
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
} from 'firebase/firestore';
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
      return docSnap.data() as UserProfile;
    }
    return null;
  } catch (error) {
    console.error("Error getting user profile:", error);
    return null;
  }
}

export async function createUserProfile(user: import('firebase/auth').User): Promise<UserProfile> {
   if (!db) {
    console.error("Firestore (db) is not initialized. Cannot create user profile.");
    throw new Error("Database service not available for profile creation.");
  }
  const userProfile: UserProfile = {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
    // Assign admin role based on .env or other logic. Fallback to 'user'.
    role: user.email === process.env.ADMIN_EMAIL && process.env.ADMIN_EMAIL ? 'admin' : 'user', 
    // createdAt: serverTimestamp(), // Use serverTimestamp for consistency
  };
  try {
    const userDocRef = doc(db, 'users', user.uid);
    await setDoc(userDocRef, userProfile, { merge: true }); // Use setDoc with merge:true to create or update
    return userProfile;
  } catch (error) {
     console.error("Error creating user profile in Firestore:", error);
     throw new Error("Could not save user profile to database.");
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
    let q = query(collection(db, 'servers'));

    if (status !== 'all') {
      q = query(q, where('status', '==', status));
    }

    if (gameFilter !== 'all') {
      q = query(q, where('game', '==', gameFilter));
    }
    
    let orderByField = 'votes';
    let orderDirection: 'desc' | 'asc' = 'desc';

    if (sortBy === 'playerCount') {
      orderByField = 'isOnline'; // Sort by online status first, then playerCount
      q = query(q, orderBy(orderByField, 'desc'), orderBy('playerCount', 'desc'));
    } else if (sortBy === 'name') {
      orderByField = 'name';
      orderDirection = 'asc';
      q = query(q, orderBy(orderByField, orderDirection));
    } else if (sortBy === 'submittedAt') {
      orderByField = 'submittedAt';
      orderDirection = 'desc';
      q = query(q, orderBy(orderByField, orderDirection));
    } else { // Default to votes
      q = query(q, orderBy(orderByField, orderDirection));
    }
    
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
    
    // Client-side sort for playerCount if it wasn't the primary sort, to handle offline servers correctly
    if (sortBy === 'playerCount') {
      serverList.sort((a, b) => (b.isOnline ? b.playerCount : -1) - (a.isOnline ? a.playerCount : -1));
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
  serverData: Omit<Server, 'id' | 'votes' | 'submittedAt' | 'playerCount' | 'maxPlayers' | 'isOnline' | 'submittedBy' | 'status' | 'lastVotedAt'>
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
    submittedAt: serverTimestamp(),
    submittedBy: currentUser.uid, 
    playerCount: initialStats.playerCount ?? 0,
    maxPlayers: initialStats.maxPlayers ?? 50,
    isOnline: initialStats.isOnline ?? false,
    status: 'pending' as ServerStatus,
    tags: serverData.tags || [],
  };
  
  try {
    const docRef = await addDoc(collection(db, 'servers'), newServerData);
    const newDocSnap = await getDoc(docRef); // Fetch to get timestamp resolved
    const finalData = newDocSnap.data();

    if (!finalData) {
        throw new Error("Failed to retrieve server data after creation.");
    }

    return { 
      id: docRef.id,
      ...finalData,
      // Ensure timestamps are converted
      submittedAt: (finalData.submittedAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
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

    // Implement user-specific vote cooldown check
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
      // lastVotedAt: serverTimestamp(), // This was server's global last vote, not needed with user-specific tracking
    });
    batch.set(userVoteDocRef, { votedAt: now }); // Record user's vote with timestamp

    await batch.commit();

    const updatedDocSnap = await getDoc(serverDocRef); // Fetch updated server data
    if (updatedDocSnap.exists()) {
      const data = updatedDocSnap.data();
      return {
        id: updatedDocSnap.id,
        ...data,
        submittedAt: (data.submittedAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
      } as Server;
    }
    return null;
  } catch (error) {
    console.error(`Error voting for server (${id}):`, error);
    if (error instanceof Error) throw error; // Re-throw known errors
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
  // Add more games as needed
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
  // In a real app, these might be fetched from Firestore if they need to be dynamic
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
    return usersSnapshot.docs.map(docSnap => docSnap.data() as UserProfile);
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

    // Also delete user's vote records
    // This requires knowing the structure, assuming 'users/{uid}/votes/{serverId}'
    // Listing subcollections client-side is complex. This should ideally be a backend function.
    // For now, we'll skip deleting individual vote subcollection documents.
    // Consider a Firebase Function for more robust user data deletion.

    await batch.commit();
  } catch (error) {
    console.error(`Error deleting Firestore data for user (${uid}):`, error);
    throw new Error("Failed to delete user data from database.");
  }
}

// Helper function to get server status, can be expanded to use actual query libraries
export async function getServerOnlineStatus(ipAddress: string, port: number): Promise<{isOnline: boolean, playerCount?: number, maxPlayers?: number}> {
    // This is where you'd integrate a game server query library (e.g., Gamedig, valve-server-query)
    // For now, using the mock. In a real scenario, this might be an API call to a backend service
    // that performs the query to avoid CORS issues and keep query logic server-side.
    // console.log(`Querying actual status for ${ipAddress}:${port} (using mock for now)`);
    return fetchMockServerStats(ipAddress, port);
}
