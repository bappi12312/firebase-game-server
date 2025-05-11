
import { z } from 'zod';
import { REPORT_REASONS } from './types';

export const serverFormSchema = z.object({
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

export const userProfileUpdateSchema = z.object({
  displayName: z.string().min(3, 'Display name must be at least 3 characters.').max(50, 'Display name must be less than 50 characters.').optional(),
  // Add other updatable profile fields here if needed
});

export const reportFormSchema = z.object({
  reason: z.enum(REPORT_REASONS, {
    errorMap: () => ({ message: "Please select a valid reason." }),
  }),
  description: z.string().min(10, "Description must be at least 10 characters.").max(500, "Description cannot exceed 500 characters."),
});
