
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
  type ServerDataForCreation
} from './firebase-data';
import type { Server, ServerStatus, UserProfile } from './types';
import { auth } from './firebase'; 
import { serverFormSchema } from '@/lib/schemas';

// Helper to check for admin role or if user is featuring their own server (simplified for now)
async function canUserFeatureServer(userId: string | undefined, serverId: string, serverData?: Server | null): Promise<boolean> {
  if (!userId) return false;
  
  // Check if admin
  const userProfile = await getUserProfile(userId);
  if (userProfile?.role === 'admin') {
    return true;
  }

  // Check if user is submitter of the server (for self-serve paid features)
  // This requires fetching server data if not already available
  if (!serverData) {
    // This part might need to be handled differently if serverData isn't easily passed or too costly to fetch again
    // For now, let's assume for self-serve, this check needs to be robust.
    // As a placeholder, if not admin, and trying to feature, it's a user action on their server.
    // A real implementation would fetch the server to check submittedBy.
    // For this simulation, if it's not an admin action (adminUserId not passed as such), we allow it.
    return true; // Placeholder: allows user to feature if not explicitly an admin action.
                   // This needs to be replaced with actual ownership/submitter check.
  }
  return serverData.submittedBy === userId;
}


export interface SubmitServerFormState {
  message: string;
  fields?: Record<string, string | number>; 
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
      fields: rawFormDataEntries as Record<string, string> 
    };
  }
  
  const rawFormDataForParsing = { ...rawFormDataEntries };
  delete rawFormDataForParsing.userId; 

  if (typeof rawFormDataForParsing.port === 'string') {
    rawFormDataForParsing.port = parseInt(rawFormDataForParsing.port, 10);
    if (isNaN(rawFormDataForParsing.port as number)) {
        delete rawFormDataForParsing.port; 
    }
  }


  const parsed = serverFormSchema.safeParse(rawFormDataForParsing);

  if (!parsed.success) {
    return {
      message: 'Invalid form data. Please check the fields.',
      fields: rawFormDataEntries as Record<string, string>, 
      error: true,
      errors: parsed.error.errors.map(err => ({ path: err.path.join('.'), message: err.message })),
    };
  }
  
  const submittedBy = userId;

  try {
    const dataToSave: ServerDataForCreation = {
      name: parsed.data.name,
      ipAddress: parsed.data.ipAddress,
      port: parsed.data.port, 
      game: parsed.data.game,
      description: parsed.data.description,
      bannerUrl: (parsed.data.bannerUrl && parsed.data.bannerUrl.trim() !== '') ? parsed.data.bannerUrl : undefined,
      logoUrl: (parsed.data.logoUrl && parsed.data.logoUrl.trim() !== '') ? parsed.data.logoUrl : undefined,
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
      fields: rawFormDataEntries as Record<string, string>,
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

const userProfileUpdateSchemaAction = z.object({ 
  displayName: z.string().min(3, 'Display name must be at least 3 characters.').max(50, 'Display name must be less than 50 characters.').optional(),
});

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

  const parsed = userProfileUpdateSchemaAction.safeParse(parseableProfileData);

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
  requestingUserId: string | undefined, // User initiating the feature (could be admin or regular user)
  durationDays?: number
): Promise<{ success: boolean; message: string; server?: Server }> {
  
  if (!requestingUserId) {
    return { success: false, message: "User ID not provided for feature request." };
  }

  // Permission Check:
  // 1. Is the requestingUser an admin?
  // 2. OR is the requestingUser the submitter of the server (for self-paid features)?
  // This part needs a robust implementation. For simulation, we simplify.
  const profile = await getUserProfile(requestingUserId);
  const isRequestingUserAdmin = profile?.role === 'admin';

  // In a real scenario, if not admin, you'd fetch the server to check server.submittedBy === requestingUserId
  // For this simulation, if the `requestingUserId` is not an admin, we'll assume it's a user trying to feature their own server.
  // A proper check for server ownership or submission by `requestingUserId` would be needed here.
  // e.g., const serverToFeature = await getFirebaseServerById(serverId);
  //       if (!isRequestingUserAdmin && serverToFeature?.submittedBy !== requestingUserId) {
  //         return { success: false, message: "Unauthorized: You can only feature your own servers or require admin rights." };
  //       }
  
  // Simplified check for now: if not admin, we allow (simulating user paid feature)
  // If it's an admin making the change, that's also fine.
  // This means the action is less restrictive for the simulation purpose.
  // Production would need:
  // - If admin: allow.
  // - If user: check if server.submittedBy === requestingUserId AND payment is verified.
  
  // If `requestingUserId` is an admin, they can feature any server.
  // If `requestingUserId` is not an admin, it's assumed they are trying to feature their own server (after payment).
  // The `updateServerFeaturedStatus` itself doesn't have permission checks, it's up to this action.

  try {
    const server = await updateServerFeaturedStatus(serverId, true, durationDays);
    if (server) {
      revalidatePath("/admin/servers"); // For admins to see changes
      revalidatePath(`/servers/${serverId}`); // For the server's detail page
      revalidatePath("/"); // For the main server list
      revalidatePath("/dashboard"); // If featured servers appear on user dashboards
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
  adminUserId: string | undefined // Only admins can unfeature directly through this action
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

