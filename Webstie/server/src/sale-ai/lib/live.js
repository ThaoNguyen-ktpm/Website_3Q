import { createHash, randomUUID } from 'node:crypto';
import { calculate, creationDay, money, POLICY, vietnamTime } from './pricing.js';
import { inStock, KiotClient } from './kiot.js';
import { recoverP0, validP0 } from './cycle.js';
import { ageFields } from './pricing.js';
import { executeBatch } from './batch-update.js';
import { updateSummary, reportItems,issueCount } from './update-report.js';
import { readPool } from './read-pool.js';
import {liveDraft} from './live-draft.js';
import {performance} from 'node:perf_hooks';
import {executeJoint} from './joint-update.js';
import {executeBatchJoint} from './batch-joint.js';
import {sapoNote,sapoSku} from './sapo.js';
import {prepareRestore,commitRestore} from './restore.js';
import {stopsPlatform} from './update-errors.js';

const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
// Bảo 2026-10-27: name what changed on Kiot since the last load (2,000+ codes got a _ddmmyyyy/_KG suffix on 21-27/10), not only that something did.
const CHANGE_LABELS=[['code','mã'],['name','tên'],['currentPrice','giá'],['notes','mô tả'],['stock','tồn'],['active','trạng thái bán']];
export const kiotChanges=(before,fresh)=>CHANGE_LABELS.filter(([key])=>String(before?.[key]??'')!==String(fresh[key]??'')).map(([key,label])=>key==='code'?`mã thành ${fresh.code}`:label).join(', ')||'thông tin khác';
export const fingerprint = p => digest([p.id,p.code,p.name,p.currentPrice,p.notes,p.createdAt,p.active,p.stock,p.modifiedDate,p.inventoryMissing,p.activeMissing,p.taxPresent,p.rawFields]);
const localKey = p => digest([p.p0,p.manualPricing]);
const escape = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function liveNote(existing, row, eventKey, at) {
  const current = `<!--BAOQ-CURRENT--><p>BAOQ | M${row.m} | Sale được giảm thêm tối đa ${money(row.allowance)} | Giá bán ${money(row.price)}</p><!--/BAOQ-CURRENT-->`;
  const priorEvent=existing.match(new RegExp('<p data-baoq-event="'+eventKey+'">[\\s\\S]*?</p>'))?.[0];
  const original=existing.replace(/<!--BAOQ-CURRENT--><p>BAOQ \|[\s\S]*?<\/p><!--\/BAOQ-CURRENT-->/g,'').replace(/<p data-baoq-event="[^"]*">[\s\S]*?<\/p>/g,'');
  const event = priorEvent ||
    `<p data-baoq-event="${eventKey}">${escape(at)} | Đã áp dụng ${row.pricingMode==='manual'?'giá tay duyệt riêng':row.m===0?'M0':`M${row.m} (markdown cộng dồn M1–M${row.m})`} | Giá ${money(row.currentPrice)} → ${money(row.price)}</p>`;
  return current + event + original;
}

