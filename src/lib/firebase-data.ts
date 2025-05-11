
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
import { serverFormSchema } from '@/lib/schemas'; // Import schema type from new location

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
    console.error("Error getting user profile:", error);
    return null;
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
    
    // For returning, convert serverTimestamp to an actual date for consistency if needed by client immediately
    const createdProfileForReturn: UserProfile = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        role: role,
        createdAt: new Date().toISOString() // Approximate, actual value is on server
    };
    return createdProfileForReturn;

  } catch (error: any) {
     console.error(`Error creating/updating user profile in Firestore for UID: ${user.uid}:`, error);
     let specificMessage = "Could not save user profile to database.";
     if (error instanceof Error) {
        const firebaseErrorCode = (error as any).code;
        if (firebaseErrorCode === 'permission-denied') {
          specificMessage = "Firestore permission denied. Check your security rules for users collection.";
        } else if (firebaseErrorCode) {
            specificMessage += ` (Firebase Error Code: ${firebaseErrorCode}, Message: ${error.message})`;
        } else {
            specificMessage += ` (Details: ${error.message})`;
        }
     }
     throw new Error(specificMessage);
  }
}

export async function updateFirebaseUserProfile(uid: string, data: Partial<Pick<UserProfile, 'displayName' | 'photoURL'>>): Promise<Partial<UserProfile>> {
  if (!auth || !db) {
    console.error("Firebase Auth or Firestore is not initialized for updateFirebaseUserProfile.");
    throw new Error("Authentication or Database service not available.");
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
    console.error(`Error updating user profile for UID: ${uid}:`, error);
    throw new Error(error.message || "Failed to update user profile.");
  }
}


// --- Server Functions ---
export type ServerDataForCreation = Omit<z.infer<typeof serverFormSchema>, 'tags' | 'port'> & {
  tags: string[];
  port: number; // Ensure port is number
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

    // Primary sort from Firestore
    if (sortBy === 'playerCount') {
      // This will be less effective if isOnline/playerCount are not frequently updated in Firestore.
      // We will do a client-side sort refinement later for this.
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
      // Default to votes
      queryConstraints.push(orderBy(orderByField, orderDirection));
    }
    
    const q = query(serverCollRef, ...queryConstraints);
    
    const serverSnapshot = await getDocs(q);
    let serverList = serverSnapshot.docs.map(docSnap => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        ...data,
        // Ensure dates are consistently strings
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
    
    // Refined sort for playerCount after fetching, especially if live stats are not in Firestore
    if (sortBy === 'playerCount') {
       serverList.sort((a, b) => {
        if (a.isOnline && !b.isOnline) return -1;
        if (!a.isOnline && b.isOnline) return 1;
        if (a.isOnline && b.isOnline) {
          return (b.playerCount ?? 0) - (a.playerCount ?? 0);
        }
        // If both offline or status unknown, maintain Firestore's order or fallback to votes/name
        return (b.votes ?? 0) - (a.votes ?? 0); 
      });
    }

    return serverList;
  } catch (error) {
    console.error("Error fetching servers:", error);
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
    console.error(`Error fetching server by ID (${id}):`, error);
    return null;
  }
}

export async function addFirebaseServer(
  serverData: ServerDataForCreation 
): Promise<Server> {
   if (!db) {
    console.error("Firestore (db) is not initialized for addFirebaseServer.");
    throw new Error("Database service not available.");
  }

  const initialStats = await fetchMockServerStats(serverData.ipAddress, serverData.port);
  
  const newServerData = {
    ...serverData, // Spread validated and processed data from action
    votes: 0,
    submittedAt: serverTimestamp() as FieldValue,
    playerCount: initialStats.playerCount ?? 0,
    maxPlayers: initialStats.maxPlayers ?? 50, // Default if mock returns undefined
    isOnline: initialStats.isOnline ?? false, // Default if mock returns undefined
    status: 'pending' as ServerStatus,
    lastVotedAt: null, // Initialize lastVotedAt
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
    console.error("Error adding Firebase server:", error);
    throw new Error("Failed to save server to database.");
  }
}

