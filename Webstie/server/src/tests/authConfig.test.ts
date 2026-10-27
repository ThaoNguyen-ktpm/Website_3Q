import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv('GOOGLE_CLIENT_ID', undefined);
  vi.stubEnv('SESSION_SECRET', undefined);
  vi.stubEnv('GOOGLE_ALLOWED_EMAILS', undefined);
  vi.stubEnv('APP_ORIGIN', undefined);
  vi.stubEnv('TRUST_PROXY', undefined);
  vi.stubEnv('AUDIT_RETENTION_DAYS', undefined);
});
afterEach(() => vi.unstubAllEnvs());

describe('Optional auth configuration', () => {
  it('defaults to 365 days of audit retention', async () => {
    expect((await import('../config/env.js')).env.AUDIT_RETENTION_DAYS).toBe(365);
  });
  it('accepts configured audit retention days', async () => {
    vi.stubEnv('AUDIT_RETENTION_DAYS','30');
    expect((await import('../config/env.js')).env.AUDIT_RETENTION_DAYS).toBe(30);
  });
  it.each(['0','-1','1.5','invalid','36501'])('rejects invalid audit retention %s', async value => {
    vi.stubEnv('AUDIT_RETENTION_DAYS',value);
    await expect(import('../config/env.js')).rejects.toThrow();
  });
  it('defaults to the local app origin without trusting proxies', async () => {
    const { env } = await import('../config/env.js');
    expect(env.APP_ORIGIN).toBe('http://localhost:5173');
    expect(env.TRUST_PROXY).toBeUndefined();
  });

  it('accepts a custom origin and numeric proxy hop count', async () => {
    vi.stubEnv('APP_ORIGIN', 'https://shop.example.test');
    vi.stubEnv('TRUST_PROXY', '1');
    const { env } = await import('../config/env.js');
    expect(env.APP_ORIGIN).toBe('https://shop.example.test');
    expect(env.TRUST_PROXY).toBe(1);
  });

  it.each(['https://shop.example.test/', 'https://shop.example.test/path', 'file:///tmp', 'invalid'])('rejects a non-origin APP_ORIGIN: %s', async origin => {
    vi.stubEnv('APP_ORIGIN', origin);
    await expect(import('../config/env.js')).rejects.toThrow();
  });

  it.each(['-1', '1.5', 'true'])('rejects invalid proxy hop count: %s', async proxy => {
    vi.stubEnv('TRUST_PROXY', proxy);
    await expect(import('../config/env.js')).rejects.toThrow();
  });

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
