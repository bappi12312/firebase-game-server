
import type { FieldValue, Timestamp } from 'firebase/firestore';

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
  submittedAt: string; // Always ISO string after fetch
  lastVotedAt?: string | null; // Always ISO string or null after fetch
  status: ServerStatus; 
  isFeatured?: boolean;
  featuredUntil?: string | null; // ISO string date or null
}

export interface Game {
  id: string;
  name: string;
}

export type SortOption = 'votes' | 'playerCount' | 'name' | 'submittedAt' | 'featured';

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL?: string | null;
  role?: 'user' | 'admin'; 
  createdAt?: string; // Always ISO string after fetch
  emailVerified?: boolean;
}

export interface VotedServerInfo {
  server: Server;
  votedAt: string; // ISO string date of the last vote by the user
}

export const REPORT_REASONS = [
  "Incorrect Information",
  "Server Offline (Extended)",
  "Rule Violation / Abuse",
  "Hateful Content",
  "Technical Issues (Lag, etc.)",
  "Other",
] as const;

export type ReportReason = typeof REPORT_REASONS[number];

export type ReportStatus = 'pending' | 'investigating' | 'resolved' | 'dismissed';

export interface Report {
  id: string;
  serverId: string;
  serverName: string; // Denormalized for easier display
  reportingUserId: string;
  reportingUserDisplayName?: string | null; // Denormalized
  reason: ReportReason;
  description: string;
  reportedAt: string; // ISO string
  status: ReportStatus;
  resolvedBy?: string | null; // UID of admin
  resolvedAt?: string | null; // ISO string
  adminNotes?: string | null;
}
