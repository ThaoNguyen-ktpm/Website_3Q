import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  APP_ORIGIN: z.url().refine((value) => {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && url.origin === value;
  }, 'APP_ORIGIN must be an HTTP(S) origin without a trailing slash').default('http://localhost:5173'),
  TRUST_PROXY: z.coerce.number().int().min(0).optional(),
  AUDIT_RETENTION_DAYS: z.coerce.number().int().min(1).max(36500).default(365),
  GOOGLE_CLIENT_ID: z.string().trim().optional(),
  SESSION_SECRET: z.string().optional().transform((value) =>
    value && value.length >= 32 ? value : undefined),
  GOOGLE_ALLOWED_EMAILS: z.string().default('').transform((value) =>
    value.split(',').map((email) => email.trim().toLowerCase()).filter(Boolean)),
});

export const env = envSchema.parse(process.env);
