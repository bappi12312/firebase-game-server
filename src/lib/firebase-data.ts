
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
} from 'firebase/firestore';
import { updateProfile as updateAuthProfile, type User as FirebaseUserType } from 'firebase/auth';
import type { z } from 'zod';
import { db, auth } from './firebase';
import type { Server, Game, ServerStatus, UserProfile } from './types';
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
    if (firebaseErrorCode === 'permission-denied') {
      message += "Firestore permission denied. Please check your Firestore security rules to allow this operation.";
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
    console.error("Firestore (db) is not initialized. Cannot get user profile.");
    return null;
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
    console.log(`User profile not found for UID: ${uid}`);
    return null;
  } catch (error) {
    throw new Error(formatFirebaseError(error, `getting user profile for UID ${uid}`));
  }
}

export async function createUserProfile(user: FirebaseUserType): Promise<UserProfile> {
  if (!db) {
    const errorMsg = "Database service not available for profile creation. (Firestore not initialized)";
    console.error(errorMsg);
    throw new Error(errorMsg);
  }

  const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL;
  const role: 'user' | 'admin' = (adminEmail && user.email === adminEmail) ? 'admin' : 'user';

  const userProfileData: Omit<UserProfile, 'createdAt'> & { createdAt: FieldValue } = {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
    role: role,
    createdAt: serverTimestamp(), 
  };

  try {
    const userDocRef = doc(db, 'users', user.uid);
    await setDoc(userDocRef, userProfileData, { merge: true }); 
    console.log(`User profile created/updated in Firestore for UID: ${user.uid} with role: ${role}`);
    
    const createdProfileForReturn: UserProfile = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        role: role,
        createdAt: new Date().toISOString() 
    };
    return createdProfileForReturn;

  } catch (error: any) {
     throw new Error(formatFirebaseError(error, `creating/updating user profile in Firestore for UID ${user.uid}`));
  }
}

export async function updateFirebaseUserProfile(uid: string, data: Partial<Pick<UserProfile, 'displayName' | 'photoURL'>>): Promise<Partial<UserProfile>> {
  if (!auth || !db) {
    throw new Error(formatFirebaseError(null, "Authentication or Database service not available for updateFirebaseUserProfile"));
  }
  
  const currentUser = auth.currentUser;
  if (!currentUser || currentUser.uid !== uid) {
    console.warn("updateFirebaseUserProfile: Attempting to update profile for a UID that doesn't match current auth session, or no session. Auth profile update will be skipped.");
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
    
    console.log(`User profile updated in Firestore for UID: ${uid}`);
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
  sortBy: string = 'votes', 
  searchTerm: string = '',
  status: ServerStatus | 'all' = 'approved'
): Promise<Server[]> {
   if (!db) {
    console.error("Firestore (db) is not initialized. Cannot get servers.");
    return [];
  }
  try {
    const serverCollRef = collection(db, 'servers');
    const queryConstraints = [];

    if (status !== 'all') {
      queryConstraints.push(where('status', '==', status));
    }

    if (gameFilter !== 'all') {
      queryConstraints.push(where('game', '==', gameFilter));
    }
    
    let orderByField = 'votes';
    let orderDirection: 'desc' | 'asc' = 'desc';

    if (sortBy === 'playerCount') {
      queryConstraints.push(orderBy('isOnline', 'desc')); 
      queryConstraints.push(orderBy('playerCount', 'desc'));
    } else if (sortBy === 'name') {
      orderByField = 'name';
      orderDirection = 'asc';
      queryConstraints.push(orderBy(orderByField, orderDirection));
    } else if (sortBy === 'submittedAt') {
      orderByField = 'submittedAt';
      orderDirection = 'desc';
      queryConstraints.push(orderBy(orderByField, orderDirection));
    } else { 
      queryConstraints.push(orderBy(orderByField, orderDirection));
    }
    
    const q = query(serverCollRef, ...queryConstraints);
    
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
    
    if (sortBy === 'playerCount') {
       serverList.sort((a, b) => {
        if (a.isOnline && !b.isOnline) return -1;
        if (!a.isOnline && b.isOnline) return 1;
        if (a.isOnline && b.isOnline) {
          return (b.playerCount ?? 0) - (a.playerCount ?? 0);
        }
        return (b.votes ?? 0) - (a.votes ?? 0); 
      });
    }

    return serverList;
  } catch (error) {
    console.error(formatFirebaseError(error, "fetching servers"));
    return [];
  }
}

export async function getFirebaseServerById(id: string): Promise<Server | null> {
   if (!db) {
    console.error("Firestore (db) is not initialized. Cannot get server by ID.");
    return null;
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
    console.error(formatFirebaseError(error, `fetching server by ID (${id})`));
    return null;
  }
}

export async function addFirebaseServer(
  serverData: ServerDataForCreation 
): Promise<Server> {
   if (!db) {
    throw new Error(formatFirebaseError(null, "Database service not available for addFirebaseServer"));
  }

  const initialStats = await fetchMockServerStats(serverData.ipAddress, serverData.port);
  
  const newServerData = {
    ...serverData, 
    votes: 0,
    submittedAt: serverTimestamp() as FieldValue,
    playerCount: initialStats.playerCount ?? 0,
    maxPlayers: initialStats.maxPlayers ?? 50, 
    isOnline: initialStats.isOnline ?? false, 
    status: 'pending' as ServerStatus,
    lastVotedAt: null, 
  };
  
  try {
    const docRef = await addDoc(collection(db, 'servers'), newServerData);
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
    if (error instanceof Error && error.message.startsWith("You've voted")) throw error; // Re-throw specific cooldown error
    throw new Error(formatFirebaseError(error, `voting for server (${id})`));
  }
}

export async function updateFirebaseServerStatus(id: string, status: ServerStatus): Promise<Server | null> {
  if (!db) {
    console.error("Firestore (db) is not initialized. Cannot update server status.");
    return null;
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
    console.error(formatFirebaseError(error, `updating server status (${id} to ${status})`));
    return null;
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
    console.error("Firestore (db) is not initialized. Cannot get all users.");
    return [];
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
    console.error(formatFirebaseError(error, "fetching all users"));
    return [];
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
    console.error("Firestore (db) is not initialized. Cannot get servers count.");
    return 0;
  }
  try {
    let q = query(collection(db, 'servers'));
    if (status && status !== 'all') {
      q = query(q, where('status', '==', status));
    }
    const snapshot = await getDocs(q);
    return snapshot.size;
  } catch (error) {
    console.error(formatFirebaseError(error, `fetching servers count (status: ${status})`));
    return 0;
  }
}

export async function getUsersCount(): Promise<number> {
  if (!db) {
    console.error("Firestore (db) is not initialized. Cannot get users count.");
    return 0;
  }
  try {
    const snapshot = await getDocs(collection(db, 'users'));
    return snapshot.size;
  } catch (error) {
    console.error(formatFirebaseError(error, "fetching users count"));
    return 0;
  }
}

export async function updateServerStatsInFirestore(serverId: string): Promise<void> {
  if (!db) {
    console.error("Firestore (db) is not initialized. Cannot update server stats.");
    return;
  }
  const serverRef = doc(db, 'servers', serverId);
  const serverSnap = await getDoc(serverRef);

  if (!serverSnap.exists()) {
    console.error(`Server ${serverId} not found for stats update.`);
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
    console.error(formatFirebaseError(error, `updating stats for server ${serverId} in Firestore`));
    await updateDoc(serverRef, {
      isOnline: false,
      playerCount: 0,
    });
  }
}

