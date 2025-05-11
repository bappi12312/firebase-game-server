
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
} from 'firebase/firestore';
import { db, auth } from './firebase';
import type { Server, Game, ServerStatus, UserProfile } from './types';

// Simulate fetching server stats (mock for now, replace with actual Steam Query or similar)
export async function fetchMockServerStats(ipAddress: string, port: number): Promise<Partial<Server>> {
  await new Promise(resolve => setTimeout(resolve, 300)); // Simulate network delay
  const isOnline = Math.random() > 0.2; 
  return {
    isOnline,
    playerCount: isOnline ? Math.floor(Math.random() * 50) : 0,
    maxPlayers: 50 + Math.floor(Math.random() * 50),
  };
}

const serversCollection = collection(db, 'servers');
const gamesCollection = collection(db, 'games');
const usersCollection = collection(db, 'users'); // For storing user profile data including roles

// --- User Profile Functions ---
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  if (!db) {
    console.error("Firestore is not initialized. Cannot get user profile.");
    return null;
  }
  const userDocRef = doc(db, 'users', uid);
  const docSnap = await getDoc(userDocRef);
  if (docSnap.exists()) {
    return docSnap.data() as UserProfile;
  }
  return null;
}

export async function createUserProfile(user: import('firebase/auth').User): Promise<UserProfile> {
   if (!db) {
    console.error("Firestore is not initialized. Cannot create user profile.");
    throw new Error("Database not available.");
  }
  const userProfile: UserProfile = {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
    role: user.email === process.env.ADMIN_EMAIL ? 'admin' : 'user', // Assign admin role based on .env
    // createdAt: new Date().toISOString(),
  };
  const userDocRef = doc(db, 'users', user.uid);
  await updateDoc(userDocRef, userProfile, { merge: true }); // Use updateDoc with merge:true or setDoc
  return userProfile;
}


// --- Server Functions ---
export async function getFirebaseServers(
  gameFilter: string = 'all', 
  sortBy: string = 'votes', 
  searchTerm: string = '',
  status: ServerStatus | 'all' = 'approved' // Allow fetching all for admin
): Promise<Server[]> {
   if (!db) {
    console.error("Firestore is not initialized. Cannot get servers.");
    return [];
  }
  let q = query(serversCollection);

  // Status filter
  if (status !== 'all') {
    q = query(q, where('status', '==', status));
  } else {
     // If 'all' statuses are requested (typically for admin), don't filter by status UNLESS also filtering by game
     // This ensures admin can see all servers regardless of status
     // If other filters are applied, then we should apply them.
  }


  // Game Filtering
  if (gameFilter !== 'all') {
    q = query(q, where('game', '==', gameFilter));
  }
  
  let orderByField = 'votes';
  let orderDirection: 'desc' | 'asc' = 'desc';

  if (sortBy === 'playerCount') {
    orderByField = 'playerCount'; 
    orderDirection = 'desc';
  } else if (sortBy === 'name') {
    orderByField = 'name';
    orderDirection = 'asc';
  } else if (sortBy === 'submittedAt') {
    orderByField = 'submittedAt';
    orderDirection = 'desc';
  }
  
  q = query(q, orderBy(orderByField, orderDirection));
  
  const serverSnapshot = await getDocs(q);
  let serverList = serverSnapshot.docs.map(docSnap => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      ...data,
      submittedAt: (data.submittedAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
      lastVotedAt: (data.lastVotedAt as Timestamp)?.toDate().toISOString(),
    } as Server;
  });

  if (searchTerm) {
    const lowerSearchTerm = searchTerm.toLowerCase();
    serverList = serverList.filter(
      (server) =>
        server.name.toLowerCase().includes(lowerSearchTerm) ||
        server.ipAddress.toLowerCase().includes(lowerSearchTerm) ||
        server.game.toLowerCase().includes(lowerSearchTerm)
    );
  }
  
  if (sortBy === 'playerCount') {
    serverList.sort((a, b) => (b.isOnline ? b.playerCount : -1) - (a.isOnline ? a.playerCount : -1));
  }

  return serverList;
}

