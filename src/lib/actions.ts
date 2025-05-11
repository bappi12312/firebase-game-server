
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
  type ServerDataForCreation
} from './firebase-data';
import type { Server, ServerStatus, UserProfile, Report, ReportStatus, ReportReason } from './types';
import { auth } from './firebase'; // Removed storage import as it's not used here anymore
// Firebase Storage functions (ref, uploadBytes, getDownloadURL) are removed as uploads are client-side
import { serverFormSchema, reportFormSchema, userProfileUpdateSchema } from '@/lib/schemas';
// uuidv4 removed as it's not used here anymore

// Helper to check for admin role
async function isAdmin(userId: string): Promise<boolean> {
  const profile = await getUserProfile(userId);
  return profile?.role === 'admin';
}

// uploadFileToStorage function removed as uploads are now client-side


export interface SubmitServerFormState {
  message: string;
  fields?: Record<string, string | number | File | null>; 
  server?: Server;
  error?: boolean;
  errors?: { path: string; message: string }[];
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
      fields: rawFormDataEntries as Record<string, string | File> 
    };
  }
  
  const zodParseData: Record<string, any> = {};
  for (const key in rawFormDataEntries) {
    if (key !== 'userId') { // Exclude userId as it's handled separately
      zodParseData[key] = rawFormDataEntries[key];
    }
  }

  if (typeof zodParseData.port === 'string') {
    zodParseData.port = parseInt(zodParseData.port, 10);
    if (isNaN(zodParseData.port as number)) {
        delete zodParseData.port; 
    }
  }
  
  const parsed = serverFormSchema.safeParse(zodParseData);

  if (!parsed.success) {
    return {
      message: 'Invalid form data. Please check the fields.',
      fields: rawFormDataEntries as Record<string, string | File>, 
      error: true,
      errors: parsed.error.errors.map(err => ({ path: err.path.join('.'), message: err.message })),
    };
  }
  
  const submittedBy = userId;
  // URLs now come directly from parsed data, assuming client-side upload.
  const bannerDownloadURL = parsed.data.bannerUrl || undefined;
  const logoDownloadURL = parsed.data.logoUrl || undefined;

  try {
    const dataToSave: ServerDataForCreation = {
      name: parsed.data.name,
      ipAddress: parsed.data.ipAddress,
      port: parsed.data.port, 
      game: parsed.data.game,
      description: parsed.data.description,
      bannerUrl: (bannerDownloadURL && bannerDownloadURL.trim() !== '') ? bannerDownloadURL : undefined,
      logoUrl: (logoDownloadURL && logoDownloadURL.trim() !== '') ? logoDownloadURL : undefined,
      tags: parsed.data.tags ? parsed.data.tags.split(',').map(tag => tag.trim()).filter(tag => tag) : [],
      submittedBy: submittedBy,
    };
    
    const newServer = await addFirebaseServer(dataToSave);
    
    revalidatePath('/'); 
    revalidatePath('/servers/submit'); 
    revalidatePath('/admin/servers'); 
    revalidatePath('/dashboard');
    return { message: `Server "${newServer.name}" submitted successfully! It's now pending review.`, server: newServer, error: false };
  } catch (e: any) {
    console.error("Submission error in submitServerAction:", e);
    return {
      message: e.message || 'Failed to submit server. Please try again.',
      fields: rawFormDataEntries as Record<string, string | File>,
      error: true,
    };
  }
}


export async function voteAction(serverId: string, userId: string | undefined): Promise<{ success: boolean; message: string; newVotes?: number, serverId?: string }> {
   if (!auth) {
    return { success: false, message: "Authentication service not available." };
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
    console.error("Error in voteAction:", error);
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

  if (Object.keys(updates).length === 0) {
     return { message: "No changes to save.", error: false };
  }

  try {
    const updatedFields = await updateFirebaseUserProfile(userIdFromForm, updates);
    revalidatePath('/profile/settings');
    revalidatePath('/dashboard');
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
  
  // For self-serve, user doesn't need to be admin if they are featuring their own server
  // The updateServerFeaturedStatus logic should ideally handle permission if it's not an admin action.
  // For now, assuming if a user is making this call, they have permission (e.g., via UI flow for their own server).
  // A more robust check might involve verifying server ownership (submittedBy field).

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
  errors?: { path: string; message: string }[];
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
      errors: parsed.error.errors.map(err => ({ path: err.path.join('.'), message: err.message })),
    };
  }

  try {
    const reportData: Omit<Report, 'id' | 'reportedAt' | 'status'> = {
      serverId,
      serverName,
      reportingUserId,
      reportingUserDisplayName: reportingUserDisplayName || 'Anonymous',
      reason: parsed.data.reason,
      description: parsed.data.description,
    };
    await addFirebaseReport(reportData);
    revalidatePath(`/servers/${serverId}`); 
    revalidatePath('/admin/reports'); 
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
  if (!await isAdmin(adminUserId)) {
    return { success: false, message: "Unauthorized: Admin role required." };
  }

  try {
    const report = await updateFirebaseReportStatus(reportId, newStatus, adminUserId, adminNotes);
    if (report) {
      revalidatePath('/admin/reports');
      return { success: true, message: `Report status updated to ${newStatus}.`, report };
    }
    return { success: false, message: "Failed to update report: not found." };
  } catch (error: any) {
    return { success: false, message: error.message || "Failed to update report status." };
  }
}

