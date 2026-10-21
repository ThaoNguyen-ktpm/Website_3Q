'use strict';

// Bảo 2026-10-20 (TASK-040): Bảo's feedback on closing-price suggestions ("Hợp lý" / "Chưa đúng" + his price and reason),
// the founder log of the PRICE-SYSTEM plan. One JSON line per answer in BossTele/data/ (gitignored), read back for the same model.
const fs = require('node:fs');
const path = require('node:path');

const fold = text => String(text ?? '').normalize('NFD').replace(/\p{M}/gu, '').replace(/[đĐ]/g, 'd').toLowerCase();
const words = name => new Set(fold(name).split(/[^a-z0-9]+/).filter(word => word.length >= 3 && !/^\d+$/.test(word)));

function createPriceFeedback(file = path.join(__dirname, '..', 'data', 'price-feedback.jsonl')) {
  const all = () => {
    let text = '';
    try { text = fs.readFileSync(file, 'utf8'); } catch { return []; }
    // A half-written line (power cut) is skipped, the rest stays readable.
    return text.split('\n').flatMap(line => { try { return line ? [JSON.parse(line)] : []; } catch { return []; } });
  };
  return {
    add(entry) {
      const row = { at: new Date().toISOString(), ...entry };
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.appendFileSync(file, `${JSON.stringify(row)}\n`);
      return row;
    },
    // shortcut: "same model" = same SKU or 3+ shared name words; switch to the BaoQ SKU convention once the Price System maps models.
    similar(product, limit = 5) {
      const mine = words(product.name);
      return all().filter(entry => entry.sku === product.sku || [...words(entry.name)].filter(word => mine.has(word)).length >= 3).slice(-limit);
    },
  };
}

module.exports = { createPriceFeedback };
