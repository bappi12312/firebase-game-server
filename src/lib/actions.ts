'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { addServer as dbAddServer, voteForServer as dbVoteForServer, fetchMockServerStats } from './mock-data';
import type { Server } from './types';

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
    
    // Fetch initial stats - in a real app this might be more complex
    // For now, we let addServer handle this.
    // const initialStats = await fetchMockServerStats(parsed.data.ipAddress, parsed.data.port);

    const newServer = await dbAddServer(dataToSave);
    
    revalidatePath('/');
    revalidatePath('/servers/submit'); // To clear form potentially
    return { message: `Server "${newServer.name}" submitted successfully!`, server: newServer, error: false };
  } catch (e) {
    return {
      message: 'Failed to submit server. Please try again.',
      fields: Object.fromEntries(
        Object.entries(rawFormData).map(([key, value]) => [key, String(value)])
      ),
      error: true,
    };
  }
}


export async function voteAction(serverId: string): Promise<{ success: boolean; message: string; newVotes?: number, serverId?: string }> {
  if (!serverId) {
    return { success: false, message: 'Server ID is required.' };
  }

  try {
    // Here you would implement anti-bot protection and cooldown logic.
    // For this example, we'll just increment the vote.
    // In a real app, check user's last vote time from a database.
    const updatedServer = await dbVoteForServer(serverId);
    if (updatedServer) {
      revalidatePath('/');
      revalidatePath(`/servers/${serverId}`);
      return { success: true, message: `Voted for ${updatedServer.name}!`, newVotes: updatedServer.votes, serverId: serverId };
    }
    return { success: false, message: 'Server not found.' };
  } catch (error) {
    console.error('Vote failed:', error);
    return { success: false, message: 'An error occurred while voting.' };
  }
}
