// Run with Node 24: node tasks/TASK-017-selfcheck.mjs. Local mocks only; no database or Google calls.
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import request from 'supertest';

// Use the installed TypeScript compiler in-process because Vite/Vitest cannot spawn workers in this sandbox.
registerHooks({
  resolve(specifier, context, next) {
    if (specifier.endsWith('.js') && context.parentURL?.includes('/server/src/')) {
      const source = new URL(specifier.slice(0, -3) + '.ts', context.parentURL);
      if (existsSync(source)) return {url:source.href,shortCircuit:true};
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.endsWith('.ts') && url.includes('/server/src/')) {
      return {format:'module',shortCircuit:true,source:ts.transpileModule(readFileSync(fileURLToPath(url),'utf8'),{
        compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022},fileName:fileURLToPath(url),
      }).outputText};
    }
    return next(url, context);
  },
});
process.env.SESSION_SECRET = 'task-017-local-selfcheck-secret-32-characters';
process.env.DATABASE_URL = 'mysql://fixture:fixture@127.0.0.1:1/fixture';
const { prisma } = await import('../server/src/models/prisma.ts');
const { app } = await import('../server/src/app.ts');
const { rolePermissions } = await import('../server/src/config/permissions.ts');
let people = [
 {id:1,email:'admin@example.test',fullName:'Admin fixture',role:'ADMIN',status:'ACTIVE',googleSub:null,customPermissions:false,permissions:[]},
 {id:2,email:'staff@example.test',fullName:'Staff fixture',role:'STAFF',status:'ACTIVE',googleSub:null,customPermissions:false,permissions:[]},
 {id:3,email:'manager@example.test',fullName:'Manager fixture',role:'MANAGER',status:'ACTIVE',googleSub:null,customPermissions:true,permissions:[{permission:'staff.manage'},{permission:'staff.view'}]},
 {id:4,email:'peer@example.test',fullName:'Peer fixture',role:'STAFF',status:'ACTIVE',googleSub:null,customPermissions:false,permissions:[]},
];
let transactions=0, failWrite=false;
prisma.rolePermission.findMany=async ()=>[];
const apply=(target,data)=>{
 if(failWrite)throw new Error('fixture write failed');
 const {permissions,...fields}=data;Object.assign(target,fields);
 if(permissions)target.permissions=permissions.create.map(row=>({...row}));
 return structuredClone(target);
};
prisma.staff.findUnique=async ({where})=>structuredClone(people.find(p=>where.id?p.id===where.id:p.email===where.email)??null);
prisma.staff.findMany=async ()=>structuredClone(people);
prisma.staff.count=async ()=>people.filter(p=>p.role==='ADMIN'&&p.status==='ACTIVE').length;
prisma.staff.create=async ({data})=>{const person=apply({id:people.length+1,googleSub:null},data);people.push(person);return structuredClone(person)};
prisma.staff.update=async ({where,data})=>apply(people.find(p=>p.id===where.id),data);
prisma.$transaction=async(action,options)=>{
 assert.equal(options.isolationLevel,'Serializable');transactions++;
 const before=structuredClone(people);
 try{return await action({staff:prisma.staff})}catch(error){people=before;throw error}
};
function cookie(id){
 const value=JSON.stringify({staffId:id,createdAt:Date.now()});
 const signature=createHmac('sha256',process.env.SESSION_SECRET).update(value).digest('base64').replace(/=+$/,'');
 return `sid=${encodeURIComponent(`s:${value}.${signature}`)}`;
}
const admin=cookie(1),staff=cookie(2),manager=cookie(3),peer=cookie(4);
const patch=(body,id=2,session=admin)=>request(app).patch(`/api/staff/${id}`).set('Cookie',session).send(body);
let sequence=0;
const post=(extra={},session=admin)=>request(app).post('/api/staff').set('Cookie',session).send({email:`fixture${++sequence}@example.test`,fullName:'Fixture',...extra});
const me=session=>request(app).get('/api/auth/me').set('Cookie',session);
const list=session=>request(app).get('/api/staff').set('Cookie',session);
let response=await post({permissions:['products.view']});assert.equal(response.status,201);assert.equal(response.body.staff.customPermissions,true);assert.deepEqual(response.body.staff.permissions,['products.view']);
for(const extra of [{},{permissions:null},{permissions:[...rolePermissions.STAFF].reverse()}]){
 response=await post(extra);assert.equal(response.status,201);assert.equal(response.body.staff.customPermissions,false);assert.deepEqual(response.body.staff.permissions,rolePermissions.STAFF);
}
response=await post({permissions:[]});assert.equal(response.status,201);assert.equal(response.body.staff.customPermissions,true);assert.deepEqual(response.body.staff.permissions,[]);
assert.equal((await list(staff)).status,403);
assert.equal((await patch({permissions:['staff.view']})).status,200);
assert.deepEqual((await me(staff)).body.user.permissions,['staff.view']);assert.equal((await list(staff)).status,200);
assert.deepEqual((await me(peer)).body.user.permissions,rolePermissions.STAFF);
response=await list(admin);assert.equal(response.body.staff[1].customPermissions,true);assert(!JSON.stringify(response.body).includes('googleSub'));
assert.equal((await patch({fullName:'Updated'})).status,200);assert.deepEqual((await me(staff)).body.user.permissions,['staff.view']);
assert.equal((await patch({permissions:[]})).status,200);assert.deepEqual((await me(staff)).body.user.permissions,[]);assert.equal((await list(staff)).status,403);
assert.equal((await patch({role:'MANAGER'})).status,200);assert.equal(people[1].customPermissions,false);assert.deepEqual(people[1].permissions,[]);assert.deepEqual((await me(staff)).body.user.permissions,rolePermissions.MANAGER);
assert.equal((await patch({permissions:['staff.view']})).status,200);assert.equal((await patch({permissions:null})).status,200);assert.equal(people[1].customPermissions,false);
for(const permissions of [[],null,['staff.view']])assert.equal((await patch({permissions},1)).status,403);
assert.equal((await patch({fullName:'New admin name'},1)).status,200);
for(const body of [{permissions:['products.edit']},{permissions:null},{role:'STAFF'}])assert.equal((await patch(body,2,manager)).status,403);
assert.equal((await post({},manager)).status,403);
assert.equal((await post({permissions:['staff.view']},manager)).status,201);
assert.equal((await patch({permissions:['staff.view']},4,manager)).status,200);
assert.equal((await post({role:'ADMIN',permissions:[]},manager)).status,403);
assert.equal((await patch({role:'ADMIN'},4,manager)).status,403);
response=await post({role:'ADMIN',permissions:[]});assert.equal(response.status,201);assert.equal(response.body.staff.customPermissions,false);assert.deepEqual(response.body.staff.permissions,rolePermissions.ADMIN);
for(const permissions of [['unknown'],['staff.view','staff.view'],'staff.view',[12]]){
 assert.equal((await post({permissions})).status,400);assert.equal((await patch({permissions})).status,400);
}
assert.equal((await patch({permissions:[],extra:true})).status,400);
assert.equal((await patch({status:'DISABLED'},1)).status,403);
assert.equal((await patch({role:'STAFF'},1)).status,403);
const { update }=await import('../server/src/services/staffService.ts');
const extraAdmin=people.find(p=>p.id!==1&&p.role==='ADMIN');extraAdmin.status='DISABLED';
await assert.rejects(update({id:extraAdmin.id,role:'ADMIN',permissions:rolePermissions.ADMIN},1,{status:'DISABLED'}),{code:'LAST_ADMIN'});
const before=structuredClone(people);failWrite=true;
assert.equal((await patch({permissions:[]})).status,500);assert.deepEqual(people,before);failWrite=false;
assert.equal((await request(app).put('/api/staff/roles/STAFF/permissions').set('Cookie',admin).send({permissions:[]})).status,404);
response=await request(app).get('/api/staff/roles').set('Cookie',admin);assert.equal(response.status,200);assert.equal(response.body.catalog.length,11);
assert(transactions>0);
await prisma.$disconnect();
console.log('TASK-017 selfcheck PASS: source API/services/model, mocked Prisma; custom/default/empty permissions, sessions/guards, peer isolation, validation, self/grant/Admin rules, transaction failures.');
