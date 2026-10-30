import {test,expect} from '@playwright/test';
import {listDocuments,uploadDocument,deleteDocument,askDocuments} from './src/api/documents';

const originalFetch=globalThis.fetch;
test.afterEach(()=>{globalThis.fetch=originalFetch});
test('document requests preserve session, no-store, encoding and cancellation',async()=>{
 const calls:{url:string;init:RequestInit}[]=[];
 globalThis.fetch=async(url,init)=>{
  calls.push({url:String(url),init:init!});
  return init?.method==='DELETE'?new Response(null,{status:204}):Response.json({documents:[]});
 };
 const signal=new AbortController().signal;
 await listDocuments(signal);
 const file=new File(['%PDF-1.4'],'Quy trình.pdf',{type:'application/pdf'});
 await uploadDocument(file,signal);
 await deleteDocument('a/b',signal);
 await askDocuments('Quy trình?',signal);
 expect(calls.map(c=>c.url)).toEqual(['/api/documents','/api/documents','/api/documents/a%2Fb','/api/documents/ask']);
 for(const {init} of calls){expect(init.credentials).toBe('include');expect(init.cache).toBe('no-store');expect(init.signal).toBe(signal)}
 expect(calls[1].init).toMatchObject({method:'POST',headers:{'Content-Type':'application/pdf','X-File-Name':'Quy%20tr%C3%ACnh.pdf'},body:file});
 expect(calls[2].init.method).toBe('DELETE');
 expect(calls[3].init).toMatchObject({method:'POST',headers:{'Content-Type':'application/json'},body:'{"question":"Quy trình?"}'});
});
test('document API returns answers and sources and surfaces denied or malformed responses',async()=>{
 const answer={answer:'Nội dung',sources:[{documentId:'doc-1',name:'Quy trình',page:2,excerpt:'Đoạn nguồn'}]};
 globalThis.fetch=async()=>Response.json(answer);
 expect(await askDocuments('Câu hỏi')).toEqual(answer);
 globalThis.fetch=async()=>Response.json({error:{message:'Không có quyền'}},{status:403});
 await expect(listDocuments()).rejects.toThrow('Không có quyền');
 globalThis.fetch=async()=>new Response('not json');
 await expect(listDocuments()).rejects.toThrow('Phản hồi tài liệu không hợp lệ');
 globalThis.fetch=async()=>new Response('',{status:500});
 await expect(uploadDocument(new File(['x'],'a.pdf'))).rejects.toThrow('Không thể xử lý tài liệu');
});
