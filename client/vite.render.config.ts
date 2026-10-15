// Dev-only config for exporting still renders of the 3D bag:
//   npx vite --config vite.render.config.ts  →  open /render-4k.html
// Adds a localhost-only endpoint that writes the rendered PNG/WebP into src/assets/.
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

const outDir = path.resolve(__dirname, 'src/assets');

const saveRender: Plugin = {
  name: 'save-render',
  configureServer(server) {
    server.middlewares.use('/__save-render', (req, res) => {
      const name = new URL(req.url ?? '', 'http://localhost').searchParams.get('name') ?? '';
      if (req.method !== 'POST' || !/^[\w-]+\.(png|webp)$/.test(name)) {
        res.statusCode = 400;
        res.end('bad request');
        return;
      }
      const chunks: Buffer[] = [];
      req.on('data', (c: Buffer) => chunks.push(c));
      req.on('end', async () => {
        await mkdir(outDir, { recursive: true });
        await writeFile(path.join(outDir, name), Buffer.concat(chunks));
        res.end(`saved src/assets/${name}`);
      });
    });
  },
};

export default defineConfig({
  plugins: [react(), saveRender],
  server: { host: '127.0.0.1', port: 5182, strictPort: true },
});
