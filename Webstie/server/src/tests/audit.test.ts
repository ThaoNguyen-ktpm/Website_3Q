import { createHmac } from 'node:crypto';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { app } from '../app.js';
import { prisma } from '../models/prisma.js';
import { createSession } from '../services/authService.js';
import * as audit from '../services/auditService.js';
import { allPermissions, rolePermissions } from '../config/permissions.js';

vi.mock('../config/env.js', () => ({ env: { APP_ORIGIN:'http://localhost:8787', SESSION_SECRET:'test-audit-secret-at-least-32-characters' } }));
vi.mock('../models/prisma.js', () => ({ prisma: {
  auditLog: { create:vi.fn(),findMany:vi.fn(),count:vi.fn(),deleteMany:vi.fn() },
  $transaction:vi.fn(async values => Promise.all(values)),
} }));
vi.mock('../models/staffModel.js', () => ({ findById:vi.fn() }));
vi.mock('../models/rolePermissionModel.js', () => ({ list:vi.fn(async()=>[]) }));
import * as staff from '../models/staffModel.js';
const actor={id:1,email:'admin@example.test',fullName:'Admin',role:'ADMIN',status:'ACTIVE',customPermissions:false,permissions:[]};
const item={id:3,actorId:1,actorEmail:actor.email,action:'staff.update',createdAt:new Date('2026-10-16T00:00:00Z'),before:{fullName:'Old'},after:{fullName:'New'},targetType:'staff',targetId:'2',ip:'127.0.0.1'};
function cookie() {
  const value=createSession(1);
  const signature=createHmac('sha256','test-audit-secret-at-least-32-characters').update(value).digest('base64').replace(/=+$/,'');
  return `sid=${encodeURIComponent(`s:${value}.${signature}`)}`;
}
const get=(query='')=>request(app).get(`/api/audit-logs${query}`).set('Cookie',cookie());
beforeEach(()=>{
  vi.clearAllMocks();
  vi.mocked(staff.findById).mockResolvedValue(actor as Awaited<ReturnType<typeof staff.findById>>);
  vi.mocked(prisma.auditLog.findMany).mockResolvedValue([item]);
  vi.mocked(prisma.auditLog.count).mockResolvedValue(55);
  vi.mocked(prisma.auditLog.deleteMany).mockResolvedValue({count:2});
});
afterEach(()=>{vi.useRealTimers();vi.restoreAllMocks()});
describe('Audit API',()=>{
  it('requires a session before reading logs',async()=>{
    expect((await request(app).get('/api/audit-logs')).status).toBe(401);
    expect(prisma.auditLog.findMany).not.toHaveBeenCalled();
  });
  it.each(['STAFF','MANAGER'])('denies %s by default',async role=>{
    vi.mocked(staff.findById).mockResolvedValue({...actor,role} as Awaited<ReturnType<typeof staff.findById>>);
    expect((await get()).status).toBe(403);
    expect(prisma.auditLog.findMany).not.toHaveBeenCalled();
    expect(rolePermissions[role as 'STAFF'|'MANAGER']).not.toContain('audit.view');
    expect(allPermissions).toContain('audit.view');
  });
  it('honors an explicit audit grant without requiring staff.view',async()=>{
    vi.mocked(staff.findById).mockResolvedValue({...actor,role:'STAFF',customPermissions:true,permissions:[{permission:'audit.view'}]} as Awaited<ReturnType<typeof staff.findById>>);
    expect((await get()).status).toBe(200);
  });
  it('uses safe defaults and Vietnamese action labels',async()=>{
    const response=await get();
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({total:55,page:1,pageSize:25,items:[{id:3,actionLabel:'Sửa nhân viên'}]});
    expect(prisma.auditLog.findMany).toHaveBeenCalledWith({where:{},orderBy:[{createdAt:'desc'},{id:'desc'}],skip:0,take:25});
  });
  it('filters and paginates through the database',async()=>{
    const response=await get('?action=staff.update&actorId=1&page=3&pageSize=10');
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({page:3,pageSize:10});
    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(expect.objectContaining({where:{action:'staff.update',actorId:1},skip:20,take:10}));
    expect(prisma.auditLog.count).toHaveBeenCalledWith({where:{action:'staff.update',actorId:1}});
  });
  it.each(['pageSize=101','pageSize=0','page=0','page=1.2','page=1e2','actorId=-1','actorId=x','action=unknown','extra=x','action=auth.login&action=auth.logout','page=2147483647&pageSize=100','page=','actorId='])('rejects invalid strict query: %s',async query=>{
    expect((await get(`?${query}`)).status).toBe(400);
    expect(prisma.auditLog.findMany).not.toHaveBeenCalled();
  });
  it('accepts maximum page size and returns an empty page',async()=>{
    vi.mocked(prisma.auditLog.findMany).mockResolvedValue([]);
    expect((await get('?pageSize=100')).body).toMatchObject({items:[],pageSize:100});
  });
  it('returns a safe server error on database read failure',async()=>{
    vi.mocked(prisma.auditLog.findMany).mockRejectedValueOnce(new Error('private connection string'));
    const response=await get();
    expect(response.status).toBe(500);
    expect(response.body.error.code).toBe('INTERNAL_ERROR');
    expect(JSON.stringify(response.body)).not.toContain('private');
  });
});
describe('Audit safety and retention',()=>{
  it('drops sensitive keys and nested objects from snapshots',async()=>{
    await audit.record({actor:{id:1,email:actor.email},action:'staff.create',before:{token:'secret',cookie:'secret',googleSub:'secret'},after:{email:actor.email,fullName:'Name',permissions:['products.view'],googleSub:'secret',nested:{token:'secret'},phone:{cookie:'secret'}}});
    expect(prisma.auditLog.create).toHaveBeenCalledWith({data:expect.objectContaining({before:{},after:{email:actor.email,fullName:'Name',permissions:['products.view']}})});
    expect(JSON.stringify(vi.mocked(prisma.auditLog.create).mock.calls)).not.toContain('secret');
  });
  it('serializes safe staff timestamps in a creation snapshot',async()=>{
    const createdAt=new Date('2026-10-16T05:00:00Z');
    await audit.record({action:'staff.create',after:{createdAt,updatedAt:createdAt,lastLoginAt:null}});
    expect(prisma.auditLog.create).toHaveBeenCalledWith({data:expect.objectContaining({after:{createdAt:createdAt.toISOString(),updatedAt:createdAt.toISOString(),lastLoginAt:null}})});
  });
  it('deletes strictly older than the exact retention boundary',async()=>{
    vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-16T05:00:00Z'));
    await expect(audit.purgeOlderThan(365)).resolves.toEqual({count:2});
    expect(prisma.auditLog.deleteMany).toHaveBeenCalledWith({where:{createdAt:{lt:new Date('2025-10-16T05:00:00Z')}}});
  });
  it('purges at startup and every 24 hours with configured days',async()=>{
    vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-16T05:00:00Z'));
    const timer=audit.startRetention(30);
    expect(prisma.auditLog.deleteMany).toHaveBeenCalledTimes(1);
    expect(prisma.auditLog.deleteMany).toHaveBeenLastCalledWith({where:{createdAt:{lt:new Date('2026-09-16T05:00:00Z')}}});
    await vi.advanceTimersByTimeAsync(86400000);
    expect(prisma.auditLog.deleteMany).toHaveBeenCalledTimes(2);
    clearInterval(timer);
  });
  it('continues scheduled cleanup after a failure without exposing database errors',async()=>{
    vi.useFakeTimers();const error=vi.spyOn(console,'error').mockImplementation(()=>{});
    vi.mocked(prisma.auditLog.deleteMany).mockRejectedValueOnce(new Error('private connection string'));
    const timer=audit.startRetention();await vi.advanceTimersByTimeAsync(86400000);
    expect(prisma.auditLog.deleteMany).toHaveBeenCalledTimes(2);
    expect(error).toHaveBeenCalledExactlyOnceWith('Không thể dọn nhật ký thao tác cũ.');
    clearInterval(timer);
  });
  it.each([0,-1,1.5,NaN])('rejects unsafe retention %s',async days=>{
    await expect(audit.purgeOlderThan(days)).rejects.toThrow();
    expect(prisma.auditLog.deleteMany).not.toHaveBeenCalled();
  });
});
