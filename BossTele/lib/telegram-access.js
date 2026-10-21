'use strict';

// Bảo 2026-10-20: access.json says dmPolicy "pairing". A stranger who messages the bot gets a pairing code; Bảo approves it
// on this computer (node lib/telegram-access.js approve <MÃ>, or by asking Claude Code here). Never approved from Telegram itself.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { randomInt } = require('node:crypto');

const FILE = path.join(os.homedir(), '.claude', 'channels', 'telegram', 'access.json');
const TTL_MS = 60 * 60 * 1000, MAX_PENDING = 10;
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O, 1/I

function createAccess(file = FILE, now = Date.now) {
  const read = () => JSON.parse(fs.readFileSync(file, 'utf8'));
  const write = data => fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
  return {
    allowFrom: () => (read().allowFrom ?? []).map(String),
    // Bảo 2026-10-20: the owner sees cost and profit and is told about offers under cost; "owner" in access.json, else the first allowed id.
    owner: () => { const data = read(); return String(data.owner ?? data.allowFrom?.[0] ?? ''); },
    /** The pairing code for a stranger (same code while it is valid), or null when pairing is off. */
    pairingCode(from, chatId) {
      const data = read();
      if (data.dmPolicy !== 'pairing') return null;
      const pending = Object.fromEntries(Object.entries(data.pending ?? {}).filter(([, entry]) => now() - entry.createdAt < TTL_MS));
      const known = Object.entries(pending).find(([, entry]) => entry.senderId === String(from.id));
      if (known) return known[0];
      const code = Array.from({ length: 6 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');
      pending[code] = { senderId: String(from.id), chatId: String(chatId), name: [from.first_name, from.last_name].filter(Boolean).join(' '), username: from.username ?? null, createdAt: now() };
      data.pending = Object.fromEntries(Object.entries(pending).sort(([, a], [, b]) => b.createdAt - a.createdAt).slice(0, MAX_PENDING));
      write(data);
      return code;
    },
    /** Website staff email linked to a Telegram id (permissions follow that login), or null. */
    emailFor: id => read().links?.[String(id)] ?? null,
    link(id, email) {
      const data = read();
      data.links = { ...(data.links ?? {}), [String(id)]: String(email).trim().toLowerCase() };
      write(data);
    },
    /** Adds the code's sender to allowFrom; returns who was added, or null for an unknown or expired code. */
    approve(code) {
      const data = read(), entry = data.pending?.[String(code).trim().toUpperCase()];
      if (!entry || now() - entry.createdAt >= TTL_MS) return null;
      data.allowFrom = [...new Set([...(data.allowFrom ?? []).map(String), entry.senderId])];
      delete data.pending[String(code).trim().toUpperCase()];
      write(data);
      return entry;
    },
  };
}

if (require.main === module) {
  const [command, code] = process.argv.slice(2);
  const access = createAccess();
  const email = process.argv[4];
  if (command === 'approve' && code) {
    const entry = access.approve(code);
    if (!entry) { console.error('Mã không đúng hoặc đã hết hạn (1 giờ).'); process.exitCode = 1; }
    else {
      if (email) access.link(entry.senderId, email);
      console.log(`Đã cho phép ${entry.name || 'người dùng'}${entry.username ? ` (@${entry.username})` : ''}, id ${entry.senderId}${email ? `, theo quyền web của ${email}` : ''}.`);
    }
  } else if (command === 'link' && code && email) {
    access.link(code, email);
    console.log(`Telegram ${code} theo quyền web của ${email}.`);
  } else if (command === 'pending') {
    console.log(JSON.stringify(JSON.parse(fs.readFileSync(FILE, 'utf8')).pending ?? {}, null, 2));
  } else console.error('Dùng: node lib/telegram-access.js approve <MÃ> [email nhân viên] | link <telegram id> <email nhân viên> | pending');
}

module.exports = { createAccess };