export async function voteForFirebaseServer(id: string, userId: string): Promise<Server | null> {
  if (!db || !auth) { 
    console.error("Firestore (db) or Auth is not initialized. Cannot vote.");
    throw new Error("Database or Authentication service not available.");
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
    // Vote cooldown: 24 hours (e.g.)
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
    console.error(`Error voting for server (${id}):`, error);
    if (error instanceof Error) throw error; 
    throw new Error("An unexpected error occurred while voting.");
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
    console.error(`Error updating server status (${id} to ${status}):`, error);
    return null;
  }
}

export async function deleteFirebaseServer(id: string): Promise<void> {
  if (!db) {
    console.error("Firestore (db) is not initialized. Cannot delete server.");
    throw new Error("Database service not available for server deletion.");
  }
  try {
    const serverDocRef = doc(db, 'servers', id);
    await deleteDoc(serverDocRef);
    // Consider deleting associated votes from user subcollections if necessary (more complex)
  } catch (error) {
    console.error(`Error deleting server (${id}):`, error);
    throw new Error("Failed to delete server from database.");
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
  // For now, returning static list. Could be fetched from Firestore if games are dynamic.
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
    console.error("Error fetching all users:", error);
    return [];
  }
}

// Admin: Update user role
export async function updateUserFirebaseRole(uid: string, role: 'user' | 'admin'): Promise<void> {
   if (!db) {
    console.error("Firestore (db) is not initialized. Cannot update user role.");
    throw new Error("Database service not available for role update.");
  }
  try {
    const userDocRef = doc(db, 'users', uid);
    await updateDoc(userDocRef, { role });
  } catch (error) {
    console.error(`Error updating role for user (${uid} to ${role}):`, error);
    throw new Error("Failed to update user role in database.");
  }
}

// Admin: Delete user (data from Firestore, not Firebase Auth user itself for safety from client-side)
export async function deleteFirebaseUserFirestoreData(uid: string): Promise<void> {
   if (!db) {
    console.error("Firestore (db) is not initialized. Cannot delete user data.");
    throw new Error("Database service not available for user data deletion.");
  }
  try {
    const batch = writeBatch(db);
    const userDocRef = doc(db, 'users', uid);
    batch.delete(userDocRef);

    // Example: Delete user's votes (if stored under 'users/{uid}/votes')
    const votesCollectionRef = collection(db, 'users', uid, 'votes');
    const votesSnapshot = await getDocs(votesCollectionRef);
    votesSnapshot.docs.forEach(voteDoc => batch.delete(voteDoc.ref));

    // TODO: If servers are submitted by this user, decide how to handle them (e.g., reassign, mark as orphaned)
    // This would involve querying servers collection for submittedBy === uid

    await batch.commit();
  } catch (error) {
    console.error(`Error deleting Firestore data for user (${uid}):`, error);
    throw new Error("Failed to delete user data from database.");
  }
}


// This is the function used by ServerCard and ServerDetails to get "live" stats
// In a real app, this would use a proper server query mechanism (e.g. Steam Query, Game Server Query Protocol)
// For now, it continues to use fetchMockServerStats
export async function getServerOnlineStatus(ipAddress: string, port: number): Promise<{isOnline: boolean, playerCount?: number, maxPlayers?: number}> {
    // console.log(`getServerOnlineStatus called for ${ipAddress}:${port}`);
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
    console.error(`Error fetching servers count (status: ${status}):`, error);
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
    console.error("Error fetching users count:", error);
    return 0;
  }
}

// Function to update server stats in Firestore (could be run by a cron job or on demand)
// This is an example and not directly called by the UI in its current form.
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
    // console.log(`Updating Firestore stats for ${serverData.name} (${serverData.ipAddress}:${serverData.port})`);
    const liveStats = await getServerOnlineStatus(serverData.ipAddress, serverData.port);
    await updateDoc(serverRef, {
      isOnline: liveStats.isOnline,
      playerCount: liveStats.playerCount ?? 0,
      maxPlayers: liveStats.maxPlayers ?? serverData.maxPlayers, // Keep existing if undefined
      // lastChecked: serverTimestamp() // Optional: track when stats were last updated
    });
    // console.log(`Successfully updated Firestore stats for ${serverData.name}`);
  } catch (error) {
    console.error(`Error updating stats for server ${serverId} in Firestore:`, error);
    // Optionally mark server as offline or log error for this server
    await updateDoc(serverRef, {
      isOnline: false,
      playerCount: 0,
    });
  }
}
