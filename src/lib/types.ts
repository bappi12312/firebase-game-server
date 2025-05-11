
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
  submittedAt: string; 
  lastVotedAt?: string; 
  status: ServerStatus; // Added for approval process
  // promotedUntil?: string; // For PayPal integration: ISO string date
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
  role?: 'user' | 'admin'; // User role
  // lastLoginAt?: string;
  // createdAt?: string;
}
