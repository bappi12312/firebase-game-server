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
import { updateProfile as updateAuthProfile, type User as FirebaseUserType } from 'firebase/auth'; // Renamed User to avoid conflict
import { db, auth } from './firebase';
import type { Server, Game, ServerStatus, UserProfile } from './types';

// Simulate fetching server stats (mock for now, replace with actual Steam Query or similar)
export async function fetchMockServerStats(ipAddress: string, port: number): Promise<Partial<Server>> {
  // console.log(`Fetching mock server stats for ${ipAddress}:${port}`);
  await new Promise(resolve => setTimeout(resolve, 300)); // Simulate network delay
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
        uid: docSnap.id, // Ensure uid is part of the returned object
        createdAt: (data.createdAt as Timestamp)?.toDate().toISOString() ?? undefined,
      } as UserProfile;
    }
    return null;
  } catch (error) {
    console.error("Error getting user profile:", error);
    return null;
  }
}

export async function createUserProfile(user: FirebaseUserType): Promise<UserProfile> {
  if (!db) {
    console.error("Firestore (db) is not initialized. Cannot create user profile.");
    throw new Error("Database service not available for profile creation. (Firestore not initialized)");
  }

  const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL;
  const role: 'user' | 'admin' = (adminEmail && user.email === adminEmail) ? 'admin' : 'user';

  const userProfileData: UserProfile = {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
    role: role,
    createdAt: serverTimestamp() as FieldValue, 
  };

  try {
    const userDocRef = doc(db, 'users', user.uid);
    await setDoc(userDocRef, userProfileData, { merge: true }); 
    console.log(`User profile created/updated in Firestore for UID: ${user.uid}`);
    
    // Return a representation of the profile, converting serverTimestamp for client-side use
    // Firestore typically returns the committed data, but serverTimestamp might still be a sentinel.
    // For immediate client use, it's often better to either re-fetch or use a client-side date.
    // However, for consistency with UserProfile type, we'll return it as is or slightly converted.
    
    const createdProfileForReturn: UserProfile = {
        ...userProfileData,
        // If we need an ISO string immediately, we'd have to fetch again or use new Date().toISOString()
        // For now, let's assume the type allows FieldValue or we handle it downstream
        // For simplicity, let's set createdAt to a new Date string for immediate use if it was a serverTimestamp
        // This is a common pattern if you don't want to re-fetch immediately.
        createdAt: new Date().toISOString() // Or handle FieldValue properly if type demands
    };
    return createdProfileForReturn;

  } catch (error: any) {
     console.error(`Error creating/updating user profile in Firestore for UID: ${user.uid}:`, error);
     let specificMessage = "Could not save user profile to database.";
     if (error instanceof Error) {
        const firebaseErrorCode = (error as any).code;
        if (firebaseErrorCode === 'permission-denied') {
          specificMessage = "Firestore permission denied. Check your security rules.";
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
    throw new Error("User not authenticated or UID mismatch.");
  }

  const updates: Partial<UserProfile> = {};
  if (data.displayName !== undefined) {
    updates.displayName = data.displayName;
  }
  if (data.photoURL !== undefined) { 
    updates.photoURL = data.photoURL;
  }

  try {
    // Update Firebase Auth profile
    if (Object.keys(updates).length > 0 && currentUser) { // Added null check for currentUser for safety
      await updateAuthProfile(currentUser, updates);
    }

    // Update Firestore profile
    const userDocRef = doc(db, 'users', uid);
    await updateDoc(userDocRef, updates);
    
    console.log(`User profile updated for UID: ${uid}`);
    return updates; 
  } catch (error: any) {
    console.error(`Error updating user profile for UID: ${uid}:`, error);
    throw new Error(error.message || "Failed to update user profile.");
  }
}


// --- Server Functions ---
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
      orderByField = 'submittedAt'; // This should be a Timestamp field for correct sorting
      orderDirection = 'desc';
      queryConstraints.push(orderBy(orderByField, orderDirection));
    } else { // Default to votes
      queryConstraints.push(orderBy(orderByField, orderDirection));
    }
    
    const q = query(serverCollRef, ...queryConstraints);
    
    const serverSnapshot = await getDocs(q);
    let serverList = serverSnapshot.docs.map(docSnap => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        ...data,
        submittedAt: (data.submittedAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
        lastVotedAt: (data.lastVotedAt as Timestamp)?.toDate()?.toISOString(),
      } as Server;
    });

    // Client-side filtering for search term if not using a dedicated search service
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
    
    // Specific sort for playerCount where offline servers are ranked lower
    if (sortBy === 'playerCount') {
      serverList.sort((a, b) => (b.isOnline && b.playerCount !== undefined ? b.playerCount : -1) - (a.isOnline && a.playerCount !== undefined ? a.playerCount : -1));
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
        submittedAt: (data.submittedAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
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
  serverData: Omit<Server, 'id' | 'votes' | 'submittedAt' | 'lastVotedAt' | 'playerCount' | 'maxPlayers' | 'isOnline' | 'submittedBy' | 'status' >
): Promise<Server> {
   if (!auth || !db) {
    console.error("Firebase Auth or Firestore is not initialized for addFirebaseServer.");
    throw new Error("Authentication or Database service not available.");
  }
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error("User must be logged in to submit a server.");
  }

  const initialStats = await fetchMockServerStats(serverData.ipAddress, serverData.port);
  
  const newServerData = {
    ...serverData,
    votes: 0,
    submittedAt: serverTimestamp() as FieldValue,
    submittedBy: currentUser.uid, 
    playerCount: initialStats.playerCount ?? 0,
    maxPlayers: initialStats.maxPlayers ?? 50,
    isOnline: initialStats.isOnline ?? false,
    status: 'pending' as ServerStatus,
    tags: serverData.tags || [],
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
      submittedAt: (finalData.submittedAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(), // Convert Timestamp
     } as Server;
  } catch (error) {
    console.error("Error adding Firebase server:", error);
    throw new Error("Failed to save server to database.");
  }
}

