/* Synthetic, deterministic data (seeded). Shaped like the three sources a dev will join by SKU:
   Sapo  → orders / line items (order code, created_on, source_name, assignee, price after discount)
   Kiot  → receipt_date, cost, current list price
   Price System (simulated) → ready_for_sale_date, sale_cycle_start, m0_price
   ready_for_sale_date is a GIVEN simulated field here (no derivation from website/social/photo dates). */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./engine.js'));else root.Data=factory(root.Engine)})(typeof self!=='undefined'?self:this,function(E){
const CALC_DEFAULT='2026-10-22',PERIOD={from:'2026-10-01',to:'2026-10-21',label:'Tháng 10/2026 (đến 21/10)'};
function rng(seed){return function(){seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const R=rng(20261022),rint=(a,b)=>a+Math.floor(R()*(b-a+1)),pick=a=>a[Math.floor(R()*a.length)],between=(a,b)=>a+R()*(b-a);
const CATS=['Túi xách','Ví & phụ kiện da','Giày','Đồng hồ','Trang sức'];
const CATDEF={
 'Túi xách':{lo:30,hi:420,brands:{'Hermès':['Birkin 25','Birkin 30','Kelly 28','Constance 18','Evelyne III'],'Chanel':['Classic Flap Medium','Boy Bag','19 Flap','Gabrielle'],'Louis Vuitton':['Neverfull MM','Speedy 30','Capucines MM','Alma BB'],'Dior':['Lady Dior Medium','Saddle','Book Tote'],'Gucci':['Jackie 1961','Marmont Small','Dionysus'],'Goyard':['Saint Louis PM','Artois MM'],'Saint Laurent':['Loulou Medium','Sac de Jour']}},
 'Ví & phụ kiện da':{lo:5,hi:60,brands:{'Louis Vuitton':['Zippy Wallet','Card Holder','Key Pouch'],'Chanel':['Wallet on Chain','Card Holder'],'Hermès':['Belt H 32mm','Bastia','Card Holder'],'Gucci':['Marmont Wallet','Belt GG'],'Goyard':['Card Holder','Matignon Wallet'],'Dior':['Saddle Wallet','Card Holder']}},
 'Giày':{lo:12,hi:70,brands:{'Chanel':['Slingback','Loafer'],'Dior':['J’Adior Slingback','Walk’n’Dior'],'Hermès':['Oran Sandal','Oz Mule'],'Gucci':['Horsebit Loafer','Ace Sneaker'],'Louis Vuitton':['Trainer Sneaker','Lock It Flat'],'Prada':['Monolith Loafer','Cloudbust']}},
 'Đồng hồ':{lo:80,hi:520,brands:{'Rolex':['Datejust 36','Submariner Date','Oyster Perpetual 41'],'Cartier':['Tank Must','Ballon Bleu 33','Santos Medium'],'Omega':['Seamaster 300','Constellation 28']}},
 'Trang sức':{lo:15,hi:260,brands:{'Cartier':['Love Bracelet','Juste un Clou','Trinity Ring'],'Van Cleef & Arpels':['Alhambra Necklace','Frivole Ring'],'Tiffany':['T Wire Bracelet','HardWear Necklace'],'Bvlgari':['Serpenti Viper','B.zero1 Ring']}}};
const BRAND_NONE='Chưa có brand';
const CHANNELS=['Cửa hàng','Online','Đối tác'],SALES=['An','Bình','Chi','Dũng'];
const skew=(lo,hi,p=1.7)=>lo+Math.pow(R(),p)*(hi-lo);
const half=v=>Math.round(v*2)/2;           // triệu, step 0.5
const vnd=tr=>Math.round(tr*1e6/1e5)*1e5;   // VND, step 100k

function newProduct(cat,forcedTr){
 const d=CATDEF[cat],brand=pick(Object.keys(d.brands)),model=pick(d.brands[brand]);
 const tr=forcedTr!=null?forcedTr:half(skew(d.lo,d.hi));
 return {category:cat,brand,name:`${brand} ${model}`,list_price:vnd(tr)};
}
function costOf(list,source){return Math.round(list*(source==='Ký gửi'?between(.72,.8):between(.7,.88))/1e5)*1e5}

/* ---------------- Stock (tồn hiện tại) ---------------- */
const STOCK=[];let skuN=1;
const AGE_W=[24,20,16,12,10,8,6,14];                 // weights M0..M6, M6+
function randomAge(){let s=R()*AGE_W.reduce((a,b)=>a+b,0),i=0;for(;i<AGE_W.length;i++){s-=AGE_W[i];if(s<=0)break}return i<=6?i*30+rint(0,29):rint(210,430)}
function stockItem(over){
 const cat=over.category||pick(['Túi xách','Túi xách','Túi xách','Ví & phụ kiện da','Ví & phụ kiện da','Giày','Giày','Đồng hồ','Trang sức','Trang sức']);
 const p=newProduct(cat,over.priceTr);
 const source=over.source||'Mua đứt';
 const days=over.age!=null?over.age:randomAge();
 const ready=over.ready!==undefined?over.ready:E.addDays(CALC_DEFAULT,-days);
 const cost=over.cost!==undefined?over.cost:costOf(p.list_price,source);
 const it={sku:'SKU-'+String(skuN++).padStart(4,'0'),name:p.name,brand:over.brand!==undefined?over.brand:p.brand,category:p.category,source,
  list_price:p.list_price,cost,m0_price:over.m0!==undefined?over.m0:p.list_price,
  receipt_date:ready?E.addDays(ready,-rint(2,15)):E.addDays(CALC_DEFAULT,-rint(10,60)),
  ready_for_sale_date:ready,sale_cycle_start:ready,special:over.special||null,legacy_reset:!!over.legacy,legacy_reset_date:over.legacyDate||null,tag:over.tag||''};
 if(it.legacy_reset)it.sale_cycle_start=null;
 if(over.listOverride!=null)it.list_price=over.listOverride;
 STOCK.push(it);return it;
}
// 0–4 missing ready date (own group, never defaulted to M0)
for(let i=0;i<5;i++)stockItem({ready:null,tag:'missing_ready'});
// 2 not ready yet (ready date after calc date)
stockItem({ready:E.addDays(CALC_DEFAULT,3),tag:'not_ready'});stockItem({ready:E.addDays(CALC_DEFAULT,10),tag:'not_ready'});
for(let i=0;i<3;i++)stockItem({age:rint(40,150),cost:null,tag:'missing_cost'});
for(let i=0;i<3;i++)stockItem({age:rint(40,150),m0:null,tag:'missing_m0'});
for(let i=0;i<2;i++){const it=stockItem({age:rint(70,140),priceTr:half(between(30,90)),tag:'m0_below_cost'});it.cost=vnd(it.m0_price/1e6*1.12)}
// cost-stop demos: M0 just above cost so the 2nd turn would cross it
[[15,14.4],[25,24.1],[60,58.2]].forEach(([p,c])=>stockItem({age:100,priceTr:p,category:'Giày',cost:vnd(c),tag:'cost_stop'}));
['hot_trend','hot_trend','hot_trend','hot_trend','rule_3pct','rule_3pct','rule_half','rule_half','buyback','buyback'].forEach(s=>stockItem({special:s,age:rint(20,200)}));
// legacy: manual-sale stock up to 06/2026, price cycle restarts on the (editable) reset date
// each legacy item carries its OWN reset date (item data, never taken from a policy version); 06-15 falls before some ready dates on purpose
const RESET_DATES=['2026-07-01','2026-06-15','2026-06-30'];
for(let i=0;i<8;i++)stockItem({legacy:true,legacyDate:RESET_DATES[i%3],age:rint(125,260),priceTr:half(between(40,260)),tag:'legacy'});
// boundary ages on the ready-date clock (and on the cycle clock for non-legacy stock)
[29,30,59,60,179,180,209,210].forEach((a,i)=>stockItem({age:a,priceTr:[85,110,45,155,205,320,95,130][i],tag:'boundary_'+a}));
// ≥ 600 triệu (no rule). 1,000 is exactly 1 tỷ; 1,250 and 1,450 sit above the slider's 1 tỷ ceiling
[650,720,880,1000,1250,1450].forEach(p=>stockItem({priceTr:p,category:p>=1000?'Túi xách':pick(['Túi xách','Đồng hồ']),age:rint(10,150),tag:'over600'}));
// regular stock; ~1/7 consignment, 3 without brand
while(STOCK.length<132){const n=STOCK.length;const o={};if(n%7===3)o.source='Ký gửi';if(n===60||n===75||n===90)o.brand='';stockItem(o)}
STOCK.forEach(s=>{if(s.brand==='')s.brand=BRAND_NONE});

/* ---------------- Orders (bán trong kỳ) ---------------- */
const ORDERS=[],LINES=[];
const dayN0=E.dayNum(PERIOD.from);
let lineN=1;
function makeLine(order,forced){
 const cat=forced&&forced.category||pick(['Túi xách','Túi xách','Ví & phụ kiện da','Ví & phụ kiện da','Ví & phụ kiện da','Giày','Giày','Đồng hồ','Trang sức','Trang sức']);
 const p=newProduct(cat,forced&&forced.priceTr);
 const source=R()<0.15?'Ký gửi':'Mua đứt';
 const disc=R()<0.4?between(.01,.08):0;
 const price=Math.round(p.list_price*(1-disc)/1e5)*1e5;
 const ready=E.addDays(order.created_on,-rint(5,170));
 const L={sku:'SKU-'+String(1000+lineN++),order:order.code,created_on:order.created_on,channel:order.source,assignee:order.assignee,name:p.name,
  brand:p.brand,category:p.category,source,qty:1,list_price:p.list_price,discount:p.list_price-price,price_actual:price,cost:costOf(p.list_price,source),
  receipt_date:E.addDays(ready,-rint(2,15)),ready_for_sale_date:ready};
 order.lines.push(L);LINES.push(L);return L;
}
const FORCED=[{priceTr:650,category:'Túi xách'},{priceTr:780,category:'Đồng hồ'},{priceTr:1000,category:'Túi xách'},{priceTr:1250,category:'Túi xách'}];
for(let i=1;i<=90;i++){
 const day=rint(0,20),created=E.dayStr(dayN0+day);
 const ch=R()<.38?'Cửa hàng':R()<.65?'Online':'Đối tác';
 let s=R()*4.0,w=[1.3,1.1,.9,.7],sale=SALES[0];for(let k=0;k<4;k++){s-=w[k];if(s<=0){sale=SALES[k];break}}
 const o={code:'SON-2610-'+String(i).padStart(4,'0'),created_on:created,source:ch,assignee:sale,lines:[]};
 const n=R()<.12?2:R()<.06?3:1;
 for(let k=0;k<n;k++)makeLine(o,i<=FORCED.length&&k===0?FORCED[i-1]:null);
 ORDERS.push(o);
}
// missing-data states in sold lines
LINES[12].ready_for_sale_date=null;LINES[40].ready_for_sale_date=null;
LINES[7].brand=BRAND_NONE;LINES[55].brand=BRAND_NONE;
LINES[20].cost=null;
ORDERS.sort((a,b)=>a.created_on.localeCompare(b.created_on)||a.code.localeCompare(b.code));

// Two items whose price cycle started BEFORE they were ready for sale (added last and without the RNG, so the rest of the data is unchanged).
[[80,'Gucci Marmont Small'],[150,'Dior Lady Dior Medium']].forEach(([p,name],i)=>{const ready=E.addDays(CALC_DEFAULT,-40);STOCK.push({sku:'SKU-'+String(skuN++).padStart(4,'0'),name,brand:name.split(' ')[0],category:'Túi xách',source:'Mua đứt',list_price:vnd(p),cost:vnd(p*0.8),m0_price:vnd(p),
 receipt_date:E.addDays(ready,-7),ready_for_sale_date:ready,sale_cycle_start:E.addDays(CALC_DEFAULT,-110),special:null,legacy_reset:false,legacy_reset_date:null,tag:'cycle_before_ready'})});

return {CALC_DEFAULT,PERIOD,CATS,CHANNELS,SALES,BRAND_NONE,STOCK,ORDERS,LINES};
});
