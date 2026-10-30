import test from 'node:test';
import assert from 'node:assert/strict';
import {KiotClient} from '../lib/kiot.js';
import http from 'node:http';
const credentials={retailer:'baoqluxury',client:'TEST-CLIENT',secret:'TEST-SECRET'};
test('connect timeout preserves safe code, GET path and phase without secret text',async()=>{
  const client=new KiotClient({credentials,fetcher:async()=>{const e=new TypeError('fetch failed TEST-SECRET');e.cause=Object.assign(new Error('TEST-SECRET'),{code:'UND_ERR_CONNECT_TIMEOUT'});throw e;}});
  client.token='FAKE';client.expires=Date.now()+60000;
  await assert.rejects(client.product(17142603),e=>{
    assert.equal(e.diagnostic?.code,'UND_ERR_CONNECT_TIMEOUT');assert.equal(e.diagnostic.method,'GET');assert.equal(e.diagnostic.path,'/products/17142603');assert.match(e.message,/thiết lập kết nối/);assert.ok(!JSON.stringify(e).includes('TEST-SECRET'));return true;
  });
});
test('GET retries a closed socket once on a fresh connection; PUT never retries',async()=>{
  for(const method of ['GET','PUT']){
    let calls=0;const client=new KiotClient({credentials,fetcher:async(url,options)=>{
      calls++;assert.equal(options.headers.Connection,'close');
      if(calls===1)throw Object.assign(new TypeError('fetch failed'),{cause:{code:'UND_ERR_SOCKET'}});
      return {ok:true,status:200,json:async()=>({id:1,code:'TEST'})};
    }});client.token='FAKE';client.expires=Date.now()+60000;
    if(method==='GET'){const p=await client.product(1);assert.equal(p.code,'TEST');assert.equal(calls,2);}
    else {await assert.rejects(client.update({id:1,rawFields:{}},{basePrice:5}),e=>e.diagnostic.code==='UND_ERR_SOCKET');assert.equal(calls,1);}
  }
});
test('persistent socket failure is bounded at two GETs and keeps the error code',async()=>{
  let calls=0;const client=new KiotClient({credentials,fetcher:async()=>{calls++;throw Object.assign(new Error('fetch failed'),{cause:{code:'UND_ERR_SOCKET'}});}});client.token='FAKE';client.expires=Date.now()+60000;
  await assert.rejects(client.product(1),e=>e.diagnostic.code==='UND_ERR_SOCKET'&&e.diagnostic.attempts===2);assert.equal(calls,2);
});
test('real local HTTP socket closed before response recovers with GET only',async()=>{
  let calls=0;const connections=[];
  const server=http.createServer((req,res)=>{calls++;connections.push(req.headers.connection);if(calls===1){req.socket.destroy();return;}res.setHeader('Content-Type','application/json');res.end(JSON.stringify({id:1,code:'TEST',name:'Mẫu',basePrice:5}));});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const client=new KiotClient({credentials,fetcher:async(url,options)=>fetch(base+'/product',options)});client.token='FAKE';client.expires=Date.now()+60000;
  try {const p=await client.product(1);assert.equal(p.code,'TEST');assert.equal(calls,2);assert.deepEqual(connections,['close','close']);}
  finally{await new Promise(r=>server.close(r));}
});
test('socket reset, DNS and response timeout remain distinguishable, never retry PUT',async()=>{
  for(const code of ['ECONNRESET','ENOTFOUND','UND_ERR_HEADERS_TIMEOUT']){
    let calls=0;const client=new KiotClient({credentials,fetcher:async()=>{calls++;throw Object.assign(new Error('PRIVATE'),{cause:{code}});}});client.token='FAKE';client.expires=Date.now()+60000;
    await assert.rejects(client.update({id:1,rawFields:{}},{basePrice:5}),e=>e.diagnostic?.code===code&&e.diagnostic.method==='PUT');assert.equal(calls,1);
  }
});
