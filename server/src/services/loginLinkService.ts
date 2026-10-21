import { createHash, randomBytes } from 'node:crypto';
import os from 'node:os';
import { isPrivateIPv4 } from '../config/origins.js';

// Bảo 2026-10-20: laptops on the shop wifi (MacBooks) open the site by IP, where Google sign-in is not allowed. A manager
// makes a one-time sign-in link for one staff member: 10 minutes, single use. Only a hash is kept, in memory, so a restart
// voids open links and nothing reusable is ever stored or logged.
const ttlMs = 10 * 60 * 1000;
const links = new Map<string, { staffId: number; expires: number }>();
const hash = (code: string) => createHash('sha256').update(code).digest('hex');

export function createLink(staffId: number, now = Date.now()) {
  for (const [key, link] of links) if (link.expires <= now) links.delete(key);
  const code = randomBytes(24).toString('base64url');
  links.set(hash(code), { staffId, expires: now + ttlMs });
  return { code, expiresAt: new Date(now + ttlMs).toISOString() };
}

/** The staff id of a valid link, which is used up either way; null when unknown, used or expired. */
export function consumeLink(code: string, now = Date.now()) {
  const key = hash(code), link = links.get(key);
  links.delete(key);
  return link && link.expires > now ? link.staffId : null;
}

/** The address other laptops on the wifi type: this machine's private IPv4 with the site's port (192.168 first). */
export function lanOrigin(appOrigin: string, interfaces = os.networkInterfaces()) {
  const app = new URL(appOrigin);
  const addresses = Object.values(interfaces).flat()
    .filter(item => item && item.family === 'IPv4' && !item.internal && isPrivateIPv4(item.address)).map(item => item!.address);
  const ip = addresses.find(address => address.startsWith('192.168.')) ?? addresses[0];
  return ip ? `${app.protocol}//${ip}${app.port ? `:${app.port}` : ''}` : app.origin;
}
