// In-process checks when sandbox policy prevents the Playwright worker from spawning.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const ts = require(path.join(root, 'Webstie/frontend/node_modules/typescript'));
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022},
}).outputText, filename);
const {allowedPage} = require(path.join(root, 'Webstie/frontend/src/access.ts'));
const api = require(path.join(root, 'Webstie/frontend/src/api/documents.ts'));
async function check() {
  assert.equal(allowedPage({role:'STAFF',permissions:['documents.view']}, 'documents'), true);
  for (const role of ['STAFF','MANAGER','ADMIN']) {
    assert.equal(allowedPage({role,permissions:[]}, 'documents'), false);
    assert.equal(allowedPage({role,permissions:['documents.manage']}, 'documents'), false);
  }
  const calls = [], signal = new AbortController().signal;
  const answer = {answer:'Nội dung kiểm thử',sources:[{documentId:'doc-1',name:'Quy trình',page:2,excerpt:'Đoạn nguồn'}]};
  globalThis.fetch = async (url, init) => {
    calls.push({url,init});
    return init.method === 'DELETE' ? new Response(null,{status:204}) : Response.json(url.endsWith('/ask') ? answer : {documents:[]});
  };
  assert.deepEqual(await api.listDocuments(signal), {documents:[]});
  const file = new File(['%PDF-1.4'], 'Quy trình.pdf', {type:'application/pdf'});
  await api.uploadDocument(file, signal);
  assert.equal(await api.deleteDocument('a/b', signal), undefined);
  assert.deepEqual(await api.askDocuments('Quy trình?', signal), answer);
  assert.deepEqual(calls.map(c => c.url), ['/api/documents','/api/documents','/api/documents/a%2Fb','/api/documents/ask']);
  for (const {init} of calls) {
    assert.equal(init.credentials, 'include'); assert.equal(init.cache, 'no-store'); assert.equal(init.signal, signal);
  }
  assert.equal(calls[1].init.body, file);
  assert.deepEqual(calls[1].init.headers, {'Content-Type':'application/pdf','X-File-Name':'Quy%20tr%C3%ACnh.pdf'});
  assert.equal(calls[2].init.method, 'DELETE');
  assert.deepEqual(calls[3].init.headers, {'Content-Type':'application/json'});
  assert.equal(calls[3].init.body, '{"question":"Quy trình?"}');
  globalThis.fetch = async () => Response.json({error:{message:'Không có quyền'}},{status:403});
  await assert.rejects(api.listDocuments(), /Không có quyền/);
  globalThis.fetch = async () => new Response('not json');
  await assert.rejects(api.listDocuments(), /Phản hồi tài liệu không hợp lệ/);
  globalThis.fetch = async () => new Response('', {status:500});
  await assert.rejects(api.uploadDocument(file), /Không thể xử lý tài liệu/);
  console.log('PASS: document permissions, API contracts, sources, cancellation signal and error handling (in-process; mocked fetch).');
}
const originalFetch = globalThis.fetch;
check().catch(error => {console.error(error); process.exitCode=1}).finally(() => {globalThis.fetch=originalFetch});
