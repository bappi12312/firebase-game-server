
'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { addFirebaseServer, voteForFirebaseServer } from './firebase-data'; // Updated import
import type { Server } from './types';
import { auth } from './firebase'; // Import auth for checking user status

const serverSchema = z.object({
  name: z.string().min(3, 'Server name must be at least 3 characters long.'),
  ipAddress: z.string().regex(/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$|^([a-zA-Z0-9]+(-[a-zA-Z0-9]+)*\.)+[a-zA-Z]{2,}$/, 'Invalid IP address or domain.'),
  port: z.coerce.number().min(1, 'Port must be a positive number.').max(65535, 'Port number cannot exceed 65535.'),
  game: z.string().min(1, 'Game selection is required.'),
  description: z.string().min(10, 'Description must be at least 10 characters long.').max(500, 'Description cannot exceed 500 characters.'),
  bannerUrl: z.string().url('Invalid banner URL.').optional().or(z.literal('')),
  logoUrl: z.string().url('Invalid logo URL.').optional().or(z.literal('')),
  // tags: z.string().optional(), // Add if you plan to parse comma-separated tags
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
  // This check needs to happen within an async context where auth state can be determined.
  // However, Server Actions currently don't have direct access to auth context easily without passing user explicitly.
  // For true security, API routes with session checks or more advanced Server Action patterns are needed.
  // For now, we'll rely on client-side checks and Firebase rules for actual data security.
  // A proper implementation would involve getting the user session on the server.
  
  // const currentUser = auth.currentUser; // This won't work reliably on the server side like this in actions
  // if (!currentUser) {
  //   return { message: "You must be logged in to submit a server.", error: true };
  // }

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
      // tags: parsed.data.tags ? parsed.data.tags.split(',').map(tag => tag.trim()).filter(tag => tag) : [],
    };
    
    const newServer = await addFirebaseServer(dataToSave);
    
    revalidatePath('/');
    revalidatePath('/servers/submit'); 
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
  // Similar auth check consideration as above
  // const currentUser = auth.currentUser;
  // if (!currentUser) {
  //   return { success: false, message: 'You must be logged in to vote.' };
  // }

  if (!serverId) {
    return { success: false, message: 'Server ID is required.' };
  }

  try {
    const updatedServer = await voteForFirebaseServer(serverId);
    if (updatedServer) {
      revalidatePath('/'); // Revalidate homepage
      revalidatePath(`/servers/${serverId}`); // Revalidate specific server page
      return { success: true, message: `Voted for ${updatedServer.name}!`, newVotes: updatedServer.votes, serverId: serverId };
    }
    return { success: false, message: 'Server not found or unable to vote.' };
  } catch (error: any) {
    console.error('Vote failed:', error);
    return { success: false, message: error.message || 'An error occurred while voting.' };
  }
}
