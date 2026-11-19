import {randomUUID} from 'node:crypto';
import {vietnamTime,money} from './pricing.js';

export const AUTO_UPDATE_WINDOW_MS=5*60*1000;
export const AUTO_UPDATE_LIMIT=2000;
const validTime=value=>typeof value==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(value);
const defaults=()=>({version:1,products:[],runs:[],enabled:false,time:'10:00',lastDate:null,events:[]});
const weekday=day=>new Date(day+'T12:00:00+07:00').getUTCDay();
const instant=(day,time)=>new Date(`${day}T${time}:00+07:00`).getTime();

/** Independent metadata: claiming a busy day must not mutate an active price journal. */
export class AutoUpdate {
  constructor(store,clock){this.store=store;this.clock=clock;this.tail=Promise.resolve();this.running=false;this.revision=0;}
  async initialize(){
    this.state=await this.store.read()||defaults();
    if(typeof this.state.enabled!=='boolean'||!validTime(this.state.time)||!Array.isArray(this.state.events))throw Error('Cài đặt lịch Sale AI không hợp lệ');
    if(this.state.events.some(e=>e.outcome==='running'))await this.save(s=>{
      for(const e of s.events)if(e.outcome==='running'){e.outcome='interrupted';e.message='Lượt tự động bị gián đoạn — xem Lịch sử trước khi cập nhật tiếp';}
    });
  }
  save(change){
    const work=this.tail.then(async()=>{const next=structuredClone(this.state);const result=change(next);await this.store.write(next);this.state=next;this.revision++;return result;});
    this.tail=work.catch(()=>{});return work;
  }
  due(){
    const now=this.clock(),{date}=vietnamTime(now),elapsed=now.getTime()-instant(date,this.state.time);
    return this.state.enabled&&weekday(date)!==0&&this.state.lastDate!==date&&elapsed>=0&&elapsed<AUTO_UPDATE_WINDOW_MS;
  }
  status(){
    let nextAt=null;
    if(this.state.enabled){
      const now=this.clock(),{date}=vietnamTime(now);
      for(let n=0;n<8;n++){
        const day=new Date(Date.parse(date+'T00:00:00Z')+n*86400000).toISOString().slice(0,10),at=instant(day,this.state.time);
        if(weekday(day)!==0&&day!==this.state.lastDate&&(at>now.getTime()||(n===0&&this.due()))){nextAt=new Date(at).toISOString();break;}
      }
    }
    return {enabled:this.state.enabled,time:this.state.time,running:this.running,nextAt,windowMinutes:AUTO_UPDATE_WINDOW_MS/60000};
  }
  async configure(body,actor){
    if(!body||Array.isArray(body)||typeof body!=='object'||Object.keys(body).length!==2||Object.keys(body).some(k=>!['enabled','time'].includes(k))||typeof body.enabled!=='boolean'||!validTime(body.time))throw Object.assign(Error('Chỉ nhận enabled (Bật/Tắt) và time hợp lệ HH:MM'),{status:400});
    if(this.running)throw Object.assign(Error('Lượt tự động đang chạy; chờ hoàn tất trước khi đổi lịch'),{status:409});
    await this.save(s=>{
      const before={enabled:s.enabled,time:s.time};s.enabled=body.enabled;s.time=body.time;
      s.events.unshift({id:randomUUID(),at:this.clock().toISOString(),mode:'auto-settings',items:[],actor:{id:actor?.id,email:actor?.email},before,after:{...body},
        message:`${actor?.email||'Người quản lý'} đổi lịch: ${before.enabled?'Bật':'Tắt'} ${before.time} → ${body.enabled?'Bật':'Tắt'} ${body.time} · Thứ 2–Thứ 7`});
    });
    return this.status();
  }
  async claim(message){
    return this.save(s=>{
      const date=vietnamTime(this.clock()).date;
      if(!this.due())return null;
      s.lastDate=date;
      const event={id:randomUUID(),at:this.clock().toISOString(),trigger:'schedule',mode:'schedule-event',outcome:message?'skipped':'running',items:[],message:message||'Đang chạy lượt tự động cập nhật'};
      s.events.unshift(event);return event;
    });
  }
  async finish(event,{message,manualPriceSkips=[],unverifiedSkips=[],journaled=false}={}){
    await this.save(s=>{s.events=s.events.flatMap(e=>e.id!==event.id?[e]:journaled?[]:[{...e,outcome:'completed',message:message+(manualPriceSkips.length?` · ${manualPriceSkips.length.toLocaleString('vi-VN')} giữ giá sửa tay`:'')+(unverifiedSkips.length?` · ${unverifiedSkips.length.toLocaleString('vi-VN')} chưa xác minh, không gửi lại`:''),manualPriceSkips,unverifiedSkips}]);});
  }
  history(state){
    // Updates can be replaced without replacing the containing state (including recovery/fixtures).
    if(this.cachedHistory?.state===state&&this.cachedHistory.updates===state.updates&&this.cachedHistory.revision===this.revision)return this.cachedHistory.value;
    const persisted=new Set((state.updates||[]).map(u=>u.scheduleId).filter(Boolean));
    const value={...state,updates:[...(state.updates||[]),...this.state.events.filter(e=>!persisted.has(e.id))]};
    this.cachedHistory={state,updates:state.updates,revision:this.revision,value};return value;
  }
}

