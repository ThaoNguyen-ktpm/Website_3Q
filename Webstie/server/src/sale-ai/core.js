import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { SplitStore } from './lib/split-store.js';
import { Simulator } from './lib/service.js';
import { vietnamTime,POLICY } from './lib/pricing.js';
import { failureScenarios } from './lib/fake-sync.js';
import { KiotClient } from './lib/kiot.js';
import { LiveService } from './lib/live.js';
import { validP0, recoverP0 } from './lib/cycle.js';
import { randomUUID, createHash } from 'node:crypto';
import { viewData, updateDetail, filterResultRows } from './lib/view-data.js';
import {SapoClient,SapoService} from './lib/sapo.js';
import {mkdir,access} from 'node:fs/promises';
import {audit,applyPlan} from './lib/store-cleanup.js';
/** @param {any} [options] JS compatibility boundary; core validation remains unchanged. */
export async function createSaleAi({ dataDir = fileURLToPath(new URL('../../data/sale-ai/', import.meta.url)), store, source = {load:async()=>[]}, clock, liveStore, client, sapoClient, sapoStore, fixture=false, sapoWrite=true, sapoDescription=false, batchWrites=false } = {}) {
  if(fixture&&(!store||!liveStore||!sapoStore||!client||!sapoClient||client instanceof KiotClient||sapoClient instanceof SapoClient))throw Error('Fixture phải dùng hai client giả lập và ba store riêng');
  if(!fixture&&sapoClient&&!(sapoClient instanceof SapoClient))throw Error('Client Sapo giả lập chỉ dùng trong fixture riêng');
  const root = dirname(fileURLToPath(import.meta.url));
  // Data lives outside src/dist; never import the legacy data directory.
  if (!fixture) {
    await mkdir(dataDir,{recursive:true});
    const stores=['state.store','kiot-state.store','sapo-state.store'];
    let existing=false;
    for(const name of stores) {try{await access(join(dataDir,name,'manifest.json'));existing=true;}catch(e){if(e.code!=='ENOENT')throw e;}}
    if(existing) await applyPlan(dataDir,await audit(dataDir));
  }
  const session=randomUUID(), counters=new Map();
  const track=original=>{
    const tracked={path:original.path,read:()=>original.read(),write:async(...args)=>{await original.write(...args);counters.set(tracked,(counters.get(tracked)||0)+1);}};
    return tracked;
  };
  const revision=target=>`${session}:${target===real?'real':'sample'}:${counters.get(target.store)||0}${target===real?':'+JSON.stringify(sapo.status()):''}`;
  const simulator = new Simulator(track(store || new SplitStore(join(dataDir, 'state.json'))), source, clock);
  await simulator.initialize();
  const real = new Simulator(track(liveStore || new SplitStore(join(dirname(store?.path || join(dataDir,'state.json')), 'kiot-state.json'))), {load:async()=>[]}, clock);
  await real.initialize();real.state.dataset='real';
  if (!real.state.pricedOnly) await real.mutate(state=>{
    for (const p of state.products) recoverP0(state,p,real.clock().toISOString());
    const eligible=p=>p.active&&p.stock>0&&validP0(p.p0)&&validP0(p.currentPrice);
    const hidden=state.products.filter(p=>!eligible(p));
    state.products=state.products.filter(eligible);
    state.archivedProducts=[...(state.archivedProducts||[]),...hidden.map(p=>({...p,excludedReason:'missing_price'}))];
    state.pricedOnly=true;state.dataRevision=(state.dataRevision||0)+1;state.prepared=[];
  });
  // TASK-104: runtime supplies the shared catalog callback; per-product reads/writes stay in the original client.
  const live = new LiveService(real, client || new KiotClient({credentials:{retailer:process.env.KIOT_RETAILER,client:process.env.KIOT_CLIENT_ID,secret:process.env.KIOT_CLIENT_SECRET}}), clock);real.live=live;
  const sapo=new SapoService(sapoClient||new SapoClient({shop:process.env.SAPO_SHOP,key:process.env.SAPO_API_KEY,secret:process.env.SAPO_API_SECRET}),sapoStore||new SplitStore(join(dirname(store?.path||join(dataDir,'state.json')),'sapo-state.json'),{kind:'sapo'}),fixture?'fixture':undefined);
  // Sapo receives price only by user request; its description stays untouched unless sapoDescription:true.
  await sapo.initialize();live.sapo=sapo;live.sapoWrite=sapoWrite;live.requireJoint=sapoWrite;live.sapoDescription=sapoDescription;
  // Batch writes are disabled in production; tests may explicitly exercise the fixture engine.
  live.batchWrites=batchWrites;
  let operationBusy=false;
  const perform=async fn=>{
    if(operationBusy||simulator.busy||real.busy) {const e=new Error('Đang xử lý một lượt khác, vui lòng chờ');e.status=409;throw e;}
    operationBusy=true;try{return await fn();}finally{operationBusy=false;}
  };
  const ensureCurrent=async(target,force=false)=>{
    const run=target.state.runs[0];
    if(force||!run||run.customDate||run.day!==vietnamTime(target.clock()).date||run.policy!==target.state.policy||(target===real&&run.dataRevision!==real.state.dataRevision)) return target.run(undefined,'data_change');
  };
  const refreshSapo=async(startup=false)=>{
    // API ordering is not an index change; compare only product/variant identities and SKU.
    const catalogKey=()=>JSON.stringify(sapo.state.products.map(p=>({id:p.id,
      variants:p.variants.map(v=>({id:v.id,sku:v.sku})).sort((a,b)=>a.id-b.id)
    })).sort((a,b)=>a.id-b.id));
    const before=startup?catalogKey():null;
    const result=await sapo.refresh();
    if(!startup||before!==catalogKey())await real.mutate(s=>{s.prepared=[];});
    return result;
  };
  const refreshTable=async()=>perform(async()=>{
    const result=await live.refresh({onlyWhenChanged:true});
    await ensureCurrent(real,result.changed);
    if(sapo.status().connected)try{await refreshSapo();}catch{/* Kiot table stays available; Sapo status reports the failure. */}
    return result;
  });
  const readSapoOnStartup=()=>{
    if(!sapo.status().connected||sapo.status().ready)return;
    if(operationBusy||simulator.busy||real.busy){setTimeout(readSapoOnStartup,25).unref();return;}
    void perform(()=>refreshSapo(true)).catch(()=>console.error('Sale AI: chưa đọc được Sapo, sẽ thử lại khi Tải lại từ Kiot.'));
  };
  // Defer network work until the initialized core has been returned; share the write lock.
  if(sapo.status().connected&&!sapo.status().ready)setImmediate(readSapoOnStartup).unref();
  const handler = async (req, res) => {
    const respond = (code, body) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(body)); };
    try {
      const url = new URL(req.url, 'http://sale-ai.local');
      const selected=url.searchParams.get('dataset')==='real'?real:simulator;
      if (req.method === 'GET' && url.pathname === '/api/status') return respond(200,{busy:operationBusy||simulator.busy||real.busy,progress:live.progress,operation:live.operation,lastTimings:live.lastTimings,runId:selected.state.runs[0]?.id,revision:revision(selected)});
      if(req.method==='GET'&&url.pathname==='/api/view')return respond(200,{...viewData(selected.state,url.searchParams,{revision:revision(selected),today:vietnamTime(selected.clock()).date,dataset:selected===real?'real':'sample',busy:operationBusy||simulator.busy||real.busy,progress:live.progress}),...(selected===real?{sapo:sapo.status(),sapoWrite:live.sapoWrite,sapoDescription:live.sapoDescription}:{})});
      if(req.method==='GET'&&url.pathname==='/api/sapo/status')return respond(200,sapo.status());
      if(req.method==='GET'&&url.pathname==='/api/kiot/selection'){
        const run=real.state.runs[0];if(!run||run.id!==url.searchParams.get('runId')||run.day!==vietnamTime(real.clock()).date||run.policy!==POLICY||run.customDate||run.dataRevision!==real.state.dataRevision)throw Error('Bảng đã thay đổi; tải lại trước khi chọn tất cả');
        const rows=filterResultRows(run.rows,url.searchParams);return respond(200,{runId:run.id,dataRevision:real.state.dataRevision,codes:rows.filter(r=>r.status==='simulated').map(r=>r.code),excludedCodes:rows.filter(r=>r.status!=='simulated').map(r=>r.code)});
      }
      if(req.method==='GET'&&url.pathname==='/api/kiot/retry-selection'){
        const source=(real.state.updates||[]).find(u=>u.id===url.searchParams.get('updateId'));if(!source)throw Object.assign(Error('Không tìm thấy lượt cập nhật'),{status:404});
        const run=real.state.runs[0];if(!run||run.day!==vietnamTime(real.clock()).date||run.policy!==POLICY||run.customDate||run.dataRevision!==real.state.dataRevision)throw Error('Bảng đã thay đổi; tải lại trước khi cập nhật lại');
        const failed=[...new Set([...(source.items||[]).filter(i=>i.status!=='done').map(i=>i.code),...(source.skipped||[]).map(s=>s.code)])];
        const rows=new Map(run.rows.map(r=>[r.code,r]));const codes=failed.filter(code=>rows.get(code)?.status==='simulated');
        return respond(200,{runId:run.id,dataRevision:real.state.dataRevision,total:failed.length,codes,notEligible:failed.length-codes.length});
      }
      if(req.method==='GET'&&url.pathname.startsWith('/api/history/updates/'))return respond(200,updateDetail(selected.state,decodeURIComponent(url.pathname.slice('/api/history/updates/'.length)),url.searchParams));
      if (req.method === 'GET' && url.pathname === '/api/state') {
        const {archivedProducts,...visibleState}=selected.state;
        return respond(200, { ...visibleState, archivedCount:archivedProducts?.length||0,products:selected.state.products.map(({rawSource,...p})=>p),dataset:selected===real?'real':'sample',
        busy:operationBusy||simulator.busy||real.busy, progress:live.progress,today:vietnamTime(simulator.clock()).date,
        mode:selected===real?'Dữ liệu Kiot thật — cập nhật theo thao tác hoặc lịch đã bật':'Dữ liệu mẫu — chỉ mô phỏng' });
      }
      if (req.method === 'POST') {
        if (!req.headers['content-type']?.startsWith('application/json')) return respond(403, { error: 'Yêu cầu không hợp lệ' });
        let raw = '';
        const bodyLimit=['/api/kiot/prepare','/api/kiot/preview'].includes(url.pathname)?1048576:16384;
        for await (const chunk of req) { raw += chunk; if (raw.length > bodyLimit) return respond(413, { error: 'Dữ liệu quá lớn' }); }
        const body = JSON.parse(raw || '{}');
        const target=body.dataset==='real'?real:simulator;
        if (url.pathname === '/api/run') return respond(200, await perform(()=>target.run(body.day)));
        if (url.pathname === '/api/manual-price') return respond(410, {error:'Chức năng nhập giá tay đã được gỡ bỏ'});
        if (url.pathname === '/api/table/ensure') {const before=revision(target);await perform(()=>ensureCurrent(target));return respond(200,{ok:true,changed:before!==revision(target),revision:revision(target)});}
        if (url.pathname === '/api/kiot/refresh') return respond(200, await refreshTable());
        if (url.pathname === '/api/kiot/diagnose') return respond(200,await perform(async()=>{
          const p=real.state.products.find(p=>p.code===body.code);
          if(!p)throw new Error('Chọn mã sản phẩm có trong dữ liệu đã tải');
          const checks=[];
          for(let n=1;n<=3;n++) {
            const started=Date.now();try {const fresh=await live.client.product(p.id);checks.push({attempt:n,ok:true,ms:Date.now()-started,code:fresh.code,price:fresh.currentPrice});}
            catch(error){checks.push({attempt:n,ok:false,error:error.message,diagnostic:error.diagnostic});}
          }
          return {mode:'Chỉ đọc trong tiến trình tool — không gửi cập nhật',checks};
        }));
        if (url.pathname === '/api/kiot/mapping') {await perform(()=>live.mapping(body));return respond(200,{ok:true});}
        if(url.pathname==='/api/sapo/refresh')return respond(200,await perform(()=>refreshSapo()));
        if(url.pathname==='/api/sapo/check')return respond(200,await perform(()=>sapo.check(body.code)));
        if(url.pathname==='/api/sapo/mapping'){await perform(async()=>{await sapo.confirm(body);await real.mutate(s=>{s.prepared=[];});});return respond(200,{ok:true});}
        if (url.pathname === '/api/kiot/preview') return respond(200,await perform(()=>live.prepare(body.runId,body.codes,{previewOnly:true})));
        if (url.pathname === '/api/kiot/prepare') return respond(200,await perform(()=>live.prepare(body.runId,body.codes,{continueOnError:body.continueOnError===true,excludedCodes:body.excludedCodes||[]})));
        if (url.pathname === '/api/kiot/cancel') {await perform(()=>live.cancel(body.id));return respond(200,{ok:true});}
        if (url.pathname === '/api/kiot/restore/prepare') return respond(200,await perform(()=>live.prepareRestore(body.sourceId)));
        if (url.pathname === '/api/kiot/restore/commit') {const update=await perform(()=>live.commitRestore(body.id,body.confirmed));return respond(200,{...update,viewRevision:revision(real)});}
        if (url.pathname === '/api/kiot/commit') {const update=await perform(()=>live.commit(body.id,body.confirmed));return respond(200,{...update,viewRevision:revision(real)});}
        if (url.pathname === '/api/kiot/retry') return respond(410,{error:'Chức năng thử lại đã tắt'});
        if (url.pathname === '/api/scenarios') return respond(200, failureScenarios());
        return respond(404, { error: 'Không có chức năng này' });
      }
      const files = { '/': ['public/index.html', 'text/html'], '/app.js': ['public/app.js', 'text/javascript'], '/live-ui.js': ['public/live-ui.js', 'text/javascript'], '/style.css': ['public/style.css', 'text/css'], '/update-report.js':['lib/update-report.js','text/javascript'], '/history-model.js':['public/history-model.js','text/javascript'] };
      files['/age-cell.js'] = ['public/age-cell.js','text/javascript'];
      if (req.method !== 'GET' || !files[url.pathname]) return respond(404, { error: 'Không tìm thấy' });
      const [file, contentType] = files[url.pathname];
      const bytes=await readFile(join(root,file));const etag='"'+createHash('sha256').update(bytes).digest('hex')+'"';
      const headers={ 'Content-Type': `${contentType}; charset=utf-8`, 'Content-Security-Policy': "default-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'self'", 'X-Content-Type-Options': 'nosniff','Cache-Control':'no-cache',ETag:etag };
      const matches=(req.headers['if-none-match']||'').split(',').some(tag=>tag.trim()==='*'||tag.trim().replace(/^W\//,'')===etag);
      res.writeHead(matches?304:200,headers);res.end(matches?undefined:bytes);
    } catch (error) { respond(error.status || 400, { error: error.message }); }
  };
  return { handler, simulator,real,live,sapo,refreshTable,keepCurrent:async()=>{if(!operationBusy&&!simulator.busy&&!real.busy)await perform(async()=>{await ensureCurrent(simulator);await ensureCurrent(real);});} };
}
