import { calculate, POLICY, STEP_DAYS, money } from './pricing.js';
// Isolated fake sink: it operates on clones, has no HTTP/network capabilities.
export class FakeSink {
  constructor(product, fail = null) { this.product = structuredClone(product); this.fail = fail; this.events = []; this.pending = new Map(); this.priceWrites = 0; }
  price(value) {
    if (this.fail === 'price') { this.fail = null; throw new Error('Lỗi giá giả lập'); }
    this.product.currentPrice = value; this.priceWrites++;
    if (this.fail === 'timeout') { this.fail = null; throw new Error('Timeout sau ghi giá giả lập'); }
  }
  note(event) {
    if (this.fail === 'note') { this.fail = null; throw new Error('Lỗi ghi chú giả lập'); }
    if (!this.events.some(e => e.key === event.key)) {
      this.events.push(event); this.product.notes += `\n${event.text}`;
    }
  }
}
export function fakeApply(sink, day) {
  const row = calculate(sink.product, day);
  if (row.status !== 'simulated') return { status: 'waiting', row };
  const key = `${POLICY}:${sink.product.code}:M${row.m}:${row.p0}`;
  const previous = sink.events.at(-1)?.m ?? 0;
  if (!sink.pending.has(key)) sink.pending.set(key, { key, m: row.m,
    text: `Đã mô phỏng | ${day} | M${previous} → M${row.m}${row.m > previous + 1 ? ` (bù M${previous + 1}–M${row.m})` : ''} | Giá ${money(sink.product.currentPrice)} → ${money(row.price)} | Quyền sale ${money(row.allowance)}` });
  try {
    if (sink.product.currentPrice !== row.price) sink.price(row.price);
  } catch (error) {
    // Read the local replica: a timeout may have occurred after a successful write.
    if (sink.product.currentPrice !== row.price) return { status: 'price_failed', error: error.message };
  }
  try {
    sink.note(sink.pending.get(key));
  } catch (error) { return { status: 'note_pending', error: error.message }; }
  return { status: 'simulated', row };
}
export function failureScenarios() {
  const product = { code: 'SANDBOX', name: 'Bản sao thử lỗi', p0: 15e6, currentPrice: 15e6,
    stock: 1, active: true, createdAt: '2026-10-16', type: 'normal', floor: 0, notes: 'Ghi chú gốc' };
  const day = new Date(Date.parse(product.createdAt) + (3 * STEP_DAYS + 9) * 86400000).toISOString().slice(0,10);
  return ['price', 'note', 'timeout'].map(failure => {
    const sink = new FakeSink(product, failure);
    const first = fakeApply(sink, day);
    const retry = fakeApply(sink, day);
    fakeApply(sink, day);
    return { failure, first: first.status, retry: retry.status, price: sink.product.currentPrice,
      priceWrites: sink.priceWrites, eventCount: sink.events.length,
      preserved: sink.product.notes.startsWith('Ghi chú gốc'),
      passed: retry.status === 'simulated' && sink.priceWrites === 1 && sink.events.length === 1 && sink.product.currentPrice === 13300000 };
  });
}
