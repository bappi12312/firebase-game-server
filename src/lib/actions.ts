// src/lib/actions.ts
'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import {
  addFirebaseServer,
  voteForFirebaseServer,
  updateFirebaseServerStatus,
  deleteFirebaseServer as deleteFirebaseServerData,
  getUserProfile,
  updateFirebaseUserProfile,
  updateServerFeaturedStatus,
  addFirebaseReport,
  updateFirebaseReportStatus,
  type ServerDataForCreation,
  updateUserFirebaseRole,
  deleteFirebaseUserFirestoreData,
} from './firebase-data';
import type { Server, ServerStatus, UserProfile, Report, ReportStatus } from './types';
import { auth } from './firebase';
import { serverFormSchema, reportFormSchema, userProfileUpdateSchema } from '@/lib/schemas';
import { GameDig } from 'gamedig';


// Helper to check for admin role
async function isAdmin(userId: string): Promise<boolean> {
  const profile = await getUserProfile(userId);
  return profile?.role === 'admin';
}


export interface SubmitServerFormState {
  message: string;
  fields?: Record<string, string | number | File | null>;
  server?: Server;
  serverId?: string | null;
  error?: boolean;
  errors?: { path: string | (string|number)[]; message: string }[];
}

// Function to get initial server stats using GameDig
async function getInitialServerStats(ipAddress: string, port: number): Promise<{isOnline: boolean, playerCount: number, maxPlayers: number}> {
   const timeout = 5000; // 5 seconds timeout for initial check
   try {
    const state = await GameDig.query({
      type: 'rust', // Specifically for Rust servers as per project focus
      host: ipAddress,
      port: port,
      socketTimeout: timeout,
      givenPortOnly: true, // Often important for Rust
    });
    return {
      isOnline: true,
      playerCount: state.players ? state.players.length : 0,
      maxPlayers: state.maxplayers ?? 50, // Default if not reported
    };
  } catch (error) {
    // console.warn(`Initial status check failed for ${ipAddress}:${port} (Type: rust):`, error);
    return {
      isOnline: false,
      playerCount: 0,
      maxPlayers: 50, // Default max players for offline/failed check
    };
  }
}


export async function submitServerAction(
  prevState: SubmitServerFormState,
  formData: FormData
): Promise<SubmitServerFormState> {
  const rawFormDataEntries = Object.fromEntries(formData.entries());
  const userId = formData.get('userId') as string | null;

  if (!userId) {
    return {
      message: "User information not provided. You must be logged in to submit a server.",
      error: true,
      fields: rawFormDataEntries as Record<string, string | File>,
      serverId: null,
    };
  }

  // Prepare data for Zod parsing, excluding userId
  const zodParseData: Record<string, any> = {};
  for (const key in rawFormDataEntries) {
    if (key !== 'userId') {
      zodParseData[key] = rawFormDataEntries[key];
    }
  }

  // Explicitly parse port to number for Zod
  if (typeof zodParseData.port === 'string') {
    const parsedPort = parseInt(zodParseData.port, 10);
    zodParseData.port = isNaN(parsedPort) ? undefined : parsedPort;
  }

  const parsed = serverFormSchema.safeParse(zodParseData);

  if (!parsed.success) {
    return {
      message: 'Invalid form data. Please check the fields.',
      fields: rawFormDataEntries as Record<string, string | File>,
      error: true,
      errors: parsed.error.errors.map(err => ({ path: err.path, message: err.message })),
      serverId: null,
    };
  }

  const submittedBy = userId;
  const bannerDownloadURL = parsed.data.bannerUrl || undefined;
  const logoDownloadURL = parsed.data.logoUrl || undefined;

  try {
    // Fetch initial server stats before saving
    const initialStats = await getInitialServerStats(parsed.data.ipAddress, parsed.data.port);

    const dataToSave: ServerDataForCreation = {
      name: parsed.data.name,
      ipAddress: parsed.data.ipAddress,
      port: parsed.data.port,
      game: parsed.data.game,
      description: parsed.data.description,
      bannerUrl: bannerDownloadURL,
      logoUrl: logoDownloadURL,
      tags: parsed.data.tags ? parsed.data.tags.split(',').map(tag => tag.trim()).filter(tag => tag) : [],
      submittedBy: submittedBy,
      initialIsOnline: initialStats.isOnline,
      initialPlayerCount: initialStats.playerCount,
      initialMaxPlayers: initialStats.maxPlayers,
    };

    const newServer = await addFirebaseServer(dataToSave);

    revalidatePath('/');
    revalidatePath('/servers/submit');
    revalidatePath('/admin/servers');
    revalidatePath('/dashboard'); // Revalidate dashboard if user submitted servers are shown there
    return {
        message: `Server "${newServer.name}" submitted successfully! It's now pending review.`,
        server: newServer, // Return the created server object
        serverId: newServer.id,
        error: false
    };
  } catch (e: any) {
    // console.error("[actions.ts] Submission error in submitServerAction:", e);
    return {
      message: e.message || 'Failed to submit server. Please try again.',
      fields: rawFormDataEntries as Record<string, string | File>,
      error: true,
      serverId: null,
    };
  }
}


