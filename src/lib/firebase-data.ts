
import {
  collection,
  addDoc,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  increment,
  query,
  orderBy,
  limit,
  where,
  serverTimestamp,
  Timestamp,
  deleteDoc,
  writeBatch,
  setDoc,
  type FieldValue,
  type QueryConstraint,
} from 'firebase/firestore';
import { updateProfile as updateAuthProfile, type User as FirebaseUserType } from 'firebase/auth';
import type { z } from 'zod';
import { db, auth } from './firebase';
import type { Server, Game, ServerStatus, UserProfile, SortOption } from './types';
import { serverFormSchema } from '@/lib/schemas'; 

// Simulate fetching server stats (mock for now, replace with actual Steam Query or similar)
export async function fetchMockServerStats(ipAddress: string, port: number): Promise<Partial<Server>> {
  // console.log(`Mock fetching stats for ${ipAddress}:${port}`);
  await new Promise(resolve => setTimeout(resolve, Math.random() * 500 + 200)); 
  const isOnline = Math.random() > 0.2; 
  return {
    isOnline,
    playerCount: isOnline ? Math.floor(Math.random() * 50) : 0,
    maxPlayers: 50 + Math.floor(Math.random() * 50),
  };
}

function formatFirebaseError(error: any, context: string): string {
  let message = `Error ${context}: `;
  if (error instanceof Error) {
    const firebaseErrorCode = (error as any).code;
    if (firebaseErrorCode === 'permission-denied' || (error.message && error.message.toLowerCase().includes('permission denied'))) {
      message += `Firestore permission denied. Please check your Firestore security rules to allow this operation. (Original message: ${error.message})`;
    } else if (firebaseErrorCode === 'failed-precondition' && error.message && error.message.toLowerCase().includes('index')) {
      message += `Firestore query requires an index. Please create it in the Firebase console. (Original message: ${error.message})`;
    }
     else if (firebaseErrorCode) {
      message += `Firebase Error (Code: ${firebaseErrorCode}): ${error.message}`;
    } else {
      message += error.message;
    }
  } else {
    message += 'An unknown error occurred.';
  }
  console.error(message, error); // Keep console.error for server logs
  return message; // Return the formatted message for UI display
}

// --- User Profile Functions ---
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  if (!db) {
    // console.error("Firestore (db) is not initialized. Cannot get user profile.");
    throw new Error(formatFirebaseError(null, "Database service not available. Firestore (db) is not initialized. Cannot get user profile."));
  }
  try {
    const userDocRef = doc(db, 'users', uid);
    const docSnap = await getDoc(userDocRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        ...data,
        uid: docSnap.id,
        createdAt: (data.createdAt as Timestamp)?.toDate().toISOString() ?? undefined,
      } as UserProfile;
    }
    // console.log(`User profile not found for UID: ${uid}`);
    return null;
  } catch (error) {
    throw new Error(formatFirebaseError(error, `getting user profile for UID ${uid}`));
  }
}

export async function createUserProfile(user: FirebaseUserType): Promise<UserProfile> {
  if (!db) {
    const errorMsg = "Database service not available for profile creation. (Firestore not initialized)";
    // console.error(errorMsg);
    throw new Error(formatFirebaseError(null, errorMsg));
  }

  const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL;
  const role: 'user' | 'admin' = (adminEmail && user.email === adminEmail) ? 'admin' : 'user';

  const userProfileData: Omit<UserProfile, 'createdAt' | 'emailVerified'> & { createdAt: FieldValue; emailVerified: boolean } = {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
    role: role,
    createdAt: serverTimestamp(),
    emailVerified: user.emailVerified,
  };

  try {
    const userDocRef = doc(db, 'users', user.uid);
    await setDoc(userDocRef, userProfileData, { merge: true }); 
    // console.log(`User profile created/updated in Firestore for UID: ${user.uid} with role: ${role}`);
    
    const createdProfileForReturn: UserProfile = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        role: role,
        createdAt: new Date().toISOString(),
        emailVerified: user.emailVerified,
    };
    return createdProfileForReturn;

  } catch (error: any) {
     const specificMessage = formatFirebaseError(error, `creating/updating user profile in Firestore for UID ${user.uid}`);
     throw new Error(specificMessage);
  }
}

