
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
  documentId,
} from 'firebase/firestore';
import { updateProfile as updateAuthProfile, type User as FirebaseUserType } from 'firebase/auth';
import type { z } from 'zod';
import { db, auth } from './firebase';
import type { Server, Game, ServerStatus, UserProfile, SortOption, VotedServerInfo } from './types';
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
    } else if (firebaseErrorCode === 'failed-precondition' && error.message && error.message.toLowerCase().includes('query requires an index')) {
      // Directly use the error.message from Firebase, as it contains the link and necessary info.
      message = `Error ${context}: ${error.message}`;
    } else if (firebaseErrorCode) {
      message += `Firebase Error (Code: ${firebaseErrorCode}): ${error.message}`;
    } else {
      message += error.message;
    }
  } else {
    message += 'An unknown error occurred.';
  }
  console.error(message, error); 
  return message; 
}

// --- User Profile Functions ---
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  if (!db) {
    throw new Error(formatFirebaseError({message: "Firestore (db) is not initialized."}, "getting user profile. Database service not available."));
  }
  try {
    const userDocRef = doc(db, 'users', uid);
    const docSnap = await getDoc(userDocRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        ...data,
        uid: docSnap.id,
        createdAt: (data.createdAt instanceof Timestamp) ? data.createdAt.toDate().toISOString() : undefined,
        emailVerified: data.emailVerified ?? false, 
      } as UserProfile;
    }
    return null;
  } catch (error) {
    throw new Error(formatFirebaseError(error, `getting user profile for UID ${uid}`));
  }
}

export async function createUserProfile(user: FirebaseUserType): Promise<UserProfile> {
  if (!db) {
    const errorMsg = "Database service not available for profile creation. (Firestore not initialized)";
    throw new Error(formatFirebaseError({ message: errorMsg }, "creating user profile"));
  }

  const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL || "hossainmdbappi701@gmail.com";
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
     if (error.code === 'permission-denied' || (error.message && error.message.toLowerCase().includes('permission denied'))) {
        const permissionDeniedMsg = `Firestore permission denied. Check your security rules for users collection. Error details: ${error.message}`;
        throw new Error(formatFirebaseError({message: permissionDeniedMsg, code: error.code}, `creating/updating user profile in Firestore for UID ${user.uid}`));
     }
     const specificMessage = formatFirebaseError(error, `creating/updating user profile in Firestore for UID ${user.uid}`);
     throw new Error(specificMessage);
  }
}

export async function updateFirebaseUserProfile(uid: string, data: Partial<Pick<UserProfile, 'displayName' | 'photoURL'>>): Promise<Partial<UserProfile>> {
  if (!auth || !db) {
    throw new Error(formatFirebaseError({message: "Authentication or Database service not available."}, "updating Firebase user profile"));
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
  status: ServerStatus | 'all' = 'approved',
  submittedByUserId?: string // New parameter
): Promise<Server[]> {
  if (!db) {
    throw new Error(formatFirebaseError({message: "Firestore (db) is not initialized."}, "getting servers. Database service not available."));
  }
  try {
    const serverCollRef = collection(db, 'servers');
    const qConstraints: QueryConstraint[] = [];
    
    if (status !== 'all') {
      qConstraints.push(where('status', '==', status));
    }
    if (gameFilter !== 'all') {
      qConstraints.push(where('game', '==', gameFilter));
    }
    if (submittedByUserId) { // Filter by submittedBy if provided
      qConstraints.push(where('submittedBy', '==', submittedByUserId));
    }


    let baseOrderByField: keyof Server = 'votes';
    let baseOrderByDirection: 'asc' | 'desc' = 'desc';

    switch (sortBy) {
      case 'votes':
        baseOrderByField = 'votes';
        baseOrderByDirection = 'desc';
        break;
      case 'playerCount':
        // For player count, we also want online servers first.
        // Firestore requires the first orderBy to match the inequality filter if any.
        // If no inequality filter on 'isOnline', we can sort by 'isOnline' then 'playerCount'.
        qConstraints.push(orderBy('isOnline', 'desc')); 
        baseOrderByField = 'playerCount'; 
        baseOrderByDirection = 'desc';
        break;
      case 'name':
        baseOrderByField = 'name';
        baseOrderByDirection = 'asc';
        break;
      case 'submittedAt':
        baseOrderByField = 'submittedAt';
        baseOrderByDirection = 'desc';
        break;
      default: 
        baseOrderByField = 'votes';
        baseOrderByDirection = 'desc';
    }
    
    qConstraints.push(orderBy(baseOrderByField, baseOrderByDirection));
    
    const q = query(serverCollRef, ...qConstraints);
    
    const serverSnapshot = await getDocs(q);
    let serverList = serverSnapshot.docs.map(docSnap => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        ...data,
        submittedAt: (data.submittedAt instanceof Timestamp) ? data.submittedAt.toDate().toISOString() : new Date(0).toISOString(),
        lastVotedAt: (data.lastVotedAt instanceof Timestamp) ? data.lastVotedAt.toDate().toISOString() : undefined,
      } as Server;
    });

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
    
    // Client-side sort for player count if primary sort was `isOnline` then `playerCount`
    // This is now handled by Firestore if the index `isOnline DESC, playerCount DESC` exists.
    // If sortBy is playerCount, Firestore already sorts by isOnline desc, then playerCount desc.
    // No need for additional client-side sort for this specific case if indexes are set up.

    return serverList;
  } catch (error) {
    throw new Error(formatFirebaseError(error, "fetching servers"));
  }
}

