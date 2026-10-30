import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  APP_ORIGIN: z.url().refine((value) => {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && url.origin === value;
  }, 'APP_ORIGIN must be an HTTP(S) origin without a trailing slash').default('http://localhost:8787'),
  // Additional explicitly allowed origins of this site (comma-separated).
  EXTRA_ORIGINS: z.string().default('').transform(value => value.split(',').map(origin => origin.trim()).filter(Boolean)),
  TRUST_PROXY: z.coerce.number().int().min(0).optional(),
  AUDIT_RETENTION_DAYS: z.coerce.number().int().min(1).max(36500).default(365),
  GOOGLE_CLIENT_ID: z.string().trim().optional(),
  ANTHROPIC_API_KEY: z.string().trim().optional(),
  // Local model (Ollama) used for document Q&A when no Claude key is set, e.g. http://localhost:11434.
  LLM_BASE_URL: z.preprocess(value => value === '' ? undefined : value, z.url().refine(value => ['http:', 'https:'].includes(new URL(value).protocol)).optional()),
  LLM_MODEL: z.string().trim().min(1).default('qwen3:8b'),
  // Shared with the BossTele Telegram bot on this machine (npm run dev generates one per run); unset disables /internal.
  INTERNAL_TOKEN: z.string().optional().transform(value => value && value.length >= 32 ? value : undefined),
  SESSION_SECRET: z.string().optional().transform((value) =>
    value && value.length >= 32 ? value : undefined),
  GOOGLE_ALLOWED_EMAILS: z.string().default('').transform((value) =>
    value.split(',').map((email) => email.trim().toLowerCase()).filter(Boolean)),
});

export const env = envSchema.parse(process.env);
