import { randomUUID } from 'node:crypto';
import { validateManual } from './manual-pricing.js';
import { calculate, ageFields, typeFromName, validDay, vietnamTime, POLICY } from './pricing.js';
import { migrateCycles } from './cycle.js';
import {liveDraft} from './live-draft.js';
import { retainRuns } from './retention.js';
import {performance} from 'node:perf_hooks';
export class Simulator {
  constructor(store, source, clock = () => new Date(), { maxRuns = Number(process.env.SALE_AI_MAX_RUNS || 7) } = {}) { this.maxRuns = maxRuns; this.store = store; this.source = source; this.clock = clock; this.busy = false; }
  async initialize() {
    this.state = await this.store.read();
    if (!this.state) {
      const products = (await this.source.load()).map(p => ({ ...p, p0: p.currentPrice, type: typeFromName(p.name) }));
      this.state = { version: 1, policy: POLICY, sampleRevision: this.source.revision || null, products, runs: [] };
      await this.store.write(this.state);
    } else {
      const next = structuredClone(this.state);
      if (this.source.revision && next.sampleRevision !== this.source.revision) {
        const seeds = await this.source.load();
        for (const seed of seeds) {
          if (!next.products.some(p => p.code === seed.code)) next.products.push({ ...seed, p0: seed.currentPrice });
        }
        // Only amend the original synthetic hottrend fixture; keep user-edited names.
        const hot = next.products.find(p => p.code === 'TEST-HOT' && p.source === 'Giả định kiểm thử');
        if (hot?.name === 'Đồng hồ giả định hottrend 90 triệu') hot.name += ' !';
        next.sampleRevision = this.source.revision;
      }
      for (const product of next.products) product.type = typeFromName(product.name);
      if(next.policy !== POLICY) next.prepared=[];
      next.policy = POLICY;
      // Unchanged: keep the objects read from the store, so the first save after a restart skips the runs it already has (~400 MB).
      if (JSON.stringify(next) !== JSON.stringify(this.state)) { await this.store.write(next); this.state = next; }
    }
    if (this.state.cycleVersion !== 2) {
      const next = structuredClone(this.state);
      migrateCycles(next, vietnamTime(this.clock()).date, this.clock().toISOString());
      await this.store.write(next); this.state = next;
    }
    const recovered=structuredClone(this.state);
    let interrupted=false;
    for (const update of recovered.updates||[]) for (const attempt of update.attempts||[]) if(attempt.status==='running') {
      attempt.status='interrupted';interrupted=true;
        if(['joint-v1','restore-joint-v1'].includes(update.mode)){
        update.outcome='interrupted';
        for(const item of update.items){for(const p of Object.values(item.platforms||{}))if(p.status!=='done'&&p.status!=='not_sent'&&p.status!=='write_failed'&&p.status!=='preflight_failed'){p.status='unknown';p.error='Lượt bị gián đoạn — chưa xác định; không tự gửi tiếp';}
          item.status=Object.values(item.platforms||{}).every(p=>p.status==='done')?'done':'unknown';item.error='Lượt bị gián đoạn — xem kết quả từng bên';}
        update.platformSummary=Object.fromEntries(['kiot','sapo'].map(name=>{const succeeded=update.items.filter(i=>i.platforms?.[name]?.status==='done').length;return [name,{total:update.items.length,succeeded,failed:update.items.length-succeeded}];}));
        attempt.items=update.items.map(i=>({code:i.code,name:i.name,status:i.status,error:i.error,platforms:structuredClone(i.platforms)}));
      }
      if(['rollback-v1','stop-v1'].includes(update.mode)) {
        update.outcome='interrupted';
        for(const item of update.items)if(['journaled','ready','sending','verified','rolling_back','done'].includes(item.status)) {
          item.status='unknown';item.error='Lượt bị gián đoạn — chưa xác minh trạng thái Kiot';
        }
      }
    }
    if(interrupted) {await this.store.write(recovered);this.state=recovered;}
  }
  async mutate(fn,scope) {
    if (this.busy) { const error = new Error('Đang xử lý một lượt khác, vui lòng chờ'); error.status = 409; throw error; }
    this.busy = true;
    try {
      const started=performance.now();
      const next = scope?liveDraft(this.state,scope):structuredClone(this.state);
      if(scope){this.liveScope=scope;scope.timings.cloneMs=performance.now()-started;}
      const result = await fn(next);
      retainRuns(next, this.maxRuns);
      const publishing=performance.now();const published=scope?liveDraft(next,scope):next;
      if(scope)scope.timings.publishMs+=performance.now()-publishing;
      const saving=performance.now();await this.store.write(published,scope?{immutable:true}:undefined);
      if(scope)scope.timings.saveMs+=performance.now()-saving;
      this.state = published;
      return result;
    } finally { this.liveScope=null;this.busy = false; }
  }
  async run(day, trigger = 'manual') {
    const today = vietnamTime(this.clock()).date;
    day ||= today;
    if (!validDay(day)) throw new Error('Ngày xét không hợp lệ');
    return this.mutate(state => {
      for (const product of state.products) product.type = typeFromName(product.name);
      if (day === today) for (const product of [...state.products, ...(state.archivedProducts || [])]) Object.assign(product, ageFields(product, today));
      const run = { id: randomUUID(), at: this.clock().toISOString(), day, customDate: day !== today,
        trigger, policy: POLICY, label: 'Đã mô phỏng', rows: state.products.map(p => calculate(p, day)) };
      if (this.live) {
        run.dataset='real';run.dataRevision=state.dataRevision;
        run.rows=run.rows.map((row,index)=>this.live.snapshot(row,state.products[index],state));
      }
      // Filter after snapshots so each row keeps its original product identity.
      const rowCount=run.rows.length;
      run.rows=run.rows.filter(row=>row.excludedReason!=='before_no_markdown');
      run.hiddenBeforeNoMarkdownCount=rowCount-run.rows.length;
      // Automatic table previews roll forward; preserve older explicit/scheduled
      // snapshots and all live-update journals, without a full snapshot per minute.
      if(trigger==='data_change'&&state.runs[0]?.trigger==='data_change'&&state.runs[0]?.day===day&&state.runs[0]?.policy===POLICY) state.runs[0]=run;
      else state.runs.unshift(run);
      return run;
    });
  }
  async saveManual(code, price, allowance) {
    validateManual(price, allowance);
    return this.mutate(state => {
      const product = state.products.find(p => p.code === code);
      if (!product) throw new Error('Không tìm thấy sản phẩm');
      if (!Number.isSafeInteger(product.p0) || product.p0 < 600e6) throw new Error('Chỉ nhập giá tay cho nhóm P0 từ 600 triệu');
      if (!product.active || !(product.stock > 0)) throw new Error('Chỉ lưu giá tay cho món còn tồn và đang kinh doanh');
      const before = product.manualPricing ? structuredClone(product.manualPricing) : null;
      const after = { price, allowance, updatedAt: this.clock().toISOString() };
      product.manualPricing = after;
      state.manualEdits ||= [];
      state.manualEdits.unshift({ id: randomUUID(), code, name: product.name, at: after.updatedAt,
        before, after: structuredClone(after), label: 'Đã lưu giá tay — chỉ mô phỏng' });
      return after;
    });
  }
}
