
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
} from 'firebase/firestore';
import { db, auth } from './firebase';
import type { Server, Game } from './types';

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
const gamesCollection = collection(db, 'games'); // If games are managed in Firestore

// --- Server Functions ---
export async function getFirebaseServers(
  gameFilter: string = 'all', 
  sortBy: string = 'votes', 
  searchTerm: string = ''
): Promise<Server[]> {
  let q = query(serversCollection);

  // Filtering
  if (gameFilter !== 'all') {
    q = query(q, where('game', '==', gameFilter));
  }
  // Note: Firestore doesn't support text search directly on multiple fields like SQL LIKE.
  // For robust search, you'd use a third-party service like Algolia or Typesense,
  // or implement a more basic search by querying specific fields if needed.
  // This example will filter client-side after fetching if searchTerm is present,
  // or you could query by a primary searchable field if your data model supports it.

  // Sorting
  // Firestore requires an index for most composite queries (filter + sort).
  // Default sort by votes descending.
  let orderByField = 'votes';
  let orderDirection: 'desc' | 'asc' = 'desc';

  if (sortBy === 'playerCount') {
    orderByField = 'playerCount'; // Assumes online servers have playerCount > 0
    orderDirection = 'desc';
  } else if (sortBy === 'name') {
    orderByField = 'name';
    orderDirection = 'asc';
  } else if (sortBy === 'submittedAt') {
    orderByField = 'submittedAt';
    orderDirection = 'desc';
  }
  
  q = query(q, orderBy(orderByField, orderDirection));
  // q = query(q, limit(50)); // Example: Paginate or limit results

  const serverSnapshot = await getDocs(q);
  let serverList = serverSnapshot.docs.map(docSnap => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      ...data,
      // Convert Firestore Timestamps to ISO strings
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
  
  // If sorting by player count, we might want to put offline servers last
  if (sortBy === 'playerCount') {
    serverList.sort((a, b) => (b.isOnline ? b.playerCount : -1) - (a.isOnline ? a.playerCount : -1));
  }


  return serverList;
}

export async function getFirebaseServerById(id: string): Promise<Server | null> {
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
}

export async function addFirebaseServer(
  serverData: Omit<Server, 'id' | 'votes' | 'submittedAt' | 'playerCount' | 'maxPlayers' | 'isOnline' | 'submittedBy'>
): Promise<Server> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error("User must be logged in to submit a server.");
  }

  const initialStats = await fetchMockServerStats(serverData.ipAddress, serverData.port);
  
  const newServerData = {
    ...serverData,
    votes: 0,
    submittedAt: serverTimestamp(), // Use server timestamp
    submittedBy: currentUser.uid, 
    playerCount: initialStats.playerCount ?? 0,
    maxPlayers: initialStats.maxPlayers ?? 50,
    isOnline: initialStats.isOnline ?? false,
    // tags can be stored as an array if needed
  };

  const docRef = await addDoc(serversCollection, newServerData);
  
  // Fetch the just-added document to return it with the ID and resolved timestamp
  const newDocSnap = await getDoc(docRef);
  const finalData = newDocSnap.data();

  return { 
    id: docRef.id,
    ...finalData,
    submittedAt: (finalData?.submittedAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
   } as Server;
}

export async function voteForFirebaseServer(id: string): Promise<Server | null> {
  const serverDocRef = doc(db, 'servers', id);
  // Basic Cooldown: In a real app, this should be more robust, checking user-specific vote timestamps.
  // This is a simplified server-level cooldown example.
  const serverSnap = await getDoc(serverDocRef);
  if (!serverSnap.exists()) return null;

  const serverData = serverSnap.data();
  // Example: 1 minute cooldown, globally on server (not user specific here)
  // For user specific, you would store lastVotedAt per user per server in a separate collection.
  const now = Date.now();
  const lastVotedAtMs = serverData.lastVotedAt ? (serverData.lastVotedAt as Timestamp).toMillis() : 0;
  const cooldownMs = 60 * 1000; // 1 minute

  if (now - lastVotedAtMs < cooldownMs) {
      throw new Error("You've voted for this server recently. Please wait.");
  }

  await updateDoc(serverDocRef, {
    votes: increment(1),
    lastVotedAt: serverTimestamp(), // Update last voted time
    // Optionally, re-fetch and update player count here if desired on vote
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

// --- Game Functions ---
// Using static games for now, but this shows how you might fetch from Firestore
const staticGames: Game[] = [
  { id: 'mc', name: 'Minecraft' },
  { id: 'val', name: 'Valheim' },
  { id: 'csgo', name: 'Counter-Strike: GO' },
  { id: 'rust', name: 'Rust' },
  { id: 'ark', name: 'ARK: Survival Evolved' },
];

export async function getFirebaseGames(): Promise<Game[]> {
  // To use Firestore for games:
  // const gameSnapshot = await getDocs(gamesCollection);
  // return gameSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Game));
  return Promise.resolve([...staticGames]); // Keep using static list for simplicity
}
