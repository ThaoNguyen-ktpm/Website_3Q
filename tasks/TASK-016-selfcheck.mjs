// Run with Node 24: node tasks/TASK-016-selfcheck.mjs. Local mocks only; no database or Google calls.
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
process.env.SESSION_SECRET = 'task-016-local-selfcheck-secret-32-characters';
process.env.DATABASE_URL = 'mysql://fixture:fixture@127.0.0.1:1/fixture';
const { prisma } = await import('../server/src/models/prisma.ts');
const { permissionsFor } = await import('../server/src/services/permissionService.ts');
const { rolePermissions } = await import('../server/src/config/permissions.ts');
const { app } = await import('../server/src/app.ts');
const people = [
  {id:1,email:'admin@example.test',fullName:'Admin fixture',role:'ADMIN',status:'ACTIVE',googleSub:null},
  {id:2,email:'staff@example.test',fullName:'Staff fixture',role:'STAFF',status:'ACTIVE',googleSub:null},
  {id:3,email:'manager@example.test',fullName:'Manager fixture',role:'MANAGER',status:'ACTIVE',googleSub:null},
];
let rows = [], transactions = 0, failInsert = false;
const delegate = {
  findMany:async ({where})=>rows.filter(row=>row.role===where.role),
  deleteMany:async ({where})=>{rows=rows.filter(row=>row.role!==where.role)},
  createMany:async ({data})=>{if(failInsert)throw new Error('fixture failure');rows.push(...data)},
};
prisma.rolePermission = delegate;
prisma.staff.findUnique = async ({where})=>people.find(person=>where.id?person.id===where.id:person.email===where.email)??null;
prisma.staff.findMany = async ()=>people;
prisma.staff.count = async ()=>people.filter(person=>person.role==='ADMIN'&&person.status==='ACTIVE').length;
prisma.staff.create = async ({data})=>({...data,id:4,googleSub:null});
prisma.staff.update = async ({where,data})=>Object.assign(people.find(person=>person.id===where.id),data);
prisma.$transaction = async (action, options)=>{
  assert.equal(options.isolationLevel,'Serializable');transactions++;
  const before=structuredClone(rows);
  try{return await action({rolePermission:delegate,staff:prisma.staff})}catch(error){rows=before;throw error}
};
function cookie(id){
  const value=JSON.stringify({staffId:id,createdAt:Date.now()});
  const signature=createHmac('sha256',process.env.SESSION_SECRET).update(value).digest('base64').replace(/=+$/,'');
  return `sid=${encodeURIComponent(`s:${value}.${signature}`)}`;
}
const admin=cookie(1),staff=cookie(2),manager=cookie(3);
const put=(role,permissions,session=admin)=>request(app).put(`/api/staff/roles/${role}/permissions`).set('Cookie',session).send({permissions});
const me=session=>request(app).get('/api/auth/me').set('Cookie',session);
const staffList=session=>request(app).get('/api/staff').set('Cookie',session);
assert.deepEqual(await permissionsFor('STAFF'),rolePermissions.STAFF);
assert.deepEqual(await permissionsFor('MANAGER'),rolePermissions.MANAGER);
assert.equal((await staffList(staff)).status,403);
assert.equal((await request(app).put('/api/staff/roles/STAFF/permissions').send({permissions:[]})).status,401);
assert.equal((await put('STAFF',[],manager)).status,403);
for(const [role,permissions] of [['ADMIN',[]],['OWNER',[]],['UNKNOWN',[]],['STAFF',['unknown']],['STAFF',['staff.view','staff.view']],['STAFF',['__EMPTY__']]]){
  const response=await put(role,permissions);assert.equal(response.status,400);assert.equal(response.body.error.code,'VALIDATION_ERROR');
}
assert.equal((await request(app).put('/api/staff/roles/STAFF/permissions').set('Cookie',admin).send({permissions:[],extra:true})).status,400);
assert.equal(transactions,0);
let response=await put('STAFF',['staff.view']);assert.equal(response.status,200);
assert.deepEqual(response.body.role.permissions.map(p=>p.key),['staff.view']);
assert.deepEqual((await me(staff)).body.user.permissions,['staff.view']);
assert.equal((await staffList(staff)).status,200);
assert.equal((await put('STAFF',[])).status,200);
assert.deepEqual((await me(staff)).body.user.permissions,[]);
assert.equal((await staffList(staff)).status,403);
assert.deepEqual(rows,[{role:'STAFF',permission:'__EMPTY__'}]);
assert.equal((await me(admin)).body.user.permissions.length,11);
assert.equal((await put('MANAGER',['staff.view','staff.manage'])).status,200);
assert.equal((await put('STAFF',[],manager)).status,403);
assert.equal((await request(app).post('/api/staff').set('Cookie',manager).send({email:'new@example.test',fullName:'Fixture'})).status,201);
assert.equal((await request(app).post('/api/staff').set('Cookie',manager).send({email:'new@example.test',fullName:'Fixture',role:'ADMIN'})).status,403);
assert.equal((await request(app).patch('/api/staff/1').set('Cookie',manager).send({role:'STAFF'})).status,403);
assert.equal((await request(app).patch('/api/staff/1').set('Cookie',admin).send({status:'DISABLED'})).status,403);
people.push({...people[1],id:4,role:'ADMIN'});
// Simulate a stale actor to exercise the last-Admin guard independently of self-protection.
const { update } = await import('../server/src/services/staffService.ts');
people[3].status='DISABLED';
await assert.rejects(update({id:4,role:'ADMIN',permissions:rolePermissions.ADMIN},1,{status:'DISABLED'}),{code:'LAST_ADMIN'});
const before=structuredClone(rows);failInsert=true;
assert.equal((await put('STAFF',['products.view'])).status,500);
assert.deepEqual(rows,before);failInsert=false;
response=await request(app).get('/api/staff/roles').set('Cookie',admin);
assert.deepEqual(response.body.roles.map(r=>r.role),['ADMIN','MANAGER','STAFF']);
assert.equal(response.body.catalog.length,11);
assert.equal(response.body.roles[0].editable,false);
assert(!JSON.stringify(response.body).includes('__EMPTY__'));
await prisma.$disconnect();
console.log('TASK-016 selfcheck PASS: source API + services + model, mocked Prisma; defaults, validation, dynamic sessions/guards, empty permissions, staff rules, transaction rollback.');
