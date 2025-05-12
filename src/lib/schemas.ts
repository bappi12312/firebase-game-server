
import { z } from 'zod';
import { REPORT_REASONS } from './types';

const MAX_FILE_SIZE_MB = 5;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024; 
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];

// This specific fileSchema is not directly used in serverFormSchema anymore for bannerFile/logoFile,
// but can be kept if needed for other client-side validation before upload.
const fileSchema = z.instanceof(File)
  .refine(file => file.size <= MAX_FILE_SIZE_BYTES, `Max file size is ${MAX_FILE_SIZE_MB}MB.`)
  .refine(file => ACCEPTED_IMAGE_TYPES.includes(file.type), "Only .jpg, .jpeg, .png, .webp and .gif formats are supported.");

export const serverFormSchema = z.object({
  name: z.string().min(3, { message: 'Server name must be at least 3 characters long.' }).max(50, { message: 'Server name too long.'}),
  // Updated regex to not allow port in the IP/domain field.
  ipAddress: z.string().regex(/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$|^([a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,6}$/, { message: 'Invalid IP address or domain name. Do not include the port here.'}),
  port: z.coerce.number().min(1, { message: 'Port must be a positive number.'}).max(65535, { message: 'Port number cannot exceed 65535.'}),
  game: z.string().min(1, { message: 'Please select a game.'}),
  description: z.string().min(10, { message: 'Description must be at least 10 characters.'}).max(1000, { message: 'Description cannot exceed 1000 characters.'}),
  
  bannerUrl: z.string().url({ message: 'Invalid banner URL. Must be a valid URL if provided.'}).optional().or(z.literal('')),
  logoUrl: z.string().url({ message: 'Invalid logo URL. Must be a valid URL if provided.'}).optional().or(z.literal('')),

  tags: z.string().optional().refine(val => !val || val.split(',').every(tag => tag.trim().length > 0 && tag.trim().length <= 20), {
    message: "Tags should be comma-separated, each 1-20 characters."
  }).refine(val => !val || val.split(',').length <= 5, {
    message: "Maximum of 5 tags allowed."
  }),
});

export const userProfileUpdateSchema = z.object({
  displayName: z.string().min(3, 'Display name must be at least 3 characters.').max(50, 'Display name must be less than 50 characters.').optional(),
});

export const reportFormSchema = z.object({
  reason: z.enum(REPORT_REASONS, {
    errorMap: () => ({ message: "Please select a valid reason." }),
  }),
  description: z.string().min(10, "Description must be at least 10 characters.").max(500, "Description cannot exceed 500 characters."),
});

