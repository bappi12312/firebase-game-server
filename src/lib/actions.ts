
'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { 
  addFirebaseServer, 
  voteForFirebaseServer,
  updateFirebaseServerStatus,
  deleteFirebaseServer as deleteFirebaseServerData,
  getUserProfile,
  updateFirebaseUserProfile
} from './firebase-data';
import type { Server, ServerStatus, UserProfile } from './types';
import { auth } from './firebase'; 

// Helper to check for admin role
async function isAdmin(userId: string | undefined): Promise<boolean> {
  if (!userId) return false;
  // Assuming auth is initialized and available for server-side checks if necessary
  // For client-SDK on server, auth.currentUser is not reliable.
  // This function should ideally use Admin SDK if called from a trusted server environment
  // or rely on a custom claim set via Admin SDK.
  // For now, it fetches profile which works if Firestore rules allow.
  const userProfile = await getUserProfile(userId);
  return userProfile?.role === 'admin';
}


const serverFormSchema = z.object({
  name: z.string().min(3, { message: 'Server name must be at least 3 characters long.' }).max(50, { message: 'Server name too long.'}),
  ipAddress: z.string().regex(/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$|^([a-zA-Z0-9]+(?:-[a-zA-Z0-9]+)*\.)+[a-zA-Z]{2,}$/, { message: 'Invalid IP address or domain name.'}),
  port: z.coerce.number().min(1, { message: 'Port must be a positive number.'}).max(65535, { message: 'Port number cannot exceed 65535.'}),
  game: z.string().min(1, { message: 'Please select a game.'}),
  description: z.string().min(10, { message: 'Description must be at least 10 characters.'}).max(1000, { message: 'Description cannot exceed 1000 characters.'}),
  bannerUrl: z.string().url({ message: 'Invalid banner URL (e.g., https://example.com/banner.jpg).'}).optional().or(z.literal('')),
  logoUrl: z.string().url({ message: 'Invalid logo URL (e.g., https://example.com/logo.png).'}).optional().or(z.literal('')),
  tags: z.string().optional().refine(val => !val || val.split(',').every(tag => tag.trim().length > 0 && tag.trim().length <= 20), {
    message: "Tags should be comma-separated, each 1-20 characters."
  }).refine(val => !val || val.split(',').length <= 5, {
    message: "Maximum of 5 tags allowed."
  }),
});


export interface SubmitServerFormState {
  message: string;
  fields?: Record<string, string>;
  server?: Server;
  error?: boolean;
  errors?: { path: string; message: string }[];
}

export async function submitServerAction(
  prevState: SubmitServerFormState, // Previous state from useActionState
  formData: FormData
): Promise<SubmitServerFormState> {
   if (!auth || !auth.currentUser) { // Check if auth is initialized and user is logged in
    return { message: "You must be logged in to submit a server.", error: true, fields: Object.fromEntries(formData) as Record<string,string> };
  }
  
  const rawFormData = Object.fromEntries(formData.entries());
  const parsed = serverFormSchema.safeParse(rawFormData);

  if (!parsed.success) {
    return {
      message: 'Invalid form data. Please check the fields.',
      fields: rawFormData as Record<string, string>, // Return raw form data for repopulation
      error: true,
      errors: parsed.error.errors.map(err => ({ path: err.path.join('.'), message: err.message })),
    };
  }
  
  const submittedBy = auth.currentUser.uid;

  try {
    // Prepare data, ensuring optional fields are handled
    const dataToSave = {
      ...parsed.data,
      bannerUrl: parsed.data.bannerUrl || undefined, // Store undefined if empty string
      logoUrl: parsed.data.logoUrl || undefined,   // Store undefined if empty string
      tags: parsed.data.tags ? parsed.data.tags.split(',').map(tag => tag.trim()).filter(tag => tag) : [], // Convert comma-separated string to array
      submittedBy: submittedBy, // Add submittedBy field
    };
    
    // Omit fields not expected by addFirebaseServer (id, votes, timestamps, status etc. are set by backend)
    const { 
        // These are set by addFirebaseServer or are not part of initial submission data structure for that func
    } = dataToSave;


    const newServer = await addFirebaseServer(dataToSave);
    
    revalidatePath('/'); // Revalidate homepage
    revalidatePath('/servers/submit'); // Revalidate submission page (though usually redirects or clears)
    revalidatePath('/admin/servers'); // Revalidate admin server list
    return { message: `Server "${newServer.name}" submitted successfully! It's now pending review.`, server: newServer, error: false };
  } catch (e: any) {
    console.error("Submission error in submitServerAction:", e);
    return {
      message: e.message || 'Failed to submit server. Please try again.',
      fields: rawFormData as Record<string, string>,
      error: true,
    };
  }
}