export async function voteForFirebaseServer(id: string): Promise<Server | null> {
  if (!db || !auth) {
    console.error("Firestore (db) or Auth is not initialized. Cannot vote.");
    throw new Error("Database or Authentication service not available.");
  }
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error("You must be logged in to vote.");
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

    const userVoteDocRef = doc(db, 'users', currentUser.uid, 'votes', id);
    const userVoteSnap = await getDoc(userVoteDocRef);
    const now = Timestamp.now();
    const cooldownMs = 24 * 60 * 60 * 1000; // 24 hours

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
        submittedAt: (data.submittedAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
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
        submittedAt: (data.submittedAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
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
  // In a real scenario, these might be fetched from Firestore if they are dynamic
  // For now, returning the static list.
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
            uid: docSnap.id, // Ensure uid from doc id is included
            createdAt: (data.createdAt as Timestamp)?.toDate().toISOString() ?? undefined, // Convert Timestamp
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

    // TODO: Optionally, delete related user data like votes subcollection for this user
    // const votesCollectionRef = collection(db, 'users', uid, 'votes');
    // const votesSnapshot = await getDocs(votesCollectionRef);
    // votesSnapshot.docs.forEach(voteDoc => batch.delete(voteDoc.ref));

    await batch.commit();
  } catch (error) {
    console.error(`Error deleting Firestore data for user (${uid}):`, error);
    throw new Error("Failed to delete user data from database.");
  }
}

export async function getServerOnlineStatus(ipAddress: string, port: number): Promise<{isOnline: boolean, playerCount?: number, maxPlayers?: number}> {
    // Replace this with actual Steam Query logic (e.g., using a library like 'gamedig')
    // This often needs to be done from a backend/serverless function due to browser limitations (CORS, UDP)
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