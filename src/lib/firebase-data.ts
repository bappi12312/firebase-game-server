
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
import type { Server, Game, ServerStatus, UserProfile, SortOption, VotedServerInfo, Report, ReportStatus, ReportReason } from './types';
import { serverFormSchema } from '@/lib/schemas';
// Removed: import { GameDig } from 'gamedig'; - No longer needed here

function formatFirebaseError(error: any, context: string): string {
  let message = `Error ${context}: `;
  if (error instanceof Error) {
    const firebaseErrorCode = (error as any).code;
    if (firebaseErrorCode === 'permission-denied' || (error.message && error.message.toLowerCase().includes('permission denied'))) {
      message += `Firestore permission denied. Please check your Firestore security rules to allow this operation. (Original message: ${error.message})`;
    } else if (firebaseErrorCode === 'unauthenticated' || (error.message && error.message.toLowerCase().includes('unauthenticated'))) {
        message += `Authentication required. You must be logged in to perform this action.`;
    } else if (firebaseErrorCode === 'failed-precondition' && error.message && error.message.toLowerCase().includes('query requires an index')) {
      message = `Error ${context}: Firestore query requires an index. Please create it in the Firebase console. (Original message: ${error.message})`;
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

const toISODateString = (timestamp: Timestamp | FieldValue | undefined | null | string): string | null => {
  if (timestamp instanceof Timestamp) {
    return timestamp.toDate().toISOString();
  }
  if (typeof timestamp === 'string') {
    // Basic check for ISO format, can be more robust
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/.test(timestamp)) {
       return timestamp;
    }
     // Attempt to parse if it's a different date string format recognized by Date constructor
    const date = new Date(timestamp);
    if (!isNaN(date.getTime())) {
        return date.toISOString();
    }
  }
  return null;
};

const toRequiredISODateString = (timestamp: Timestamp | FieldValue | undefined | null | string, fallback = new Date(0).toISOString()): string => {
  if (timestamp instanceof Timestamp) {
    return timestamp.toDate().toISOString();
  }
  if (typeof timestamp === 'string') {
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/.test(timestamp)) {
       return timestamp;
    }
    const date = new Date(timestamp);
    if (!isNaN(date.getTime())) {
        return date.toISOString();
    }
  }
  return fallback;
};


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
        createdAt: toRequiredISODateString(data.createdAt),
        emailVerified: data.emailVerified ?? false,
      } as UserProfile;
    }
    return null;
  } catch (error) {
    const specificMessage = formatFirebaseError(error, `getting user profile for UID ${uid}`);
    console.error(specificMessage, error);
    throw new Error(specificMessage);
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

    const profileSnap = await getDoc(userDocRef);
    if (profileSnap.exists()) {
        const data = profileSnap.data();
         return {
            ...data,
            uid: profileSnap.id,
            createdAt: toRequiredISODateString(data.createdAt, new Date().toISOString()),
            emailVerified: data.emailVerified ?? false,
        } as UserProfile;
    }
    console.warn("createUserProfile: profileSnap did not exist after setDoc. Returning constructed profile.");
    return {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        role: role,
        createdAt: new Date().toISOString(),
        emailVerified: user.emailVerified,
    };

  } catch (error: any) {
     const specificMessage = formatFirebaseError(error, `creating/updating user profile in Firestore for UID ${user.uid}`);
     // Error message already includes Firebase error code and message due to formatFirebaseError
     console.error(specificMessage, error);
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
  // Add initial stats to be passed in
  initialIsOnline: boolean;
  initialPlayerCount: number;
  initialMaxPlayers: number;
};

// Removed: getServerOnlineStatus function - this is now handled by the API route