export async function voteAction(serverId: string): Promise<{ success: boolean; message: string; newVotes?: number, serverId?: string }> {
   if (!auth) {
    return { success: false, message: "Authentication service not available." };
  }

  if (!serverId) {
    return { success: false, message: 'Server ID is required.' };
  }
  
  const currentUser = auth.currentUser;
  if (!currentUser) {
    return { success: false, message: "You must be logged in to vote." };
  }


  try {
    const updatedServer = await voteForFirebaseServer(serverId, currentUser.uid); // Pass UID for vote tracking
    if (updatedServer) {
      revalidatePath('/'); 
      revalidatePath(`/servers/${serverId}`); 
      revalidatePath('/admin/servers'); // If admin dashboard shows votes
      return { success: true, message: `Voted for ${updatedServer.name}!`, newVotes: updatedServer.votes, serverId: serverId };
    }
    return { success: false, message: 'Server not found or unable to vote.' };
  } catch (error: any) {
    console.error("Error in voteAction:", error);
    return { success: false, message: error.message || "An unexpected error occurred during voting." };
  }
}

export async function approveServerAction(serverId: string, adminUserId?: string): Promise<{ success: boolean; message: string }> {
  if (!await isAdmin(adminUserId)) {
    return { success: false, message: "Unauthorized: Admin role required." };
  }
  try {
    const server = await updateFirebaseServerStatus(serverId, 'approved');
    if (server) {
      revalidatePath('/admin/servers');
      revalidatePath(`/servers/${serverId}`);
      revalidatePath('/');
      return { success: true, message: `Server "${server.name}" approved.` };
    }
    return { success: false, message: "Failed to approve server: not found." };
  } catch (error: any) {
    return { success: false, message: error.message || "Failed to approve server." };
  }
}

export async function rejectServerAction(serverId: string, adminUserId?: string): Promise<{ success: boolean; message: string }> {
 if (!await isAdmin(adminUserId)) {
    return { success: false, message: "Unauthorized: Admin role required." };
  }
  try {
    const server = await updateFirebaseServerStatus(serverId, 'rejected');
     if (server) {
      revalidatePath('/admin/servers');
      revalidatePath(`/servers/${serverId}`); // Potentially hide it from public view if rejected
      revalidatePath('/');
      return { success: true, message: `Server "${server.name}" rejected.` };
    }
    return { success: false, message: "Failed to reject server: not found." };
  } catch (error: any) {
    return { success: false, message: error.message || "Failed to reject server." };
  }
}

export async function deleteServerAction(serverId: string, adminUserId?: string): Promise<{ success: boolean; message: string }> {
  if (!await isAdmin(adminUserId)) {
    return { success: false, message: "Unauthorized: Admin role required." };
  }
  try {
    await deleteFirebaseServerData(serverId);
    revalidatePath('/admin/servers');
    revalidatePath('/'); // Remove from listings
    return { success: true, message: "Server deleted successfully." };
  } catch (error: any) {
    return { success: false, message: error.message || "Failed to delete server." };
  }
}

const userProfileUpdateSchema = z.object({
  displayName: z.string().min(3, 'Display name must be at least 3 characters.').max(50, 'Display name must be less than 50 characters.').optional(),
  // photoURL: z.string().url('Invalid photo URL.').optional().or(z.literal('')), // Add if handling photoURL updates
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
  if (!auth || !auth.currentUser) {
    return { message: "You must be logged in to update your profile.", error: true };
  }

  const rawFormData = Object.fromEntries(formData.entries());
  const parsed = userProfileUpdateSchema.safeParse(rawFormData);

  if (!parsed.success) {
    return {
      message: parsed.error.errors[0]?.message || 'Invalid form data.',
      error: true,
    };
  }

  const userId = auth.currentUser.uid;
  const updates: Partial<Pick<UserProfile, 'displayName' | 'photoURL'>> = {};
  if (parsed.data.displayName) {
    updates.displayName = parsed.data.displayName;
  }
  // Add photoURL logic if implementing photo updates
  // if (parsed.data.photoURL) updates.photoURL = parsed.data.photoURL;


  if (Object.keys(updates).length === 0) {
     return { message: "No changes to save.", error: false };
  }

  try {
    const updatedFields = await updateFirebaseUserProfile(userId, updates);
    revalidatePath('/profile/settings');
    return { message: 'Profile updated successfully!', error: false, updatedProfile: updatedFields };
  } catch (e: any) {
    return {
      message: e.message || 'Failed to update profile.',
      error: true,
    };
  }
}
