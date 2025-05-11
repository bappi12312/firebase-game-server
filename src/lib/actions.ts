
'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { 
  addFirebaseServer, 
  voteForFirebaseServer,
  updateFirebaseServerStatus,
  deleteFirebaseServer as deleteFirebaseServerData,
  getUserProfile,
  updateFirebaseUserProfile // Import new function
} from './firebase-data';
import type { Server, ServerStatus, UserProfile } from './types';
import { auth } from './firebase'; // Import auth for checking user status

// Helper to check for admin role
async function isAdmin(userId: string | undefined): Promise<boolean> {
  if (!userId) return false;
  if (!auth) return false; // Firebase not initialized
  const userProfile = await getUserProfile(userId);
  return userProfile?.role === 'admin';
}


const serverSchema = z.object({
  name: z.string().min(3, 'Server name must be at least 3 characters long.'),
  ipAddress: z.string().regex(/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$|^([a-zA-Z0-9]+(-[a-zA-Z0-9]+)*\.)+[a-zA-Z]{2,}$/, 'Invalid IP address or domain.'),
  port: z.coerce.number().min(1, 'Port must be a positive number.').max(65535, 'Port number cannot exceed 65535.'),
  game: z.string().min(1, 'Game selection is required.'),
  description: z.string().min(10, 'Description must be at least 10 characters long.').max(500, 'Description cannot exceed 500 characters.'),
  bannerUrl: z.string().url('Invalid banner URL.').optional().or(z.literal('')),
  logoUrl: z.string().url('Invalid logo URL.').optional().or(z.literal('')),
});

export interface SubmitServerFormState {
  message: string;
  fields?: Record<string, string>;
  server?: Server;
  error?: boolean;
}

export async function submitServerAction(
  prevState: SubmitServerFormState,
  formData: FormData
): Promise<SubmitServerFormState> {
   if (!auth) {
    return { message: "Authentication service not available.", error: true };
  }
  
  const rawFormData = Object.fromEntries(formData.entries());
  const parsed = serverSchema.safeParse(rawFormData);

  if (!parsed.success) {
    return {
      message: 'Invalid form data. Please check the fields.',
      fields: Object.fromEntries(
        Object.entries(rawFormData).map(([key, value]) => [key, String(value)])
      ),
      error: true,
    };
  }

  try {
    const dataToSave = {
      ...parsed.data,
      bannerUrl: parsed.data.bannerUrl || undefined,
      logoUrl: parsed.data.logoUrl || undefined,
    };
    
    const newServer = await addFirebaseServer(dataToSave);
    
    revalidatePath('/');
    revalidatePath('/servers/submit'); 
    revalidatePath('/admin/servers');
    return { message: `Server "${newServer.name}" submitted successfully! It's now pending review.`, server: newServer, error: false };
  } catch (e: any) {
    console.error("Submission error:", e);
    return {
      message: e.message || 'Failed to submit server. Please try again.',
      fields: Object.fromEntries(
        Object.entries(rawFormData).map(([key, value]) => [key, String(value)])
      ),
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

  try {
    const updatedServer = await voteForFirebaseServer(serverId);
    if (updatedServer) {
      revalidatePath('/'); 
      revalidatePath(`/servers/${serverId}`); 
      revalidatePath('/admin/servers');
      return { success: true, message: `Voted for ${updatedServer.name}!`, newVotes: updatedServer.votes, serverId: serverId };
    }
    return { success: false, message: 'Server not found or unable to vote.' };
  } catch (error: any) {
    console.error('Vote failed:', error);
    return { success: false, message: error.message || 'An error occurred while voting.' };
  }
}

// --- Admin Actions ---
export async function approveServerAction(serverId: string, currentUserId?: string): Promise<{ success: boolean; message: string }> {
  if (!await isAdmin(currentUserId)) {
    return { success: false, message: 'Unauthorized: Admin access required.' };
  }
  try {
    await updateFirebaseServerStatus(serverId, 'approved');
    revalidatePath('/admin/servers');
    revalidatePath('/');
    revalidatePath(`/servers/${serverId}`);
    return { success: true, message: 'Server approved.' };
  } catch (error: any) {
    return { success: false, message: error.message || 'Failed to approve server.' };
  }
}

export async function rejectServerAction(serverId: string, currentUserId?: string): Promise<{ success: boolean; message: string }> {
   if (!await isAdmin(currentUserId)) {
    return { success: false, message: 'Unauthorized: Admin access required.' };
  }
  try {
    await updateFirebaseServerStatus(serverId, 'rejected');
    revalidatePath('/admin/servers');
    revalidatePath(`/servers/${serverId}`);
    return { success: true, message: 'Server rejected.' };
  } catch (error: any) {
    return { success: false, message: error.message || 'Failed to reject server.' };
  }
}

export async function deleteServerAction(serverId: string, currentUserId?: string): Promise<{ success: boolean; message: string }> {
   if (!await isAdmin(currentUserId)) {
    return { success: false, message: 'Unauthorized: Admin access required.' };
  }
  try {
    await deleteFirebaseServerData(serverId);
    revalidatePath('/admin/servers');
    revalidatePath('/');
    return { success: true, message: 'Server deleted.' };
  } catch (error: any) {
    return { success: false, message: error.message || 'Failed to delete server.' };
  }
}

// --- User Profile Actions ---
const userProfileUpdateSchema = z.object({
  displayName: z.string().min(3, 'Display name must be at least 3 characters.').max(50, 'Display name too long.'),
});

export interface UpdateUserProfileFormState {
  message: string;
  error?: boolean;
  updatedProfile?: Partial<UserProfile>;
}

export async function updateUserProfileAction(
  prevState: UpdateUserProfileFormState,
  formData: FormData
): Promise<UpdateUserProfileFormState> {
  if (!auth || !auth.currentUser) {
    return { message: 'You must be logged in to update your profile.', error: true };
  }

  const rawFormData = {
    displayName: formData.get('displayName'),
  };
  
  const parsed = userProfileUpdateSchema.safeParse(rawFormData);

  if (!parsed.success) {
    return {
      message: 'Invalid data. ' + parsed.error.errors.map(e => e.message).join(' '),
      error: true,
    };
  }

  try {
    const updatedData = await updateFirebaseUserProfile(auth.currentUser.uid, { displayName: parsed.data.displayName });
    revalidatePath('/profile/settings');
    // Consider revalidating other paths where display name might be shown, or rely on client-side context update
    return { message: 'Profile updated successfully!', updatedProfile: updatedData, error: false };
  } catch (e: any) {
    return { message: e.message || 'Failed to update profile.', error: true };
  }
}