export async function getFirebaseServers(
  gameFilter: string = 'all',
  sortBy: SortOption = 'featured',
  searchTerm: string = '',
  status: ServerStatus | 'all' = 'approved',
  submittedByUserId?: string,
  count?: number
): Promise<Server[]> {
  if (!db) {
    throw new Error(formatFirebaseError({message: "Firestore (db) is not initialized."}, "getting servers. Database service not available."));
  }
  try {
    const serverCollRef = collection(db, 'servers');
    let qConstraints: QueryConstraint[] = [];

    if (status !== 'all') {
      qConstraints.push(where('status', '==', status));
    }

    if (gameFilter !== 'all') {
      qConstraints.push(where('game', '==', gameFilter));
    }
    if (submittedByUserId) {
      qConstraints.push(where('submittedBy', '==', submittedByUserId));
    }

    // Define base sorting order which might be overridden or augmented
    let baseOrderByField: keyof Server = 'votes';
    let baseOrderByDirection: 'asc' | 'desc' = 'desc';

    // Apply sorting logic based on sortBy parameter
    switch (sortBy) {
      case 'featured':
        // Prioritize featured servers
        qConstraints.push(orderBy('isFeatured', 'desc'));
        qConstraints.push(orderBy('featuredUntil', 'desc')); // Sort by expiry date if featured
        // Fallback sorting for featured/non-featured
        qConstraints.push(orderBy('votes', 'desc'));
        qConstraints.push(orderBy('playerCount', 'desc'));
        break;
      case 'votes':
        qConstraints.push(orderBy('isFeatured', 'desc')); // Keep featured on top
        qConstraints.push(orderBy('featuredUntil', 'desc'));
        qConstraints.push(orderBy('votes', 'desc'));
        break;
      case 'playerCount':
        qConstraints.push(orderBy('isFeatured', 'desc')); // Keep featured on top
        qConstraints.push(orderBy('featuredUntil', 'desc'));
        qConstraints.push(orderBy('isOnline', 'desc'));
        qConstraints.push(orderBy('playerCount', 'desc'));
        break;
      case 'name':
        qConstraints.push(orderBy('isFeatured', 'desc')); // Keep featured on top
        qConstraints.push(orderBy('featuredUntil', 'desc'));
        qConstraints.push(orderBy('name', 'asc'));
        break;
      case 'submittedAt':
        qConstraints.push(orderBy('isFeatured', 'desc')); // Keep featured on top
        qConstraints.push(orderBy('featuredUntil', 'desc'));
        qConstraints.push(orderBy('submittedAt', 'desc'));
        break;
      default:
        // Default to featured -> votes -> player count
        qConstraints.push(orderBy('isFeatured', 'desc'));
        qConstraints.push(orderBy('featuredUntil', 'desc'));
        qConstraints.push(orderBy('votes', 'desc'));
        qConstraints.push(orderBy('playerCount', 'desc'));
    }

    // Add a final tie-breaker sort by name if not already the primary sort, for consistent ordering
    // Ensure the primary sort field isn't 'name' before adding this
    const primarySortField = sortBy === 'featured' ? 'votes' : sortBy; // Determine primary sort field after featured
    if (primarySortField !== 'name') {
       qConstraints.push(orderBy('name', 'asc'));
    }


    if (count && count > 0) {
        qConstraints.push(limit(count));
    } else if (count !== undefined && count <= 0) {
        return [];
    }

    const q = query(serverCollRef, ...qConstraints);

    const serverSnapshot = await getDocs(q);
    let serverList = serverSnapshot.docs.map(docSnap => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        ...data,
        submittedAt: toRequiredISODateString(data.submittedAt),
        lastVotedAt: toISODateString(data.lastVotedAt),
        featuredUntil: toISODateString(data.featuredUntil),
      } as Server;
    });

    // Client-side filtering for search term after fetching sorted/filtered data
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
        submittedAt: toRequiredISODateString(data.submittedAt),
        lastVotedAt: toISODateString(data.lastVotedAt),
        featuredUntil: toISODateString(data.featuredUntil),
      } as Server;
    } else {
      return null;
    }
  } catch (error) {
    throw new Error(formatFirebaseError(error, `fetching server by ID (${id})`));
  }
}

