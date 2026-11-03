import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {KiotClient,kiotFetch} from '../lib/kiot.js';

const clientWith=fetcher=>{const client=new KiotClient({fetcher});client.token='fixture';client.expires=Date.now()+60000;return client;};
async function local(t,handler){
 const server=http.createServer(handler);await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
 t.after(()=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve);}));
 return 'http://127.0.0.1:'+server.address().port;
}
test('Kiot default transport bypasses global fetch including authentication',()=>{
 const client=new KiotClient();assert.equal(client.fetcher,kiotFetch);assert.notEqual(client.fetcher,globalThis.fetch);
});
test('PUT sends Vietnamese JSON with UTF-8 Content-Length and fetch-compatible headers, never chunked',async t=>{
 let received;
 const base=await local(t,async(req,res)=>{
  const chunks=[];for await(const chunk of req)chunks.push(chunk);
  received={method:req.method,headers:req.headers,body:Buffer.concat(chunks)};res.end('{}');
 });
 const body={listProducts:[{id:1,name:'Túi xách Đỏ',basePrice:1000000}]};
 const client=clientWith((_url,options)=>kiotFetch(base,options));
 await client.request('/listupdatedproducts','PUT',body);
 assert.equal(received.method,'PUT');assert.equal(received.body.toString('utf8'),JSON.stringify(body));
 assert.equal(received.headers['content-length'],String(Buffer.byteLength(JSON.stringify(body),'utf8')));
 assert.equal(received.headers['transfer-encoding'],undefined);
 assert.equal(received.headers['content-type'],'application/json');assert.equal(received.headers.retailer,'baoqluxury');
 assert.equal(received.headers.authorization,'Bearer fixture');assert.equal(received.headers.accept,'*/*');assert.equal(received.headers['user-agent'],'node');
 assert.notEqual(received.headers.connection,'close');
});
test('empty body overrides stale length and chunked headers without mutating caller headers',async t=>{
 let received;
 const base=await local(t,async(req,res)=>{for await(const _chunk of req){}received=req.headers;res.end('{}');});
 const headers={'Content-Length':'99','Transfer-Encoding':'chunked',Accept:'application/json','User-Agent':'test-agent'};
 await kiotFetch(base,{method:'PUT',headers,body:''});
 assert.equal(received['content-length'],'0');assert.equal(received['transfer-encoding'],undefined);
 assert.equal(received.accept,'application/json');assert.equal(received['user-agent'],'test-agent');
 assert.equal(headers['Content-Length'],'99');assert.equal(headers['Transfer-Encoding'],'chunked');
});
test('auth POST uses byte-counted form body and fetch-compatible headers',async t=>{
 let received;
 const base=await local(t,async(req,res)=>{
  const chunks=[];for await(const chunk of req)chunks.push(chunk);
  received={method:req.method,headers:req.headers,body:Buffer.concat(chunks)};res.end('{"access_token":"fixture","expires_in":3600}');
 });
 const credentials={retailer:'baoqluxury',client:'test-client',secret:'test-secret-đỏ'};
 const client=new KiotClient({credentials,fetcher:(_url,options)=>kiotFetch(base,options)});
 assert.equal(await client.auth(),'fixture');assert.equal(received.method,'POST');
 assert.equal(received.headers['content-length'],String(received.body.length));assert.equal(received.headers['transfer-encoding'],undefined);
 assert.equal(received.headers['content-type'],'application/x-www-form-urlencoded');
 assert.equal(new URLSearchParams(received.body.toString()).get('client_secret'),credentials.secret);
 assert.equal(received.headers.accept,'*/*');assert.equal(received.headers['user-agent'],'node');
 assert.equal(received.headers.authorization,undefined);
});
test('420 retains the Kiot reason but redacts credentials, encoded credentials and authorization',async t=>{
 let calls=0;
 const credentials={retailer:'baoqluxury',client:'test-client',secret:'test secret+/đỏ'};
 const message=`Không nhận lô giá; Bearer fixture; client_secret=${encodeURIComponent(credentials.secret)}; ${credentials.client}; ${credentials.secret}; access_token=other-private-token`;
 const base=await local(t,(_req,res)=>{calls++;res.writeHead(420,{'Content-Type':'application/json'});res.end(JSON.stringify({responseStatus:{message},headers:{Authorization:'must-not-copy'},requestBody:{private:'must-not-copy'}}));});
 const client=clientWith((_url,options)=>kiotFetch(base,options));client.credentials=credentials;
 await assert.rejects(client.request('/listupdatedproducts','PUT',{listProducts:[]}),error=>{
  assert.match(error.message,/Kiot trả HTTP 420: Không nhận lô giá/);assert.equal(error.httpStatus,420);assert.equal(error.uncertain,false);
  for(const secret of ['fixture',credentials.client,credentials.secret,encodeURIComponent(credentials.secret),'other-private-token','must-not-copy'])assert.ok(!error.message.includes(secret));
  return true;
 });
 assert.equal(calls,1);
});
for(const body of ['<html>private-response</html>',JSON.stringify({responseStatus:{message:'x'.repeat(4096)+'private-tail'}})])test('malformed or oversized error JSON retains only HTTP status',async t=>{
 const base=await local(t,(_req,res)=>{res.writeHead(420);res.end(body);});
 const response=await kiotFetch(base);await assert.rejects(response.json());
 const client=clientWith((_url,options)=>kiotFetch(base,options));
 await assert.rejects(client.request('/listupdatedproducts','PUT',{}),error=>error.message==='Kiot trả HTTP 420'&&error.httpStatus===420&&error.uncertain===false);
});
test('valid long JSON reason is shortened after redaction and has no control characters',async t=>{
 const base=await local(t,(_req,res)=>{res.writeHead(420);res.end(JSON.stringify({responseStatus:{message:'fixture\n'+ 'đ'.repeat(700)}}));});
 const client=clientWith((_url,options)=>kiotFetch(base,options));
 await assert.rejects(client.request('/listupdatedproducts','PUT',{}),error=>{
  assert.ok(error.message.length<='Kiot trả HTTP 420: '.length+500);assert.ok(!error.message.includes('fixture'));assert.ok(!error.message.includes('\n'));assert.match(error.message,/đ/);return true;
 });
});
for(const status of [401,408,429,500])test(`HTTP ${status} retains reason and classification without PUT retry`,async t=>{
 let calls=0;
 const base=await local(t,(_req,res)=>{calls++;res.writeHead(status,{'Retry-After':'3'});res.end(JSON.stringify({responseStatus:{message:'Lý do từ Kiot'}}));});
 const client=clientWith((_url,options)=>kiotFetch(base,options));
 await assert.rejects(client.request('/listupdatedproducts','PUT',{}),error=>{
  assert.match(error.message,/Lý do từ Kiot/);assert.equal(error.httpStatus,status);
  assert.equal(error.uncertain,status===408||status>=500);
  if(status===401)assert.equal(client.token,null);else assert.equal(error.retryAfter,3);
  return true;
 });assert.equal(calls,1);
});
test('auth HTTP error keeps a safe reason without credentials',async t=>{
 const credentials={retailer:'baoqluxury',client:'test-client',secret:'test-secret'};
 const base=await local(t,(_req,res)=>{res.writeHead(400);res.end(JSON.stringify({error_description:'Sai khóa test-secret'}));});
 const client=new KiotClient({credentials,fetcher:(_url,options)=>kiotFetch(base,options)});
 await assert.rejects(client.auth(),error=>{assert.match(error.message,/HTTP 400.*Sai khóa/);assert.ok(!error.message.includes(credentials.secret));return true;});
});
for(const method of ['GET','PUT'])test(`mid-body disconnect: ${method} is bounded and GET alone retries`,async t=>{
 let calls=0;
 const base=await local(t,(_req,res)=>{
  calls++;
  if(calls===1){res.writeHead(200,{'Content-Type':'application/json','Content-Length':500});res.write('{"id":');setImmediate(()=>res.destroy());}
  else res.end('{"id":1,"code":"fixture"}');
 });
 const client=clientWith((_url,options)=>kiotFetch(base,options));
 if(method==='GET'){assert.equal((await client.request('/products/1')).id,1);assert.equal(calls,2);assert.equal(client.lastReadRecovery.recovered,true);}
 else {await assert.rejects(client.request('/listupdatedproducts','PUT',{listProducts:[]}),e=>e.uncertain===true&&e.diagnostic.code==='ECONNRESET');assert.equal(calls,1);}
});
for(const body of ['', '{"id":'])test(`invalid PUT JSON ${JSON.stringify(body)} is uncertain and never resent`,async t=>{
 let calls=0;const base=await local(t,(_req,res)=>{calls++;res.end(body);});
 const client=clientWith((_url,options)=>kiotFetch(base,options));
 await assert.rejects(client.request('/products/1','PUT',{basePrice:1}),e=>e.uncertain===true);assert.equal(calls,1);
});
test('deadline covers a stalled body as well as connection and headers',async t=>{
 const base=await local(t,(_req,res)=>{res.writeHead(200);res.write('{');});
 await assert.rejects(kiotFetch(base,{signal:AbortSignal.timeout(50)}),e=>e.name==='AbortError');
});
test('transport preserves status and Retry-After and refuses redirects',async t=>{
 const base=await local(t,(_req,res)=>{res.writeHead(429,{'Retry-After':'3'});res.end('{}');});
 const client=clientWith((_url,options)=>kiotFetch(base,options));
 await assert.rejects(client.request('/products/1','PUT',{}),e=>e.httpStatus===429&&e.retryAfter===3&&e.uncertain===false);
});

test('modified read requests deletion IDs and keeps tombstones even without product rows',async()=>{
 let url;
 const client=clientWith(async target=>{url=target;return {ok:true,json:async()=>({total:0,data:[],removeId:[7]})};});
 const result=await client.listModified('2026-11-02T00:00:00Z');
 assert.equal(new URL(url).searchParams.get('includeRemoveIds'),'true');
 assert.deepEqual(result,[{id:7,deleted:true}]);
});
