import { loadEnvFile } from 'node:process';
import http from 'node:http';
import https from 'node:https';

const ERROR_BODY_LIMIT=2048;

/** Buffered, deadline-bound transport: Kiot socket errors stay on request/response emitters, outside undici. */
export function kiotFetch(url, {method='GET',headers,body,signal}={}) {
  return new Promise((resolve,reject)=>{
    const target=new URL(url), transport=target.protocol==='https:'?https:target.protocol==='http:'?http:null;
    if(!transport){reject(new Error('Unsupported Kiot protocol'));return;}
    const payload=body===undefined?undefined:String(body), outgoing=new Headers(headers);
    if(!outgoing.has('Accept'))outgoing.set('Accept','*/*');
    if(!outgoing.has('User-Agent'))outgoing.set('User-Agent','node');
    if(!outgoing.has('Accept-Language'))outgoing.set('Accept-Language','*');
    if(!outgoing.has('Sec-Fetch-Mode'))outgoing.set('Sec-Fetch-Mode','cors');
    if(payload!==undefined){outgoing.set('Content-Length',String(Buffer.byteLength(payload,'utf8')));outgoing.delete('Transfer-Encoding');}
    const req=transport.request(target,{method,headers:Object.fromEntries(outgoing),signal},res=>{
      const chunks=[],status=res.statusCode||0,ok=status>=200&&status<300;
      let retained=0;
      res.on('error',reject);
      res.on('aborted',()=>reject(Object.assign(new Error('Response aborted'),{code:'ECONNRESET'})));
      // Drain errors to completion, but retain at most 2 KiB for a safe JSON message.
      res.on('data',chunk=>{const part=ok?chunk:chunk.subarray(0,Math.max(0,ERROR_BODY_LIMIT-retained));if(part.length){chunks.push(part);retained+=part.length;}});
      res.on('end',()=>{
        if(!res.complete){reject(Object.assign(new Error('Incomplete response'),{code:'ECONNRESET'}));return;}
        const text=Buffer.concat(chunks).toString('utf8');
        resolve({ok,status,headers:{get:name=>res.headers[name.toLowerCase()]??null},json:async()=>JSON.parse(text)});
      });
    });
    req.on('error',reject);
    if(payload!==undefined)req.write(payload,'utf8');
    req.end();
  });
}