/** Latest successful verified write, including manual updates/restores; no-op reads are not writes. */
export function expectedKiotPrices(updates=[]){
  const prices=new Map(),times=new Map();
  for(const update of updates)for(const item of update.items||[]){
    const result=item.platforms?.kiot||item;
    if(result.status!=='done'||result.skipped||result.alreadyOk||result.requestSent===false||!result.verifiedAt)continue;
    const price=result.afterProduct?.currentPrice??item.row?.price,at=Date.parse(result.verifiedAt);
    if(!Number.isFinite(price)||!Number.isFinite(at)||(times.get(item.id)??-Infinity)>=at)continue;
    prices.set(item.id,price);times.set(item.id,at);
  }
  return prices;
}
export function autoSelection(state){
  const rows=(state.runs[0]?.rows||[]).filter(r=>r.status==='simulated'&&r.m>=1&&r.m<=6&&r.currentPrice!==r.price);
  const expected=expectedKiotPrices(state.updates),products=new Map(state.products.map(p=>[p.id,p]));
  const unresolved=new Set(),seen=new Set();
  // A later verified write resolves an older unknown; a failed/no-op attempt does not.
  for(const update of state.updates||[])for(const item of update.items||[]){
    if(seen.has(item.id))continue;
    const result=item.platforms?.kiot||item;
    if(['unknown','sending'].includes(result.status)){unresolved.add(item.id);seen.add(item.id);}
    else if(result.status==='done'&&result.verifiedAt&&!result.skipped&&!result.alreadyOk)seen.add(item.id);
  }
  const codes=[],manualPriceSkips=[],unverifiedSkips=[];
  for(const row of rows){
    const price=expected.get(row.id)??products.get(row.id)?.p0;
    if(row.currentPrice!==price)manualPriceSkips.push({id:row.id,code:row.code,name:row.name,status:'skipped_manual_price',beforePrice:row.currentPrice,expectedPrice:price,price:row.price,
      error:`Giá Kiot bị sửa tay: hiện ${money(row.currentPrice)}, Sale AI ghi lần trước ${money(price)}, dự kiến hôm nay ${money(row.price)}`});
    else if(unresolved.has(row.id))unverifiedSkips.push({id:row.id,code:row.code,name:row.name,status:'unknown',beforePrice:row.currentPrice,price:row.price,error:'Lượt trước chưa xác minh trên Kiot — không tự gửi lại'});
    else codes.push(row.code);
  }
  return {codes,manualPriceSkips,unverifiedSkips,total:rows.length};
}
