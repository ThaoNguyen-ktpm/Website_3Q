// Bảo 2026-10-19: one command runs the API, the web client and the BossTele Telegram bot.
import { execFileSync, spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
// Fresh per run: lets the Telegram bot call the server's /internal routes (see server/src/routes/internalRoutes.ts).
const env = { ...process.env, INTERNAL_TOKEN: process.env.INTERNAL_TOKEN || randomBytes(32).toString('hex') };
const run = command => spawn(command, { cwd: root, env, stdio: 'inherit', shell: true });

const children = ['server', 'client'].map(workspace => run(`npm run dev --workspace ${workspace}`));
// npm runs through cmd on Windows, so kill whole trees; otherwise a surviving server keeps its port.
const stop = code => {
  for (const child of children) if (child.exitCode === null) try { execFileSync('taskkill', ['/T', '/F', '/PID', String(child.pid)], { stdio: 'ignore' }); } catch {}
  process.exit(code);
};
for (const child of children) child.on('exit', code => { if (code) stop(code); });

// Sale AI (D:/BaoQ-AI, TASK-035) backs the admin "Sale AI" page; optional like the bot, and never started twice.
const saleAiDir = process.env.BAOQ_AI_DIR || 'D:/BaoQ-AI';
// Sale AI's own .env is empty: give its process the same Kiot/Sapo keys BossTele and the website use (same variable names),
// in memory only, so price updates and the Sapo index work. Nothing is copied to another file.
const sharedKeys = ['KIOT_RETAILER', 'KIOT_CLIENT_ID', 'KIOT_CLIENT_SECRET', 'SAPO_SHOP', 'SAPO_API_KEY', 'SAPO_API_SECRET'];
let saleAiKeys = {};
try {
  const parsed = parseEnv(readFileSync(`${root}/BossTele/.env`, 'utf8'));
  saleAiKeys = Object.fromEntries(sharedKeys.filter(key => parsed[key]).map(key => [key, parsed[key]]));
} catch { console.log('Sale AI: không đọc được BossTele/.env, Sale AI dùng .env riêng.'); }
if (process.env.SALE_AI === '0') console.log('Sale AI: bỏ qua (SALE_AI=0).');
else if (!existsSync(`${saleAiDir}/server.js`)) console.log(`Sale AI: không thấy ${saleAiDir}, bỏ qua.`);
else fetch('http://127.0.0.1:4310/api/status', { signal: AbortSignal.timeout(2000) })
  .then(() => console.log('Sale AI: đang chạy sẵn tại http://127.0.0.1:4310.'))
  // Same INTERNAL_TOKEN as the server: Sale AI reloads Kiot through the website's single download (TASK-036).
  .catch(() => spawn('node server.js', { cwd: saleAiDir, env: { ...saleAiKeys, ...env }, stdio: 'inherit', shell: true }));

// The bot is optional: if it fails (no token, Telegram down) the website keeps running.
if (process.env.BOSSTELE === '0') console.log('BossTele: bỏ qua bot Telegram (BOSSTELE=0).');
else children.push(run('node BossTele/telegram-bot.js'));
