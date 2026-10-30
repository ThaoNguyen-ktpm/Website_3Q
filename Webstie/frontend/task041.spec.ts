import {test,expect,type Page} from '@playwright/test';
import {allowedPage} from './src/access';
import {linkCode} from './src/login-link';
import {rolePermissions} from '../server/src/config/permissions';

// Test-only API fixtures: these checks do not claim real Google, Anthropic or staff data.
const user=(role='STAFF',permissions=['products.view'])=>({id:42,email:'fixture@example.test',fullName:'Tài khoản kiểm thử',role,roleLabel:role,permissions,isPrimaryAdmin:false});
async function mockApi(page:Page,who:ReturnType<typeof user>|null){
 await page.route(url=>url.pathname.startsWith('/api/'),route=>{
  const path=new URL(route.request().url()).pathname;
  if(path==='/api/auth/me')return route.fulfill({json:{user:who}});
  if(path==='/api/auth/config')return route.fulfill({json:{googleClientId:'test-only'}});
  return route.fulfill({status:403,json:{error:{message:'Test fixture: không có quyền'}}});
 });
 await page.route('https://accounts.google.com/**',route=>route.abort());
}

test('public deep links ask for login, close resets portal, workspace is not requested',async({page})=>{
 await mockApi(page,null);
 const workspace:string[]=[];page.on('request',r=>{if(r.url().includes('/src/workspace'))workspace.push(r.url())});
 await page.goto('/#page=overview');
 await expect(page.getByRole('dialog',{name:'Đăng nhập'})).toBeVisible();
 await expect(page.locator('.rows')).toHaveCount(0);
 await page.getByRole('button',{name:'Đóng',exact:true}).click();
 await expect(page).toHaveURL(/#page=portal$/);
 await expect(page.getByRole('dialog',{name:'Đăng nhập'})).not.toBeVisible();
 await page.evaluate(()=>location.hash='page=team');
 await expect(page.getByRole('dialog',{name:'Đăng nhập'})).toBeVisible();
 await page.keyboard.press('Escape');
 await expect(page).toHaveURL(/#page=portal$/);
 expect(workspace).toEqual([]);
});

test('malformed recent storage cannot crash the workspace or inject pages',async({page})=>{
 await mockApi(page,user());
 await page.addInitScript(()=>localStorage.setItem('baoq-recent',JSON.stringify([null,{page:'search',label:{bad:true},at:'bad'},{page:'bogus',label:'Forbidden fixture',at:'2026-10-29'},{page:'audit',label:'Nhật ký',at:'2026-10-29'}])));
 await page.goto('/');
 await expect(page.locator('.acct')).toBeVisible();
 await expect(page.getByText('Forbidden fixture')).toHaveCount(0);
 await expect(page.locator('#recent-h').locator('..').getByRole('link')).toHaveCount(0);
});

test('unknown staff route never shows admin report navigation',async({page})=>{
 await mockApi(page,user());await page.goto('/#page=bogus');
 await expect(page.getByText('Bạn chưa có quyền xem mục này')).toBeVisible();
 await expect(page.locator('.ops-side').getByText('Tổng quan điều hành',{exact:true})).toHaveCount(0);
 await expect(page.locator('.ops-tabs').getByText('Chi phí',{exact:true})).toHaveCount(0);
});

test('late signed-out me response cannot overwrite a successful link login',async({page})=>{
 await mockApi(page,null);
 let release!:()=>void;const gate=new Promise<void>(resolve=>release=resolve);
 await page.route('**/api/auth/me',async route=>{await gate;await route.fulfill({status:401,json:{user:null}})});
 await page.route('**/api/auth/link',route=>route.fulfill({json:{user:user()}}));
 await page.goto('/?ma='+'x'.repeat(32));
 await expect(page.locator('.acct')).toBeVisible();
 const response=page.waitForResponse('**/api/auth/me');release();await response;
 await expect(page.getByRole('dialog',{name:'Đăng nhập'})).not.toBeVisible();
 await expect(page.locator('.acct')).toBeVisible();
});

test('Google finishing loading cannot unlock an in-flight link request',async({page})=>{
 await mockApi(page,null);
 await page.addInitScript(()=>{(window as any).google={accounts:{id:{initialize(){},renderButton(el:HTMLElement){el.textContent='Google test button'}}}}});
 let ready!:()=>void;const gate=new Promise<void>(resolve=>ready=resolve);
 await page.route('**/api/auth/config',async route=>{await gate;await route.fulfill({json:{googleClientId:'test-only'}})});
 let finish!:()=>void;const linkGate=new Promise<void>(resolve=>finish=resolve);
 await page.route('**/api/auth/link',async route=>{await linkGate;await route.fulfill({status:401,json:{error:{message:'Mã không hợp lệ'}}})});
 await page.goto('/#page=team');
 await page.getByLabel('Đăng nhập bằng link',{exact:true}).fill('x'.repeat(32));
 await page.getByRole('button',{name:'Vào',exact:true}).click();
 ready();await expect(page.locator('.login-google')).toHaveText('Google test button');
 await expect(page.getByRole('button',{name:'Vào',exact:true})).toBeDisabled();
 await expect(page.locator('.login-google')).toHaveAttribute('inert','');
 finish();await expect(page.getByRole('alert')).toContainText('Mã không hợp lệ');
 await expect(page.locator('.login-google')).toBeVisible();
});

for(const role of ['ADMIN','MANAGER','STAFF'] as const){
 test(`page permissions match actual defaults for ${role}`,()=>{
  const actor={role,permissions:rolePermissions[role]};
  const expected:Record<string,boolean>={portal:true,tasks:true,policy:true,search:true,sale:role==='ADMIN',team:role!=='STAFF',audit:role==='ADMIN'};
  for(const target of ['overview','transactions','inventory','errors','costs','reconcile','consignment','cash','close','settings'])expected[target]=role==='ADMIN';
  for(const [target,permitted] of Object.entries(expected))expect(allowedPage(actor,target),target).toBe(permitted);
  for(const target of ['bogus','constructor','__proto__','toString',''])expect(allowedPage(actor,target),target).toBe(false);
 });
 test(`menu, recent, demo session and BossTele respect ${role}`,async({page})=>{
  await mockApi(page,user(role,rolePermissions[role]));
  await page.addInitScript(()=>localStorage.setItem('baoq-recent',JSON.stringify(['sale','search','audit','overview'].map(target=>({page:target,label:target,at:'2026-10-29T10:00:00Z'})))));
  await page.goto('/');await expect(page.locator('.acct')).toBeVisible();
  const recent=page.locator('#recent-h').locator('..');
  if(role==='ADMIN'){
   await expect(recent.getByRole('link')).toHaveCount(3);
   await expect(page.getByRole('link',{name:'Hỏi BossTele trên Telegram'})).toBeVisible();
   await expect.poll(()=>page.evaluate(()=>sessionStorage.getItem('baoq-ui-persona'))).toBe('ceo');
  }else{
   await expect(recent.getByRole('link')).toHaveCount(1);
   await expect(recent.getByRole('link')).toHaveAttribute('href','#page=search');
   await expect(page.getByRole('link',{name:'Hỏi BossTele trên Telegram'})).toHaveCount(0);
   expect(await page.evaluate(()=>sessionStorage.getItem('baoq-ui-persona'))).toBeNull();
  }
  await page.locator('.apps-trigger').click();
  const menu=page.locator('#apps-menu');
  await expect(menu.getByRole('button',{name:'Điều hành',exact:true})).toHaveCount(role==='STAFF'?0:1);
  await expect(menu.getByRole('button',{name:'Price System',exact:true})).toHaveCount(role==='ADMIN'?1:0);
  await expect(menu.getByRole('button',{name:'Tìm kiếm sản phẩm',exact:true})).toHaveCount(role==='ADMIN'?0:1);
  await page.keyboard.press('Escape');
  await page.setViewportSize({width:390,height:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:test.info().outputPath(`${role}-mobile.png`),fullPage:true});
 });
}

test('custom permissions override role defaults for real pages only',()=>{
 const actor={role:'STAFF',permissions:['sale.manage','audit.view']};
 expect(allowedPage(actor,'sale')).toBe(true);expect(allowedPage(actor,'audit')).toBe(true);
 expect(allowedPage(actor,'search')).toBe(false);expect(allowedPage(actor,'overview')).toBe(false);
 expect(allowedPage({role:'ADMIN',permissions:[]},'search')).toBe(false);
});

test('linkCode accepts full links, bare codes and reports links without ma',()=>{
 const code='Abc_-123';
 expect(linkCode(` http://localhost:8787/dang-nhap?ma=${code} `)).toBe(code);
 expect(linkCode(`http://192.168.1.20:8787/dang-nhap?ma=${code}`)).toBe(code);
 expect(linkCode(' '+code+' ')).toBe(code);
 for(const value of ['','  ','http://localhost:8787/','http://localhost:8787/?ma='])expect(linkCode(value)).toBe('');
});

test('pasted URL without a code gives a clear error without calling auth',async({page})=>{
 await mockApi(page,null);let calls=0;
 await page.route('**/api/auth/link',route=>{calls++;return route.abort()});
 await page.goto('/#page=team');
 await page.getByLabel('Đăng nhập bằng link',{exact:true}).fill('http://localhost:8787/');
 await page.getByRole('button',{name:'Vào',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('Link này không có mã đăng nhập');expect(calls).toBe(0);
 await expect(page.locator('.login-google')).toHaveCount(1);
});

test('assistant retries, aborts on navigation, and limits input to 2000 characters',async({page})=>{
 await mockApi(page,user());let calls=0;const bodies:any[]=[];
 let pending!:()=>void;const gate=new Promise<void>(resolve=>pending=resolve);
 await page.route('**/api/assistant/chat',async route=>{
  calls++;bodies.push(route.request().postDataJSON());
  if(calls===1)return route.fulfill({status:503,json:{error:{message:'Test fixture: lỗi tạm thời'}}});
  if(calls===3)await gate;
  return route.fulfill({json:{reply:calls===3?'Test fixture: trả lời đã hủy':'Test fixture: trả lời thành công',sources:[]}}).catch(()=>{});
 });
 await page.goto('/');await page.getByRole('button',{name:'Mở trợ lý',exact:true}).click();
 const input=page.getByLabel('Câu hỏi cho Trợ lý BaoQ');
 await expect(input).toHaveAttribute('maxlength','2000');
 await input.fill('Câu hỏi kiểm thử');await page.getByRole('button',{name:'Gửi câu hỏi',exact:true}).click();
 await expect(page.getByText('Test fixture: lỗi tạm thời')).toBeVisible();
 await page.getByRole('button',{name:'Thử lại',exact:true}).click();
 await expect(page.getByText('Test fixture: trả lời thành công')).toBeVisible();
 expect(bodies[0]).toEqual(bodies[1]);expect(bodies[1].messages).toHaveLength(1);
 await input.fill('Câu hỏi bị hủy');await page.getByRole('button',{name:'Gửi câu hỏi',exact:true}).click();
 await expect.poll(()=>calls).toBe(3);
 await page.evaluate(()=>location.hash='page=policy');
 await expect(page.getByText('Đang trả lời…',{exact:true})).toHaveCount(0);
 pending();await expect(page.getByText('Test fixture: trả lời đã hủy')).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Tiếp tục câu hỏi',exact:true})).toBeVisible();
});
