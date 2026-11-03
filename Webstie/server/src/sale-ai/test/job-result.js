import {Readable} from 'node:stream';

// HTTP tests assert business results after the new 202 acceptance response.
export async function jobResult(sale,id){
 for(let n=0;n<20000;n++){
  const req=Readable.from([]);Object.assign(req,{url:'/api/jobs/'+encodeURIComponent(id),method:'GET',headers:{}});
  let data;await sale.handler(req,{writeHead(){},end(bytes){data=JSON.parse(bytes);}});
  if(data.status==='completed')return {status:200,data:data.result};
  if(data.status==='failed')return {status:data.errorStatus,data:{error:data.error}};
  await new Promise(setImmediate);
 }
 throw Error('Background fixture timed out');
}
export async function responseResult(sale,response){
 const data=await response.json();return response.status===202?jobResult(sale,data.id):{status:response.status,data};
}
