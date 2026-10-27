import {useEffect,useMemo,useRef,useState} from 'react';
import {loadTasks,saveTasks,type Task} from './tasks';
import {useLang,localIso,reduceMotion,showToast,Close} from './ui';
// HOME v2: open work first. Only existing task fields are used (status, due date, department); no invented priority.
const DEPTS=['Điều hành','Studio','Marketing'];
const DEPT_EN:Record<string,string>={'Điều hành':'Operations','Studio':'Studio','Marketing':'Marketing'};
const ST_EN:Record<string,string>={'Đang làm':'In progress','Chưa làm':'Not started','Hoàn thành':'Completed'};
const T={vi:{demo:'Dữ liệu demo',demoNote:'Sườn giao diện với dữ liệu tổng hợp. Vai trò chỉ mô phỏng, không phải bảo mật. Chưa nhập dữ liệu thật. Snapshot demo: 19/10/2026 09:00 UTC.',
  headDue:(n:number)=>`Hôm nay có ${n} việc đến hạn`,headOver:(n:number)=>`${n} việc đã quá hạn`,headNone:'Hôm nay không có việc đến hạn',headEmpty:'Chưa có việc nào đang mở',
  lede:(n:number,d:string)=>`${n} việc đang mở ở ${d}.`,ledeEmpty:'Tạo việc đầu tiên để bắt đầu theo dõi.',
  ctaDue:'Mở việc đến hạn',ctaOver:'Mở việc quá hạn',ctaNext:'Mở việc gần hạn nhất',ctaCreate:'Tạo việc',
  listTitle:'Việc của bạn',fOpen:'Đang mở',fToday:'Hôm nay',fOver:'Quá hạn',fDone:'Hoàn thành',dept:'Bộ phận',allDepts:'Tất cả bộ phận',viewList:'Xem dạng danh sách',viewDept:'Xem theo bộ phận',
  bOver:'Quá hạn',bToday:(d:string)=>`Hôm nay, ${d}`,bTomorrow:(d:string)=>`Ngày mai, ${d}`,bLater:'Sau đó',bNoDue:'Chưa đặt hạn',dueToday:'Hôm nay',dueTomorrow:'Ngày mai',due:'Hạn',
  empty:{today:'Không có việc đến hạn hôm nay.',overdue:'Không có việc quá hạn.',done:'Chưa có việc hoàn thành.',open:'Không có việc đang mở.'} as Record<string,string>,emptyAction:'Xem việc đang mở',
  deptEmpty:(l:string)=>`Không có việc đang mở: ${l}.`,openTasksPage:'Mở trang Công việc',goTo:'Đi tới',goOverview:'Tổng quan điều hành',goOverviewSub:'Kỳ demo tháng 10/2026',goTasks:'Tất cả công việc',goTasksSub:'Tạo, sửa, checklist, Telegram mô phỏng',
  detail:'Chi tiết công việc',close:'Đóng chi tiết công việc',assignee:'Người nhận',assigner:'Người giao',dueDate:'Hạn hoàn thành',status:'Trạng thái',markDone:'Đánh dấu hoàn thành',reopen:'Mở lại việc',openFull:'Mở trang chi tiết',
  doneNote:'Khi hoàn thành, trang Công việc hiện bản xem trước thông báo Telegram cho người giao (mô phỏng, không gửi).',toastDone:'Đã đánh dấu hoàn thành',toastReopen:'Đã mở lại việc'},
 en:{demo:'Demo data',demoNote:'Interface scaffold with synthetic data. Roles are simulated, not security. No real data imported. Demo snapshot: 19 Oct 2026 09:00 UTC.',
  headDue:(n:number)=>n===1?'1 task is due today':`${n} tasks are due today`,headOver:(n:number)=>`${n} overdue ${n===1?'task':'tasks'}`,headNone:'Nothing is due today',headEmpty:'No open tasks yet',
  lede:(n:number,d:string)=>`${n} open ${n===1?'task':'tasks'} in ${d}.`,ledeEmpty:'Create the first task to start tracking.',
  ctaDue:'Open task due today',ctaOver:'Open overdue task',ctaNext:'Open next due task',ctaCreate:'Create task',
  listTitle:'Your tasks',fOpen:'Open',fToday:'Today',fOver:'Overdue',fDone:'Done',dept:'Department',allDepts:'All departments',viewList:'List view',viewDept:'Group by department',
  bOver:'Overdue',bToday:(d:string)=>`Today, ${d}`,bTomorrow:(d:string)=>`Tomorrow, ${d}`,bLater:'Later',bNoDue:'No due date',dueToday:'Today',dueTomorrow:'Tomorrow',due:'Due',
  empty:{today:'Nothing is due today.',overdue:'No overdue tasks.',done:'No completed tasks yet.',open:'No open tasks.'} as Record<string,string>,emptyAction:'Show open tasks',
  deptEmpty:(l:string)=>`No open tasks: ${l}.`,openTasksPage:'Open the Tasks page',goTo:'Go to',goOverview:'Executive overview',goOverviewSub:'Demo period October 2026',goTasks:'All tasks',goTasksSub:'Create, edit, checklists, simulated Telegram',
  detail:'Task details',close:'Close task details',assignee:'Assignee',assigner:'Assigned by',dueDate:'Due date',status:'Status',markDone:'Mark as done',reopen:'Reopen task',openFull:'Open full details',
  doneNote:'When a task is completed, the Tasks page shows a simulated Telegram preview for the assigner (nothing is sent).',toastDone:'Marked as done',toastReopen:'Task reopened'}};