// Updated to accept initial stats
export async function addFirebaseServer(
  serverDataInput: ServerDataForCreation
): Promise<Server> {
   if (!db) {
    throw new Error(formatFirebaseError({message: "Firestore (db) is not initialized."}, "adding Firebase server. Database service not available."));
  }

  // Initial stats are now passed in
  const { initialIsOnline, initialPlayerCount, initialMaxPlayers, ...restOfData } = serverDataInput;

  const dataToSave: { [key: string]: any } = {
    ...restOfData, // Includes name, ip, port, game, desc, tags, submittedBy, bannerUrl, logoUrl
    tags: serverDataInput.tags && serverDataInput.tags.length > 0 ? serverDataInput.tags : [],
    votes: 0,
    submittedAt: serverTimestamp() as FieldValue,
    playerCount: initialPlayerCount,
    maxPlayers: initialMaxPlayers,
    isOnline: initialIsOnline,
    status: 'pending' as ServerStatus,
    lastVotedAt: null,
    bannerUrl: (serverDataInput.bannerUrl && serverDataInput.bannerUrl.trim() !== '') ? serverDataInput.bannerUrl : null,
    logoUrl: (serverDataInput.logoUrl && serverDataInput.logoUrl.trim() !== '') ? serverDataInput.logoUrl : null,
    isFeatured: false,
    featuredUntil: null,
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
      submittedAt: toRequiredISODateString(finalData.submittedAt, new Date().toISOString()),
      lastVotedAt: toISODateString(finalData.lastVotedAt),
      featuredUntil: toISODateString(finalData.featuredUntil),
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
        submittedAt: toRequiredISODateString(data.submittedAt),
        lastVotedAt: toISODateString(data.lastVotedAt),
        featuredUntil: toISODateString(data.featuredUntil),
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
        submittedAt: toRequiredISODateString(data.submittedAt),
        lastVotedAt: toISODateString(data.lastVotedAt),
        featuredUntil: toISODateString(data.featuredUntil),
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

    const batch = writeBatch(db);
    batch.delete(serverDocRef);

    // Also delete reports associated with this server
    const reportsQuery = query(collection(db, 'reports'), where('serverId', '==', id));
    const reportsSnapshot = await getDocs(reportsQuery);
    reportsSnapshot.forEach(reportDoc => batch.delete(reportDoc.ref));

    await batch.commit();

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
    throw new Error(formatFirebaseError({message: "Firestore (db) is not initialized."}, "getting all users. Database service not available."));
  }
  try {
    const usersSnapshot = await getDocs(collection(db, "users"));
    return usersSnapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
            ...data,
            uid: docSnap.id,
            createdAt: toRequiredISODateString(data.createdAt),
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

    const votesCollectionRef = collection(db, 'users', uid, 'votes');
    const votesSnapshot = await getDocs(votesCollectionRef);
    votesSnapshot.docs.forEach(voteDoc => batch.delete(voteDoc.ref));

    await batch.commit();
  } catch (error) {
    throw new Error(formatFirebaseError(error, `deleting Firestore data for user (${uid})`));
  }
}

// --- Admin Dashboard Stats & Recent Activity ---
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

