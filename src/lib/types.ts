
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
  submittedBy?: string; // Optional for now
  submittedAt: string; // Store as ISO string for easier handling without Date objects in client components initially
  lastVotedAt?: string; // Store as ISO string
}

export interface Game {
  id: string;
  name: string;
}

export type SortOption = 'votes' | 'playerCount' | 'name' | 'submittedAt';
