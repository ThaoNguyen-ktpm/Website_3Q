'use strict';

class SearchCache {
  constructor({ now = Date.now, ttl = 120000, capacity = 50 } = {}) {
    this.now = now; this.ttl = ttl; this.capacity = capacity; this.entries = new Map();
  }
  get(key) {
    const entry = this.entries.get(key);
    if (!entry) return null;
    if (this.now() - entry.fetchedAt >= this.ttl) { this.entries.delete(key); return null; }
    this.entries.delete(key); this.entries.set(key, entry);
    return entry;
  }
  set(key, result, fetchedAt = this.now()) {
    if (result.status !== 'ok') return;
    this.entries.delete(key);
    this.entries.set(key, { result, fetchedAt });
    while (this.entries.size > this.capacity) this.entries.delete(this.entries.keys().next().value);
  }
}

module.exports = { SearchCache };