export async function updateFirebaseUserProfile(uid: string, data: Partial<Pick<UserProfile, 'displayName' | 'photoURL'>>): Promise<Partial<UserProfile>> {
  if (!auth || !db) {
    throw new Error(formatFirebaseError(null, "Authentication or Database service not available for updateFirebaseUserProfile"));
  }
  
  const currentUser = auth.currentUser;
  if (!currentUser || currentUser.uid !== uid) {
    // console.warn("updateFirebaseUserProfile: Attempting to update profile for a UID that doesn't match current auth session, or no session. Auth profile update will be skipped.");
  }

  const updates: Partial<UserProfile> = {};
  if (data.displayName !== undefined) {
    updates.displayName = data.displayName;
  }
  if (data.photoURL !== undefined) { 
    updates.photoURL = data.photoURL;
  }

  try {
    if (currentUser && currentUser.uid === uid && Object.keys(updates).length > 0) {
      await updateAuthProfile(currentUser, updates);
    }

    const userDocRef = doc(db, 'users', uid);
    await updateDoc(userDocRef, updates);
    
    // console.log(`User profile updated in Firestore for UID: ${uid}`);
    return updates; 
  } catch (error: any) {
    throw new Error(formatFirebaseError(error, `updating user profile for UID ${uid}`));
  }
}


// --- Server Functions ---
export type ServerDataForCreation = Omit<z.infer<typeof serverFormSchema>, 'tags' | 'port'> & {
  tags: string[];
  port: number; 
  submittedBy: string;
};


export async function getFirebaseServers(
  gameFilter: string = 'all',
  sortBy: SortOption = 'votes',
  searchTerm: string = '',
  status: ServerStatus | 'all' = 'approved'
): Promise<Server[]> {
  if (!db) {
    // console.error("Firestore (db) is not initialized. Cannot get servers.");
    throw new Error(formatFirebaseError(null, "Database service not available. Firestore (db) is not initialized. Cannot get servers."));
  }
  try {
    const serverCollRef = collection(db, 'servers');
    const qConstraints: QueryConstraint[] = [];
    let performClientSideSortForVotes = false;

    // Apply filters
    if (status !== 'all') {
      qConstraints.push(where('status', '==', status));
    }
    if (gameFilter !== 'all') {
      qConstraints.push(where('game', '==', gameFilter));
    }

    // Determine orderBy strategy
    if (sortBy === 'votes' && (status !== 'all' || gameFilter !== 'all')) {
      // If filtering by status or game AND sorting by votes,
      // order by a default field in Firestore (e.g., __name__ or submittedAt)
      // and then sort by votes in JS. This avoids needing a specific composite index
      // for (status/game, votes) immediately.
      // Other composite indexes might still be required for (status/game, __name__/submittedAt).
      qConstraints.push(orderBy('__name__', 'asc')); // Using document ID for ordering
      performClientSideSortForVotes = true;
    } else if (sortBy === 'playerCount') {
      // This combination (filters + isOnline + playerCount) WILL require a composite index.
      // e.g., status ASC, isOnline DESC, playerCount DESC
      qConstraints.push(orderBy('isOnline', 'desc'));
      qConstraints.push(orderBy('playerCount', 'desc'));
    } else if (sortBy === 'name') {
      // This combination (filters + name) WILL require a composite index.
      // e.g., status ASC, name ASC
      qConstraints.push(orderBy('name', 'asc'));
    } else if (sortBy === 'submittedAt') {
      // This combination (filters + submittedAt) WILL require a composite index.
      // e.g., status ASC, submittedAt DESC
      qConstraints.push(orderBy('submittedAt', 'desc'));
    } else if (sortBy === 'votes') { // This handles 'votes' sort when no status/game filter is active.
      qConstraints.push(orderBy('votes', 'desc')); // Uses single-field index on votes.
    } else { // Fallback, should not happen if SortOption type is adhered to.
      qConstraints.push(orderBy('votes', 'desc'));
    }
    
    const q = query(serverCollRef, ...qConstraints);
    
    const serverSnapshot = await getDocs(q);
    let serverList = serverSnapshot.docs.map(docSnap => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        ...data,
        submittedAt: (data.submittedAt as Timestamp)?.toDate().toISOString() || new Date(0).toISOString(),
        lastVotedAt: (data.lastVotedAt as Timestamp)?.toDate()?.toISOString(),
      } as Server;
    });

    if (performClientSideSortForVotes) {
      serverList.sort((a, b) => (b.votes ?? 0) - (a.votes ?? 0));
    }

    // Apply searchTerm filter (client-side after fetch)
    if (searchTerm) {
      const lowerSearchTerm = searchTerm.toLowerCase();
      serverList = serverList.filter(
        (server) =>
          server.name.toLowerCase().includes(lowerSearchTerm) ||
          server.ipAddress.toLowerCase().includes(lowerSearchTerm) ||
          (server.game && server.game.toLowerCase().includes(lowerSearchTerm)) ||
          (server.tags && server.tags.some(tag => tag.toLowerCase().includes(lowerSearchTerm)))
      );
    }
    
    // Refined sort for playerCount (applied client-side after fetch)
    // This ensures online servers are prioritized, then by player count, then by votes as fallback.
    if (sortBy === 'playerCount') {
       serverList.sort((a, b) => {
        if (a.isOnline && !b.isOnline) return -1;
        if (!a.isOnline && b.isOnline) return 1;
        // If both have same online status (both online or both offline)
        if (a.isOnline === b.isOnline) {
          if (a.isOnline) { // Both online, sort by player count
            return (b.playerCount ?? 0) - (a.playerCount ?? 0);
          }
          // Both offline, can sort by votes or other criteria
           return (b.votes ?? 0) - (a.votes ?? 0);
        }
        // Should not reach here due to initial checks, but as a fallback:
        return (b.votes ?? 0) - (a.votes ?? 0); 
      });
    }

    return serverList;
  } catch (error) {
    throw new Error(formatFirebaseError(error, "fetching servers"));
  }
}