export async function getFirebaseServerById(id: string): Promise<Server | null> {
   if (!db) {
    throw new Error(formatFirebaseError({message: "Firestore (db) is not initialized."}, "getting server by ID. Database service not available."));
  }
  try {
    const serverDocRef = doc(db, 'servers', id);
    const docSnap = await getDoc(serverDocRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        ...data,
        submittedAt: (data.submittedAt instanceof Timestamp) ? data.submittedAt.toDate().toISOString() : new Date(0).toISOString(),
        lastVotedAt: (data.lastVotedAt instanceof Timestamp) ? data.lastVotedAt.toDate().toISOString() : undefined,
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
    throw new Error(formatFirebaseError({message: "Firestore (db) is not initialized."}, "adding Firebase server. Database service not available."));
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
      submittedAt: (finalData.submittedAt instanceof Timestamp) ? finalData.submittedAt.toDate().toISOString() : new Date(0).toISOString(),
      lastVotedAt: (finalData.lastVotedAt instanceof Timestamp) ? finalData.lastVotedAt.toDate().toISOString() : undefined,
     } as Server;
  } catch (error) {
    throw new Error(formatFirebaseError(error, "adding Firebase server"));
  }
}

export async function voteForFirebaseServer(id: string, userId: string): Promise<Server | null> {
  if (!db || !auth) { 
    throw new Error(formatFirebaseError({message: "Database or Authentication service not available."}, "voting for server."));
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
        submittedAt: (data.submittedAt instanceof Timestamp) ? data.submittedAt.toDate().toISOString() : new Date(0).toISOString(),
        lastVotedAt: (data.lastVotedAt instanceof Timestamp) ? data.lastVotedAt.toDate().toISOString() : undefined,
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
    throw new Error(formatFirebaseError({message: "Firestore (db) is not initialized."}, "updating server status. Database service not available."));
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
        submittedAt: (data.submittedAt instanceof Timestamp) ? data.submittedAt.toDate().toISOString() : new Date(0).toISOString(),
        lastVotedAt: (data.lastVotedAt instanceof Timestamp) ? data.lastVotedAt.toDate().toISOString() : undefined,
      } as Server;
    }
    return null;
  } catch (error) {
    throw new Error(formatFirebaseError(error, `updating server status (${id} to ${status})`));
  }
}