async function kiotErrorReason(response,credentials,token) {
  try {
    const data=await response.json();
    let message=data?.responseStatus?.message??data?.responseStatus?.Message??data?.ResponseStatus?.Message??data?.message??data?.error_description;
    if(typeof message!=='string')return '';
    // Only the message field is exposed; redact known credentials before shortening it.
    const secrets=new Set([token,credentials?.client,credentials?.secret].filter(Boolean)
      .flatMap(value=>[value,encodeURIComponent(value),new URLSearchParams({v:value}).toString().slice(2)]));
    for(const value of [...secrets].sort((a,b)=>b.length-a.length))message=message.split(value).join('[REDACTED]');
    message=message.replace(/\b(Bearer|Basic)\s+[^\s,;"'<>]+/gi,'$1 [REDACTED]')
      .replace(/\b((?:access[_-]?token|refresh[_-]?token|client[_-]?(?:secret|id)|api[_-]?key|authorization|password|secret|token)["']?\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s,;<>]+)/gi,'$1[REDACTED]')
      .replace(/[\u0000-\u001f\u007f]/g,' ').trim();
    return message.slice(0,500);
  }catch{return '';}
}


export const BRANCH = 44466;
const networkLabels={UND_ERR_CONNECT_TIMEOUT:'hết thời gian thiết lập kết nối',UND_ERR_HEADERS_TIMEOUT:'hết thời gian chờ phản hồi',UND_ERR_BODY_TIMEOUT:'hết thời gian đọc phản hồi',ENOTFOUND:'không phân giải được DNS',EAI_AGAIN:'DNS tạm thời không phản hồi',ECONNRESET:'kết nối bị ngắt',ECONNREFUSED:'kết nối bị từ chối',ETIMEDOUT:'kết nối hết thời gian',UND_ERR_SOCKET:'socket kết nối bị đóng',CERT_HAS_EXPIRED:'chứng chỉ máy chủ hết hạn',UNABLE_TO_VERIFY_LEAF_SIGNATURE:'không xác minh được chứng chỉ máy chủ',TIMEOUT:'yêu cầu hết thời gian',ABORTED:'yêu cầu bị hủy'};
function networkError(error,path,method,ms,phase) {
  const candidates=[error?.cause?.code,error?.code,...(error?.cause?.errors||[]).map(e=>e.code)];
  const code=candidates.find(c=>Object.hasOwn(networkLabels,c))||(error?.name==='TimeoutError'?'TIMEOUT':error?.name==='AbortError'?'ABORTED':'NETWORK_ERROR');
  // Never copy raw error text, headers, bodies or credentials into a journal.
  const safePath=/^\/products\/\d+$/.test(path.split('?')[0])?path.split('?')[0]:path.startsWith('/products')?'/products':path==='/connect/token'?path:'/api';
  const result=new Error(`Kiot ${method} ${safePath}: ${networkLabels[code]||'không kết nối được mạng'} (${code})`);
  result.diagnostic={code,method,path:safePath,ms,phase};return result;
}
export const inStock = p => Number.isFinite(p.stock) && p.stock > 0 && p.active === true;
export function normalizeProduct(raw) {
  const inventory = raw.inventories?.find(i => i.branchId === BRANCH);
  return { id: raw.id, code: raw.code, name: raw.fullName || raw.name, currentPrice: raw.basePrice,
    createdAt: raw.createdDate, active: raw.isActive === true, activeMissing: typeof raw.isActive !== 'boolean',
    stock: typeof inventory?.onHand === 'number' ? inventory.onHand : null,
    inventoryMissing: typeof inventory?.onHand !== 'number', notes: raw.description ?? '',
    modifiedDate: raw.modifiedDate ?? null, source: 'Kiot thật · Chi nhánh trung tâm',
    taxPresent: !!(raw.saleTax || raw.productTaxs?.length || raw.taxRate),
    rawFields: { name:raw.name,code:raw.code,categoryId:raw.categoryId }, rawSource:raw };
}

export class KiotClient {
  /** @param {{fetcher?: typeof fetch, credentials?: {retailer?: string, client?: string, secret?: string}}} [options] */
  constructor({ fetcher = kiotFetch, credentials } = {}) { this.fetcher=fetcher;this.credentials=credentials; }
  async auth() {
    if (this.token && Date.now()<this.expires) return this.token;
    if (!this.credentials) {
      loadEnvFile('.env');
      this.credentials={retailer:process.env.KIOT_RETAILER,client:process.env.KIOT_CLIENT_ID,secret:process.env.KIOT_CLIENT_SECRET};
    }
    const {retailer,client,secret}=this.credentials;
    if(retailer!=='baoqluxury'||!client||!secret) throw new Error('Thiếu/sai cấu hình Kiot trong .env');
    const authStart=performance.now();
    try{
    const response=await this.fetcher('https://id.kiotviet.vn/connect/token',{method:'POST',redirect:'error',signal:AbortSignal.timeout(30000),
      headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'client_credentials',scope:'PublicApi.Access',scopes:'PublicApi.Access',client_id:client,client_secret:secret})});
    if(!response.ok){const reason=await kiotErrorReason(response,this.credentials);throw new Error(`Xác thực Kiot thất bại (HTTP ${response.status})${reason?': '+reason:''}`);}
    const result=await response.json();if(!result.access_token) throw new Error('Kiot không trả token');
    this.token=result.access_token;this.expires=Date.now()+Math.max(0,(Number(result.expires_in)||0)-60)*1000;
    return this.token;
    }finally{this.onAuthTiming?.(performance.now()-authStart);}
  }
  async request(path, method='GET', body) {
    const token=await this.auth();
    const started=Date.now();
    const limit=method==='GET'?2:1;
    const recoveries=[];
    for(let attempt=1;attempt<=limit;attempt++) {
      let response,phase='Kết nối / chờ phản hồi';
      try {
        // Native transport contains socket failures without entering the global fetch parser.
        response=await this.fetcher('https://public.kiotapi.com'+path,{method,redirect:'error',signal:AbortSignal.timeout(30000),
          headers:{Retailer:'baoqluxury',Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
        if(response.ok) {
          phase='Đọc phản hồi';const result=await response.json();
          if(recoveries.length)this.lastReadRecovery={...recoveries[0],attempts:attempt,recovered:true};
          return result;
        }
      }catch(error){
        const failure=networkError(error,path,method,Date.now()-started,phase);
        failure.diagnostic.attempts=attempt;failure.uncertain=method==='PUT';
        if(method==='GET'&&attempt<limit&&['UND_ERR_SOCKET','ECONNRESET'].includes(failure.diagnostic.code)){recoveries.push(failure.diagnostic);continue;}
        throw failure;
      }
      // HTTP/auth failures and all PUTs are never retried automatically.
      const reason=await kiotErrorReason(response,this.credentials,token),detail=reason?': '+reason:'';
      if(response.status===401){this.token=null;throw Object.assign(new Error('Phiên Kiot hết hạn; thử lại thao tác'+detail),{httpStatus:401,uncertain:false});}
      // Retry-After (seconds) lets callers pause after a 429 (TASK-102).
      const retryAfter=Number(response.headers?.get?.('retry-after'))||null;
      throw Object.assign(new Error(`Kiot trả HTTP ${response.status}${detail}`),{httpStatus:response.status,uncertain:method==='PUT'&&(response.status>=500||response.status===408),retryAfter});
    }
  }
  /** @param {(value: {loaded:number,total:number,kept:number}) => void} [progress] */
  async all(progress=()=>{}) {
    const result=new Map(),seen=new Set();let offset=0,total=null;this.lastPages=0;
    while(total===null||offset<total) {
      this.lastPages++;
      const page=await this.request(`/products?pageSize=100&currentItem=${offset}&includeInventory=true&BranchIds=${BRANCH}&isActive=true&orderBy=code&orderDirection=ASC`);
      if(!Array.isArray(page.data)||!Number.isSafeInteger(page.total)||page.total<0) throw new Error('Danh sách Kiot không hợp lệ');
      if(total!==null&&page.total!==total) throw new Error('Số sản phẩm đổi trong lúc tải; hãy tải lại');
      total=page.total;if(!page.data.length&&offset<total) throw new Error('Kiot trả trang thiếu dữ liệu');
      for(const raw of page.data) {
        if(!Number.isSafeInteger(raw.id)||seen.has(raw.id)) throw new Error('Trang Kiot bị trùng hoặc thiếu ID; hãy tải lại');
        seen.add(raw.id);
        const product=normalizeProduct(raw);
        if(inStock(product)) result.set(raw.id,product);
      }
      offset+=page.data.length;progress({loaded:seen.size,total,kept:result.size});
      if(total===0) break;
    }
    if(seen.size!==total) throw new Error('Chưa tải đủ sản phẩm Kiot');
    this.lastImport={read:seen.size,kept:result.size,filtered:seen.size-result.size};
    return [...result.values()];
  }
  async product(id) {return normalizeProduct(await this.request(`/products/${id}?includeInventory=true`));}
  /** Products modified since an ISO time, all pages, normalized like all(); lastPages = GET count used (TASK-102). */
  async listModified(since) {
    const out=[],seen=new Set(),removed=new Set();let offset=0,total=null,pages=0;
    while(total===null||offset<total){
      const page=await this.request(`/products?pageSize=100&currentItem=${offset}&includeInventory=true&includeRemoveIds=true&BranchIds=${BRANCH}&lastModifiedFrom=${encodeURIComponent(since)}&orderBy=code&orderDirection=ASC`);pages++;
      if(!Array.isArray(page.data)||!Number.isSafeInteger(page.total)||page.total<0)throw new Error('Danh sách Kiot vừa sửa không hợp lệ');
      total=page.total;if(!page.data.length&&offset<total)throw new Error('Kiot trả trang thiếu dữ liệu');
      if(page.removeId!==undefined&&!Array.isArray(page.removeId))throw new Error('Danh sách ID Kiot đã xóa không hợp lệ');
      for(const id of page.removeId||[]){if(!Number.isSafeInteger(id))throw new Error('ID Kiot đã xóa không hợp lệ');removed.add(id);}
      for(const raw of page.data){if(!Number.isSafeInteger(raw.id))throw new Error('Danh sách Kiot vừa sửa thiếu ID');if(!seen.has(raw.id)){seen.add(raw.id);out.push(normalizeProduct(raw));}}
      offset+=page.data.length;if(total===0)break;
    }
    this.lastPages=pages;return [...out.filter(p=>!removed.has(p.id)),...Array.from(removed,id=>({id,deleted:true}))];
  }
  /** One bulk write (PUT /listupdatedproducts) of price + description; same body per product as update() (TASK-102). */
  async updateMany(entries) {
    if(!Array.isArray(entries)||!entries.length)throw new Error('Lô cập nhật rỗng');
    for(const {fields} of entries)if(!Object.keys(fields).length||Object.keys(fields).some(k=>!['basePrice','description'].includes(k)))throw new Error('Trường cập nhật không hợp lệ');
    return this.request('/listupdatedproducts','PUT',{listProducts:entries.map(({product,fields})=>({...product.rawFields,id:product.id,...fields}))});
  }
  async update(product, fields) {
    if(!Object.keys(fields).length||Object.keys(fields).some(k=>!['basePrice','description'].includes(k)))throw new Error('Trường cập nhật không hợp lệ');
    return this.request(`/products/${product.id}?branchId=${BRANCH}`,'PUT',{...product.rawFields,...fields});
  }
  async price(product, value) {
    return this.request(`/products/${product.id}?branchId=${BRANCH}`,'PUT',{...product.rawFields,basePrice:value});
  }
  async note(product, value) {
    return this.request(`/products/${product.id}?branchId=${BRANCH}`,'PUT',{...product.rawFields,description:value});
  }
}