export async function getFirebaseServerById(id: string): Promise<Server | null> {
   if (!db) {
    // console.error("Firestore (db) is not initialized. Cannot get server by ID.");
    throw new Error(formatFirebaseError(null, "Database service not available. Firestore (db) is not initialized. Cannot get server by ID."));
  }
  try {
    const serverDocRef = doc(db, 'servers', id);
    const docSnap = await getDoc(serverDocRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        ...data,
        submittedAt: (data.submittedAt as Timestamp)?.toDate().toISOString() || new Date(0).toISOString(),
        lastVotedAt: (data.lastVotedAt as Timestamp)?.toDate().toISOString(),
      } as Server;
    } else {
      return null;
    }
  } catch (error) {
    throw new Error(formatFirebaseError(error, `fetching server by ID (${id})`));
  }
}

export async function addFirebaseServer(
  serverDataInput: ServerDataForCreation 
): Promise<Server> {
   if (!db) {
    throw new Error(formatFirebaseError(null, "Database service not available for addFirebaseServer"));
  }

  const initialStats = await fetchMockServerStats(serverDataInput.ipAddress, serverDataInput.port);
  
  const dataToSave: { [key: string]: any } = {
    name: serverDataInput.name,
    ipAddress: serverDataInput.ipAddress,
    port: serverDataInput.port,
    game: serverDataInput.game,
    description: serverDataInput.description,
    tags: serverDataInput.tags && serverDataInput.tags.length > 0 ? serverDataInput.tags : [],
    votes: 0,
    submittedAt: serverTimestamp() as FieldValue,
    playerCount: initialStats.playerCount ?? 0,
    maxPlayers: initialStats.maxPlayers ?? 50, 
    isOnline: initialStats.isOnline ?? false, 
    status: 'pending' as ServerStatus,
    lastVotedAt: null, 
    submittedBy: serverDataInput.submittedBy,
    bannerUrl: (serverDataInput.bannerUrl && serverDataInput.bannerUrl.trim() !== '') ? serverDataInput.bannerUrl : null,
    logoUrl: (serverDataInput.logoUrl && serverDataInput.logoUrl.trim() !== '') ? serverDataInput.logoUrl : null,
  };
  
  try {
    const docRef = await addDoc(collection(db, 'servers'), dataToSave);
    const newDocSnap = await getDoc(docRef); 
    const finalData = newDocSnap.data();

    if (!finalData) {
        throw new Error("Failed to retrieve server data after creation.");
    }
    
    return { 
      id: docRef.id,
      ...finalData,
      submittedAt: (finalData.submittedAt as Timestamp)?.toDate().toISOString() || new Date(0).toISOString(),
      lastVotedAt: (finalData.lastVotedAt as Timestamp)?.toDate().toISOString(),
     } as Server;
  } catch (error) {
    throw new Error(formatFirebaseError(error, "adding Firebase server"));
  }
}