export async function getFirebaseServerById(id: string): Promise<Server | null> {
   if (!db) {
    console.error("Firestore is not initialized. Cannot get server by ID.");
    return null;
  }
  const serverDocRef = doc(db, 'servers', id);
  const docSnap = await getDoc(serverDocRef);

  if (docSnap.exists()) {
    const data = docSnap.data();
    // Ensure server is approved if fetched by a regular user
    // For admin, this check might be bypassed or handled in the calling component
    // if (data.status !== 'approved') return null; // Consider this rule based on context

    return {
      id: docSnap.id,
      ...data,
      submittedAt: (data.submittedAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
      lastVotedAt: (data.lastVotedAt as Timestamp)?.toDate().toISOString(),
    } as Server;
  } else {
    return null;
  }
}

export async function addFirebaseServer(
  serverData: Omit<Server, 'id' | 'votes' | 'submittedAt' | 'playerCount' | 'maxPlayers' | 'isOnline' | 'submittedBy' | 'status'>
): Promise<Server> {
   if (!auth || !db) {
    console.error("Firebase Auth or Firestore is not initialized.");
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
    status: 'pending' as ServerStatus, // Initial status
  };

  const docRef = await addDoc(serversCollection, newServerData);
  const newDocSnap = await getDoc(docRef);
  const finalData = newDocSnap.data();

  return { 
    id: docRef.id,
    ...finalData,
    submittedAt: (finalData?.submittedAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
   } as Server;
}

export async function voteForFirebaseServer(id: string): Promise<Server | null> {
  if (!db) {
    console.error("Firestore is not initialized. Cannot vote for server.");
    return null;
  }
  const serverDocRef = doc(db, 'servers', id);
  const serverSnap = await getDoc(serverDocRef);
  if (!serverSnap.exists()) return null;

  const serverData = serverSnap.data();
  if (serverData.status !== 'approved') {
    throw new Error("This server is not currently approved for voting.");
  }

  const now = Date.now();
  const lastVotedAtMs = serverData.lastVotedAt ? (serverData.lastVotedAt as Timestamp).toMillis() : 0;
  const cooldownMs = 60 * 1000 * 60 * 24; // 24 hour cooldown

  if (now - lastVotedAtMs < cooldownMs) {
      throw new Error("You've voted for this server within the last 24 hours. Please wait.");
  }

  await updateDoc(serverDocRef, {
    votes: increment(1),
    lastVotedAt: serverTimestamp(),
  });

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
}

export async function updateFirebaseServerStatus(id: string, status: ServerStatus): Promise<Server | null> {
  if (!db) {
    console.error("Firestore is not initialized. Cannot update server status.");
    return null;
  }
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
}

export async function deleteFirebaseServer(id: string): Promise<void> {
  if (!db) {
    console.error("Firestore is not initialized. Cannot delete server.");
    throw new Error("Database service not available.");
  }
  const serverDocRef = doc(db, 'servers', id);
  await deleteDoc(serverDocRef);
}


// --- Game Functions ---
const staticGames: Game[] = [
  { id: 'mc', name: 'Minecraft' },
  { id: 'val', name: 'Valheim' },
  { id: 'csgo', name: 'Counter-Strike: GO' },
  { id: 'rust', name: 'Rust' },
  { id: 'ark', name: 'ARK: Survival Evolved' },
];

export async function getFirebaseGames(): Promise<Game[]> {
  return Promise.resolve([...staticGames]);
}


// Admin: Get all users
export async function getAllFirebaseUsers(): Promise<UserProfile[]> {
  if (!db) {
    console.error("Firestore is not initialized. Cannot get all users.");
    return [];
  }
  const usersSnapshot = await getDocs(collection(db, "users"));
  return usersSnapshot.docs.map(docSnap => docSnap.data() as UserProfile);
}

// Admin: Update user role
export async function updateUserFirebaseRole(uid: string, role: 'user' | 'admin'): Promise<void> {
   if (!db) {
    console.error("Firestore is not initialized. Cannot update user role.");
    throw new Error("Database service not available.");
  }
  const userDocRef = doc(db, 'users', uid);
  await updateDoc(userDocRef, { role });
}

// Admin: Delete user (data from Firestore, not Firebase Auth user itself for safety from client-side)
export async function deleteFirebaseUser FirestoreData(uid: string): Promise<void> {
   if (!db) {
    console.error("Firestore is not initialized. Cannot delete user data.");
    throw new Error("Database service not available.");
  }
  // This only deletes the user's profile data in Firestore.
  // Deleting a Firebase Auth user requires Admin SDK on backend.
  // Also, consider deleting user's submitted servers or re-assigning them.
  const batch = writeBatch(db);
  const userDocRef = doc(db, 'users', uid);
  batch.delete(userDocRef);

  // Example: Find and delete servers submitted by this user
  // const userServersQuery = query(serversCollection, where('submittedBy', '==', uid));
  // const userServersSnap = await getDocs(userServersQuery);
  // userServersSnap.forEach(doc => batch.delete(doc.ref));

  await batch.commit();
}
