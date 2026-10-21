import { catalogStore } from '../catalogStore.js';

/** Common ways staff write brands whose KiotViet name is abbreviated or spelled differently (alias → KiotViet name). */
const aliases: Record<string, string> = {
  'saint laurent': 'YSL', 'yves saint laurent': 'YSL', 'bvlgari': 'BVL', 'bulgari': 'BVL', 'van cleef': 'VCA',
  'van cleef arpels': 'VCA', 'bottega veneta': 'Bottega', 'dolce gabbana': 'D&G', 'ferragamo': 'Salvatore',
  'salvatore ferragamo': 'Salvatore', 'off white': 'Offwhite', 'alexander wang': 'Alexanderwang', 'tom ford': 'Tomford',
  'marc jacobs': 'Marjcob', 'palm angels': 'Palm Angles', 'maison margiela': 'Maison Margelia', 'christian louboutin': 'Louboutin',
  'hermes': 'Hermes', 'louis vuitton': 'Louis Vuitton', 'lv': 'Louis Vuitton',
};
const ignored = new Set(['Brand lạ']);
export const fold = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').replace(/[đĐ]/g, 'd').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Damerau–Levenshtein (optimal string alignment) distance, small strings only. */
export function editDistance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
    const cost = a[i - 1] === b[j - 1] ? 0 : 1;
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
    if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
  }
  return d[a.length][b.length];
}
// Short names (LV, MCM, YSL…) are too close to ordinary words to correct safely.
const allowed = (name: string) => { const letters = name.replace(/ /g, '').length; return letters < 5 ? 0 : letters < 8 ? 1 : 2; };

export type BrandSuggestion = { typed: string; brand: string };

/** Folded name → KiotViet brand name, for exact names and known aliases. */
export function brandCandidates(brands: string[]) {
  const candidates = new Map<string, string>();
  for (const brand of brands) if (!ignored.has(brand)) candidates.set(fold(brand), brand);
  for (const [alias, brand] of Object.entries(aliases)) if (brands.includes(brand)) candidates.set(alias, brand);
  return candidates;
}

/** Finds words in the question that look like a misspelled brand (and are not an exact brand/alias). */
export function findBrandTypos(question: string, brands: string[]): BrandSuggestion[] {
  const words = question.split(/\s+/).filter(Boolean);
  const folded = words.map(fold);
  const candidates = brandCandidates(brands);
  const exact = new Set<number>();
  const found: (BrandSuggestion & { start: number; end: number; distance: number })[] = [];
  for (const [name, brand] of candidates) {
    const size = name.split(' ').length;
    for (let start = 0; start + size <= words.length; start++) {
      const window = folded.slice(start, start + size).join(' ');
      if (!window) continue;
      if (window === name) { for (let i = start; i < start + size; i++) exact.add(i); continue; }
      const limit = allowed(name);
      if (!limit || window[0] !== name[0]) continue;
      const distance = editDistance(window, name);
      // Repeated trailing letters ("chanelel", "hermesss") on a 5+ letter one-word name are still that brand.
      const stretched = size === 1 && name.length >= 5 && window.startsWith(name) && window.length - name.length <= 3 && /^[a-z]+$/.test(window);
      if (distance > 0 && (distance <= limit || stretched)) found.push({ typed: words.slice(start, start + size).join(' '), brand, start, end: start + size, distance });
    }
  }
  const best = new Map<string, (typeof found)[number]>();
  for (const item of found.sort((a, b) => a.distance - b.distance)) {
    if (Array.from({ length: item.end - item.start }, (_, i) => item.start + i).some(i => exact.has(i))) continue;
    if (!best.has(item.typed)) best.set(item.typed, item);
  }
  return [...best.values()].slice(0, 3).map(({ typed, brand }) => ({ typed, brand }));
}

/** Brand names from the live KiotViet catalog; empty when the catalog cannot be read. */
export async function catalogBrands(): Promise<string[]> {
  try { return await catalogStore.brands(); } catch { return []; }
}