export async function voteForFirebaseServer(id: string, userId: string): Promise<Server | null> {
  if (!db || !auth) { 
    throw new Error(formatFirebaseError(null, "Database or Authentication service not available for voting"));
  }
  if (!userId) {
      throw new Error("User ID is required to vote.");
  }

  try {
    const serverDocRef = doc(db, 'servers', id);
    const serverSnap = await getDoc(serverDocRef);
    if (!serverSnap.exists()) {
      throw new Error("Server not found.");
    }

    const serverData = serverSnap.data();
    if (serverData.status !== 'approved') {
      throw new Error("This server is not currently approved for voting.");
    }

    const userVoteDocRef = doc(db, 'users', userId, 'votes', id);
    const userVoteSnap = await getDoc(userVoteDocRef);
    const now = Timestamp.now();
    const cooldownMs = 24 * 60 * 60 * 1000; 

    if (userVoteSnap.exists()) {
        const lastVoteTimestamp = userVoteSnap.data().votedAt as Timestamp;
        if (now.toMillis() - lastVoteTimestamp.toMillis() < cooldownMs) {
            const timeLeft = cooldownMs - (now.toMillis() - lastVoteTimestamp.toMillis());
            const hoursLeft = Math.ceil(timeLeft / (1000 * 60 * 60));
            throw new Error(`You've voted for this server recently. Please wait approximately ${hoursLeft} hour(s).`);
        }
    }

    const batch = writeBatch(db);
    batch.update(serverDocRef, {
      votes: increment(1),
      lastVotedAt: now 
    });
    batch.set(userVoteDocRef, { votedAt: now }); 

    await batch.commit();

    const updatedDocSnap = await getDoc(serverDocRef); 
    if (updatedDocSnap.exists()) {
      const data = updatedDocSnap.data();
      return {
        id: updatedDocSnap.id,
        ...data,
        submittedAt: (data.submittedAt as Timestamp)?.toDate().toISOString() || new Date(0).toISOString(),
        lastVotedAt: (data.lastVotedAt as Timestamp)?.toDate().toISOString(),
      } as Server;
    }
    return null;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("You've voted")) throw error;
    throw new Error(formatFirebaseError(error, `voting for server (${id})`));
  }
}

export async function updateFirebaseServerStatus(id: string, status: ServerStatus): Promise<Server | null> {
  if (!db) {
    // console.error("Firestore (db) is not initialized. Cannot update server status.");
    throw new Error(formatFirebaseError(null, "Database service not available. Firestore (db) is not initialized. Cannot update server status."));
  }
  try {
    const serverDocRef = doc(db, 'servers', id);
    await updateDoc(serverDocRef, { status });
    
    const updatedDocSnap = await getDoc(serverDocRef);
    if (updatedDocSnap.exists()) {
      const data = updatedDocSnap.data();
      return {
        id: updatedDocSnap.id,
        ...data,
        submittedAt: (data.submittedAt as Timestamp)?.toDate().toISOString() || new Date(0).toISOString(),
        lastVotedAt: (data.lastVotedAt as Timestamp)?.toDate().toISOString(),
      } as Server;
    }
    return null;
  } catch (error) {
    throw new Error(formatFirebaseError(error, `updating server status (${id} to ${status})`));
  }
}

export async function deleteFirebaseServer(id: string): Promise<void> {
  if (!db) {
    throw new Error(formatFirebaseError(null, "Database service not available for server deletion"));
  }
  try {
    const serverDocRef = doc(db, 'servers', id);
    await deleteDoc(serverDocRef);
  } catch (error) {
    throw new Error(formatFirebaseError(error, `deleting server (${id})`));
  }
}


// --- Game Functions ---
const staticGames: Game[] = [
  { id: 'mc', name: 'Minecraft' },
  { id: 'val', name: 'Valheim' },
  { id: 'csgo', name: 'Counter-Strike: GO' },
  { id: 'rust', name: 'Rust' },
  { id: 'ark', name: 'ARK: Survival Evolved' },
  { id: 'tf2', name: 'Team Fortress 2' },
  { id: 'gmod', name: 'Garry\'s Mod' },
  { id: 'terraria', name: 'Terraria' },
  { id: 'factorio', name: 'Factorio' },
  { id: 'satisfactory', name: 'Satisfactory' },
  { id: 'dst', name: 'Don\'t Starve Together' },
  { id: 'eco', name: 'Eco' },
  { id: 'arma3', name: 'Arma 3' },
  { id: 'dayz', name: 'DayZ' },
  { id: 'squad', name: 'Squad' },
  { id: 'other', name: 'Other Game' },
];

export async function getFirebaseGames(): Promise<Game[]> {
  return Promise.resolve([...staticGames]);
}


