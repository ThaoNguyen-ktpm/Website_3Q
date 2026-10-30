import { createHmac } from 'node:crypto';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { app } from '../app.js';
import { createSession } from '../services/authService.js';
import * as model from '../models/staffModel.js';
import * as service from '../services/staffService.js';
import * as permissionModel from '../models/rolePermissionModel.js';
import { allPermissions, hiddenPermissions, rolePermissions } from '../config/permissions.js';
import * as auditModel from '../models/auditLogModel.js';
vi.mock('../models/auditLogModel.js', () => ({ create: vi.fn(async () => ({})), list: vi.fn(), deleteBefore: vi.fn() }));

vi.mock('../config/env.js', () => ({env:{APP_ORIGIN:'http://localhost:8787',SESSION_SECRET:'test-staff-secret-at-least-32-characters'}}));
vi.mock('../models/rolePermissionModel.js', () => ({ list: vi.fn(async () => []) }));
vi.mock('../models/staffModel.js', () => ({
  findById:vi.fn(), findByEmail:vi.fn(), list:vi.fn(), create:vi.fn(), update:vi.fn(),
  countActiveAdmins:vi.fn(), transaction:vi.fn(action=>action({})),
}));
const owner = {id:1,email:'owner@example.test',fullName:'Chủ mẫu',role:'ADMIN',status:'ACTIVE',googleSub:'private-sub',phone:null,lastLoginAt:null,customPermissions:false,permissions:[] as {permission:string}[]};
const member = {...owner,id:2,email:'sales@example.test',role:'STAFF',googleSub:null};
const draft = {email:' New@Example.Test ',fullName:' Nhân viên mới ',phone:'+84 123',role:'STAFF',status:'ACTIVE'};
let actor = {...owner};
let savedPermissions = new Map<string, string[]>();
function cookie() {
 const value=createSession(actor.id);
 const signature=createHmac('sha256','test-staff-secret-at-least-32-characters').update(value).digest('base64').replace(/=+$/,'');
 return `sid=${encodeURIComponent(`s:${value}.${signature}`)}`;
}
const post = (body:unknown=draft)=>request(app).post('/api/staff').set('Origin', 'http://localhost:8787').set('Cookie',cookie()).send(body);
const patch = (body:unknown,id=2)=>request(app).patch(`/api/staff/${id}`).set('Origin', 'http://localhost:8787').set('Cookie',cookie()).send(body);
beforeEach(()=>{
 vi.clearAllMocks();actor={...owner};
 savedPermissions = new Map();
 vi.mocked(permissionModel.list).mockImplementation(async role =>
  (savedPermissions.get(role) ?? []).map(permission => ({role,permission,createdAt:new Date()})));
 vi.mocked(model.findById).mockImplementation(async id => (id===actor.id?actor:id===2?member:null) as Awaited<ReturnType<typeof model.findById>>);
 vi.mocked(model.findByEmail).mockResolvedValue(null);
 vi.mocked(model.list).mockResolvedValue([owner,member] as Awaited<ReturnType<typeof model.list>>);
 vi.mocked(model.create).mockImplementation(async data=>({...member,...data,permissions:(data.permissions?.create as {permission:string}[])??[],email:String(data.email).trim().toLowerCase()}) as Awaited<ReturnType<typeof model.create>>);
 vi.mocked(model.update).mockImplementation(async (id,data)=>({...member,id,...data,permissions:(data.permissions?.create as {permission:string}[])??member.permissions}) as Awaited<ReturnType<typeof model.update>>);
 vi.mocked(model.countActiveAdmins).mockResolvedValue(2);
});
describe('Staff API and permissions',()=>{
 it('records a safe created staff snapshot with permissions and request IP', async () => {
  expect((await post()).status).toBe(201);
  expect(auditModel.create).toHaveBeenCalledWith(expect.objectContaining({ action:'staff.create',actorId:1,actorEmail:owner.email,targetType:'staff',targetId:'2',ip:expect.any(String),after:expect.objectContaining({email:'new@example.test',permissions:rolePermissions.STAFF}) }));
  expect(JSON.stringify(vi.mocked(auditModel.create).mock.calls)).not.toMatch(/googleSub|private-sub|cookie|token/i);
 });
 it('records only changed fields and effective permissions in before/after', async () => {
  expect((await patch({fullName:'Changed',permissions:['products.view']})).status).toBe(200);
  expect(auditModel.create).toHaveBeenCalledWith(expect.objectContaining({action:'staff.update',targetId:'2',before:{fullName:member.fullName,customPermissions:false,permissions:rolePermissions.STAFF},after:{fullName:'Changed',customPermissions:true,permissions:['products.view']}}));
 });
 it('records empty changes for a no-op without leaking untouched fields', async () => {
  expect((await patch({fullName:member.fullName})).status).toBe(200);
  expect(auditModel.create).toHaveBeenCalledWith(expect.objectContaining({before:{},after:{}}));
 });
 it('does not roll back staff writes on audit failure', async () => {
  const error=vi.spyOn(console,'error').mockImplementation(()=>{});
  vi.mocked(auditModel.create).mockRejectedValueOnce(new Error('private-sub'));
  expect((await post()).status).toBe(201);
  vi.mocked(auditModel.create).mockRejectedValueOnce(new Error('private-sub'));
  expect((await patch({fullName:'Changed'})).status).toBe(200);
  expect(error.mock.calls.flat().join(' ')).not.toContain('private-sub');
  error.mockRestore();
 });
 it('does not record an operation that failed or was denied', async () => {
  expect((await post({...draft,unknown:true})).status).toBe(400);
  vi.mocked(model.update).mockRejectedValueOnce(new Error('fixture failure'));
  expect((await patch({fullName:'Changed'})).status).toBe(500);
  expect(auditModel.create).not.toHaveBeenCalled();
 });
 it.each([['get','/api/staff'],['get','/api/staff/roles'],['post','/api/staff'],['patch','/api/staff/2']])('requires authentication: %s %s',async(method,url)=>{
  const response=await request(app)[method as 'get'](url).set('Origin', 'http://localhost:8787');
  expect(response.status).toBe(401);expect(model.list).not.toHaveBeenCalled();expect(model.create).not.toHaveBeenCalled();expect(model.update).not.toHaveBeenCalled();
 });
 it.each(['STAFF'])('denies staff endpoints to %s',async role=>{
  actor.role=role;
  for(const url of ['/api/staff','/api/staff/roles'])expect((await request(app).get(url).set('Cookie',cookie())).status).toBe(403);
  expect((await post()).status).toBe(403);expect((await patch({fullName:'Tên mới'})).status).toBe(403);
  expect(model.list).not.toHaveBeenCalled();expect(model.create).not.toHaveBeenCalled();expect(model.update).not.toHaveBeenCalled();
 });
 it('allows manager to view staff and roles but not write',async()=>{
  actor.role='MANAGER';
  const response=await request(app).get('/api/staff').set('Cookie',cookie());
  expect(response.status).toBe(200);expect(response.body.staff[0].roleLabel).toBe('Admin');
  expect(JSON.stringify(response.body)).not.toContain('googleSub');
  const options=await request(app).get('/api/staff/roles').set('Cookie',cookie());
  expect(options.body.roles.map((role: { role: string })=>role.role)).toEqual(['ADMIN','MANAGER','STAFF']);expect(options.body.catalog.map((item: { key: string }) => item.key)).toEqual(allPermissions.filter(key => !hiddenPermissions.includes(key)));
  expect((await post()).status).toBe(403);expect((await patch({status:'DISABLED'})).status).toBe(403);
 });
 it('creates with normalized email/name and safe response',async()=>{
  const response=await post();expect(response.status).toBe(201);
  expect(vi.mocked(model.create).mock.calls[0][0]).toMatchObject({...draft,email:'new@example.test',fullName:'Nhân viên mới',customPermissions:false});
  expect(response.body.staff.email).toBe('new@example.test');expect(response.body.staff.googleSub).toBeUndefined();
 });
 it('defaults to active sales',async()=>{
  expect((await post({email:'new@example.test',fullName:'Mới'})).status).toBe(201);
  expect(vi.mocked(model.create).mock.calls[0][0]).toMatchObject({email:'new@example.test',fullName:'Mới',role:'STAFF',status:'ACTIVE',customPermissions:false});
 });
 it('returns 409 for an existing email and a concurrent unique violation',async()=>{
  vi.mocked(model.findByEmail).mockResolvedValue(member as Awaited<ReturnType<typeof model.findByEmail>>);
  expect((await post()).body.error.code).toBe('EMAIL_EXISTS');expect(model.create).not.toHaveBeenCalled();
  vi.mocked(model.findByEmail).mockResolvedValue(null);vi.mocked(model.create).mockRejectedValue({code:'P2002'});
  const response=await post();expect(response.status).toBe(409);expect(response.body.error.code).toBe('EMAIL_EXISTS');
 });
 it('allows owner to assign ADMIN and update staff',async()=>{
  expect((await post({...draft,role:'ADMIN'})).status).toBe(201);
  expect((await patch({role:'ADMIN',status:'DISABLED'})).status).toBe(200);
 });
 it('only ADMIN can assign or remove ADMIN even if staff.manage is provided',async()=>{
  const manager={id:3,role:'MANAGER' as const,permissions:[...rolePermissions.ADMIN]};
  await expect(service.create(manager,{...draft,role:'ADMIN'})).rejects.toMatchObject({statusCode:403});
  await expect(service.update(manager,1,{role:'STAFF'})).rejects.toMatchObject({statusCode:403});
 });
 it.each([{role:'MANAGER'},{status:'DISABLED'}])('rejects self-demotion/suspension: %j',async body=>{
  expect((await patch(body,1)).status).toBe(403);expect(model.update).not.toHaveBeenCalled();
 });
 it('allows own name changes',async()=>{expect((await patch({fullName:'Chủ mới'},1)).status).toBe(200)});
 it.each([{role:'STAFF'},{status:'DISABLED'}])('preserves last active owner: %j',async body=>{
  vi.mocked(model.findById).mockImplementation(async id=>(id===1?actor:{...owner,id:2}) as Awaited<ReturnType<typeof model.findById>>);
  vi.mocked(model.countActiveAdmins).mockResolvedValue(1);
  const response=await patch(body);expect(response.status).toBe(409);expect(response.body.error.code).toBe('LAST_ADMIN');expect(model.update).not.toHaveBeenCalled();
 });
 it('allows deactivating another owner when two remain',async()=>{
  vi.mocked(model.findById).mockImplementation(async id=>({...owner,id}) as Awaited<ReturnType<typeof model.findById>>);
  expect((await patch({status:'DISABLED'})).status).toBe(200);expect(model.countActiveAdmins).toHaveBeenCalledWith({});
 });
 it('returns 404 for missing staff',async()=>{expect((await patch({fullName:'Mới'},99)).status).toBe(404)});
 it('keeps email immutable',async()=>{expect((await patch({email:'other@example.test'})).status).toBe(400)});
 it.each([{}, {extra:true}, {email:'bad',fullName:'Name'}, {...draft,fullName:' '}, {...draft,fullName:'x'.repeat(121)}, {...draft,email:'x'.repeat(192)+'@example.test'}, {...draft,phone:'012abc'}, {...draft,phone:'1'.repeat(21)}, {...draft,role:'OWNER'}, {...draft,status:'UNKNOWN'}, {...draft,googleSub:'injected'}])('validates strict create body %j',async body=>{
  expect((await post(body)).status).toBe(400);expect(model.create).not.toHaveBeenCalled();
 });
 it.each([{}, {role:'OWNER'}, {phone:'abc'}, {fullName:''}, {permissions:['unknown']}])('validates strict patch body %j',async body=>{expect((await patch(body)).status).toBe(400)});
 it.each(['abc','0','-1','1.2','9007199254740992'])('rejects invalid id %s',async id=>{expect((await request(app).patch(`/api/staff/${id}`).set('Origin', 'http://localhost:8787').set('Cookie',cookie()).send({fullName:'Mới'})).status).toBe(400)});
});

