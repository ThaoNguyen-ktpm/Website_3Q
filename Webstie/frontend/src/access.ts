import type {User} from './auth';
import {PRICE,MANAGE} from './apps';

const reports=['overview','transactions','inventory','errors','costs','reconcile','consignment','cash','close','settings'];
/** UI routing only; the server checks permissions on every protected API. */
export function allowedPage(user:Pick<User,'role'|'permissions'>,target:string){
 const app=[...PRICE,...MANAGE].find(([page])=>page===target);
 if(app)return user.permissions.includes(app[2]);
 if(reports.includes(target))return user.role==='ADMIN';
 return ['portal','tasks','policy'].includes(target);
}
