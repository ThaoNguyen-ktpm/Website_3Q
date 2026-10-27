import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const csp = "default-src 'self'; script-src 'self' https://accounts.google.com/gsi/client; style-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/style https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https://*.googleusercontent.com https://cdn2-retail-images.kiotviet.vn https://cdn1-retail-images.kiotviet.vn https://cdn-images.kiotviet.vn https://bizweb.dktcdn.net; media-src 'self'; connect-src 'self' https://accounts.google.com/gsi/; frame-src 'self' https://accounts.google.com/gsi/; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'";
const headers = {
  'Content-Security-Policy': csp,
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'DENY',
};

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    headers: {
      ...headers,
      // React Refresh injects an inline preamble; allow it only in the dev server.
      'Content-Security-Policy': csp.replace("script-src 'self'", "script-src 'self' 'unsafe-inline'")
        .replace("connect-src 'self'", "connect-src 'self' ws:"),
    },
    // Bảo 2026-10-20: reachable from other laptops on the shop wifi. Google sign-in only accepts localhost, so those laptops
    // forward their own localhost:5173 here (netsh portproxy, see docs/LAN.md) instead of opening the IP.
    host: true,
    port: 5173,
    strictPort: true,
    proxy: { '/api': 'http://127.0.0.1:4000', '/sale-ai': 'http://127.0.0.1:4000' },
  },
  preview: { headers },
});
