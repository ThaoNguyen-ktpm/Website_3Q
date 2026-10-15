'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const MARKER = '  // BossTele: filter product commands before forwarding to Claude.';
const ANCHOR = '  // Typing indicator — signals "processing" until we reply (or ~5s elapses).';
const guardPath = path.resolve(__dirname, '../lib/telegram-product-guard.js').replaceAll('\\', '/');

function patchTelegramServer(source) {
  const eol = source.includes('\r\n') ? '\r\n' : '\n';
  const block = [
    MARKER,
    `  const { allowProductMessage } = require(${JSON.stringify(guardPath)})`,
    '  if (!await allowProductMessage(ctx, text, Boolean(downloadImage || attachment))) return',
    '',
  ].join(eol);
  if (source.includes(MARKER)) {
    if (source.includes(block)) return source;
    // Dự án đổi thư mục: chỉ thay đường dẫn require của bộ lọc đã cài.
    const installed = /  const \{ allowProductMessage \} = require\("[^"\r\n]*\/lib\/telegram-product-guard\.js"\)/;
    const moved = source.replace(installed, () => `  const { allowProductMessage } = require(${JSON.stringify(guardPath)})`);
    if (!moved.includes(block)) throw new Error('Bộ lọc đã cài khác phiên bản; cần kiểm tra thủ công.');
    return moved;
  }
  if (source.split(ANCHOR).length !== 2 || !source.includes('async function handleInbound(')) {
    throw new Error('Plugin đã đổi cấu trúc; chưa sửa file.');
  }
  return source.replace(ANCHOR, block + eol + ANCHOR);
}

function install() {
  const registry = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.claude/plugins/installed_plugins.json'), 'utf8'));
  const entries = registry.plugins?.['telegram@claude-plugins-official'];
  if (!Array.isArray(entries) || entries.length !== 1 || !entries[0].installPath) {
    throw new Error('Không xác định được duy nhất plugin Telegram đang cài.');
  }
  const target = path.join(entries[0].installPath, 'server.ts');
  const original = fs.readFileSync(target, 'utf8');
  const patched = patchTelegramServer(original);
  if (patched === original) return console.log('Bộ lọc đã được cài.');
  fs.copyFileSync(target, `${target}.bosstele-before-product-guard-${Date.now()}.bak`, fs.constants.COPYFILE_EXCL);
  fs.writeFileSync(target, patched, 'utf8');
  if (fs.readFileSync(target, 'utf8') !== patched) throw new Error('Đọc lại plugin không khớp.');
  console.log('Đã cài và đọc lại bộ lọc Telegram. Khởi động lại kết nối Telegram trong Claude để áp dụng.');
}

if (require.main === module) {
  try { install(); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}

module.exports = { patchTelegramServer };