export async function voteAction(serverId: string, userId: string | undefined): Promise<{ success: boolean; message: string; newVotes?: number; serverId?: string }> {
   if (!auth) {
    // console.warn("[actions.ts] voteAction: Firebase Auth is not initialized.");
    return { success: false, message: "Authentication service not available. Please try again later." };
  }

  if (!serverId) {
    return { success: false, message: 'Server ID is required.' };
  }

  if (!userId) {
    return { success: false, message: "You must be logged in to vote." };
  }

  try {
    const updatedServer = await voteForFirebaseServer(serverId, userId);
    if (updatedServer) {
      revalidatePath('/');
      revalidatePath(`/servers/${serverId}`);
      revalidatePath('/admin/servers');
      revalidatePath('/dashboard');
      return { success: true, message: `Voted for ${updatedServer.name}!`, newVotes: updatedServer.votes, serverId: serverId };
    }
    return { success: false, message: 'Server not found or unable to vote.' };
  } catch (error: any) {
    // console.error("[actions.ts] Error in voteAction:", error);
    return { success: false, message: error.message || "An unexpected error occurred during voting." };
  }
}

export async function approveServerAction(serverId: string, adminUserId?: string): Promise<{ success: boolean; message: string; server?: Server }> {
  if (!adminUserId || !await isAdmin(adminUserId)) {
    return { success: false, message: "Unauthorized: Admin role required." };
  }
  try {
    const server = await updateFirebaseServerStatus(serverId, 'approved');
    if (server) {
      revalidatePath('/admin/servers');
      revalidatePath(`/servers/${serverId}`);
      revalidatePath('/');
      revalidatePath('/dashboard');
      return { success: true, message: `Server "${server.name}" approved.`, server };
    }
    return { success: false, message: "Failed to approve server: not found." };
  } catch (error: any) {
    return { success: false, message: error.message || "Failed to approve server." };
  }
}

export async function rejectServerAction(serverId: string, adminUserId?: string): Promise<{ success: boolean; message: string; server?: Server }> {
 if (!adminUserId || !await isAdmin(adminUserId)) {
    return { success: false, message: "Unauthorized: Admin role required." };
  }
  try {
    const server = await updateFirebaseServerStatus(serverId, 'rejected');
     if (server) {
      revalidatePath('/admin/servers');
      revalidatePath(`/servers/${serverId}`);
      revalidatePath('/');
      revalidatePath('/dashboard');
      return { success: true, message: `Server "${server.name}" rejected.`, server };
    }
    return { success: false, message: "Failed to reject server: not found." };
  } catch (error: any) {
    return { success: false, message: error.message || "Failed to reject server." };
  }
}

