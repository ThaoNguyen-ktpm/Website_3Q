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
import {fingerprint} from './kiot-fingerprint.js';
import {approvalGroups} from './approval.js';
export {fingerprint} from './kiot-fingerprint.js';

const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
// Bảo 2026-10-27: name what changed on Kiot since the last load (2,000+ codes got a _ddmmyyyy/_KG suffix on 21-27/10), not only that something did.
const CHANGE_LABELS=[['code','mã'],['name','tên'],['currentPrice','giá'],['notes','mô tả'],['stock','tồn'],['active','trạng thái bán']];
export const kiotChanges=(before,fresh)=>CHANGE_LABELS.filter(([key])=>String(before?.[key]??'')!==String(fresh[key]??'')).map(([key,label])=>key==='code'?`mã thành ${fresh.code}`:label).join(', ')||'thông tin khác (tên/mô tả/tồn kho)';
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
    if(this.sim.halted)throw Error('Sale AI đã dừng vì lỗi nghiêm trọng');
    const scope=this.sim.liveScope,start=performance.now();
    try{return await fn();}finally{if(scope){const ms=performance.now()-start;scope.timings.networkMs+=ms;scope.timings.requests.push({method,path:'/products/:id',ms});}}
  }
  readProduct(id){return this.timed('GET',()=>this.client.product(id));}
  sendUpdate(product,body){return this.timed('PUT',()=>this.client.update(product,body));}
  checkKiotSnapshot(state,item,fresh) {
    if(fresh.cost!==item.row.cost)throw Error('Giá vốn trên Kiot đã thay đổi — tải lại và duyệt lại');
    if(fresh.id===item.id&&fingerprint(fresh)===item.row.liveBase)return;
    // Price-only no-ops tolerate the write timestamp, never changes to other fields.
    if(this.kiotDescription===false&&fresh.id===item.id&&fresh.currentPrice===item.row.price){
      const before=item.before;
      if(before&&fingerprint({...before,currentPrice:fresh.currentPrice,modifiedDate:fresh.modifiedDate})===fingerprint(fresh))return;
      const ownWrite=(state.updates||[]).some(u=>u.mode!=='restore-joint-v1'&&(u.items||[]).some(i=>i.id===item.id&&i.platforms?.kiot?.status==='done'&&i.platforms.kiot.afterProduct&&(i.platforms.kiot.afterFingerprint??fingerprint(i.platforms.kiot.afterProduct))===fingerprint(fresh)));
      if(ownWrite)return;
    }
    const price=fresh.currentPrice!==item.row.price?`; giá Kiot hiện ${money(fresh.currentPrice)}, dự kiến ${money(item.row.price)}`:'';
    throw Error(`Kiot đã thay đổi (${kiotChanges(item.before,fresh)}${price}); bấm Tải lại từ Kiot rồi kiểm thử lại`);
  }
  syncKiotProduct(state,fresh,id) {
    if(fresh.id!==id)throw Error('Kiot trả sai ID sản phẩm khi xác minh');
    const local=state.products.find(p=>p.id===id);
    if(local)Object.assign(local,fresh,{liveReadAt:this.clock().toISOString()});
  }
  skipCorrectKiot(state,item,fresh) {
    this.syncKiotProduct(state,fresh,item.id);
    const result=item.platforms?.kiot||item;
    Object.assign(result,{status:'unchanged',requestSent:false,error:null,verifiedAt:this.clock().toISOString()});
  }
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
    const published=scope?liveDraft(state,scope,this.sim.state):null;
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
        const kiotReadAt=this.clock().toISOString();
        const downloaded=await this.client.all(p=>Object.assign(this.progress,p));
        const fresh=downloaded.filter(inStock);
        const current=new Map(state.products.map(p=>[p.id,p]));
        state.lastCheckedAt=this.clock().toISOString();
        state.kiotReadAt=kiotReadAt;
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
        const changed=!!state.tableStale||!state.pricedOnly||state.products.length!==current.size||state.products.some(p=>!current.has(p.id)||fingerprint(p)!==fingerprint(current.get(p.id))||p.p0!==current.get(p.id).p0||p.cost!==current.get(p.id).cost);
        state.tableStale=false;
        state.pricedOnly=true;
        state.importStats={...(this.client.lastImport||{read:downloaded.length}),kept:state.products.length,missingPrice:mergedProducts.length-state.products.length};
        state.stockOnly=true;
        if(onlyWhenChanged&&!changed) {
          // Publish a new current snapshot even when an old table had no trusted read cursor.
          const run=state.runs[0];
          if(run?.dataset==='real'&&run.dataRevision===state.dataRevision){
            const byId=new Map(state.products.map(p=>[p.id,p]));
            state.runs=[{...run,rows:run.rows.map(row=>byId.has(row.id)?{...row,liveReadAt:kiotReadAt}:row)},...state.runs.slice(1)];
          }
          return {count:state.products.length,at:state.loadedAt,changed:false};
        }
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
    return {...row,id:product.id,notesBefore:product.notes||'',liveBase:fingerprint(product),liveReadAt:product.liveReadAt||state.kiotReadAt||null,localKey:localKey(product),dataRevision:state.dataRevision};
  }
  async prepare(runId,codes,{previewOnly=false,continueOnError=false,excludedCodes=[],batch,localOnly=false,schedule,approveBelowCost=false,restoreCost=false,by=null}={}) {
    if(typeof approveBelowCost!=='boolean'||typeof restoreCost!=='boolean'||(approveBelowCost&&restoreCost))throw Error('Cờ duyệt không hợp lệ');
    const approval=approveBelowCost||restoreCost?{kind:restoreCost?'restore_cost':'below_cost',at:this.clock().toISOString(),by}:null;
    if(approval){continueOnError=false;localOnly=false;}
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
      if(batch&&!localOnly){
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
        let row=run.rows.find(r=>r.code===code);const local=state.products.find(p=>p.code===code);
        if(restoreCost&&!row&&local)row=this.snapshot(calculate(local,today),local,state);
        const eligible=restoreCost?approvalGroups(state).legacy.some(r=>r.code===code):approveBelowCost?row?.status==='needs_approval'&&row.currentPrice!==row.price:row?.status==='simulated';
        if(!row||!local||!eligible||row.localKey!==localKey(local)) throw new Error(`${code}: dữ liệu chưa đủ điều kiện; cần kiểm thử lại`);
        if(restoreCost)row={...row,price:row.cost};
        const fresh=localOnly?local:batch?kiotList.get(local.id):await this.readProduct(local.id);
        if(!fresh)throw new Error(`${code}: Kiot không còn trong danh sách (hết hàng hoặc ngừng bán)`);
        this.stage('Đang đối chiếu',(this.operation?.processed||0)+1);
        this.checkKiotSnapshot(state,{id:local.id,before:local,row},fresh);
        if(fresh.taxPresent) throw new Error(`${code}: cần đối chiếu giá/thuế trước khi ghi`);
        const key=digest([POLICY,local.id,local.p0,row.m,row.price,row.allowance]);
        const item={code,id:local.id,name:local.name,before:structuredClone(fresh),row:structuredClone(row),key,
          notePreview:liveNote(fresh.notes,row,key,'Thời điểm áp dụng sẽ được ghi khi thực hiện')};
        if(useSapo){item.sapo=localOnly?this.sapo.resolve(item.code):batch?this.sapo.prepareFrom(item.code,sapoList):await this.sapo.prepare(item.code,{previewOnly});
          // Found by the code before "_": another Kiot product on the same base would write the same Sapo variant.
          if(item.sapo.code!==code&&state.products.some(p=>p.id!==local.id&&sapoSku(p.code)===item.sapo.code))throw new Error(`${code}: Kiot có mã khác cùng gốc ${item.sapo.code} — chưa thể cập nhật Sapo chung`);if(this.sapoDescription===false){item.sapo.keepContent=true;item.sapo.notePreview=item.sapo.before?.content;}else if(!localOnly)item.sapo.notePreview=sapoNote(item.sapo.before.content,item.row,item.notePreview);}
        if(batch&&!localOnly&&(this.kiotDescription!==false||useSapo)){
          // Send only the side that is still wrong; a product right on both sides is not sent at all.
          const kiotOk=fresh.currentPrice===row.price&&(this.kiotDescription===false||String(fresh.notes||'').includes(`data-baoq-event="${key}"`));
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
      const prepared={id:randomUUID(),runId,policy:POLICY,at:this.clock().toISOString(),day:today,revision:state.dataRevision,items,skipped,continueOnError,status:'prepared',kiotDescription:this.kiotDescription!==false,joint:useSapo,...(useSapo||this.sapoWrite===false?{platforms:useSapo?['kiot','sapo']:['kiot']}:{})};
      if(approval)prepared.approval=approval;
      if(localOnly)prepared.localOnly=true;
      if(schedule)prepared.schedule=structuredClone(schedule);
      if(batch){
        const cursors=items.map(i=>Date.parse(i.row.liveReadAt));
        prepared.batch=true;prepared.listAt=localOnly?(cursors.length&&cursors.every(t=>Number.isFinite(t)&&t<=this.clock().getTime())?new Date(Math.min(...cursors)).toISOString():null):listAt;
        prepared.unchanged=unchanged.length;prepared.unchangedCodes=unchanged;
      }
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
      if((prepared?.joint||prepared?.platforms?.includes('sapo'))&&this.sapoWrite===false)throw Error('Sapo đã tắt; cần xác nhận lại lượt chỉ giá Kiot');
      if(this.kiotDescription===false&&prepared?.kiotDescription!==false)throw Error('Đã tắt ghi mô tả Kiot; cần xác nhận lại lượt chỉ giá Kiot');
      if(prepared?.joint)this.sapo.requireVerified();
      if(!prepared||this.clock().getTime()-Date.parse(prepared.at)>300000||prepared.policy!==POLICY||prepared.status!=='prepared'||prepared.day!==vietnamTime(this.clock()).date||prepared.revision!==state.dataRevision) throw new Error('Lượt xác nhận không còn hợp lệ; kiểm thử lại');
      prepared.status='consumed';
      // Kiot-only confirmations still use the verified per-platform engine so they keep restore snapshots.
      const platforms=prepared.platforms||(prepared.joint?['kiot','sapo']:null);
      const update={id:randomUUID(),at:this.clock().toISOString(),label:prepared.joint?'Cập nhật Kiot + Sapo':prepared.kiotDescription===false?'Cập nhật giá Kiot':'Cập nhật Kiot',kiotDescription:prepared.kiotDescription!==false,mode:platforms?'joint-v1':'stop-v1',...(platforms?{restoreVersion:1}:{}),...(prepared.joint?{sapoBinding:this.sapo.binding}:{}),items:prepared.items.map(item=>({...item,status:'journaled',actualAt:null,error:null,...(platforms?{platforms:Object.fromEntries(platforms.map(name=>[name,{status:'journaled'}]))}:{})}))};
      if(prepared.approval)update.approval=structuredClone(prepared.approval);
      update.attempts=[{id:randomUUID(),at:this.clock().toISOString(),kind:'commit',status:'running'}];
      if(platforms?.length===1&&platforms[0]==='kiot'&&prepared.kiotDescription===false)update.journalVersion=2;
      update.continueOnError=prepared.continueOnError===true;update.skipped=structuredClone(prepared.skipped||[]);update.targets=platforms;
      if(prepared.schedule){update.trigger='schedule';update.scheduleId=prepared.schedule.id;update.manualPriceSkips=structuredClone(prepared.schedule.manualPriceSkips);update.unverifiedSkips=structuredClone(prepared.schedule.unverifiedSkips);}
      if(prepared.localOnly)update.localOnly=true;
      if(prepared.batch&&platforms){update.batch=true;update.listAt=prepared.listAt;update.unchanged=prepared.unchanged||0;update.unchangedCodes=structuredClone(prepared.unchangedCodes||[]);
        // A side already right at the check counts as done and is never sent (restore skips it).
        for(const item of update.items)for(const name of item.alreadyOk||[])if(item.platforms[name])item.platforms[name]={status:'done',skipped:true,alreadyOk:true};}
      scope.updateId=update.id;
      // The background job owns this confirmation; its restore snapshots now live in the journal.
      if(prepared.localOnly)state.prepared=[];
      state.updates||=[];state.updates.unshift(update);if(!update.batch)await this.checkpoint(state,update);
      if(platforms)await (update.batch?executeBatchJoint:executeJoint)(this,state,update);else await executeBatch(this,state,update);
      await this.finishAttempt(state,update);
      return update;
    });
  }
  async finishAttempt(state,update) {
    const attempt=update.attempts.at(-1);
    attempt.summary=updateSummary(update.items);attempt.items=reportItems(update.items);
    attempt.status='completed';attempt.completedAt=this.clock().toISOString();
    update.issueCount=issueCount(update);
    this.syncVerifiedTable(state,update);
    if(!update.batch)await this.checkpoint(state,update);
  }
  syncVerifiedTable(state,update) {
    // Only the simulator's table provider may publish a new current table.
    if(this.sim.live!==this)return;
    const verified=new Map(update.items.filter(i=>i.platforms?['done','unchanged'].includes(i.platforms.kiot?.status)&&!i.platforms.kiot.skipped:['done','unchanged'].includes(i.status)).map(i=>[i.id,i.platforms?.kiot?.status||i.status]));
    const run=state.runs[0],today=vietnamTime(this.clock()).date;
    if(!verified.size||!run||run.customDate||run.day!==today||run.policy!==POLICY||run.dataRevision!==state.dataRevision)return;
    const products=new Map(state.products.map(p=>[p.id,p]));
    const revision=(state.dataRevision||0)+1;
    const rows=run.rows.map(row=>verified.has(row.id)&&products.has(row.id)?{
      ...this.snapshot(calculate(products.get(row.id),today),products.get(row.id),{dataRevision:revision}),
      writeStatus:update.mode==='restore-joint-v1'?'restored':verified.get(row.id)==='unchanged'?'unchanged':'updated'
    }:{...row,dataRevision:revision});
    // New immutable current snapshot; old simulation and write journals retain their before-images.
    state.dataRevision=revision;
    state.runs=[{...run,id:randomUUID(),at:this.clock().toISOString(),trigger:'data_change',dataRevision:revision,rows},...state.runs];
  }
  async retry() {const error=new Error('Chức năng thử lại đã tắt');error.status=410;throw error;}
  preflightRow(state,update,item,row){
    if(update.approval?.kind==='restore_cost'){
      if(!approvalGroups(state).legacy.some(r=>r.id===item.id)||row.cost!==item.row.cost)throw Error('Điều kiện trả về giá vốn đã thay đổi');
      return {...row,price:row.cost};
    }
    if(update.approval?.kind==='below_cost'?row.status!=='needs_approval':row.status!=='simulated')throw Error('Điều kiện hoặc mốc M thay đổi');
    return row;
  }
  async keepBelowCost(codes,confirmed,by=null,expectedItems){
    if(confirmed!==true||!Array.isArray(codes)||!codes.length||new Set(codes).size!==codes.length||!Array.isArray(expectedItems)||expectedItems.length!==codes.length||new Set(expectedItems.map(i=>i?.code)).size!==codes.length)throw Error('Cần xác nhận danh sách giữ giá hợp lệ');
    return this.transaction('keep-below-cost',codes,async state=>{
      const legacy=approvalGroups(state).legacy,items=[];
      for(const code of codes){
        const row=legacy.find(r=>r.code===code);if(!row)throw Error('Danh sách món dưới vốn đã thay đổi; tải lại');
        const expected=expectedItems.find(i=>i?.code===code);
        if(!expected||expected.price!==row.currentPrice||expected.cost!==row.cost)throw Error('Giá hoặc giá vốn đã thay đổi; tải lại và xác nhận lại');
        const local=state.products.find(p=>p.id===row.id),fresh=await this.readProduct(row.id);
        this.checkKiotSnapshot(state,{id:row.id,row:row.liveBase?row:this.snapshot(row,local,state),before:local},fresh);
        items.push({id:row.id,price:fresh.currentPrice,at:this.clock().toISOString(),by});
      }
      state.belowCostKeeps=[...(state.belowCostKeeps||[]).filter(k=>!items.some(i=>i.id===k.id)),...items];
      return {count:items.length};
    });
  }
  writesSapo(){return !!this.sapo&&this.sapoWrite!==false;}
  prepareRestore(sourceId){return prepareRestore(this,sourceId);}
  commitRestore(id,confirmed){return commitRestore(this,id,confirmed);}
}
