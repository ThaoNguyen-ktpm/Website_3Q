// Bảo 2026-10-19: one command runs the API, the web client and the BossTele Telegram bot.
import { execFileSync, spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
// Fresh per run: lets the Telegram bot call the server's /internal routes (see server/src/routes/internalRoutes.ts).
// EXTRA_ORIGINS remains available for explicitly configured additional site origins.
const env = { ...process.env, INTERNAL_TOKEN: process.env.INTERNAL_TOKEN || randomBytes(32).toString('hex') };
const run = command => spawn(command, { cwd: root, env, stdio: 'inherit', shell: true });

const children = [run('npm run dev --workspace server')];
children.push(run('npm run dev --prefix frontend'));
// npm runs through cmd on Windows, so kill whole trees; otherwise a surviving server keeps its port.
const stop = code => {
  for (const child of children) if (child.exitCode === null) try { execFileSync('taskkill', ['/T', '/F', '/PID', String(child.pid)], { stdio: 'ignore' }); } catch {}
  process.exit(code);
};
for (const child of children) child.on('exit', code => { if (code) stop(code); });

// The bot is optional: if it fails (no token, Telegram down) the website keeps running.
if (process.env.BOSSTELE === '0') console.log('BossTele: bỏ qua bot Telegram (BOSSTELE=0).');
else children.push(run('node BossTele/telegram-bot.js'));