export async function deleteServerAction(serverId: string, adminUserId?: string): Promise<{ success: boolean; message: string }> {
  if (!adminUserId || !await isAdmin(adminUserId)) {
    return { success: false, message: "Unauthorized: Admin role required." };
  }
  try {
    await deleteFirebaseServerData(serverId);
    revalidatePath('/admin/servers');
    revalidatePath('/');
    revalidatePath('/dashboard');
    return { success: true, message: "Server deleted successfully." };
  } catch (error: any) {
    return { success: false, message: error.message || "Failed to delete server." };
  }
}

export interface UpdateUserProfileFormState {
  message: string;
  error: boolean;
  updatedProfile?: Partial<Pick<UserProfile, 'displayName' | 'photoURL'>>;
}


export async function updateUserProfileAction(
  prevState: UpdateUserProfileFormState,
  formData: FormData
): Promise<UpdateUserProfileFormState> {
  const userIdFromForm = formData.get('userId') as string | null;

  if (!userIdFromForm) {
     return { message: "User information not provided. Cannot update profile.", error: true };
  }

  const rawFormData = Object.fromEntries(formData.entries());
  // Ensure userId is not part of Zod parsing
  const parseableProfileData = {...rawFormData};
  delete parseableProfileData.userId;

  const parsed = userProfileUpdateSchema.safeParse(parseableProfileData);

  if (!parsed.success) {
    return {
      message: parsed.error.errors[0]?.message || 'Invalid form data.',
      error: true,
    };
  }

  const updates: Partial<Pick<UserProfile, 'displayName' | 'photoURL'>> = {};
  if (parsed.data.displayName) {
    updates.displayName = parsed.data.displayName;
  }
  // Add photoURL update if it's part of the form and schema in future
  // if (parsed.data.photoURL) { updates.photoURL = parsed.data.photoURL; }


  if (Object.keys(updates).length === 0) {
     return { message: "No changes to save.", error: false };
  }

  try {
    const updatedFields = await updateFirebaseUserProfile(userIdFromForm, updates);
    revalidatePath('/profile/settings');
    revalidatePath('/dashboard'); // Revalidate dashboard if profile info is shown there
    return { message: 'Profile updated successfully!', error: false, updatedProfile: updatedFields };
  } catch (e: any) {
    return {
      message: e.message || 'Failed to update profile.',
      error: true,
    };
  }
}


export async function featureServerAction(
  serverId: string,
  requestingUserId: string | undefined,
  durationDays?: number
): Promise<{ success: boolean; message: string; server?: Server }> {

  if (!requestingUserId) {
    return { success: false, message: "User ID not provided for feature request." };
  }

  const profile = await getUserProfile(requestingUserId);
  if (!profile) {
    return { success: false, message: "Requesting user profile not found." };
  }

  // Here, you might add logic to check if the user *can* feature a server.
  // For example, if it's a paid feature, this is where payment processing would occur.
  // Or, if only admins can feature, or users can only feature their own servers:
  // const serverToFeature = await getFirebaseServerById(serverId);
  // if (!serverToFeature || serverToFeature.submittedBy !== requestingUserId && profile.role !== 'admin') {
  //   return { success: false, message: "You do not have permission to feature this server." };
  // }


  try {
    const server = await updateServerFeaturedStatus(serverId, true, durationDays);
    if (server) {
      revalidatePath("/admin/servers");
      revalidatePath(`/servers/${serverId}`);
      revalidatePath("/");
      revalidatePath("/dashboard");
      return {
        success: true,
        message: `Server "${server.name}" has been featured.`,
        server,
      };
    }
    return { success: false, message: "Failed to feature server: not found." };
  } catch (error: any) {
    return { success: false, message: error.message || "Failed to feature server." };
  }
}

export async function unfeatureServerAction(
  serverId: string,
  adminUserId: string | undefined
): Promise<{ success: boolean; message: string; server?: Server }> {
  if (!adminUserId || !(await isAdmin(adminUserId))) {
    return { success: false, message: "Unauthorized: Admin role required to unfeature." };
  }
  try {
    const server = await updateServerFeaturedStatus(serverId, false);
    if (server) {
      revalidatePath("/admin/servers");
      revalidatePath(`/servers/${serverId}`);
      revalidatePath("/");
      revalidatePath("/dashboard");
      return {
        success: true,
        message: `Server "${server.name}" is no longer featured.`,
        server,
      };
    }
    return { success: false, message: "Failed to unfeature server: not found." };
  } catch (error: any) {
    return { success: false, message: error.message || "Failed to unfeature server." };
  }
}

