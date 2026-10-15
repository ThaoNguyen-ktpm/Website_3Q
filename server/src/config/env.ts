import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  GOOGLE_CLIENT_ID: z.string().trim().optional(),
  SESSION_SECRET: z.string().optional().transform((value) =>
    value && value.length >= 32 ? value : undefined),
  GOOGLE_ALLOWED_EMAILS: z.string().default('').transform((value) =>
    value.split(',').map((email) => email.trim().toLowerCase()).filter(Boolean)),
});

export const env = envSchema.parse(process.env);
