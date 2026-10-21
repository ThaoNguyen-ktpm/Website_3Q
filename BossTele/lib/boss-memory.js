'use strict';

// Bảo 2026-10-19 (TASK-034): BossTele's memory. Recent turns per chat (survive bot restarts) and a long-term
// notebook BOSS.md that every Claude answer reads. Files stay on this machine; BossTele/data/ is gitignored.
const fs = require('node:fs');
const path = require('node:path');

const MAX_NOTES = 50, MAX_NOTE = 300, MAX_TURNS = 20;
const fold = text => text.normalize('NFD').replace(/\p{M}/gu, '').replace(/[đĐ]/g, 'd').toLowerCase();

function createMemory(dir = path.join(__dirname, '..', 'data', 'memory')) {
  const notesFile = path.join(dir, 'BOSS.md');
  const chatFile = chatId => path.join(dir, `chat-${String(chatId).replace(/[^\d-]/g, '')}.json`);
  const write = (file, text) => { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(file, text); };
  // BOSS.md is plain Markdown so Bảo can also edit it by hand: every "- " line is one note.
  const notes = () => {
    try { return fs.readFileSync(notesFile, 'utf8').split(/\r?\n/).filter(line => line.startsWith('- ')).map(line => line.slice(2).trim()).filter(Boolean); }
    catch { return []; }
  };
  const saveNotes = list => write(notesFile, `# Trí nhớ BossTele về Bảo\n\nMỗi dòng "- " là một điều cần nhớ lâu dài. Có thể sửa tay file này.\n\n${list.map(note => `- ${note}`).join('\n')}\n`);
  return {
    notes,
    add(note) {
      const clean = String(note).replace(/\s+/g, ' ').trim().slice(0, MAX_NOTE);
      if (!clean) return null;
      saveNotes([...notes().filter(item => fold(item) !== fold(clean)), clean].slice(-MAX_NOTES));
      return clean;
    },
    forget(keyword) {
      const key = fold(String(keyword).trim());
      if (!key) return 0;
      const list = notes(), kept = list.filter(item => !fold(item).includes(key));
      saveNotes(kept);
      return list.length - kept.length;
    },
    loadChat(chatId) {
      try { return JSON.parse(fs.readFileSync(chatFile(chatId), 'utf8')); } catch { return null; }
    },
    saveChat(chatId, { history, conversation, closing = null }) {
      write(chatFile(chatId), JSON.stringify({ history: history.slice(-MAX_TURNS), conversation, closing }));
    },
  };
}

module.exports = { createMemory };