export async function getRecentPendingServers(count: number = 5): Promise<Server[]> {
  if (!db) throw new Error(formatFirebaseError({ message: "DB not init" }, "fetching recent pending servers"));
  if (count <= 0) {
    return [];
  }
  try {
    const q = query(
      collection(db, 'servers'),
      where('status', '==', 'pending'),
      orderBy('submittedAt', 'desc'),
      limit(count)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(docSnap => {
      const data = docSnap.data();
      return {
        id: docSnap.id, ...data,
        submittedAt: toRequiredISODateString(data.submittedAt),
        lastVotedAt: toISODateString(data.lastVotedAt),
        featuredUntil: toISODateString(data.featuredUntil),
      } as Server;
    });
  } catch (error) {
    throw new Error(formatFirebaseError(error, "fetching recent pending servers"));
  }
}

export async function getRecentPendingReports(filterStatus: ReportStatus | 'all' = 'all', count: number = 5): Promise<Report[]> {
   if (!db) throw new Error(formatFirebaseError({ message: "DB not init" }, "fetching recent pending reports"));
   if (count <= 0) {
    return [];
  }
  try {
    const reportsCollRef = collection(db, 'reports');
    let qConstraints: QueryConstraint[] = [orderBy('reportedAt', 'desc')];

    if (filterStatus !== 'all') {
      qConstraints.push(where('status', '==', filterStatus));
    }
    qConstraints.push(limit(count));

    const q = query(reportsCollRef, ...qConstraints);
    const snapshot = await getDocs(q);
    return snapshot.docs.map(docSnap => {
      const data = docSnap.data();
      return {
        id: docSnap.id, ...data,
        reportedAt: toRequiredISODateString(data.reportedAt),
        resolvedAt: toISODateString(data.resolvedAt),
      } as Report;
    });
  } catch (error) {
    throw new Error(formatFirebaseError(error, "fetching recent pending reports"));
  }
}

export async function getRecentRegisteredUsers(count: number = 5): Promise<UserProfile[]> {
   if (!db) throw new Error(formatFirebaseError({ message: "DB not init" }, "fetching recent registered users"));
   if (count <= 0) {
     return [];
   }
  try {
    const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'), limit(count));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(docSnap => {
      const data = docSnap.data();
      return {
        uid: docSnap.id, ...data,
        createdAt: toRequiredISODateString(data.createdAt),
        emailVerified: data.emailVerified ?? false,
      } as UserProfile;
    });
  } catch (error) {
    throw new Error(formatFirebaseError(error, "fetching recent registered users"));
  }
}


export async function updateServerStatsInFirestore(
  serverId: string,
  statsToUpdate: { isOnline: boolean; playerCount?: number; maxPlayers?: number }
): Promise<void> {
  if (!db) {
    console.warn("updateServerStatsInFirestore: Firestore (db) is not initialized. Skipping stat update.");
    return;
  }
  const serverRef = doc(db, 'servers', serverId);

  try {
    const serverSnap = await getDoc(serverRef);
    if (!serverSnap.exists()) {
      console.warn(`updateServerStatsInFirestore: Server ${serverId} not found. Skipping stat update.`);
      return;
    }
    const serverData = serverSnap.data();
    if(serverData.status !== 'approved') {
        // console.log(`updateServerStatsInFirestore: Server ${serverId} is not approved. Skipping stat update.`);
        return;
    }

    const updatePayload: Partial<Server> = {
      isOnline: statsToUpdate.isOnline,
      playerCount: statsToUpdate.playerCount ?? (serverData.playerCount ?? 0), // Persist old if undefined
    };
    // Only update maxPlayers if it's provided in statsToUpdate
    if (statsToUpdate.maxPlayers !== undefined) {
      updatePayload.maxPlayers = statsToUpdate.maxPlayers;
    } else {
      updatePayload.maxPlayers = serverData.maxPlayers ?? 50; // Persist old or default
    }

    await updateDoc(serverRef, updatePayload as { [x: string]: any });
  } catch (error) {
    console.error(formatFirebaseError(error, `updating stats for server ${serverId} in Firestore`));
  }
}

