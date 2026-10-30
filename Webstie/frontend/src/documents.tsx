import {useEffect,useRef,useState,type FormEvent} from 'react';
import {listDocuments,uploadDocument,deleteDocument,askDocuments,type DocumentMetadata,type DocumentAnswer} from './api/documents';

export default function Documents({canManage}:{canManage:boolean}){
 const [documents,setDocuments]=useState<DocumentMetadata[]>([]),[loading,setLoading]=useState(true),[listError,setListError]=useState('');
 const [file,setFile]=useState<File|null>(null),[uploading,setUploading]=useState(false),[uploadError,setUploadError]=useState(''),[deleting,setDeleting]=useState('');
 const [question,setQuestion]=useState(''),[answer,setAnswer]=useState<DocumentAnswer|null>(null),[asking,setAsking]=useState(false),[askError,setAskError]=useState('');
 const requests=useRef(new Set<AbortController>()),fileInput=useRef<HTMLInputElement>(null);
 function controller(){const item=new AbortController();requests.current.add(item);return item}
 async function load(){
  const request=controller();setLoading(true);setListError('');
  try{const data=await listDocuments(request.signal);if(!request.signal.aborted)setDocuments(data.documents)}
  catch(error){if(!request.signal.aborted)setListError((error as Error).message)}
  finally{requests.current.delete(request);if(!request.signal.aborted)setLoading(false)}
 }
 useEffect(()=>{void load();return()=>{requests.current.forEach(request=>request.abort());requests.current.clear()}},[]);
 async function upload(event:FormEvent){
  event.preventDefault();if(!file||uploading)return;
  if(!/\.pdf$/i.test(file.name)||file.size>20*1024*1024){setUploadError('Chọn file PDF tối đa 20 MB.');return}
  const request=controller();setUploading(true);setUploadError('');
  try{await uploadDocument(file,request.signal);if(!request.signal.aborted){setFile(null);if(fileInput.current)fileInput.current.value='';setAnswer(null);await load()}}
  catch(error){if(!request.signal.aborted)setUploadError((error as Error).message)}
  finally{requests.current.delete(request);if(!request.signal.aborted)setUploading(false)}
 }
 async function remove(document:DocumentMetadata){
  if(deleting||!window.confirm(`Xóa tài liệu “${document.name}”? Thao tác này xóa PDF và chỉ mục trên máy.`))return;
  const request=controller();setDeleting(document.id);setListError('');
  try{await deleteDocument(document.id,request.signal);if(!request.signal.aborted){setDocuments(items=>items.filter(item=>item.id!==document.id));setAnswer(null)}}
  catch(error){if(!request.signal.aborted)setListError((error as Error).message)}
  finally{requests.current.delete(request);if(!request.signal.aborted)setDeleting('')}
 }
 async function ask(event:FormEvent){
  event.preventDefault();if(!question.trim()||asking)return;
  const request=controller();setAsking(true);setAskError('');setAnswer(null);
  try{const result=await askDocuments(question.trim(),request.signal);if(!request.signal.aborted)setAnswer(result)}
  catch(error){if(!request.signal.aborted)setAskError((error as Error).message)}
  finally{requests.current.delete(request);if(!request.signal.aborted)setAsking(false)}
 }
 return <div className="ws-stack documents-page">
  <section aria-labelledby="documents-library-title" className="ws-stack">
   <div><h2 id="documents-library-title">Thư viện tài liệu</h2><p className="ws-muted">PDF có văn bản, tối đa 20 MB. Không hỗ trợ ảnh scan.</p></div>
   {canManage&&<form className="ws-stack" onSubmit={upload} aria-busy={uploading}>
    <label htmlFor="document-file">Chọn tài liệu PDF</label>
    <div className="documents-controls"><input ref={fileInput} className="ws-input" id="document-file" type="file" accept="application/pdf,.pdf" disabled={uploading||!!deleting} onChange={event=>{setFile(event.target.files?.[0]||null);setUploadError('')}}/><button className="btn btn-primary-dark" disabled={!file||uploading||!!deleting} type="submit">{uploading?'Đang xử lý…':'Tải lên'}</button></div>
    {uploading&&<p role="status">Đang đọc và lập chỉ mục tài liệu. Lần đầu có thể cần tải mô hình về máy.</p>}
    {uploadError&&<p role="alert">{uploadError} Chọn lại file hoặc nhấn Tải lên để thử lại.</p>}
   </form>}
   {listError&&<div className="ws-msg" role="alert">{listError} <button className="btn btn-secondary" onClick={()=>void load()} disabled={loading}>Thử lại</button></div>}
   {loading?<p className="ws-muted" role="status">Đang tải danh sách…</p>:documents.length?<div className="card ws-table"><div className="table-scroll"><table className="table"><thead><tr><th>Tên tài liệu</th><th>Số trang</th><th>Ngày tải</th><th>Người tải</th>{canManage&&<th>Thao tác</th>}</tr></thead><tbody>{documents.map(document=><tr key={document.id}><td>{document.name}</td><td>{document.pages}</td><td>{new Date(document.uploadedAt).toLocaleString('vi-VN')}</td><td>{document.uploadedBy}</td>{canManage&&<td><button className="btn btn-secondary btn-sm" disabled={!!deleting||uploading} aria-label={`Xóa ${document.name}`} onClick={()=>void remove(document)}>{deleting===document.id?'Đang xóa…':'Xóa'}</button></td>}</tr>)}</tbody></table></div></div>:!listError&&<p className="ws-muted">Chưa có tài liệu nào được tải lên.</p>}
  </section>
  <section className="ws-stack" aria-labelledby="documents-qa-title">
   <div><h2 id="documents-qa-title">Hỏi đáp tài liệu</h2><p className="ws-muted">Mỗi câu hỏi được trả lời độc lập, kèm nguồn để đối chiếu.</p></div>
   <form onSubmit={ask} className="ws-stack" aria-busy={asking}>
    <label htmlFor="document-question">Câu hỏi của bạn</label><textarea className="ws-input" id="document-question" value={question} onChange={event=>setQuestion(event.target.value)} maxLength={1000} required disabled={asking} rows={3} placeholder="Nhập điều bạn muốn tìm trong tài liệu…"/>
    <p className="ws-muted">Chỉ trả lời dựa trên tài liệu đã tải lên. Câu hỏi và các đoạn liên quan được gửi tới mô hình AI: Ollama trên máy, hoặc Claude (Anthropic) khi đã cấu hình khóa.</p>
    <div><button type="submit" className="btn btn-primary-dark" disabled={asking||!question.trim()}>{asking?'Đang trả lời…':askError?'Thử lại':'Hỏi'}</button></div>
    {asking&&<p role="status">Đang tìm đoạn tài liệu và soạn câu trả lời…</p>}
    {askError&&<p className="ws-msg" role="alert">{askError}</p>}
   </form>
   {answer&&<div className="documents-answer" aria-live="polite"><h3>Câu trả lời</h3><p>{answer.answer}</p>{answer.sources.length>0&&<><h3>Nguồn tham khảo</h3><ul>{answer.sources.map((source,index)=><li key={`${source.documentId}-${source.page}-${index}`}><strong>{source.name} · trang {source.page}</strong><p>{source.excerpt}</p></li>)}</ul></>}</div>}
  </section>
 </div>;
}
