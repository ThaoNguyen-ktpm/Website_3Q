import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv('GOOGLE_CLIENT_ID', undefined);
  vi.stubEnv('SESSION_SECRET', undefined);
  vi.stubEnv('GOOGLE_ALLOWED_EMAILS', undefined);
});
afterEach(() => vi.unstubAllEnvs());

describe('Optional auth configuration', () => {
  it('loads safely without auth configuration', async () => {
    const { env } = await import('../config/env.js');
    expect(env.GOOGLE_CLIENT_ID).toBeUndefined();
    expect(env.SESSION_SECRET).toBeUndefined();
    expect(env.GOOGLE_ALLOWED_EMAILS).toEqual([]);
  });

  it('normalizes emails and trims client ID', async () => {
    vi.stubEnv('GOOGLE_CLIENT_ID', '  public-client-id  ');
    vi.stubEnv('GOOGLE_ALLOWED_EMAILS', ' Alice@Example.Test, , BOB@example.test ,');
    const { env } = await import('../config/env.js');
    expect(env.GOOGLE_CLIENT_ID).toBe('public-client-id');
    expect(env.GOOGLE_ALLOWED_EMAILS).toEqual(['alice@example.test', 'bob@example.test']);
  });

  it.each(['', 'x'.repeat(31)])('disables signing for an empty or short secret', async (secret) => {
    vi.stubEnv('SESSION_SECRET', secret);
    const { env } = await import('../config/env.js');
    expect(env.SESSION_SECRET).toBeUndefined();
  });

  it('accepts a 32-character signing secret', async () => {
    vi.stubEnv('SESSION_SECRET', 'x'.repeat(32));
    const { env } = await import('../config/env.js');
    expect(env.SESSION_SECRET).toBe('x'.repeat(32));
  });
});