export async function getUserVotedServerDetails(userId: string): Promise<VotedServerInfo[]> {
  if (!db) {
    throw new Error(formatFirebaseError({ message: "Firestore (db) is not initialized." }, "getting user voted servers. Database service not available."));
  }
  try {
    const votesColRef = collection(db, 'users', userId, 'votes');
    // Order by votedAt descending to get the most recent votes first
    const votesQuery = query(votesColRef, orderBy('votedAt', 'desc'));
    const votesSnapshot = await getDocs(votesQuery);

    if (votesSnapshot.empty) {
      return [];
    }

    const votedServerEntries = votesSnapshot.docs.map(docSnap => ({
      serverId: docSnap.id,
      votedAt: toRequiredISODateString(docSnap.data().votedAt as Timestamp),
    }));

    const serverIds = votedServerEntries.map(entry => entry.serverId);
    const votedServersDetails: VotedServerInfo[] = [];

    // Fetch server details in batches
    const batchSize = 30; // Firestore 'in' query limit is 30
    for (let i = 0; i < serverIds.length; i += batchSize) {
      const serverIdsBatch = serverIds.slice(i, i + batchSize);
      if (serverIdsBatch.length === 0) continue;

      const serversQuery = query(collection(db, 'servers'), where(documentId(), 'in', serverIdsBatch));
      const serversSnapshot = await getDocs(serversQuery);

      serversSnapshot.forEach(serverDoc => {
        const serverData = serverDoc.data();
        if (serverData) {
            const voteEntry = votedServerEntries.find(entry => entry.serverId === serverDoc.id);
            if (voteEntry) {
            votedServersDetails.push({
                server: {
                  id: serverDoc.id,
                  name: serverData.name,
                  ipAddress: serverData.ipAddress,
                  port: serverData.port,
                  game: serverData.game,
                  description: serverData.description,
                  tags: serverData.tags || [],
                  playerCount: serverData.playerCount ?? 0,
                  maxPlayers: serverData.maxPlayers ?? 0,
                  isOnline: serverData.isOnline ?? false,
                  votes: serverData.votes ?? 0,
                  status: serverData.status as ServerStatus,
                  bannerUrl: serverData.bannerUrl,
                  logoUrl: serverData.logoUrl,
                  submittedBy: serverData.submittedBy,
                  submittedAt: toRequiredISODateString(serverData.submittedAt),
                  lastVotedAt: toISODateString(serverData.lastVotedAt),
                  isFeatured: serverData.isFeatured ?? false,
                  featuredUntil: toISODateString(serverData.featuredUntil),
                },
                votedAt: voteEntry.votedAt,
            });
            }
        }
      });
    }

    // Ensure the final list is sorted by votedAt descending, as fetching might reorder
    votedServersDetails.sort((a, b) => new Date(b.votedAt).getTime() - new Date(a.votedAt).getTime());

    return votedServersDetails;
  } catch (error) {
    throw new Error(formatFirebaseError(error, `fetching voted server details for user ${userId}`));
  }
}


export async function updateServerFeaturedStatus(
  serverId: string,
  isFeatured: boolean,
  durationDays?: number
): Promise<Server | null> {
  if (!db) {
    throw new Error(
      formatFirebaseError(
        { message: "Firestore (db) is not initialized." },
        "updating server featured status. Database service not available."
      )
    );
  }
  try {
    const serverDocRef = doc(db, "servers", serverId);
    const updates: Partial<Server> & { featuredUntil?: FieldValue | null } = {
      isFeatured,
    };

    if (isFeatured && durationDays && durationDays > 0) {
      const featuredUntilDate = new Date();
      featuredUntilDate.setDate(featuredUntilDate.getDate() + durationDays);
      updates.featuredUntil = Timestamp.fromDate(featuredUntilDate) as any;
    } else if (!isFeatured) {
      updates.featuredUntil = null;
    } else if (isFeatured && !durationDays){
        updates.featuredUntil = null; // Indefinite feature
    }


    await updateDoc(serverDocRef, updates as { [key: string]: any });

    const updatedDocSnap = await getDoc(serverDocRef);
    if (updatedDocSnap.exists()) {
      const data = updatedDocSnap.data();
      return {
        id: updatedDocSnap.id,
        ...data,
        submittedAt: toRequiredISODateString(data.submittedAt),
        lastVotedAt: toISODateString(data.lastVotedAt),
        featuredUntil: toISODateString(data.featuredUntil),
      } as Server;
    }
    return null;
  } catch (error) {
    throw new Error(
      formatFirebaseError(
        error,
        `updating featured status for server (${serverId})`
      )
    );
  }
}