// Admin: Get all users
export async function getAllFirebaseUsers(): Promise<UserProfile[]> {
  if (!db) {
    // console.error("Firestore (db) is not initialized. Cannot get all users.");
    throw new Error(formatFirebaseError(null, "Database service not available. Firestore (db) is not initialized. Cannot get all users."));
  }
  try {
    const usersSnapshot = await getDocs(collection(db, "users"));
    return usersSnapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
            ...data,
            uid: docSnap.id, 
            createdAt: (data.createdAt as Timestamp)?.toDate().toISOString() ?? undefined, 
        } as UserProfile
    });
  } catch (error) {
    throw new Error(formatFirebaseError(error, "fetching all users"));
  }
}

// Admin: Update user role
export async function updateUserFirebaseRole(uid: string, role: 'user' | 'admin'): Promise<void> {
   if (!db) {
    throw new Error(formatFirebaseError(null, "Database service not available for role update"));
  }
  try {
    const userDocRef = doc(db, 'users', uid);
    await updateDoc(userDocRef, { role });
  } catch (error) {
    throw new Error(formatFirebaseError(error, `updating role for user (${uid} to ${role})`));
  }
}

// Admin: Delete user (data from Firestore, not Firebase Auth user itself for safety from client-side)
export async function deleteFirebaseUserFirestoreData(uid: string): Promise<void> {
   if (!db) {
    throw new Error(formatFirebaseError(null, "Database service not available for user data deletion"));
  }
  try {
    const batch = writeBatch(db);
    const userDocRef = doc(db, 'users', uid);
    batch.delete(userDocRef);

    const votesCollectionRef = collection(db, 'users', uid, 'votes');
    const votesSnapshot = await getDocs(votesCollectionRef);
    votesSnapshot.docs.forEach(voteDoc => batch.delete(voteDoc.ref));

    await batch.commit();
  } catch (error) {
    throw new Error(formatFirebaseError(error, `deleting Firestore data for user (${uid})`));
  }
}


export async function getServerOnlineStatus(ipAddress: string, port: number): Promise<{isOnline: boolean, playerCount?: number, maxPlayers?: number}> {
    return fetchMockServerStats(ipAddress, port);
}

// --- Admin Dashboard Stats ---
export async function getServersCountByStatus(status?: ServerStatus | 'all'): Promise<number> {
  if (!db) {
    // console.error("Firestore (db) is not initialized. Cannot get servers count.");
    throw new Error(formatFirebaseError(null, "Database service not available. Firestore (db) is not initialized. Cannot get servers count."));
  }
  try {
    let q = query(collection(db, 'servers'));
    if (status && status !== 'all') {
      q = query(q, where('status', '==', status));
    }
    const snapshot = await getDocs(q);
    return snapshot.size;
  } catch (error) {
    throw new Error(formatFirebaseError(error, `fetching servers count (status: ${status})`));
  }
}

export async function getUsersCount(): Promise<number> {
  if (!db) {
    // console.error("Firestore (db) is not initialized. Cannot get users count.");
    throw new Error(formatFirebaseError(null, "Database service not available. Firestore (db) is not initialized. Cannot get users count."));
  }
  try {
    const snapshot = await getDocs(collection(db, 'users'));
    return snapshot.size;
  } catch (error) {
    throw new Error(formatFirebaseError(error, "fetching users count"));
  }
}

export async function updateServerStatsInFirestore(serverId: string): Promise<void> {
  if (!db) {
    // console.error("Firestore (db) is not initialized. Cannot update server stats.");
    return;
  }
  const serverRef = doc(db, 'servers', serverId);
  const serverSnap = await getDoc(serverRef);

  if (!serverSnap.exists()) {
    // console.error(`Server ${serverId} not found for stats update.`);
    return;
  }

  const serverData = serverSnap.data() as Server;
  try {
    const liveStats = await getServerOnlineStatus(serverData.ipAddress, serverData.port);
    await updateDoc(serverRef, {
      isOnline: liveStats.isOnline,
      playerCount: liveStats.playerCount ?? 0,
      maxPlayers: liveStats.maxPlayers ?? serverData.maxPlayers, 
    });
  } catch (error) {
    // console.error(formatFirebaseError(error, `updating stats for server ${serverId} in Firestore`));
    await updateDoc(serverRef, {
      isOnline: false,
      playerCount: 0,
    }).catch(e => console.error(formatFirebaseError(e, `marking server ${serverId} offline after stat update error`)));
  }
}

export async function fetchAndRefreshServerListings(
  gameFilter: string = 'all', 
  sortBy: SortOption = 'votes', 
  searchTerm: string = ''
): Promise<Server[]> {
  const servers = await getFirebaseServers(gameFilter, sortBy, searchTerm, 'approved');
  return servers;
}
