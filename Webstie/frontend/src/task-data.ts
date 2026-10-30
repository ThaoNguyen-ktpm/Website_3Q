export type Task={department?:string;id:string;title:string;assignee:string;due:string;status:string;checklist:{text:string;done:boolean}[];comments:{text:string;at:string}[];assigner:string};
export const people=['An · demo','Bình · demo','Chi · demo'];
export const seed:Task[]=[{department:'Studio',id:'TASK-DEMO-01',title:'Chuẩn bị bộ ảnh sản phẩm demo',assignee:people[0],assigner:'Người giao · demo',due:'2026-10-21',status:'Đang làm',checklist:[{text:'Kiểm tra ánh sáng',done:true},{text:'Chọn 5 ảnh',done:false}],comments:[]},{department:'Điều hành',id:'TASK-DEMO-02',title:'Rà soát checklist mở cửa demo',assignee:people[1],assigner:'Người giao · demo',due:'2026-10-22',status:'Chưa làm',checklist:[{text:'Kiểm tra vật dụng',done:false}],comments:[]}];
// Shared demo task store (sessionStorage only), used by Tasks and the HOME view.
export function loadTasks():Task[]{try{return JSON.parse(sessionStorage.getItem('baoq-tasks-demo')||'null')||seed}catch{return seed}}
export function saveTasks(t:Task[]){sessionStorage.setItem('baoq-tasks-demo',JSON.stringify(t))}
