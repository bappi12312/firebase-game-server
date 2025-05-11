
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
  type ServerDataForCreation // Import type for addFirebaseServer
} from './firebase-data';
import type { Server, ServerStatus, UserProfile } from './types';
import { auth } from './firebase'; 
import { serverFormSchema } from '@/lib/schemas'; // Import from new location

// Helper to check for admin role
async function isAdmin(userId: string | undefined): Promise<boolean> {
  if (!userId) return false;
  const userProfile = await getUserProfile(userId);
  return userProfile?.role === 'admin';
}

export interface SubmitServerFormState {
  message: string;
  fields?: Record<string, string>;
  server?: Server;
  error?: boolean;
  errors?: { path: string; message: string }[];
}

export async function submitServerAction(
  prevState: SubmitServerFormState, 
  formData: FormData
): Promise<SubmitServerFormState> {
  const rawFormData = Object.fromEntries(formData.entries()) as Record<string, string>;
  const userId = formData.get('userId') as string | null;

  if (!userId) {
    return { 
      message: "User information not provided. You must be logged in to submit a server.", 
      error: true, 
      fields: rawFormData
    };
  }
  
  // Remove userId from rawFormData before parsing with serverFormSchema if it's not part of the schema
  const parseableFormData = {...rawFormData};
  delete parseableFormData.userId;

  const parsed = serverFormSchema.safeParse(parseableFormData);

  if (!parsed.success) {
    return {
      message: 'Invalid form data. Please check the fields.',
      fields: rawFormData, 
      error: true,
      errors: parsed.error.errors.map(err => ({ path: err.path.join('.'), message: err.message })),
    };
  }
  
  const submittedBy = userId;

  try {
    const dataToSave: ServerDataForCreation = {
      name: parsed.data.name,
      ipAddress: parsed.data.ipAddress,
      port: parsed.data.port, // Already a number due to z.coerce.number()
      game: parsed.data.game,
      description: parsed.data.description,
      bannerUrl: parsed.data.bannerUrl || undefined,
      logoUrl: parsed.data.logoUrl || undefined,
      tags: parsed.data.tags ? parsed.data.tags.split(',').map(tag => tag.trim()).filter(tag => tag) : [],
      submittedBy: submittedBy,
    };
    
    const newServer = await addFirebaseServer(dataToSave);
    
    revalidatePath('/'); 
    revalidatePath('/servers/submit'); 
    revalidatePath('/admin/servers'); 
    return { message: `Server "${newServer.name}" submitted successfully! It's now pending review.`, server: newServer, error: false };
  } catch (e: any) {
    console.error("Submission error in submitServerAction:", e);
    return {
      message: e.message || 'Failed to submit server. Please try again.',
      fields: rawFormData,
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
    const updatedServer = await voteForFirebaseServer(serverId, currentUser.uid);
    if (updatedServer) {
      revalidatePath('/'); 
      revalidatePath(`/servers/${serverId}`); 
      revalidatePath('/admin/servers'); 
      return { success: true, message: `Voted for ${updatedServer.name}!`, newVotes: updatedServer.votes, serverId: serverId };
    }
    return { success: false, message: 'Server not found or unable to vote.' };
  } catch (error: any) {
    console.error("Error in voteAction:", error);
    return { success: false, message: error.message || "An unexpected error occurred during voting." };
  }
}

export async function approveServerAction(serverId: string, adminUserId?: string): Promise<{ success: boolean; message: string }> {
  if (!adminUserId || !await isAdmin(adminUserId)) {
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
 if (!adminUserId || !await isAdmin(adminUserId)) {
    return { success: false, message: "Unauthorized: Admin role required." };
  }
  try {
    const server = await updateFirebaseServerStatus(serverId, 'rejected');
     if (server) {
      revalidatePath('/admin/servers');
      revalidatePath(`/servers/${serverId}`); 
      revalidatePath('/');
      return { success: true, message: `Server "${server.name}" rejected.` };
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
    return { success: true, message: "Server deleted successfully." };
  } catch (error: any) {
    return { success: false, message: error.message || "Failed to delete server." };
  }
}

const userProfileUpdateSchema = z.object({
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
    return { message: 'Profile updated successfully!', error: false, updatedProfile: updatedFields };
  } catch (e: any) {
    return {
      message: e.message || 'Failed to update profile.',
      error: true,
    };
  }
}
