// Real sign-in through the website's API using its session cookie.
export type User={id:number;email:string;fullName:string;role:string;roleLabel:string;permissions:string[];isPrimaryAdmin:boolean};
async function auth(path:string,body?:unknown){
 const response=await fetch('/api/auth/'+path,body===undefined?{credentials:'include'}:{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 if(path==='me'&&response.status===401)return {user:null};
 const data=await response.json().catch(()=>null);
 if(!response.ok)throw Error(data?.error?.message??'Không kết nối được máy chủ. Kiểm tra máy chủ đang chạy rồi thử lại.');
 return data;
}
export const getMe=():Promise<{user:User|null}>=>auth('me');
export const getConfig=():Promise<{googleClientId:string}>=>auth('config');
export const loginWithGoogle=(credential:string):Promise<{user:User}>=>auth('google',{credential});
export const loginWithLink=(code:string):Promise<{user:User}>=>auth('link',{code});
export const logout=()=>auth('logout',{});
