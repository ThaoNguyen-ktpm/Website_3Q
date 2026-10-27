import React,{useEffect,useRef,useState} from 'react';
import {listDocuments,uploadDocument,deleteDocument,askDocuments} from '../../api/documents';

export default function Documents({canManage}){
 const [documents,setDocuments]=useState([]),[loading,setLoading]=useState(true),[listError,setListError]=useState('');
 const [file,setFile]=useState(null),[uploading,setUploading]=useState(false),[uploadError,setUploadError]=useState(''),[deleting,setDeleting]=useState('');
 const [question,setQuestion]=useState(''),[answer,setAnswer]=useState(null),[asking,setAsking]=useState(false),[askError,setAskError]=useState('');
 const requests=useRef(new Set()),fileInput=useRef(null);
 function controller(){const item=new AbortController();requests.current.add(item);return item;}
 async function load(){
  const request=controller();setLoading(true);setListError('');
  try{const data=await listDocuments(request.signal);if(!request.signal.aborted)setDocuments(data.documents);}
  catch(error){if(!request.signal.aborted)setListError(error.message);}
  finally{requests.current.delete(request);if(!request.signal.aborted)setLoading(false);}
 }
 useEffect(()=>{load();return()=>{requests.current.forEach(request=>request.abort());requests.current.clear();};},[]);
 async function upload(event){
  event.preventDefault();if(!file||uploading)return;
  if(!/\.pdf$/i.test(file.name)||file.size>20*1024*1024){setUploadError('Chọn file PDF tối đa 20 MB.');return;}
  const request=controller();setUploading(true);setUploadError('');
  try{await uploadDocument(file,request.signal);if(!request.signal.aborted){setFile(null);fileInput.current.value='';await load();setAnswer(null);}}
  catch(error){if(!request.signal.aborted)setUploadError(error.message);}
  finally{requests.current.delete(request);if(!request.signal.aborted)setUploading(false);}
 }
 async function remove(document){
  if(deleting||!window.confirm(`Xóa tài liệu “${document.name}”? Thao tác này xóa PDF và chỉ mục trên máy.`))return;
  const request=controller();setDeleting(document.id);setListError('');
  try{await deleteDocument(document.id,request.signal);if(!request.signal.aborted){setDocuments(items=>items.filter(item=>item.id!==document.id));setAnswer(null);}}
  catch(error){if(!request.signal.aborted)setListError(error.message);}
  finally{requests.current.delete(request);if(!request.signal.aborted)setDeleting('');}
 }
 async function ask(event){
  event.preventDefault();if(!question.trim()||asking)return;
  const request=controller();setAsking(true);setAskError('');setAnswer(null);
  try{const result=await askDocuments(question.trim(),request.signal);if(!request.signal.aborted)setAnswer(result);}
  catch(error){if(!request.signal.aborted)setAskError(error.message);}
  finally{requests.current.delete(request);if(!request.signal.aborted)setAsking(false);}
 }
 return <div className="documents-page">
  <section className="panel documents-library" aria-labelledby="documents-library-title">
   <div className="panel-heading"><div><h2 id="documents-library-title">Thư viện tài liệu</h2><p>PDF có văn bản, tối đa 20 MB. Không hỗ trợ ảnh scan.</p></div></div>
   {canManage&&<form className="documents-upload" onSubmit={upload} aria-busy={uploading}>
    <label htmlFor="document-file">Chọn tài liệu PDF</label>
    <div className="documents-controls"><input ref={fileInput} id="document-file" type="file" accept="application/pdf,.pdf" disabled={uploading} onChange={event=>{setFile(event.target.files?.[0]||null);setUploadError('');}}/><button className="button primary" disabled={!file||uploading} type="submit">{uploading?'Đang xử lý…':'Tải lên'}</button></div>
    {uploading&&<p role="status">Đang đọc và lập chỉ mục tài liệu. Lần đầu có thể cần tải mô hình về máy.</p>}
    {uploadError&&<p role="alert">{uploadError} Chọn lại file hoặc nhấn Tải lên để thử lại.</p>}
   </form>}
   {listError&&<div className="documents-error" role="alert">{listError} <button className="button" onClick={load} disabled={loading}>Thử lại</button></div>}
   {loading?<p className="documents-state" role="status">Đang tải danh sách…</p>:documents.length?<div className="table-wrap"><table><thead><tr><th>Tên tài liệu</th><th>Số trang</th><th>Ngày tải</th><th>Người tải</th>{canManage&&<th>Thao tác</th>}</tr></thead><tbody>{documents.map(document=><tr key={document.id}><td>{document.name}</td><td>{document.pages}</td><td>{new Date(document.uploadedAt).toLocaleString('vi-VN')}</td><td>{document.uploadedBy}</td>{canManage&&<td><button className="button" disabled={!!deleting} aria-label={`Xóa ${document.name}`} onClick={()=>remove(document)}>{deleting===document.id?'Đang xóa…':'Xóa'}</button></td>}</tr>)}</tbody></table></div>:!listError&&<p className="documents-state">Chưa có tài liệu nào được tải lên.</p>}
  </section>
  <section className="panel documents-qa" aria-labelledby="documents-qa-title">
   <div className="panel-heading"><div><h2 id="documents-qa-title">Hỏi đáp tài liệu</h2><p>Mỗi câu hỏi được trả lời độc lập, kèm nguồn để đối chiếu.</p></div></div>
   <form onSubmit={ask} className="documents-question" aria-busy={asking}>
    <label htmlFor="document-question">Câu hỏi của bạn</label><textarea id="document-question" value={question} onChange={event=>setQuestion(event.target.value)} maxLength={1000} required disabled={asking} rows={3} placeholder="Nhập điều bạn muốn tìm trong tài liệu…"/>
    <p className="muted">Chỉ trả lời dựa trên tài liệu đã tải lên. Câu hỏi và các đoạn liên quan được gửi tới mô hình AI: Ollama trên máy, hoặc Claude (Anthropic) khi đã cấu hình khóa.</p>
    <button type="submit" className="button primary" disabled={asking||!question.trim()}>{asking?'Đang trả lời…':askError?'Thử lại':'Hỏi'}</button>
    {asking&&<p role="status">Đang tìm đoạn tài liệu và soạn câu trả lời…</p>}
    {askError&&<p className="documents-error" role="alert">{askError}</p>}
   </form>
   {answer&&<div className="documents-answer" aria-live="polite"><h3>Câu trả lời</h3><p>{answer.answer}</p>{answer.sources.length>0&&<><h3>Nguồn tham khảo</h3><ul className="documents-sources">{answer.sources.map((source,index)=><li key={`${source.documentId}-${source.page}-${index}`}><strong>{source.name} · trang {source.page}</strong><p>{source.excerpt}</p></li>)}</ul></>}</div>}
  </section>
 </div>;
}
