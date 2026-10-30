import { env } from './env.js';

const privateIPv4 = /^(?:10\.\d{1,3}|192\.168|172\.(?:1[6-9]|2\d|3[01]))\.\d{1,3}\.\d{1,3}$/;
export const isPrivateIPv4 = (host: string) => privateIPv4.test(host);

/** APP_ORIGIN or an EXTRA_ORIGINS page (Webstie, Bảo 2026-10-27), or one of them opened from the shop wifi by a private IP
 * with the same scheme and port (Bảo 2026-10-20). */
export function allowedOrigin(origin: string | undefined) {
  if (!origin) return false;
  return [env.APP_ORIGIN, ...(env.EXTRA_ORIGINS ?? [])].some(base => {
    if (origin === base) return true;
    try {
      const url = new URL(origin), app = new URL(base);
      return url.origin === origin && url.protocol === app.protocol && url.port === app.port && isPrivateIPv4(url.hostname);
    } catch { return false; }
  });
}
