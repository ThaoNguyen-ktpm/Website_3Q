import {createHash} from 'node:crypto';
import {loadEnvFile} from 'node:process';
import {money} from './pricing.js';
export const sapoFingerprint=p=>createHash('sha256').update(JSON.stringify(p)).digest('hex');
const id=value=>{if(!Number.isSafeInteger(value)||value<=0)throw Error('Sapo trả ID không hợp lệ');return value;};
export function sapoCatalogEntry(p){
 id(p?.id);if(!Array.isArray(p.variants))throw Error('Sapo: danh sách phiên bản không hợp lệ');
 const seen=new Set();return {id:p.id,variants:p.variants.map(v=>{
  id(v.id);if(seen.has(v.id)||(v.sku!=null&&typeof v.sku!=='string'))throw Error('Sapo: danh tính phiên bản không hợp lệ');seen.add(v.id);
  return {id:v.id,sku:v.sku??''};
 })};
}
export function validateSapoProduct(p) {
 id(p?.id);if(typeof p.content!=='string'||!Array.isArray(p.variants)||!p.variants.length)throw Error('Sapo: chưa xác minh được cấu trúc giá/mô tả');
 const seen=new Set();for(const v of p.variants){id(v.id);if(seen.has(v.id)||typeof v.sku!=='string'||!Number.isSafeInteger(Number(v.price))||Number(v.price)<=0)throw Error('Sapo: dữ liệu phiên bản không hợp lệ');seen.add(v.id);}
 return {id:p.id,content:p.content,variants:p.variants.map(v=>({id:v.id,sku:v.sku,price:Number(v.price)}))};
}
export class SapoClient {
 constructor(config,fetcher=fetch) {
  if(!config){try{loadEnvFile('.env');}catch(e){if(e.code!=='ENOENT')throw e;}config={shop:process.env.SAPO_SHOP,key:process.env.SAPO_API_KEY,secret:process.env.SAPO_API_SECRET};}
  this.config=config;this.fetcher=fetcher;
 }
 get configured(){return /^[a-z0-9][a-z0-9-]*\.mysapo\.net$/.test(this.config.shop||'')&&!!this.config.key&&!!this.config.secret;}
 get binding(){return sapoFingerprint(this.config);}
 async request(path,method='GET',body) {
  if(!this.configured)throw Error('Sapo chưa kết nối — chưa thể cập nhật chung');
  try{
   const response=await this.fetcher('https://'+this.config.shop+path,{method,redirect:'error',signal:AbortSignal.timeout(30000),headers:{Authorization:'Basic '+Buffer.from(this.config.key+':'+this.config.secret).toString('base64'),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
   if(!response.ok){const e=Error(`Sapo ${method}: HTTP ${response.status}`);e.httpStatus=response.status;e.uncertain=method==='PUT'&&(response.status>=500||response.status===408);throw e;}
   return await response.json();
  }catch(error){if(error.httpStatus)throw error;const e=Error(`Sapo ${method}: mất phản hồi hoặc hết thời gian chờ`);e.uncertain=method==='PUT';throw e;}
 }
 async all(){const out=[],seen=new Set();for(let page=1;;page++){
  const body=await this.request('/admin/products.json?limit=250&page='+page);
  if(!Array.isArray(body.products))throw Error('Sapo: danh sách không hợp lệ');
  if(!body.products.length)return out;
  for(const raw of body.products){const p=sapoCatalogEntry(raw);if(seen.has(p.id))throw Error('Sapo: phân trang trùng sản phẩm; không công bố chỉ mục');seen.add(p.id);out.push(p);}
 }}
 async product(productId){const p=validateSapoProduct((await this.request('/admin/products/'+id(productId)+'.json')).product);if(p.id!==productId)throw Error('Sapo trả sai ID sản phẩm');return p;}
 async update(productId,variantId,price,content){id(productId);id(variantId);if(!Number.isSafeInteger(price)||price<=0||(content!==null&&typeof content!=='string'))throw Error('Sapo: giá/mô tả không hợp lệ');return this.request('/admin/products/'+productId+'.json','PUT',{product:{id:productId,...(content===null?{}:{content}),variants:[{id:variantId,price}]}});}
 async restore(productId,variants,content){id(productId);if(!Array.isArray(variants)||!variants.length||typeof content!=='string')throw Error('Sapo: bản khôi phục không hợp lệ');const seen=new Set();for(const v of variants){id(v.id);if(seen.has(v.id)||!Number.isSafeInteger(v.price)||v.price<=0)throw Error('Sapo: bản giá khôi phục không hợp lệ');seen.add(v.id);}return this.request('/admin/products/'+productId+'.json','PUT',{product:{id:productId,content,variants:variants.map(v=>({id:v.id,price:v.price}))}});}
}
// Bảo 2026-10-27: Kiot codes may carry a suffix (SP024387_23092026, SP024882_KG) while Sapo keeps SP024387.
export const sapoSku=code=>String(code).split('_')[0];
export function sapoNote(existing,row,kiotNote) {
 if(kiotNote!==undefined){
  const current=kiotNote.match(/<!--BAOQ-CURRENT--><p>BAOQ \|[\s\S]*?<\/p><!--\/BAOQ-CURRENT-->/)?.[0];
  const event=kiotNote.match(/<p data-baoq-event="[^"]*">[\s\S]*?<\/p>/)?.[0];
  if(!current||!event)throw Error('Thiếu hai dòng BAOQ để đồng bộ Sapo');
  kiotNote=current+event;
 }
 const key=Buffer.from(sapoSku(row.code)).toString('hex');const start=`<!--BAOQ-SKU-${key}-->`,end=`<!--/BAOQ-SKU-${key}-->`;
 const block=start+(kiotNote??`<p>BAOQ | M${row.m} | Giá bán ${money(row.price)} | Sale được giảm thêm tối đa ${money(row.allowance)}</p>`)+end;
 let found=false;const content=existing.replace(new RegExp(start+'[\\s\\S]*?'+end,'g'),()=>{if(found)return '';found=true;return block;});return content+(found?'':block);
}
export class SapoService {
 constructor(client,store,binding){this.client=client;this.store=store;this.binding=binding||client.binding;}
 async initialize(){this.state=await this.store.read()||{products:[]};}
 status(){const connected=this.client.configured!==false;const ready=connected&&this.state.catalogBinding===this.binding;return {connected,ready,verified:ready,refreshError:this.refreshError||null,message:!connected?'Sapo chưa kết nối — chưa thể cập nhật chung':this.refreshError||(ready?'Sapo đã kết nối':'Đang đọc chỉ mục Sapo…')};}
 requireVerified(){if(!this.status().verified)throw Error(this.status().message);}
 async refresh(){
  try{
   if(this.client.configured===false)throw Error(this.status().message);
   const products=(await this.client.all()).map(sapoCatalogEntry);const next={products,mapping:null,catalogBinding:this.binding};
   await this.store.write(next);this.state=next;this.refreshError=null;return {count:products.length};
  }catch(error){this.refreshError='Chưa đọc được Sapo, sẽ thử lại khi Tải lại từ Kiot';throw error;}
 }
 // The exact SKU wins; a Kiot code with a suffix falls back to the part before "_". ref.code is the Sapo SKU.
 resolve(code){if(this.state.catalogBinding!==this.binding)throw Error('Cần đọc lại chỉ mục Sapo cho cấu hình kết nối hiện tại');const find=sku=>this.state.products.flatMap(p=>p.variants.filter(v=>v.sku===sku).map(v=>({productId:p.id,variantId:v.id,code:sku})));const base=sapoSku(code);let matches=find(code);if(!matches.length&&base!==code)matches=find(base);if(matches.length!==1)throw Error(`${code}: SKU Sapo ${matches.length?'trùng':'thiếu'}${base!==code?` (đã tìm cả ${base})`:''} — chưa thể cập nhật chung`);return matches[0];}
 async read(ref){const p=validateSapoProduct(await this.client.product(ref.productId));const v=p.variants.find(v=>v.id===ref.variantId);if(p.id!==ref.productId||!v||v.sku!==ref.code||p.variants.filter(v=>v.sku===ref.code).length!==1)throw Error(`${ref.code}: Sapo thay đổi SKU/ID`);return p;}
 async check(code){const ref=this.resolve(code),p=await this.read(ref);return {...ref,price:p.variants.find(v=>v.id===ref.variantId).price,content:p.content,fingerprint:sapoFingerprint(p)};}
 async confirm(body){if(body.confirmed!==true)throw Error('Cần xác nhận đúng SKU, giá bán chính và mô tả Sapo');const check=await this.check(body.code);if(check.fingerprint!==body.fingerprint||check.price!==Number(body.price))throw Error('Sapo thay đổi hoặc đối chiếu không khớp');const next={...this.state,mapping:{verified:true,binding:this.binding,code:body.code}};await this.store.write(next);this.state=next;}
 /** Like prepare() but from a downloaded product list (TASK-102): same SKU/ID checks as read(), no GET. */
 prepareFrom(code,products){this.requireVerified();const ref=this.resolve(code),found=products.get(ref.productId);if(!found)throw Error(`${code}: Sapo thay đổi SKU/ID`);
  const p=validateSapoProduct(found),v=p.variants.find(v=>v.id===ref.variantId);
  if(p.id!==ref.productId||!v||v.sku!==ref.code||p.variants.filter(v=>v.sku===ref.code).length!==1)throw Error(`${ref.code}: Sapo thay đổi SKU/ID`);
  return {...ref,before:p,fingerprint:sapoFingerprint(p)};}
 async prepare(code,{previewOnly=false}={}){if(!previewOnly)this.requireVerified();const ref=this.resolve(code),before=await this.read(ref);return {...ref,before,fingerprint:sapoFingerprint(before)};}
}