const isOpen=(x:Task)=>x.status!=='Hoàn thành';
const dm=(iso:string)=>{const [,m,d]=iso.split('-');return `${d}/${m}`};
function today(){const d=new Date();d.setHours(0,0,0,0);return d}
const dayDiff=(iso:string)=>iso?Math.round((new Date(iso+'T00:00:00').getTime()-today().getTime())/864e5):null;
const bucketOf=(x:Task)=>{const d=dayDiff(x.due);return d===null?'nodue':d<0?'over':d===0?'today':d===1?'tomorrow':'later'};
const Glyph=({s}:{s:string})=>s==='Hoàn thành'?<svg className="glyph" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="8" fill="currentColor"/><path d="M6.5 10.2l2.3 2.3 4.7-4.8" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
 :s==='Đang làm'?<svg className="glyph" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="7.25" fill="none" stroke="currentColor" strokeWidth="1.5"/><path d="M10 2.75a7.25 7.25 0 0 1 0 14.5z" fill="currentColor"/></svg>
 :<svg className="glyph" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="7.25" fill="none" stroke="currentColor" strokeWidth="1.5"/></svg>;

export default function HomeView({route,go,overview,roleControl}:{route:URLSearchParams;go:(n:Record<string,string>,replace?:boolean)=>void;overview:string;roleControl?:React.ReactNode}){
 const lang=useLang(),t=T[lang],tv=(v:string)=>lang==='en'?(DEPT_EN[v]||v):v,ts=(v:string)=>lang==='en'?(ST_EN[v]||v):v;
 const [tasks,setTasks]=useState<Task[]>(loadTasks);const [note,setNote]=useState(false);
 const filter=route.get('homeFilter')||'open',dept=route.get('homeDept')||'all',layout=route.get('homeView')||'list',taskId=route.get('task')||'';
 const update=(next:Task[])=>{setTasks(next);saveTasks(next)};
 // a sheet opened in this session closes with history.back() (Back/Forward stay symmetric); a deep-linked one clears its param
 const deepTask=useRef(taskId);const closeSheet=()=>{if(taskId&&deepTask.current!==taskId)history.back();else go({task:''},true)};
 const href=(next:Record<string,string>)=>{const p=new URLSearchParams(route);for(const [k,v] of Object.entries(next)){v?p.set(k,v):p.delete(k)}return '#'+p.toString()};
 const open=tasks.filter(isOpen).sort((a,b)=>(a.due||'9999').localeCompare(b.due||'9999'));
 const counts={open:open.length,today:open.filter(x=>dayDiff(x.due)===0).length,overdue:open.filter(x=>(dayDiff(x.due)??1)<0).length,done:tasks.length-open.length};
 const dueToday=open.filter(x=>dayDiff(x.due)===0),over=open.filter(x=>(dayDiff(x.due)??1)<0);
 const [head,cta,ctaTask]=over.length?[t.headOver(over.length),t.ctaOver,over[0].id]:dueToday.length?[t.headDue(dueToday.length),t.ctaDue,dueToday[0].id]:open.length?[t.headNone,t.ctaNext,open[0].id]:[t.headEmpty,t.ctaCreate,''];
 const depts=[...new Set(open.map(x=>x.department||'Điều hành'))].map(tv).join(', ');
 const list=useMemo(()=>{let l=tasks.slice();if(filter==='open')l=l.filter(isOpen);else if(filter==='today')l=l.filter(x=>isOpen(x)&&dayDiff(x.due)===0);else if(filter==='overdue')l=l.filter(x=>isOpen(x)&&(dayDiff(x.due)??1)<0);else if(filter==='done')l=l.filter(x=>!isOpen(x));
  if(dept!=='all')l=l.filter(x=>(x.department||'Điều hành')===dept);return l.sort((a,b)=>(a.due||'9999').localeCompare(b.due||'9999')||a.id.localeCompare(b.id))},[tasks,filter,dept]);
 const region=useRef<HTMLDivElement>(null),first=useRef(true);
 useEffect(()=>{if(first.current){first.current=false;return}if(!reduceMotion())region.current?.animate([{opacity:.35,transform:'translateY(4px)'},{opacity:1,transform:'none'}],{duration:180,easing:'cubic-bezier(.22,.8,.24,1)'})},[filter,dept,layout]);
 const loc=lang==='en'?'en-GB':'vi-VN',cap=(s:string)=>s.charAt(0).toUpperCase()+s.slice(1);
 const dLong=cap(new Intl.DateTimeFormat(loc,{weekday:'long',day:'numeric',month:'numeric',year:'numeric'}).format(today())),dShort=cap(new Intl.DateTimeFormat(loc,{weekday:'short',day:'numeric',month:'numeric'}).format(today()));
 const row=(x:Task,showDue=true)=>{const d=dayDiff(x.due),done=!isOpen(x),ok=x.checklist.filter(c=>c.done).length,dueText=!showDue?'':d===0?t.dueToday:d===1?t.dueTomorrow:x.due?dm(x.due):'';
  return <li className={`row${done?' is-done':''}${showDue?' show-due':''}`} key={x.id}><a href={href({task:x.id})}><Glyph s={x.status}/><span><span className="title">{x.title}</span>
   <span className="meta"><span>{tv(x.department||'Điều hành')}</span><span>{x.assignee}</span><span className="num">Checklist {ok}/{x.checklist.length}</span>{x.due&&<span className="meta-due num">{t.due} {d===0?t.dueToday.toLowerCase():d===1?t.dueTomorrow.toLowerCase():dm(x.due)}</span>}</span></span>
   <span className={`due num${d===0&&!done?' is-today':''}`}>{dueText}</span><span className={`status-pill${done?' is-done':''}`}>{ts(x.status)}</span></a></li>};
 const empty=<div className="empty"><p>{t.empty[filter]||t.empty.open}</p>{filter!=='open'&&<button className="btn btn-secondary" type="button" onClick={()=>go({homeFilter:'open'},true)}>{t.emptyAction}</button>}</div>;
 const listLayout=()=>{if(!list.length)return empty;if(filter==='done')return <ul className="rows">{list.map(x=>row(x))}</ul>;
  const groups:Record<string,Task[]>={};for(const x of list)(groups[bucketOf(x)]=groups[bucketOf(x)]||[]).push(x);
  const tm=new Date(today().getTime()+864e5),label:Record<string,string>={over:t.bOver,today:t.bToday(dm(localIso(today()))),tomorrow:t.bTomorrow(dm(localIso(tm))),later:t.bLater,nodue:t.bNoDue};
  return <>{['over','today','tomorrow','later','nodue'].filter(b=>groups[b]).map(b=><section className="bucket" key={b}><h3>{label[b]}</h3><ul className="rows">{groups[b].map(x=>row(x,b!=='today'&&b!=='tomorrow'))}</ul></section>)}</>};
 const deptLayout=()=>{const withWork=DEPTS.filter(d=>list.some(x=>(x.department||'Điều hành')===d)),none=DEPTS.filter(d=>!withWork.includes(d)&&(dept==='all'||dept===d));if(!withWork.length)return empty;
  return <><div className="dept-grid">{withWork.map(d=>{const items=list.filter(x=>(x.department||'Điều hành')===d);return <section className="dept" key={d}><h3>{tv(d)} <span className="num">{items.length}</span></h3><ul className="rows">{items.map(x=>row(x))}</ul></section>})}</div>{none.length>0&&<p className="dept-empty">{t.deptEmpty(none.map(tv).join(', '))}</p>}</>};
 const filters:[string,string,number][]=[['open',t.fOpen,counts.open],['today',t.fToday,counts.today],['overdue',t.fOver,counts.overdue],['done',t.fDone,counts.done]];
 return <div data-no-translate>
  <section className="band on-dark intro" aria-labelledby="home-h1"><div className="wrap">
   <div className="band-meta"><p className="date"><span className="d-long">{dLong}</span><span className="d-short">{dShort}</span></p><div className="band-controls">{roleControl}
    <button className="chip-demo" type="button" aria-expanded={note} aria-controls="demo-note" onClick={()=>setNote(!note)}><svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.75" fill="none" stroke="currentColor" strokeWidth="1.3"/><path d="M8 7v4M8 5v.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>{t.demo}</button></div>
    <p className="demo-note" id="demo-note" hidden={!note}>{t.demoNote}</p></div>
   <h1 className="display" id="home-h1" tabIndex={-1}>{head}</h1><p className="lede">{open.length?t.lede(open.length,depts):t.ledeEmpty}</p>
   <div className="cta-row">{ctaTask&&<a className="btn btn-primary-dark" href={href({task:ctaTask})}>{cta}</a>}<a className={ctaTask?'btn btn-ghost-dark':'btn btn-primary-dark'} href="#page=tasks&taskView=new">{t.ctaCreate}</a></div></div></section>
  <section className="work"><div className="wrap work-grid"><div>
   <div className="toolbar"><h2 className="vh">{t.listTitle}</h2>
    <div className="seg" role="group" aria-label={t.listTitle}>{filters.map(([k,l,n])=><button type="button" key={k} aria-pressed={filter===k} onClick={()=>go({homeFilter:k},true)}>{l} <span className="count num">{n}</span></button>)}</div>
    <div className="tool-right"><label className="vh" htmlFor="home-dept">{t.dept}</label><select className="select" id="home-dept" value={dept} onChange={e=>go({homeDept:e.target.value==='all'?'':e.target.value},true)}><option value="all">{t.allDepts}</option>{DEPTS.map(d=><option key={d} value={d}>{tv(d)}</option>)}</select>
     <div className="seg icon-seg" role="group" aria-label={t.dept}><button type="button" aria-pressed={layout==='list'} aria-label={t.viewList} title={t.viewList} onClick={()=>go({homeView:''},true)}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg></button><button type="button" aria-pressed={layout==='dept'} aria-label={t.viewDept} title={t.viewDept} onClick={()=>go({homeView:'dept'},true)}><svg viewBox="0 0 20 20" aria-hidden="true"><rect x="2.75" y="3.75" width="5.5" height="12.5" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.5"/><rect x="11.75" y="3.75" width="5.5" height="8.5" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.5"/></svg></button></div></div></div>
   <div className="list-region" id="list-region" ref={region} aria-live="polite">{layout==='dept'?deptLayout():listLayout()}</div>
   <div className="list-foot"><a className="text-link" href="#page=tasks&taskView=list&taskFilter=all">{t.openTasksPage}</a></div></div>
   <aside className="side" aria-labelledby="side-h"><h2 id="side-h">{t.goTo}</h2><ul><li><a href={`#page=${overview}`}><strong>{t.goOverview}</strong><span>{t.goOverviewSub}</span></a></li><li><a href="#page=tasks&taskView=list"><strong>{t.goTasks}</strong><span>{t.goTasksSub}</span></a></li></ul></aside>
  </div></section>
  <TaskSheet t={t} task={tasks.find(x=>x.id===taskId)||null} tv={tv} ts={ts} close={closeSheet} onChange={next=>update(next)} tasks={tasks}/>
 </div>}

