export const money = value => new Intl.NumberFormat('vi-VN', {style:'currency', currency:'VND', maximumFractionDigits:0}).format(value);
export const shortMoney = value => `${new Intl.NumberFormat('vi-VN', {maximumFractionDigits:1}).format(value/1000000)} tr`;
export const demoDate = '2026-10-15';
export const statusLabels = { completed:'Hoàn tất', shipping:'Đang giao', pending:'Chờ xử lý', cancelled:'Đã hủy' };
export const seedProducts = [
 {id:'SP001', name:'Áo thun Essential', category:'Thời trang', price:290000, stock:124, sold:186, icon:'shirt', color:'lavender'},
 {id:'SP002', name:'Túi Everyday Tote', category:'Phụ kiện', price:450000, stock:58, sold:142, icon:'bag', color:'sand'},
 {id:'SP003', name:'Tai nghe Studio Wireless', category:'Điện tử', price:1290000, stock:36, sold:98, icon:'headset', color:'blue'},
 {id:'SP004', name:'Giày Urban Runner', category:'Thời trang', price:890000, stock:8, sold:76, icon:'shoe', color:'mint'},
 {id:'SP005', name:'Đồng hồ Minimal', category:'Phụ kiện', price:1590000, stock:22, sold:54, icon:'watch', color:'rose'},
 {id:'SP006', name:'Áo thun Weekend', category:'Thời trang', price:320000, stock:4, sold:48, icon:'shirt', color:'sand'},
];
export const seedCustomers = [
 {id:'KH001',name:'Nguyễn Minh Anh',initials:'MA',email:'minhanh@example.com',phone:'0900 000 101',orders:12,spent:8450000,color:'lavender'},
 {id:'KH002',name:'Trần Quốc Bảo',initials:'QB',email:'quocbao@example.com',phone:'0900 000 102',orders:8,spent:6270000,color:'blue'},
 {id:'KH003',name:'Lê Thảo Nguyên',initials:'TN',email:'thaonguyen@example.com',phone:'0900 000 103',orders:6,spent:4510000,color:'rose'},
 {id:'KH004',name:'Phạm Hoàng Nam',initials:'HN',email:'hoangnam@example.com',phone:'0900 000 104',orders:5,spent:3840000,color:'mint'},
 {id:'KH005',name:'Vũ Khánh Linh',initials:'KL',email:'khanhlinh@example.com',phone:'0900 000 105',orders:3,spent:2690000,color:'sand'},
 {id:'KH006',name:'Đỗ Gia Huy',initials:'GH',email:'giahuy@example.com',phone:'0900 000 106',orders:2,spent:1870000,color:'blue'},
];
const orderRows = [
 ['1048',0,'2026-10-15', 'pending',[[0,2],[1,1]],'Website'],
 ['1047',1,'2026-10-15', 'shipping',[[2,1]],'Facebook'],
 ['1046',2,'2026-10-15', 'completed',[[3,1],[0,1]],'Website'],
 ['1045',3,'2026-10-14', 'completed',[[4,1]],'Cửa hàng'],
 ['1044',4,'2026-10-14', 'pending',[[1,2]],'Website'],
 ['1043',5,'2026-10-13', 'shipping',[[5,2],[0,1]],'Facebook'],
 ['1042',0,'2026-10-13', 'completed',[[2,1],[1,1]],'Website'],
 ['1041',2,'2026-10-12', 'cancelled',[[3,1]],'Website'],
 ['1040',1,'2026-10-10', 'completed',[[0,3]],'Cửa hàng'],
 ['1039',3,'2026-10-09', 'completed',[[4,1],[1,1]],'Website'],
 ['1038',4,'2026-10-05', 'shipping',[[2,1]],'Facebook'],
 ['1037',5,'2026-09-28', 'completed',[[0,2],[5,1]],'Website'],
];
export const seedOrders = orderRows.map(([id,customer,date,status,items,channel])=>({id:`DH${id}`,customer:seedCustomers[customer],date,status,channel,items:items.map(([i,quantity])=>({...seedProducts[i],quantity})),total:items.reduce((s,[i,q])=>s+seedProducts[i].price*q,0)}));
export const seedTeam = [
 {id:'NV01',name:'Nguyễn An',initials:'NA',email:'an@example.com',role:'Quản trị viên',department:'Quản lý',active:true,color:'lavender'},
 {id:'NV02',name:'Trần Minh',initials:'TM',email:'minh@example.com',role:'Nhân viên bán hàng',department:'Kinh doanh',active:true,color:'mint'},
 {id:'NV03',name:'Lê Hà',initials:'LH',email:'ha@example.com',role:'Quản lý kho',department:'Vận hành',active:true,color:'rose'},
 {id:'NV04',name:'Phạm Duy',initials:'PD',email:'duy@example.com',role:'Nhân viên bán hàng',department:'Kinh doanh',active:false,color:'blue'},
];
const storageKey = 'maison-admin-demo-v1';
export const storeRepository = {
 load() { try {const saved=JSON.parse(localStorage.getItem(storageKey));return {products:seedProducts,settings:{name:'BaoQ Luxury',email:'hello@example.com',phone:'0900 000 000',address:'123 Đường Mẫu, TP. Hồ Chí Minh',lowStock:10},...saved};} catch {return {products:seedProducts, settings:{name:'BaoQ Luxury',email:'hello@example.com',phone:'0900 000 000',address:'123 Đường Mẫu, TP. Hồ Chí Minh',lowStock:10}};} },
 save(data) {localStorage.setItem(storageKey,JSON.stringify(data));}
};
export const reportSeries = {
 month: {labels:['01/10','03/10','05/10','07/10','09/10','11/10','13/10','15/10'],current:[6.2,9.1,7.8,14.6,11.2,17.4,14.5,21.8],previous:[4.3,6.8,5.2,9.4,7.6,11.8,10.3,14.2],total:128650000,orderCount:248,customers:86,average:518750,trend:'18,6%'},
 week: {labels:['09/10','10/10','11/10','12/10','13/10','14/10','15/10'],current:[4.2,6.3,5.1,8.6,7.2,10.5,12.8],previous:[3.8,4.2,4.9,6.1,5.2,7.4,8.9],total:54700000,orderCount:106,customers:38,average:516038,trend:'12,4%'},
 today: {labels:['08:00','10:00','12:00','14:00','16:00','18:00'],current:[0.3,1.2,0.8,2.1,1.7,2.8],previous:[0.2,0.8,1.1,1.4,1.2,1.9],total:8900000,orderCount:18,customers:7,average:494444,trend:'9,2%'}
};
