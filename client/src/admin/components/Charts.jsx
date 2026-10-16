import React from 'react';
import {money, shortMoney} from '../models/storeModel';

export function RevenueChart({report}) {
 const max=30,w=700,h=210,left=40,top=18;
 const points=values=>values.map((value,i)=>`${left+i*(w-left-8)/(values.length-1)},${top+h-value/max*h}`).join(' ');
 return <div className="chart" role="img" aria-label={`Biểu đồ doanh thu mẫu: kỳ này ${money(report.total)}, tăng ${report.trend} so với kỳ trước.`}>
  <svg viewBox="0 0 720 274" aria-hidden="true">
   {[0,10,20,30].map(n=><g key={n}><text x="0" y={top+h-n/max*h+4}>{n===0?'0':`${n} tr`}</text><line x1={left} y1={top+h-n/max*h} x2="700" y2={top+h-n/max*h}/></g>)}
   <polygon points={`${left},${top+h} ${points(report.current)} 692,${top+h}`} fill="#f1edfc"/>
   <polyline points={points(report.previous)} stroke="#c3b8eb" strokeDasharray="5 6"/>
   <polyline points={points(report.current)} stroke="#795ade"/>
   {report.current.map((v,i)=><circle key={i} cx={left+i*(w-left-8)/(report.current.length-1)} cy={top+h-v/max*h} r="3.5" fill="#795ade" stroke="white" strokeWidth="2"/>)}
   {report.labels.map((label,i)=><text key={label} textAnchor={i===0?'start':i===report.labels.length-1?'end':'middle'} x={left+i*(w-left-8)/(report.labels.length-1)} y="262">{label}</text>)}
  </svg>
 </div>;
}

export function OrderRing({count}) {
 const segments=[{label:'Hoàn tất',ratio:.64,color:'#7a5bd9'},{label:'Đang giao',ratio:.20,color:'#60b9a1'},{label:'Chờ xử lý',ratio:.12,color:'#e6b66c'},{label:'Đã hủy',ratio:.04,color:'#df91a3'}];
 let used=0;const counts=segments.map(s=>Math.floor(count*s.ratio));let remaining=count-counts.reduce((a,b)=>a+b,0);const remainders=segments.map((s,i)=>({i,fraction:count*s.ratio-counts[i]})).sort((a,b)=>b.fraction-a.fraction);for(let i=0;i<remaining;i++)counts[remainders[i].i]++;const values=segments.map((s,i)=>({...s,count:counts[i]}));
 return <><div className="ring-wrap"><svg viewBox="0 0 200 200" role="img" aria-label={`Phân bố ${count} đơn hàng mẫu`}><circle cx="100" cy="100" r="75" fill="none" stroke="#f2f1f7" strokeWidth="20"/>{values.map((s)=>{const start=used;used+=s.ratio;return <circle key={s.label} cx="100" cy="100" r="75" fill="none" stroke={s.color} strokeWidth="20" strokeDasharray={`${s.ratio*471-5} ${471-s.ratio*471+5}`} strokeDashoffset={-start*471} transform="rotate(-90 100 100)"/>})}<text x="100" y="99" textAnchor="middle" className="ring-count">{count}</text><text x="100" y="122" textAnchor="middle" className="ring-label">Tổng đơn hàng</text></svg></div><div className="ring-legend">{values.map(s=><div key={s.label}><span><i style={{background:s.color}}/>{s.label}</span><strong>{s.count}</strong><small>{Math.round(s.ratio*100)}%</small></div>)}</div></>;
}
