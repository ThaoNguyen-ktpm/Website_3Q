import {useEffect, useMemo, useState} from 'react';
import {storeRepository, seedOrders, seedCustomers, reportSeries, demoDate} from '../models/storeModel';

export default function useAdminController(defaultPage='overview') {
 const [page,setPage]=useState(()=>location.hash.slice(1)||defaultPage);
 const [store,setStore]=useState(()=>storeRepository.load());
 const [search,setSearch]=useState(''); const [period,setPeriod]=useState('month');
 const [status,setStatus]=useState('all');const [category,setCategory]=useState('all');
 const [drawer,setDrawer]=useState(null);const [toast,setToast]=useState('');const [sidebarOpen,setSidebarOpen]=useState(false);
 useEffect(()=>{const change=()=>{setPage(location.hash.slice(1)||defaultPage);setSearch('');setStatus('all');setCategory('all');setDrawer(null);setSidebarOpen(false)};window.addEventListener('hashchange',change);return()=>window.removeEventListener('hashchange',change)},[]);
 useEffect(()=>{if(!toast)return;const timer=setTimeout(()=>setToast(''),4000);return()=>clearTimeout(timer)},[toast]);
 useEffect(()=>{if(!drawer)return;const close=e=>{if(e.key==='Escape')setDrawer(null)};document.addEventListener('keydown',close);return()=>document.removeEventListener('keydown',close)},[drawer]);
 const normalized=search.toLocaleLowerCase('vi');
 const matches = (...values)=>values.some(v=>String(v).toLocaleLowerCase('vi').includes(normalized));
 const filteredProducts = useMemo(()=>store.products.filter(p=>matches(p.name,p.id,p.category)&&(category==='all'||p.category===category)),[store.products,search,category]);
 const filteredOrders = useMemo(()=>seedOrders.filter(o=>matches(o.id,o.customer.name,o.channel)&&(status==='all'||o.status===status)&&(period==='today'?o.date===demoDate:period==='week'?o.date>='2026-10-09':o.date>='2026-10-01')),[search,status,period]);
 const filteredCustomers=seedCustomers.filter(c=>matches(c.name,c.email,c.id));
 function persist(next,message) { try{storeRepository.save(next);setStore(next);setToast(message);return true}catch{setToast('Không lưu được trong trình duyệt. Hãy kiểm tra dung lượng lưu trữ rồi thử lại.');return false} }
 function saveProduct(product) {const existed=store.products.some(p=>p.id===product.id);const next={...store,products:existed?store.products.map(p=>p.id===product.id?product:p):[product,...store.products]};if(persist(next,'Đã lưu sản phẩm trong bản mẫu.'))setDrawer(null);}
 function saveSettings(settings){persist({...store,settings},'Đã lưu cài đặt trong bản mẫu.');}
 function exportOrders(){const escape=v=>'"'+String(v).replaceAll('"','""')+'"';const rows=[['Mã đơn','Khách hàng','Ngày','Tổng tiền (VND)','Trạng thái'],...filteredOrders.map(o=>[o.id,o.customer.name,o.date,o.total,o.status])];const blob=new Blob(['\uFEFF'+rows.map(r=>r.map(escape).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8;'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='don-hang-mau.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setToast('Đã xuất danh sách đơn hàng mẫu đang lọc.');}
 return {page,store,search,setSearch,period,setPeriod,status,setStatus,category,setCategory,drawer,setDrawer,toast,setToast,sidebarOpen,setSidebarOpen,filteredProducts,filteredOrders,filteredCustomers,report:reportSeries[period],saveProduct,saveSettings,exportOrders};
}
