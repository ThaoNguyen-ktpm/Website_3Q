import test from 'node:test';
import assert from 'node:assert/strict';

for(const hangs of [false,true])test(`fatal runtime recovery is bounded and redacts its log (hangs=${hangs})`,async()=>{
 const runtime=await import(`../runtime.ts?fatal=${hangs}`);
 const logs=[],original=console.error;console.error=message=>logs.push(message);
 const saved=process.env.SALE_AI_TEST_SECRET;process.env.SALE_AI_TEST_SECRET='fixture-private';
 try{
  let interrupted=0;const exits=[];
  await runtime.startSaleAi(async()=>({keepCurrent:async()=>{},shutdown:async()=>true,interrupt:()=>{interrupted++;return hangs?new Promise(()=>{}):Promise.resolve();}}));
  await runtime.failSaleAi(Error('token=fixture-private'),code=>exits.push(code),30);
  assert.equal(interrupted,1);assert.deepEqual(exits,[1]);
  assert.match(logs[0],/lỗi nghiêm trọng/);assert.ok(logs.every(line=>!line.includes('fixture-private')));
  assert.match(runtime.getSaleAiUnavailableReason(),/gián đoạn/);
  if(hangs)assert.ok(logs.some(line=>line.includes('hết thời gian')));
 }finally{console.error=original;if(saved===undefined)delete process.env.SALE_AI_TEST_SECRET;else process.env.SALE_AI_TEST_SECRET=saved;}
});
