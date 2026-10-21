// Run: node --experimental-transform-types tasks/TASK-028-selfcheck.mjs
// Executes real graph/tools/provider adapters with in-memory boundaries; no network/DB/.env.
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const fixture = globalThis.__task028 = {
  env: { ANTHROPIC_API_KEY: '', LLM_BASE_URL: 'http://offline.test', LLM_MODEL: 'qwen3:8b' },
  reads: [], claudeCalls: [], claudeReply: { content: [{ type: 'text', text: 'Claude trả lời' }], stop_reason: 'end_turn' },
  products: { items: [{ sku: 'SP000094', name: '! Túi kiểm thử', price: 100, onHand: 2, kiot: { categoryName: 'Túi', tradeMarkName: 'LV', inventories: [{ cost: 999 }] } }], syncedAt: 'test', sources: {} },
  staffRows: [{ fullName:'Bảo test',email:'baotest@example.test',role:'STAFF',roleLabel:'Nhân viên',status:'ACTIVE',lastLoginAt:null,googleSub:'hidden' }],
  documents: [{ id: 'doc', name: 'Quy trình.pdf', chunks: Array.from({ length: 8 }, (_, i) => ({ page: i + 1, text: 'Ký gửi kiểm thử', vector: [1, 0] })) }],
};
const mocks = {
  '/server/src/config/env.ts': 'export const env = globalThis.__task028.env;',
  '/server/src/services/catalogStore.ts': 'export const catalogStore = { products: async (...args) => { globalThis.__task028.reads.push(["products",...args]); return globalThis.__task028.products; } };',
  '/server/src/models/documentStore.ts': 'export const documentStore = { read: async () => { globalThis.__task028.reads.push(["documents"]); return globalThis.__task028.documents; } };',
  '/server/src/services/documentEmbeddingService.ts': 'export const embed = async text => { globalThis.__task028.reads.push(["embed",text]); return [1,0]; };',
  '/server/src/services/staffService.ts': 'export const list = async () => { globalThis.__task028.reads.push(["staff"]); return globalThis.__task028.staffRows; };',
  '/server/src/services/auditService.ts': 'export const actionLabels = { "auth.login":"Đăng nhập" }; export const list = async args => { globalThis.__task028.reads.push(["audit",args]); return { items:[{ createdAt:new Date("2026-10-17T00:00:00Z"),actorEmail:"test@example.test",actionLabel:"Đăng nhập",ip:"hidden",before:{private:"hidden"} }] }; };',
};
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === '@anthropic-ai/sdk') return { url: 'task028:anthropic', shortCircuit: true };
    if (specifier.endsWith('.js') && context.parentURL?.includes('/server/src/')) {
      const candidate = new URL(specifier.replace(/\.js$/, '.ts'), context.parentURL);
      if (existsSync(fileURLToPath(candidate))) return next(candidate.href, context);
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url === 'task028:anthropic') return { format: 'module', shortCircuit: true, source: 'class APIError extends Error { constructor(status) { super("private"); this.status=status; } } export default Object.assign(class { messages = { create: async input => { const f=globalThis.__task028; f.claudeCalls.push(input); if(f.claudeError)throw f.claudeError; return f.claudeReply; } }; }, {APIError});' };
    for (const [suffix, source] of Object.entries(mocks)) if (url.endsWith(suffix)) return { format: 'module', shortCircuit: true, source };
    return next(url, context);
  },
});
const tracingKeys = ['LANGSMITH_TRACING','LANGCHAIN_TRACING_V2','LANGCHAIN_TRACING','LANGCHAIN_VERBOSE'];
const savedTracing = Object.fromEntries(tracingKeys.map(key => [key, process.env[key]]));
for (const key of tracingKeys) delete process.env[key];
const originalFetch = globalThis.fetch;
const payloads = [];
let responses = [];
globalThis.fetch = async (_url, init) => {
  payloads.push(JSON.parse(init.body));
  assert.ok(responses.length, 'Unexpected network attempt; all fetch responses must be queued');
  const item = responses.shift();
  if (item instanceof Error) throw item;
  return item instanceof Response ? item : new Response(JSON.stringify({ message: item }));
};
const text = content => ({ content });
const call = (name, args) => ({ content: '', tool_calls: [{ function: { name, arguments: args } }] });
const { executeTool } = await import('../server/src/services/assistant/tools.ts');
const { chat, refusal } = await import('../server/src/services/assistant/graph.ts');
const { callModel } = await import('../server/src/services/assistant/model.ts');
const { askDocuments, answerWithOllama, answerWithClaude } = await import('../server/src/services/documentQaGraph.ts');
const question = content => ({ messages: [{ role: 'user', content }] });
let checks = 0;
try {
  for (const [name, args] of [['tim_san_pham',{q:'x',limit:1}],['hoi_tai_lieu',{question:'x'}],['danh_sach_nhan_vien',{}],['nhat_ky_thao_tac',{limit:10}]]) {
    const output = await executeTool(name,args,[]);
    assert.match(output.content,/Bạn không có quyền xem/); assert.deepEqual(output.sources,[]); checks++;
  }
  assert.equal(fixture.reads.length,0);
  const product = await executeTool('tim_san_pham',{q:'tui',limit:1},['products.view']);
  assert.ok(product.content.includes('SP000094')); assert.ok(product.content.includes('"hotTrend":true')); assert.ok(!product.content.includes('999')); assert.deepEqual(fixture.reads[0],['products',{q:'tui',page:1,pageSize:15},false]); checks++;
  assert.ok((await executeTool('tim_san_pham',{q:'tui',limit:1},['products.view','products.cost'])).content.includes('999')); checks++;
  const document = await executeTool('hoi_tai_lieu',{question:'Ký gửi'},['documents.view']); assert.equal(document.sources.length,6); assert.equal(document.sources[0].label,'Quy trình.pdf · trang 1'); assert.ok(!document.content.includes('vector')); checks++;
  for (const [topic, expected] of [['Thêm nhân viên','staff.manage'],['Đơn hàng','dữ liệu mẫu'],['vai trò','MANAGER']]) {
    assert.ok((await executeTool('huong_dan_su_dung',{chu_de:topic},[])).content.includes(expected)); checks++;
  }
  const staff = await executeTool('danh_sach_nhan_vien',{q:'bao'},['staff.view']); assert.ok(staff.content.includes('Bảo test')); assert.ok(!staff.content.includes('googleSub')); assert.equal(JSON.parse(staff.content).total,1); checks++;
  fixture.staffRows=Array.from({length:11},()=>({...fixture.staffRows[0]}));
  const cappedStaff=JSON.parse((await executeTool('danh_sach_nhan_vien',{},['staff.view'])).content); assert.equal(cappedStaff.total,11); assert.equal(cappedStaff.truncated,true); assert.equal(cappedStaff.items.length,10); checks++;
  fixture.staffRows=Array.from({length:10},()=>({...fixture.staffRows[0],fullName:'"'.repeat(120),email:'x'.repeat(191)}));
  const longStaff=await executeTool('danh_sach_nhan_vien',{},['staff.view']); assert.ok(longStaff.content.length<=4000); assert.equal(JSON.parse(longStaff.content).truncated,true); checks++;
  const audit = await executeTool('nhat_ky_thao_tac',{action:'auth.login',limit:2},['audit.view']); assert.ok(audit.content.includes('Đăng nhập')); assert.ok(!audit.content.includes('hidden')); checks++;
  for (const [name,args] of [['tim_san_pham',{q:'x',limit:6}],['nhat_ky_thao_tac',{limit:11}],['hoi_tai_lieu',{question:''}],['__proto__',{}],['tim_san_pham',{q:'x',limit:1,permissions:['products.cost']}]]) {
    assert.match((await executeTool(name,args,['products.view'])).content,/không hợp lệ/); checks++;
  }
  for (const input of [{},{messages:[]},{messages:[{role:'system',content:'x'}]},{messages:[{role:'assistant',content:'x'}]},question(' '),question('x'.repeat(2001)),{messages:Array.from({length:11},()=>({role:'user',content:'x'}))}]) { await assert.rejects(chat(input,[]),{statusCode:400}); checks++; }
  for (const classification of ['OFF','ON OFF','', 'on']) {
    fixture.reads=[]; payloads.length=0; responses=[text(classification)];
    assert.deepEqual(await chat(question('Viết code Python'),[]),{reply:refusal,offTopic:true,sources:[]}); assert.equal(payloads.length,1); assert.equal(fixture.reads.length,0); checks++;
  }
  responses=[text('ON'),call('tim_san_pham',{q:'SP000094',limit:1}),text('Túi kiểm thử còn 2, giá 100.')];
  const result=await chat(question('Túi kiểm thử còn hàng?'),['products.view']) /* SKU questions are now routed in code; this one exercises the model tool path */; assert.equal(result.sources[0].label,'SP000094 · ! Túi kiểm thử'); assert.equal(result.offTopic,false); checks++;
  assert.equal(payloads.at(-1).think,false); assert.equal(payloads.at(-1).options.num_ctx,8192); assert.equal(payloads.at(-1).tools.length,6);
  responses=[text('ON'),...Array.from({length:4},()=>call('huong_dan_su_dung',{chu_de:'Tìm kiếm'}))];
  assert.match((await chat(question('Tìm kiếm?'),[])).reply,/hỏi cụ thể hơn/); assert.equal(responses.length,0); checks++;
  for (const key of tracingKeys) { process.env[key]='true'; const count=payloads.length; await assert.rejects(chat(question('Chào'),[]),{statusCode:503}); assert.equal(payloads.length,count); delete process.env[key]; checks++; }
  fixture.env.LLM_BASE_URL=undefined; await assert.rejects(chat(question('Chào'),[]),{statusCode:503,message:'Chưa cấu hình mô hình AI.'}); fixture.env.LLM_BASE_URL='http://offline.test'; checks++;
  for (const status of [400,429,500]) { responses=[new Response('private',{status})]; await assert.rejects(callModel('s',[{role:'user',content:'x'}]),{statusCode:status===400?502:503}); checks++; }
  responses=[new Response('bad json')]; await assert.rejects(callModel('s',[{role:'user',content:'x'}]),{statusCode:502}); checks++;
  responses=[new Error('private network detail')]; await assert.rejects(callModel('s',[{role:'user',content:'x'}]),{statusCode:503}); checks++;
  responses=[text('<think>private</think>15 ngày, Quy trình.pdf trang 1')];
  const docReply=await askDocuments({question:'Ký gửi?'}); assert.equal(docReply.answer,'15 ngày, Quy trình.pdf trang 1'); assert.equal(docReply.sources.length,6); assert.equal(payloads.at(-1).tools,undefined); checks++;
  responses=[text('')]; assert.equal(await answerWithOllama('?',[]),'Tài liệu không có thông tin phù hợp để trả lời câu hỏi này.'); checks++;
  fixture.env.ANTHROPIC_API_KEY='test-only';
  const claude=await callModel('s',[{role:'user',content:'x'}],true); assert.equal(claude.text,'Claude trả lời'); const body=fixture.claudeCalls.at(-1); assert.equal(body.model,'claude-opus-5-5'); assert.equal(body.tool_choice.type,'auto'); assert.ok(body.tools.every(tool=>tool.strict)); checks++;
  assert.equal(await answerWithClaude('?',[]),'Claude trả lời'); assert.equal(fixture.claudeCalls.at(-1).tools,undefined); checks++;
  fixture.claudeReply={stop_reason:'refusal',content:[]}; assert.match(await answerWithClaude('?',[]),/Xin lỗi/); checks++;
  const {default:Anthropic}=await import('@anthropic-ai/sdk');
  for (const status of [400,429,500]) { fixture.claudeError=new Anthropic.APIError(status); await assert.rejects(answerWithClaude('?',[]),{statusCode:status===400?502:503}); checks++; }
  console.log(`PASS: ${checks} offline checks; real graph, tools, adapters, document QA compatibility. No network/DB/.env.`);
} finally {
  globalThis.fetch=originalFetch;
  for (const key of tracingKeys) { if(savedTracing[key]===undefined)delete process.env[key]; else process.env[key]=savedTracing[key]; }
}
