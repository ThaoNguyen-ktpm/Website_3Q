import {afterEach,describe,expect,it,vi} from 'vitest';
vi.mock('../services/catalogStore.js',()=>({catalogStore:{}}));
afterEach(()=>{vi.useRealTimers();vi.unstubAllEnvs();vi.restoreAllMocks();vi.resetModules();});

it('fatal safety logs a redacted cause, interrupts and exits nonzero',async()=>{
 vi.useFakeTimers();vi.stubEnv('SAPO_API_SECRET','fatal-private');
 const log=vi.spyOn(console,'error').mockImplementation(()=>{}),runtime=await import('../sale-ai/runtime.js');
 const interrupt=vi.fn(async()=>{}),exit=vi.fn();
 await runtime.startSaleAi(async()=>({keepCurrent:async()=>{},shutdown:async()=>true,interrupt}));
 await runtime.failSaleAi(Error('token=fatal-private'),exit,50);
 expect(interrupt).toHaveBeenCalledTimes(1);expect(exit).toHaveBeenCalledWith(1);
 expect(JSON.stringify(log.mock.calls)).not.toContain('fatal-private');expect(log.mock.calls[0][0]).toContain('nghiêm trọng');
});
it('fatal safety exits even when recovery hangs',async()=>{
 vi.useFakeTimers();vi.spyOn(console,'error').mockImplementation(()=>{});const runtime=await import('../sale-ai/runtime.js'),exit=vi.fn();
 await runtime.startSaleAi(async()=>({keepCurrent:async()=>{},shutdown:async()=>true,interrupt:()=>new Promise(()=>{})}));
 const failed=runtime.failSaleAi(Error('fatal fixture'),exit,50);await vi.advanceTimersByTimeAsync(50);await failed;expect(exit).toHaveBeenCalledWith(1);
});
describe('TASK-117 Sale AI initialization',()=>{
 it('retries a failed initialization after 15 seconds and becomes available',async()=>{
  vi.useFakeTimers();const log=vi.spyOn(console,'error').mockImplementation(()=>{});
  const runtime=await import('../sale-ai/runtime.js');
  const core={keepCurrent:vi.fn(async()=>{}),shutdown:vi.fn(async()=>true)};
  const initialize=vi.fn().mockRejectedValueOnce(Error('Store busy: writer/maintenance lock exists')).mockResolvedValue(core);
  await runtime.startSaleAi(initialize);expect(runtime.getSaleAi()).toBeUndefined();
  expect(runtime.getSaleAiUnavailableReason()).toContain('đang bị khoá');expect(log.mock.calls[0]?.[0]).toContain('Store busy');
  await vi.advanceTimersByTimeAsync(15000);expect(initialize).toHaveBeenCalledTimes(2);expect(runtime.getSaleAi()).toBe(core);
  await runtime.stopSaleAi();
 });
 it('coalesces starts, cancels retries at shutdown and redacts known secrets',async()=>{
  vi.useFakeTimers();vi.stubEnv('SAPO_API_SECRET','private-fixture-value');
  const log=vi.spyOn(console,'error').mockImplementation(()=>{}),runtime=await import('../sale-ai/runtime.js');
  const initialize=vi.fn().mockRejectedValue(Error('config token=private-fixture-value'));
  await Promise.all([runtime.startSaleAi(initialize),runtime.startSaleAi(initialize)]);expect(initialize).toHaveBeenCalledTimes(1);
  expect(JSON.stringify(log.mock.calls)).not.toContain('private-fixture-value');
  await runtime.stopSaleAi();await vi.advanceTimersByTimeAsync(45000);expect(initialize).toHaveBeenCalledTimes(1);
 });
});