export async function deleteFirebaseServer(id: string): Promise<void> {
  if (!db) {
    throw new Error(formatFirebaseError({message: "Firestore (db) is not initialized."}, "deleting server. Database service not available."));
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
  // Simulate fetching games from Firestore if they were dynamic
  // For now, returning static list
  // if (!db) {
  //   throw new Error(formatFirebaseError({message: "Firestore (db) is not initialized."}, "getting games. Database service not available."));
  // }
  // try {
  //   const gamesSnapshot = await getDocs(collection(db, "games"));
  //   return gamesSnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as Game));
  // } catch (error) {
  //   console.error("Error fetching games from Firestore, returning static list:", error);
  //   return [...staticGames]; // Fallback to static list on error
  // }
  return Promise.resolve([...staticGames]);
}


// Admin: Get all users
export async function getAllFirebaseUsers(): Promise<UserProfile[]> {
  if (!db) {
    throw new Error(formatFirebaseError({message: "Firestore (db) is not initialized."}, "getting all users. Database service not available."));
  }
  try {
    const usersSnapshot = await getDocs(collection(db, "users"));
    return usersSnapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
            ...data,
            uid: docSnap.id, 
            createdAt: (data.createdAt instanceof Timestamp) ? data.createdAt.toDate().toISOString() : undefined, 
            emailVerified: data.emailVerified ?? false,
        } as UserProfile
    });
  } catch (error) {
    throw new Error(formatFirebaseError(error, "fetching all users"));
  }
}

// Admin: Update user role
export async function updateUserFirebaseRole(uid: string, role: 'user' | 'admin'): Promise<void> {
   if (!db) {
    throw new Error(formatFirebaseError({message: "Firestore (db) is not initialized."}, "updating user role. Database service not available."));
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
    throw new Error(formatFirebaseError({message: "Firestore (db) is not initialized."}, "deleting user Firestore data. Database service not available."));
  }
  try {
    const batch = writeBatch(db);
    const userDocRef = doc(db, 'users', uid);
    batch.delete(userDocRef);

    // Also delete their votes subcollection if it exists
    const votesCollectionRef = collection(db, 'users', uid, 'votes');
    const votesSnapshot = await getDocs(votesCollectionRef);
    votesSnapshot.docs.forEach(voteDoc => batch.delete(voteDoc.ref));
    
    await batch.commit();
  } catch (error) {
    throw new Error(formatFirebaseError(error, `deleting Firestore data for user (${uid})`));
  }
}


export async function getServerOnlineStatus(ipAddress: string, port: number): Promise<{isOnline: boolean, playerCount?: number, maxPlayers?: number}> {
    // In a real app, this would use a Steam Query library or similar.
    // For now, using the mock.
    return fetchMockServerStats(ipAddress, port);
}

// --- Admin Dashboard Stats ---
export async function getServersCountByStatus(status?: ServerStatus | 'all'): Promise<number> {
  if (!db) {
    throw new Error(formatFirebaseError({message: "Firestore (db) is not initialized."}, "getting server count by status. Database service not available."));
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
    throw new Error(formatFirebaseError({message: "Firestore (db) is not initialized."}, "getting user count. Database service not available."));
  }
  try {
    const snapshot = await getDocs(collection(db, 'users'));
    return snapshot.size;
  } catch (error) {
    throw new Error(formatFirebaseError(error, "fetching users count"));
  }
}

// This function would ideally run on a schedule (e.g., Cloud Function) or be triggered
// but for simplicity, it can be called when viewing server details or lists if needed.
export async function updateServerStatsInFirestore(serverId: string): Promise<void> {
  if (!db) {
    // console.warn("updateServerStatsInFirestore: Firestore (db) is not initialized. Skipping stat update.");
    return;
  }
  const serverRef = doc(db, 'servers', serverId);
  const serverSnap = await getDoc(serverRef);

  if (!serverSnap.exists()) {
    // console.warn(`updateServerStatsInFirestore: Server ${serverId} not found. Skipping stat update.`);
    return;
  }

  const serverData = serverSnap.data() as Server;
  if(serverData.status !== 'approved') return; // Only update stats for approved servers

  try {
    const liveStats = await getServerOnlineStatus(serverData.ipAddress, serverData.port);
    await updateDoc(serverRef, {
      isOnline: liveStats.isOnline,
      playerCount: liveStats.playerCount ?? 0,
      maxPlayers: liveStats.maxPlayers ?? serverData.maxPlayers, // Keep existing maxPlayers if new one is undefined
    });
  } catch (error) {
    console.error(formatFirebaseError(error, `updating stats for server ${serverId} in Firestore`));
    // If stat fetching fails, mark as offline
    await updateDoc(serverRef, {
      isOnline: false,
      playerCount: 0,
    }).catch(e => console.error(formatFirebaseError(e, `marking server ${serverId} offline after stat update error`)));
  }
}