export class LiveService {
  constructor(simulator, client, clock=()=>new Date()) {
    this.sim=simulator;this.client=client;this.clock=clock;this.progress={running:false,loaded:0,total:0,error:null};
    if(client instanceof KiotClient)client.onAuthTiming=ms=>{if(this.sim.liveScope)this.sim.liveScope.timings.authMs+=ms;};
  }
  stage(stage,processed=this.operation?.processed||0) {if(this.operation?.running)Object.assign(this.operation,{stage,processed});}
  async timed(method,fn) {
    const scope=this.sim.liveScope,start=performance.now();
    try{return await fn();}finally{if(scope){const ms=performance.now()-start;scope.timings.networkMs+=ms;scope.timings.requests.push({method,path:'/products/:id',ms});}}
  }
  readProduct(id){return this.timed('GET',()=>this.client.product(id));}
  sendUpdate(product,body){return this.timed('PUT',()=>this.client.update(product,body));}
  async transaction(kind,codes,fn) {
    const chosen=new Set(codes),ids=this.sim.state.products.filter(p=>chosen.has(p.code)).map(p=>p.id);
    const start=performance.now(),scope={codes,ids,timings:{cloneMs:0,saveMs:0,publishMs:0,networkMs:0,authMs:0,requests:[]}};let active=false;
    try{
      const result=await this.sim.mutate(async state=>{
        active=true;this.operation={running:true,source:'real',kind,stage:'Đang đối chiếu',processed:0,total:codes.length};
        const result=await fn(state,scope);this.stage('Đang lưu nhật ký');return result;
      },scope);
      scope.timings.totalMs=performance.now()-start;
      this.lastTimings={kind,...scope.timings};
      if(this.timingSink)this.timingSink(this.lastTimings);else console.info('BAOQ timings:',JSON.stringify(this.lastTimings));
      if(result&&typeof result==='object')result.timings=structuredClone(scope.timings);
      return result;
    }finally{if(active)this.operation={...this.operation,running:false};}
  }
  async checkpoint(state,currentUpdate) {
    for (const update of currentUpdate?[currentUpdate]:[]) {
      update.summary = updateSummary(update.items);
      update.issueCount=issueCount(update);
      const attempt = update.attempts?.at(-1);
      if (attempt?.status === 'running') {attempt.summary=update.summary;attempt.items=reportItems(update.items);}
    }
    const scope=this.sim.liveScope,previous=this.operation?.stage;
    this.stage('Đang lưu nhật ký');
    const start=performance.now();
    const published=scope?liveDraft(state,scope):null;
    if(scope)scope.timings.publishMs+=performance.now()-start;
    const saving=performance.now();
    await this.sim.store.write(published||state,{stableRuns:true,...(scope?{immutable:true}:{})});
    if(scope)scope.timings.saveMs+=performance.now()-saving;
    // Historical runs/archive are unchanged throughout commit. Publish isolated
    // mutable fields without repeatedly cloning every historical price row.
    const {runs,archivedProducts,...mutable}=state;
    this.sim.state=published||{...structuredClone(mutable),runs,...(archivedProducts?{archivedProducts}: {})};
    if(previous)this.stage(previous);
  }
  async refresh({onlyWhenChanged=false}={}) {
    return this.sim.mutate(async state=>{
      this.progress={running:true,loaded:0,total:0,error:null};
      try {
        const downloaded=await this.client.all(p=>Object.assign(this.progress,p));
        const fresh=downloaded.filter(inStock);
        const current=new Map(state.products.map(p=>[p.id,p]));
        state.lastCheckedAt=this.clock().toISOString();
        // Identity is Kiot ID / SP code, never the name. Keep out-of-stock cycle
        // records separately so a restock does not initialize P0 again.
        const old=new Map([...(state.archivedProducts||[]),...state.products].map(p=>[p.id,p]));
        const mergedProducts=fresh.map(p=>{
          const previous=old.get(p.id);old.delete(p.id);
          const merged = {...p,p0:previous?previous.p0:null,floor:previous?.floor??null,
            p0InitializedAt:previous?.p0InitializedAt,
            p0Status:previous?.p0Status,
            ...(previous?.manualPricing?{manualPricing:previous.manualPricing}:{}),type:p.name?.includes('!')?'hottrend':'normal',seen:true};
          if (!(merged.p0Status === 'pending_price' && !validP0(merged.currentPrice) && !validP0(merged.p0))) recoverP0(state, merged, this.clock().toISOString());
          Object.assign(merged, ageFields(merged, vietnamTime(this.clock()).date));
          return merged;
        });
        const eligible=p=>validP0(p.currentPrice)&&validP0(p.p0);
        state.products=mergedProducts.filter(eligible);
        state.archivedProducts=[...old.values()].map(p=>({...p,active:false,seen:false})).concat(mergedProducts.filter(p=>!eligible(p)).map(p=>({...p,excludedReason:'missing_price'})));
        const changed=!!state.tableStale||!state.pricedOnly||state.products.length!==current.size||state.products.some(p=>!current.has(p.id)||fingerprint(p)!==fingerprint(current.get(p.id))||p.p0!==current.get(p.id).p0);
        state.tableStale=false;
        state.pricedOnly=true;
        state.importStats={...(this.client.lastImport||{read:downloaded.length}),kept:state.products.length,missingPrice:mergedProducts.length-state.products.length};
        state.stockOnly=true;
        if(onlyWhenChanged&&!changed) return {count:state.products.length,at:state.loadedAt,changed:false};
        state.dataRevision=(state.dataRevision||0)+1;state.loadedAt=this.clock().toISOString();state.dataset='real';
        // Any reload requires a fresh simulation before preparing writes.
        state.prepared=[];
        return {count:state.products.length,at:state.loadedAt,changed};
      } catch(error) {this.progress.error=error.message;throw error;}
      finally {this.progress.running=false;}
    });
  }
  async mapping(body) {
    if(body.priceConfirmed!==true||body.dateConfirmed!==true||body.noteConfirmed!==true||body.noteField!=='description') throw new Error('Cần đối chiếu giá, giờ Việt Nam và đúng trường ghi chú trước khi bật ghi');
    return this.sim.mutate(state=>{
      const p=state.products.find(p=>p.code===body.code);
      if(!p||body.observedPrice!==p.currentPrice||!creationDay(body.observedCreatedAt)||body.observedCreatedAt.slice(0,16)!==p.createdAt?.slice(0,16)) throw new Error('Giá hoặc ngày/giờ đối chiếu chưa khớp sản phẩm');
      state.mapping={verified:true,noteField:'description',code:p.code,at:this.clock().toISOString()};state.prepared=[];
    });
  }
  snapshot(row,product,state) {
    return {...row,id:product.id,notesBefore:product.notes||'',liveBase:fingerprint(product),localKey:localKey(product),dataRevision:state.dataRevision};
  }
  async prepare(runId,codes,{previewOnly=false,continueOnError=false,excludedCodes=[],batch}={}) {
    // TASK-102: page updates (continue on error) check from list reads and write Kiot in bulk; restore keeps the old engine.
    batch??=this.batchWrites===true&&continueOnError&&!previewOnly&&typeof this.client.listModified==='function'&&typeof this.client.updateMany==='function';
    // Validate before creating a selected-record draft.
    if(!Array.isArray(codes)||!Array.isArray(excludedCodes)||(!codes.length&&!(continueOnError&&excludedCodes.length))||new Set(codes).size!==codes.length)throw new Error('Chọn ít nhất một sản phẩm, không trùng mã');
    const build=async state=>{
      const useSapo=this.writesSapo();
      if(this.requireJoint&&!this.sapo)throw Error('Sapo chưa kết nối — chưa thể cập nhật chung');
      if(useSapo&&!previewOnly)this.sapo.requireVerified();
      const run=state.runs.find(r=>r.id===runId);
      const today=vietnamTime(this.clock()).date;
      if(!run||run.policy!==POLICY||run.day!==today||run.customDate||run.dataset!=='real'||run.dataRevision!==state.dataRevision) throw new Error('Cần kiểm thử dữ liệu thật mới nhất cho hôm nay');
      const skipped=[],unchanged=[];
      let listAt=null,kiotList=null,sapoList=null;
      if(batch){
        listAt=this.clock().toISOString();this.stage('Đang đọc danh sách Kiot');
        kiotList=new Map((await this.timed('GET LIST',()=>this.client.all())).map(p=>[p.id,p]));
        if(useSapo){this.stage('Đang đọc danh sách Sapo');sapoList=new Map((await this.timed('SAPO LIST',()=>this.sapo.client.all())).map(p=>[p.id,p]));}
      }
      for(const code of new Set(excludedCodes)){
        const row=run.rows.find(r=>r.code===code);
        if(!row||row.status==='simulated')throw Error('Danh sách món chờ đã thay đổi; chọn lại');
        skipped.push({id:row.id,code,name:row.name,status:'skipped',error:row.reasons.join('; ')||'Chưa đủ điều kiện'});
      }
      let items=(await readPool(codes,async code=>{
       try{
        const row=run.rows.find(r=>r.code===code),local=state.products.find(p=>p.code===code);
        if(!row||!local||row.status!=='simulated'||row.localKey!==localKey(local)) throw new Error(`${code}: dữ liệu chưa đủ điều kiện; cần kiểm thử lại`);
        const fresh=batch?kiotList.get(local.id):await this.readProduct(local.id);
        if(!fresh)throw new Error(`${code}: Kiot không còn trong danh sách (hết hàng hoặc ngừng bán)`);
        this.stage('Đang đối chiếu',(this.operation?.processed||0)+1);
        if(fingerprint(fresh)!==row.liveBase) throw new Error(`${code}: Kiot đã thay đổi (${kiotChanges(local,fresh)}); bấm Tải lại từ Kiot rồi kiểm thử lại`);
        if(fresh.taxPresent) throw new Error(`${code}: cần đối chiếu giá/thuế trước khi ghi`);
        const key=digest([POLICY,local.id,local.p0,row.m,row.price,row.allowance]);
        const item={code,id:local.id,name:local.name,before:structuredClone(fresh),row:structuredClone(row),key,
          notePreview:liveNote(fresh.notes,row,key,'Thời điểm áp dụng sẽ được ghi khi thực hiện')};
        if(useSapo){item.sapo=batch?this.sapo.prepareFrom(item.code,sapoList):await this.sapo.prepare(item.code,{previewOnly});
          // Found by the code before "_": another Kiot product on the same base would write the same Sapo variant.
          if(item.sapo.code!==code&&state.products.some(p=>p.id!==local.id&&sapoSku(p.code)===item.sapo.code))throw new Error(`${code}: Kiot có mã khác cùng gốc ${item.sapo.code} — chưa thể cập nhật Sapo chung`);if(this.sapoDescription===false){item.sapo.keepContent=true;item.sapo.notePreview=item.sapo.before.content;}else item.sapo.notePreview=sapoNote(item.sapo.before.content,item.row,item.notePreview);}
        if(batch){
          // Send only the side that is still wrong; a product right on both sides is not sent at all.
          const kiotOk=fresh.currentPrice===row.price&&String(fresh.notes||'').includes(`data-baoq-event="${key}"`);
          const sapoVariant=item.sapo?.before.variants.find(v=>v.id===item.sapo.variantId);
          const sapoOk=!useSapo||(sapoVariant?.price===row.price&&(this.sapoDescription===false||String(item.sapo.before.content||'').includes(key)));
          if(kiotOk&&sapoOk){unchanged.push(code);return null;}
          item.alreadyOk=[...(kiotOk?['kiot']:[]),...(useSapo&&sapoOk?['sapo']:[])];
        }
        return item;
       }catch(error){
        if(!continueOnError||previewOnly||stopsPlatform(error))throw error;
        const local=state.products.find(p=>p.code===code);skipped.push({id:local?.id,code,name:local?.name||'',status:'skipped',error:error.message});return null;
       }
      })).filter(Boolean);
      if(previewOnly)return {previewOnly:true,items,day:today};
      const prepared={id:randomUUID(),runId,policy:POLICY,at:this.clock().toISOString(),day:today,revision:state.dataRevision,items,skipped,continueOnError,status:'prepared',joint:useSapo,...(useSapo||this.sapoWrite===false?{platforms:useSapo?['kiot','sapo']:['kiot']}:{})};
      if(batch){prepared.batch=true;prepared.listAt=listAt;prepared.unchanged=unchanged.length;}
      state.prepared=[prepared];return prepared;
    };
    return previewOnly?build(this.sim.state):this.transaction('prepare',codes,build);
  }
  async cancel(id) {return this.transaction('cancel',[],state=>{state.prepared=(state.prepared||[]).filter(p=>p.id!==id);});}
  async commit(id, confirmed) {
    if(confirmed!==true) throw new Error('Chưa xác nhận cập nhật Kiot');
    const codes=(this.sim.state.prepared?.find(p=>p.id===id)?.items||[]).map(p=>p.code);
    return this.transaction('commit',codes,async(state,scope)=>{
      const prepared=state.prepared?.find(p=>p.id===id);
      if(prepared?.kind==='restore')throw Error('Dùng chức năng khôi phục cho bản xác nhận này');
      if(this.requireJoint&&!prepared?.joint)throw Error('Cần xác nhận mới cho Kiot + Sapo');
      if(prepared?.joint)this.sapo.requireVerified();
      if(!prepared||this.clock().getTime()-Date.parse(prepared.at)>300000||prepared.policy!==POLICY||prepared.status!=='prepared'||prepared.day!==vietnamTime(this.clock()).date||prepared.revision!==state.dataRevision) throw new Error('Lượt xác nhận không còn hợp lệ; kiểm thử lại');
      prepared.status='consumed';
      // Kiot-only confirmations still use the verified per-platform engine so they keep restore snapshots.
      const platforms=prepared.platforms||(prepared.joint?['kiot','sapo']:null);
      const update={id:randomUUID(),at:this.clock().toISOString(),label:prepared.joint?'Cập nhật Kiot + Sapo':'Cập nhật Kiot',mode:platforms?'joint-v1':'stop-v1',...(platforms?{restoreVersion:1}:{}),...(prepared.joint?{sapoBinding:this.sapo.binding}:{}),items:prepared.items.map(item=>({...item,status:'journaled',actualAt:null,error:null,...(platforms?{platforms:Object.fromEntries(platforms.map(name=>[name,{status:'journaled'}]))}:{})}))};
      update.attempts=[{id:randomUUID(),at:this.clock().toISOString(),kind:'commit',status:'running'}];
      update.continueOnError=prepared.continueOnError===true;update.skipped=structuredClone(prepared.skipped||[]);update.targets=platforms;
      if(prepared.batch&&platforms){update.batch=true;update.listAt=prepared.listAt;update.unchanged=prepared.unchanged||0;
        // A side already right at the check counts as done and is never sent (restore skips it).
        for(const item of update.items)for(const name of item.alreadyOk||[])if(item.platforms[name])item.platforms[name]={status:'done',skipped:true,alreadyOk:true};}
      scope.updateId=update.id;
      state.updates||=[];state.updates.unshift(update);await this.checkpoint(state,update);
      if(platforms)await (update.batch?executeBatchJoint:executeJoint)(this,state,update);else await executeBatch(this,state,update);
      await this.finishAttempt(state,update);
      return update;
    });
  }
  async finishAttempt(state,update) {
    const attempt=update.attempts.at(-1);
    attempt.summary=updateSummary(update.items);attempt.items=reportItems(update.items);
    attempt.status='completed';attempt.completedAt=this.clock().toISOString();
    this.syncVerifiedTable(state,update);
    await this.checkpoint(state,update);
  }
  syncVerifiedTable(state,update) {
    const verified=new Set(update.items.filter(i=>i.platforms?.kiot?.status==='done'&&!i.platforms.kiot.skipped).map(i=>i.id));
    const run=state.runs[0],today=vietnamTime(this.clock()).date;
    if(!verified.size||!run||run.customDate||run.day!==today||run.policy!==POLICY||run.dataRevision!==state.dataRevision)return;
    const products=new Map(state.products.map(p=>[p.id,p]));
    const revision=(state.dataRevision||0)+1;
    const rows=run.rows.map(row=>verified.has(row.id)&&products.has(row.id)?{
      ...this.snapshot(calculate(products.get(row.id),today),products.get(row.id),{dataRevision:revision}),
      writeStatus:update.mode==='restore-joint-v1'?'restored':'updated'
    }:{...row,dataRevision:revision});
    // New immutable current snapshot; old simulation and write journals retain their before-images.
    state.dataRevision=revision;
    state.runs=[{...run,id:randomUUID(),at:this.clock().toISOString(),trigger:'data_change',dataRevision:revision,rows},...state.runs];
  }
  async retry() {const error=new Error('Chức năng thử lại đã tắt');error.status=410;throw error;}
  writesSapo(){return !!this.sapo&&this.sapoWrite!==false;}
  prepareRestore(sourceId){return prepareRestore(this,sourceId);}
  commitRestore(id,confirmed){return commitRestore(this,id,confirmed);}
}
