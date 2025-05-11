import type { FieldValue } from 'firebase/firestore';

export type ServerStatus = 'pending' | 'approved' | 'rejected';

export interface Server {
  id: string;
  name: string;
  ipAddress: string;
  port: number;
  bannerUrl?: string;
  logoUrl?: string;
  game: string;
  description: string;
  tags?: string[];
  playerCount: number;
  maxPlayers: number;
  isOnline: boolean;
  votes: number;
  submittedBy?: string; 
  submittedAt: string | FieldValue; // Can be ISO string or ServerTimestamp
  lastVotedAt?: string | FieldValue; // Can be ISO string or ServerTimestamp
  status: ServerStatus; 
}

export interface Game {
  id: string;
  name: string;
}

export type SortOption = 'votes' | 'playerCount' | 'name' | 'submittedAt';

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL?: string | null;
  role?: 'user' | 'admin'; 
  createdAt?: string | FieldValue; // Can be ISO string or ServerTimestamp
  emailVerified?: boolean;
}

export interface VotedServerInfo {
  server: Server;
  votedAt: string; // ISO string date of the last vote by the user
}