describe('Per-staff permissions', () => {
 it('creates custom permissions and reports effective keys', async () => {
  const response=await post({...draft,permissions:['products.view']});
  expect(response.status).toBe(201);expect(response.body.staff).toMatchObject({customPermissions:true,permissions:['products.view']});
 });
 it('normalizes the role template regardless of order', async () => {
  const response=await post({...draft,permissions:[...rolePermissions.STAFF].reverse()});
  expect(response.body.staff.customPermissions).toBe(false);
  expect(model.create).toHaveBeenCalledWith(expect.objectContaining({permissions:{create:[]}}),{});
 });
 it.each([null,undefined])('uses role defaults for %s', async permissions => {
  const response=await post({...draft,permissions});expect(response.status).toBe(201);
  expect(response.body.staff.customPermissions).toBe(false);
 });
 it('preserves an explicitly empty custom set', async () => {
  const response=await post({...draft,permissions:[]});
  expect(response.body.staff).toMatchObject({customPermissions:true,permissions:[]});
 });
 it('resets custom permissions on role change without a permissions field', async () => {
  const response=await patch({role:'MANAGER'});expect(response.status).toBe(200);
  expect(model.update).toHaveBeenCalledWith(2,expect.objectContaining({customPermissions:false,permissions:{deleteMany:{},create:[]}}),{});
 });
 it('keeps custom permissions on an unrelated edit', async () => {
  await patch({fullName:'Updated'});
  expect(model.update).toHaveBeenCalledWith(2,{fullName:'Updated'},{});
 });
 it.each([[],null,['products.view']])('rejects own permission edits: %j', async permissions => {
  const response=await patch({permissions},1);expect(response.status).toBe(403);expect(response.body.error.code).toBe('FORBIDDEN');
 });
 it('rejects grants outside the actor permissions including default-role grants', async () => {
  const manager={id:3,role:'MANAGER' as const,permissions:['staff.manage'] as const};
  const limited={...manager,permissions:[...manager.permissions]};
  await expect(service.create(limited,{...draft,permissions:['products.edit']})).rejects.toMatchObject({statusCode:403});
  await expect(service.create(limited,draft)).rejects.toMatchObject({statusCode:403});
  await expect(service.update(limited,2,{permissions:null})).rejects.toMatchObject({statusCode:403});
 });
 it('allows a limited manager to grant only owned keys', async () => {
  const response=await service.create({id:3,role:'MANAGER',permissions:['staff.manage','products.view']},{...draft,permissions:['products.view']});
  expect(response.permissions).toEqual(['products.view']);
 });
 it('ignores valid permission input for ADMIN', async () => {
  const response=await post({...draft,role:'ADMIN',permissions:[]});
  expect(response.body.staff.customPermissions).toBe(false);expect(response.body.staff.permissions).toEqual(rolePermissions.ADMIN);
 });
 it.each([['unknown'],['staff.view','staff.view'],[12],'staff.view'])('rejects invalid permission input %j', async permissions => {
  expect((await post({...draft,permissions})).status).toBe(400);
  expect((await patch({permissions})).status).toBe(400);
 });
 it('changes /me and requirePermission immediately, without affecting peers', async () => {
  const other={...member,id:4};let current={...member};
  vi.mocked(model.findById).mockImplementation(async id=>(id===1?owner:id===2?current:other) as Awaited<ReturnType<typeof model.findById>>);
  vi.mocked(model.update).mockImplementation(async (id,data)=>{
   current={...current,...data,permissions:(data.permissions?.create as {permission:string}[])??current.permissions} as typeof current;
   return current as Awaited<ReturnType<typeof model.update>>;
  });
  actor={...member};const staffCookie=cookie();actor={...owner};
  expect((await request(app).get('/api/staff').set('Cookie',staffCookie)).status).toBe(403);
  expect((await patch({permissions:['staff.view']})).status).toBe(200);
  expect((await request(app).get('/api/auth/me').set('Cookie',staffCookie)).body.user.permissions).toEqual(['staff.view']);
  expect((await request(app).get('/api/staff').set('Cookie',staffCookie)).status).toBe(200);
  expect((await patch({permissions:[]})).status).toBe(200);
  expect((await request(app).get('/api/auth/me').set('Cookie',staffCookie)).body.user.permissions).toEqual([]);
  expect((await request(app).get('/api/staff').set('Cookie',staffCookie)).status).toBe(403);
  const {permissionsFor}=await import('../services/permissionService.js');
  expect(await permissionsFor(other)).toEqual(rolePermissions.STAFF);
 });
 it('removes the role permission write route', async () => {
  expect((await request(app).put('/api/staff/roles/STAFF/permissions').set('Origin', 'http://localhost:8787').set('Cookie',cookie()).send({permissions:[]})).status).toBe(404);
 });
 it('propagates failed writes', async () => {
  vi.mocked(model.update).mockRejectedValueOnce(new Error('fixture failure'));
  expect((await patch({permissions:[]})).status).toBe(500);
 });
});
