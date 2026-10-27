import type { CookieOptions } from 'express';

export const sessionCookieName = () => process.env.NODE_ENV === 'production' ? '__Host-sid' : 'sid';
export const sessionCookieOptions = (): CookieOptions => ({
  httpOnly: true, sameSite: 'lax', path: '/', secure: process.env.NODE_ENV === 'production',
});
