import { brandCandidates, fold } from './brands.js';
import { extractSkus } from './sku.js';

export type Sort = 'newest' | 'cheap' | 'expensive';
export type ProductQuery = {
  sku: string | null; brand: string | null; hot: boolean; words: string[];
  inStock: boolean; minPrice: number | null; maxPrice: number | null; sort: Sort; offset: number;
};

// Words that carry intent or filters, not product names; removed before matching names.
const stopwords = new Set(('hottrend cho tui toi minh xem danh sach mau hang hot trend con khong ko k gia bao nhieu cua co nhung mon nao cac la gi ban '
  + 'oi a nhe voi va the nay kia list ton kho san pham moi ve dang hien tim kiem lay hay giup em anh chi mot vai may it nhieu tat ca '
  + 'het het nua khac loai nhom thuong hieu brand hang hieu ah duoi tren tu den trieu tr nghin ngan re dat nhat thap cao hon nho lon '
  + 'san max min toi da khoang tam thoi chi them tiep cai size sz xach muon can').split(' '));
const productWords = /\b(tui|vi|giay|dep|day chuyen|dong ho|nhan|bong tai|vong|lac|ao|quan|kinh|khan|that lung|non|mu|balo|clutch|con hang|het hang|ton kho|gia ban|bao nhieu tien)\b/;
// "mẫu khác", "xem thêm", "còn nữa không", "tiếp" … continue the previous product list.
const followUp = /\b(mau|cai|mon|loai) khac\b|\bxem them\b|\bcon (nua|khac|mau nao)\b|^(cho )?(xem )?(them|tiep|nua)\b|\bnext\b|\btrang sau\b/;
// Comparison / advice ("Hermes so với Chanel", "nên mua cái nào") needs the model, not a catalog search.
const advice = /\bso voi\b|\bso sanh\b|\bkhac gi\b|\bkhac nhau\b|\bnen\b|\b(tot|hay|dep|ben) hon\b|\bvs\b/;

// Only short messages count ("Thêm nhân viên ở đâu?" must not page products).
const isFollowUp = (text: string) => { const folded = fold(text); return folded.split(' ').length <= 4 && followUp.test(folded) && !advice.test(folded); };

const amount = (value: string, unit: string | undefined) => {
  const number = Number(value.replace(',', '.'));
  if (!Number.isFinite(number)) return null;
  if (unit && /^(trieu|tr|m)$/.test(unit)) return Math.round(number * 1e6);
  if (unit && /^(k|nghin|ngan)$/.test(unit)) return Math.round(number * 1e3);
  return number < 10000 ? Math.round(number * 1e6) : Math.round(number); // bare "50" in a price question means 50 triệu
};
const unitRe = '(\\d+(?:[.,]\\d+)?)\\s*(trieu|tr|m|k|nghin|ngan)?\\b';

function priceRange(text: string) {
  let minPrice: number | null = null, maxPrice: number | null = null;
  const between = new RegExp(`\\btu\\s*${unitRe}\\s*(?:den|-|toi)\\s*${unitRe}`).exec(text);
  if (between) { minPrice = amount(between[1], between[2] ?? between[4]); maxPrice = amount(between[3], between[4]); }
  const below = new RegExp(`\\b(?:duoi|nho hon|toi da|khong qua|max)\\s*${unitRe}`).exec(text);
  if (below) maxPrice = amount(below[1], below[2]);
  const above = new RegExp(`\\b(?:tren|lon hon|hon|tu|min)\\s*${unitRe}`).exec(text);
  if (above && !between) minPrice = amount(above[1], above[2]);
  return { minPrice, maxPrice };
}

/**
 * Detects product look-ups that code should answer directly from KiotViet, so a small model
 * never has to decide whether to search (it sometimes skipped the tool and invented items).
 */
export function productQuery(question: string, brands: string[]): ProductQuery | null {
  const text = fold(question);
  const sku = extractSkus(question)[0] ?? null;
  const hot = /\bhot\b|\btrend\b|hottrend|noi bat/.test(text);
  const { minPrice, maxPrice } = priceRange(text);
  const inStock = /\bcon hang\b|\bcon san\b|\bco san\b/.test(text);
  const sort: Sort = /\bre nhat\b|\bgia thap\b|\bre hon\b|\bre\b/.test(text) ? 'cheap' : /\bdat nhat\b|\bgia cao\b|\bmac nhat\b/.test(text) ? 'expensive' : 'newest';
  const found = new Set<string>(), names: string[] = [];
  let rest = ` ${text} `;
  for (const [name, display] of [...brandCandidates(brands)].sort((a, b) => b[0].length - a[0].length)) {
    if (rest.includes(` ${name} `)) { found.add(display); names.push(name); rest = rest.replace(` ${name} `, ' '); }
  }
  if (found.size > 1 || advice.test(text)) return null;
  const brand = [...found][0] ?? null;
  const words = rest.split(' ').filter(word => word.length > 1 && !stopwords.has(word) && !/^\d/.test(word));
  // "tui" is ambiguous once accents are folded (túi = bag, tui = I): bags only for "túi" (also typed "tuí"),
  // "tui xach" or "tui" right before a brand ("tui chanel"); "tui muốn xem chanel" stays a pronoun.
  const bag = /t(úi|uí)/i.test(question.normalize('NFC')) || / tui xach /.test(` ${text} `) || names.some(name => ` ${text} `.includes(` tui ${name} `));
  if (bag) words.unshift('tui');
  const base = { inStock, minPrice, maxPrice, sort, offset: 0 };
  if (sku) return { sku, brand: null, hot: false, words: [], ...base, inStock: false, minPrice: null, maxPrice: null, sort: 'newest' };
  const filtered = minPrice !== null || maxPrice !== null || sort !== 'newest';
  const shortAsk = text.split(' ').length <= 5;
  if (brand && (hot || productWords.test(text) || shortAsk || words.length || filtered)) return { sku: null, brand, hot, words, ...base };
  if ((hot || filtered) && (productWords.test(text) || /\bhang\b|\bmon\b|\bmau\b|san pham/.test(text))) return { sku: null, brand: null, hot, words, ...base };
  return null;
}

/** The current question's product query, or — for "mẫu khác"/"xem thêm" — the previous list's next page. */
export function resolveProductQuery(messages: { role: string; content: string }[], brands: string[]): ProductQuery | null {
  const asked = messages.filter(message => message.role === 'user').map(message => message.content);
  const direct = productQuery(asked.at(-1) ?? '', brands);
  if (direct || !isFollowUp(asked.at(-1) ?? '')) return direct;
  let pages = 1;
  for (let i = asked.length - 2; i >= 0; i--) {
    const previous = productQuery(asked[i], brands);
    if (previous) return previous.sku ? null : { ...previous, offset: 10 * pages };
    if (!isFollowUp(asked[i])) return null;
    pages++;
  }
  return null;
}