export interface ReportServerFormState {
  message: string;
  error?: boolean;
  errors?: { path: string | (string|number)[]; message: string }[];
}

export async function reportServerAction(
  prevState: ReportServerFormState,
  formData: FormData
): Promise<ReportServerFormState> {
  const serverId = formData.get('serverId') as string | null;
  const serverName = formData.get('serverName') as string | null;
  const reportingUserId = formData.get('reportingUserId') as string | null;
  const reportingUserDisplayName = formData.get('reportingUserDisplayName') as string | null;

  if (!serverId || !serverName || !reportingUserId) {
    return { message: "Missing required information (server or user details).", error: true };
  }

  const parsed = reportFormSchema.safeParse({
    reason: formData.get('reason'),
    description: formData.get('description'),
  });

  if (!parsed.success) {
    return {
      message: "Invalid report data.",
      error: true,
      errors: parsed.error.errors.map(err => ({ path: err.path, message: err.message })),
    };
  }

  try {
    const reportData: Omit<Report, 'id' | 'reportedAt' | 'status' | 'resolvedAt' | 'resolvedBy' | 'adminNotes'> = {
      serverId,
      serverName,
      reportingUserId,
      reportingUserDisplayName: reportingUserDisplayName || 'Unknown User',
      reason: parsed.data.reason,
      description: parsed.data.description,
    };
    await addFirebaseReport(reportData);
    revalidatePath(`/servers/${serverId}`); // Revalidate the specific server page
    revalidatePath('/admin/reports'); // Revalidate admin reports page
    return { message: "Server reported successfully. Our team will review it shortly.", error: false };
  } catch (e: any) {
    return { message: e.message || "Failed to submit report.", error: true };
  }
}

export async function resolveReportAction(
  reportId: string,
  adminUserId: string,
  newStatus: ReportStatus,
  adminNotes?: string
): Promise<{ success: boolean; message: string; report?: Report }> {
  if (!adminUserId || !await isAdmin(adminUserId)) {
    return { success: false, message: "Unauthorized: Admin role required." };
  }

  try {
    const report = await updateFirebaseReportStatus(reportId, newStatus, adminUserId, adminNotes);
    if (report) {
      revalidatePath('/admin/reports');
      // Optionally, revalidate the server page if action on report might affect it
      if (report.serverId) {
          revalidatePath(`/servers/${report.serverId}`);
      }
      return { success: true, message: `Report status updated to ${newStatus}.`, report };
    }
    return { success: false, message: "Failed to update report: not found." };
  } catch (error: any) {
    return { success: false, message: error.message || "Failed to update report status." };
  }
}

export async function updateUserRoleAction(uid: string, newRole: 'user' | 'admin', adminPerformingActionId: string): Promise<{ success: boolean; message: string }> {
  if (!adminPerformingActionId || !(await isAdmin(adminPerformingActionId))) {
    return { success: false, message: "Unauthorized: Admin role required." };
  }
  try {
    await updateUserFirebaseRole(uid, newRole);
    revalidatePath('/admin/users');
    return { success: true, message: `User role updated to ${newRole}.` };
  } catch (error: any) {
    return { success: false, message: error.message || "Failed to update user role." };
  }
}

export async function deleteUserDataAction(uid: string, adminPerformingActionId: string): Promise<{ success: boolean; message: string }> {
   if (!adminPerformingActionId || !(await isAdmin(adminPerformingActionId))) {
    return { success: false, message: "Unauthorized: Admin role required." };
  }
  try {
    await deleteFirebaseUserFirestoreData(uid);
    revalidatePath('/admin/users');
    return { success: true, message: `User data deleted.` };
  } catch (error: any) {
    return { success: false, message: error.message || "Failed to delete user data." };
  }
}