// --- Report Functions ---
export async function addFirebaseReport(reportData: Omit<Report, 'id' | 'reportedAt' | 'status' | 'resolvedAt' | 'resolvedBy' | 'adminNotes'>): Promise<Report> {
  if (!db) {
    throw new Error(formatFirebaseError({ message: "Firestore (db) is not initialized." }, "adding report. Database service not available."));
  }
  const dataToSave = {
    ...reportData,
    reportedAt: serverTimestamp() as FieldValue,
    status: 'pending' as ReportStatus,
    resolvedAt: null,
    resolvedBy: null,
    adminNotes: null,
  };
  try {
    const docRef = await addDoc(collection(db, 'reports'), dataToSave);
    const newDocSnap = await getDoc(docRef);
    const finalData = newDocSnap.data();
    if (!finalData) throw new Error("Failed to retrieve report data after creation.");
    return {
      id: docRef.id,
      ...finalData,
      reportedAt: toRequiredISODateString(finalData.reportedAt, new Date().toISOString()),
      resolvedAt: toISODateString(finalData.resolvedAt),
    } as Report;
  } catch (error) {
    throw new Error(formatFirebaseError(error, "adding report"));
  }
}

export async function getFirebaseReports(filterStatus: ReportStatus | 'all' = 'all', count?: number): Promise<Report[]> {
  if (!db) {
    throw new Error(formatFirebaseError({ message: "Firestore (db) is not initialized." }, "getting reports. Database service not available."));
  }
  try {
    const reportsCollRef = collection(db, 'reports');
    let qConstraints: QueryConstraint[] = [orderBy('reportedAt', 'desc')];
    if (filterStatus !== 'all') {
      qConstraints.push(where('status', '==', filterStatus));
    }
    if (count && count > 0) {
      qConstraints.push(limit(count));
    } else if (count !== undefined && count <=0) {
        return [];
    }

    const q = query(reportsCollRef, ...qConstraints);
    const reportSnapshot = await getDocs(q);
    return reportSnapshot.docs.map(docSnap => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        ...data,
        reportedAt: toRequiredISODateString(data.reportedAt),
        resolvedAt: toISODateString(data.resolvedAt),
      } as Report;
    });
  } catch (error) {
    throw new Error(formatFirebaseError(error, "fetching reports"));
  }
}

export async function updateFirebaseReportStatus(
  reportId: string,
  status: ReportStatus,
  adminUserId: string,
  adminNotes?: string
): Promise<Report | null> {
  if (!db) {
    throw new Error(formatFirebaseError({ message: "Firestore (db) is not initialized." }, "updating report status. Database service not available."));
  }
  try {
    const reportDocRef = doc(db, 'reports', reportId);
    const updates: Partial<Report> & { resolvedAt?: FieldValue | null } = {
      status,
      resolvedBy: adminUserId,
      resolvedAt: serverTimestamp() as any,
    };
    if (adminNotes !== undefined) {
      updates.adminNotes = adminNotes;
    }
    // If status is changed back to pending or investigating, clear resolved fields
    if (status === 'pending' || status === 'investigating') {
        updates.resolvedBy = null;
        updates.resolvedAt = null;
    }

    await updateDoc(reportDocRef, updates as { [x: string]: any });

    const updatedDocSnap = await getDoc(reportDocRef);
    if (updatedDocSnap.exists()) {
      const data = updatedDocSnap.data();
      return {
        id: updatedDocSnap.id,
        ...data,
        reportedAt: toRequiredISODateString(data.reportedAt),
        resolvedAt: toISODateString(data.resolvedAt),
      } as Report;
    }
    return null;
  } catch (error) {
    throw new Error(formatFirebaseError(error, `updating report status (${reportId} to ${status})`));
  }
}