function TaskSheet({t,task,tv,ts,close,onChange,tasks}:{t:typeof T.vi;task:Task|null;tv:(v:string)=>string;ts:(v:string)=>string;close:()=>void;onChange:(n:Task[])=>void;tasks:Task[]}){
 const ref=useRef<HTMLDialogElement>(null),title=useRef<HTMLHeadingElement>(null),openedFrom=useRef<Element|null>(null);
 useEffect(()=>{const d=ref.current;if(!d)return;if(task&&!d.open){openedFrom.current=document.activeElement;d.showModal();requestAnimationFrame(()=>title.current?.focus())}else if(!task&&d.open){d.close();(openedFrom.current as HTMLElement|null)?.focus?.()}},[task]);
 const set=(patch:Partial<Task>)=>{if(task)onChange(tasks.map(x=>x.id===task.id?{...x,...patch}:x))};
 const act=(done:boolean)=>{if(!task)return;const prev=task.status;set({status:done?'Hoàn thành':'Đang làm'});showToast(done?t.toastDone:t.toastReopen,()=>onChange(tasks.map(x=>x.id===task.id?{...x,status:prev}:x)))};
 const ok=task?task.checklist.filter(c=>c.done).length:0;
 return <dialog className="side-sheet" ref={ref} aria-labelledby="sheet-title" onCancel={e=>{e.preventDefault();close()}} onClick={e=>{if(e.target===ref.current)close()}}>
  {task&&<><div className="sheet-head"><p>{t.detail}</p><button className="icon-btn" type="button" aria-label={t.close} onClick={close}><Close/></button></div>
  <div className="sheet-body"><h2 id="sheet-title" ref={title} tabIndex={-1}>{task.title}</h2>
   <dl className="facts"><dt>{t.dept}</dt><dd>{tv(task.department||'Điều hành')}</dd><dt>{t.assignee}</dt><dd>{task.assignee}</dd><dt>{t.assigner}</dt><dd>{task.assigner}</dd><dt>{t.dueDate}</dt><dd className="num">{task.due?task.due.split('-').reverse().join('/'):'—'}</dd><dt>{t.status}</dt><dd>{ts(task.status)}</dd></dl>
   <h3>Checklist <span className="muted num">{ok}/{task.checklist.length}</span></h3>
   <ul className="checklist">{task.checklist.map((c,i)=><li key={i}><label className={`check${c.done?' is-checked':''}`}><input type="checkbox" checked={c.done} onChange={()=>set({checklist:task.checklist.map((x,n)=>n===i?{...x,done:!x.done}:x)})}/><span>{c.text}</span></label></li>)}</ul>
   <p className="note">{t.doneNote}</p></div>
  <div className="sheet-actions">{task.status==='Hoàn thành'?<button className="btn btn-secondary" type="button" onClick={()=>act(false)}>{t.reopen}</button>:<button className="btn btn-primary" type="button" onClick={()=>act(true)}>{t.markDone}</button>}<a className="btn btn-secondary" href={`#page=tasks&taskView=list&task=${task.id}`}>{t.openFull}</a></div></>}
 </dialog>}
