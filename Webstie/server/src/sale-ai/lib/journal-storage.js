import {fingerprint,notesFingerprint} from './kiot-fingerprint.js';

const pick=(value,keys)=>Object.fromEntries(keys.filter(key=>value?.[key]!==undefined).map(key=>[key,value[key]]));
const product=p=>p?{...pick(p,['id','code','name','currentPrice']),notesHash:p.notesHash??notesFingerprint(p.notes)}:p;
// Only price-only journals omit descriptions. Old description/Sapo journals stay verbatim.
export function journalItem(item){
 const out={...item,before:product(item.before),row:pick(item.row,['price','liveBase','localKey','m','allowance']),
  beforeFingerprint:item.beforeFingerprint??(item.before?fingerprint(item.before):undefined)};
 delete out.notePreview;delete out.desiredNote;
 out.platforms=Object.fromEntries(Object.entries(item.platforms||{}).map(([name,p])=>[name,{...p,...(p.afterProduct?{
  afterProduct:product(p.afterProduct),afterFingerprint:p.afterFingerprint??fingerprint(p.afterProduct)}:{})}]));
 return out;
}
export const compactJournal=update=>update.journalVersion===2&&update.mode==='joint-v1'&&update.kiotDescription===false&&!update.items.some(i=>i.platforms?.sapo);
export const chunkedJournal=value=>value?.storage==='baoq-update-chunks-v1';
export function journalChildren(record){
 if(!chunkedJournal(record))return [];
 if(!Array.isArray(record.itemChunks)||!Array.isArray(record.attempts)||record.attempts.some(a=>!Array.isArray(a.itemChunks)))throw Error('Khối nhật ký không hợp lệ');
 return [...record.itemChunks,...record.attempts.flatMap(a=>a.itemChunks)];
}