// This function could be used to periodically refresh server listings with live stats.
// However, calling this for every server on every page load might be expensive.
// Better to update stats individually or via background process.
export async function fetchAndRefreshServerListings(
  gameFilter: string = 'all', 
  sortBy: SortOption = 'votes', 
  searchTerm: string = ''
): Promise<Server[]> {
  const servers = await getFirebaseServers(gameFilter, sortBy, searchTerm, 'approved');
  // For each server, you could fetch live stats. This is an N+1 problem if not careful.
  // const serversWithLiveStats = await Promise.all(
  //   servers.map(async (server) => {
  //     if (server.status === 'approved') {
  //       const liveStats = await getServerOnlineStatus(server.ipAddress, server.port);
  //       return { ...server, ...liveStats };
  //     }
  //     return server;
  //   })
  // );
  // return serversWithLiveStats;
  return servers; // Return without live refresh for now to avoid performance issues on list view
}


export async function getUserVotedServerDetails(userId: string): Promise<VotedServerInfo[]> {
  if (!db) {
    throw new Error(formatFirebaseError({ message: "Firestore (db) is not initialized." }, "getting user voted servers. Database service not available."));
  }
  try {
    const votesColRef = collection(db, 'users', userId, 'votes');
    const votesSnapshot = await getDocs(votesColRef);

    if (votesSnapshot.empty) {
      return [];
    }

    const votedServerEntries = votesSnapshot.docs.map(docSnap => ({
      serverId: docSnap.id,
      votedAt: (docSnap.data().votedAt as Timestamp).toDate().toISOString(),
    }));

    const serverIds = votedServerEntries.map(entry => entry.serverId);
    const votedServersDetails: VotedServerInfo[] = [];

    // Firestore 'in' query limit is 30 items. Batch if necessary.
    const batchSize = 30;
    for (let i = 0; i < serverIds.length; i += batchSize) {
      const serverIdsBatch = serverIds.slice(i, i + batchSize);
      if (serverIdsBatch.length === 0) continue;

      const serversQuery = query(collection(db, 'servers'), where(documentId(), 'in', serverIdsBatch));
      const serversSnapshot = await getDocs(serversQuery);

      serversSnapshot.forEach(serverDoc => {
        const serverData = serverDoc.data() as Server;
        const voteEntry = votedServerEntries.find(entry => entry.serverId === serverDoc.id);
        if (voteEntry) {
          votedServersDetails.push({
            server: {
              id: serverDoc.id,
              ...serverData,
              submittedAt: (serverData.submittedAt instanceof Timestamp) ? serverData.submittedAt.toDate().toISOString() : new Date(0).toISOString(),
              lastVotedAt: (serverData.lastVotedAt instanceof Timestamp) ? serverData.lastVotedAt.toDate().toISOString() : undefined,
            },
            votedAt: voteEntry.votedAt,
          });
        }
      });
    }
    
    // Sort by most recent vote
    votedServersDetails.sort((a, b) => new Date(b.votedAt).getTime() - new Date(a.votedAt).getTime());

    return votedServersDetails;
  } catch (error) {
    throw new Error(formatFirebaseError(error, `fetching voted server details for user ${userId}`));
  }
}

// Function to initialize games in Firestore (run once or as needed by admin)
export async function initializeStaticGamesInFirestore() {
  if (!db) {
    console.error("Firestore (db) is not initialized. Cannot initialize games.");
    return;
  }
  try {
    const gamesCollectionRef = collection(db, 'games');
    const batch = writeBatch(db);
    
    // Check if games already exist to avoid duplicates (simple check by ID)
    const existingGamesSnapshot = await getDocs(query(gamesCollectionRef, where(documentId(), 'in', staticGames.map(g => g.id))));
    const existingGameIds = new Set(existingGamesSnapshot.docs.map(doc => doc.id));

    staticGames.forEach(game => {
      if (!existingGameIds.has(game.id)) {
        const gameDocRef = doc(gamesCollectionRef, game.id); // Use predefined ID
        batch.set(gameDocRef, { name: game.name });
      }
    });
    await batch.commit();
    console.log("Static games initialized/updated in Firestore.");
  } catch (error) {
    console.error("Error initializing static games in Firestore:", formatFirebaseError(error, "initializing games"));
  }
}
// Example: Call this once if needed, e.g., from an admin utility or on app startup (carefully)
// initializeStaticGamesInFirestore();
