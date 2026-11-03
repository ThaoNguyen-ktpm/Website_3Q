import {readFile} from 'node:fs/promises';
import {test,expect,type Page} from '@playwright/test';
import {allowedPage} from './src/access';
import {linkCode} from './src/login-link';
import {rolePermissions} from '../server/src/config/permissions';
import {V2_OVERVIEW} from './src/apps';

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
  for(const target of ['overview','transactions','inventory','errors','costs','reconcile','consignment','cash','close','settings','v2-dashboard','v2-tx','v2-inventory','v2-checks','v2-costs','v2-goods','v2-kpi','v2-reconcile','v2-consignment','v2-cash','v2-close','v2-settings'])expected[target]=role==='ADMIN';
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
   expect(await page.evaluate(()=>sessionStorage.getItem('baoq-ui-persona'))).toBeNull();
  }else{
   await expect(recent.getByRole('link')).toHaveCount(1);
   await expect(recent.getByRole('link')).toHaveAttribute('href','#page=search');
   await expect(page.getByRole('link',{name:'Hỏi BossTele trên Telegram'})).toHaveCount(0);
   expect(await page.evaluate(()=>sessionStorage.getItem('baoq-ui-persona'))).toBeNull();
  }
  await page.locator('.apps-trigger').click();
  const menu=page.locator('#apps-menu');
  // TASK-132: Admin opens embedded V2; Manager retains the in-app management button.
  await expect(menu.getByRole('button',{name:'Điều hành',exact:true})).toHaveCount(role==='MANAGER'?1:0);
  await expect(menu.getByRole('link',{name:'Điều hành',exact:true})).toHaveCount(role==='ADMIN'?1:0);
  if(role==='ADMIN'){
   await expect(page.locator('.app-tile').filter({hasText:'Điều hành'})).toHaveAttribute('href',V2_OVERVIEW);
   await expect(menu.getByRole('link',{name:'Điều hành',exact:true})).toHaveAttribute('href',V2_OVERVIEW);
   await page.getByRole('button',{name:'Mở mục con của Điều hành',exact:true}).click();
   const submenu=page.getByRole('navigation',{name:'Mục con Điều hành',exact:true});
   await expect(submenu.getByRole('link',{name:'Tổng quan',exact:true})).toHaveAttribute('href',V2_OVERVIEW);
   await expect(submenu.getByRole('button',{name:'Tổng quan cũ (demo)',exact:true})).toHaveCount(0);
   await expect(submenu.getByRole('link',{name:'KPI Sale',exact:true})).toBeVisible();
   await page.keyboard.press('Escape');
  }
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

// Serve the real V2 runtime from disk only in browser tests. No real login or snapshot is read.
async function fixtureV2(page:Page){
 const files=['baoq-mockup-v2.html','kpi/controller.mjs','kpi/model.mjs','kpi/income.mjs','kpi/view.mjs','kpi/style.css','goods/app.js','goods/engine.js','goods/data.js','goods/app-ops.scoped.css'];
 await page.route('**/v2/mockup/**',async route=>{
  const file=new URL(route.request().url()).pathname.slice('/v2/mockup/'.length);
  if(!files.includes(file))return route.fulfill({status:404,body:'Test: snapshot unavailable'});
  const body=await readFile(new URL('../server/src/v2/mockup/'+file,import.meta.url));
  return route.fulfill({body,contentType:file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':'text/javascript'});
 });
}
async function expectV2ContentHeight(page:Page){
 const frame=page.locator('iframe[title="Điều hành V2"]');
 const content=page.frameLocator('iframe[title="Điều hành V2"]');
 await expect.poll(async()=>{
  const height=await content.locator('#main').evaluate(el=>Math.max(400,Math.ceil(el.getBoundingClientRect().height)));
  return Math.abs((await frame.boundingBox())!.height-height);
 }).toBeLessThanOrEqual(2);
 expect(await frame.evaluate(el=>getComputedStyle(el).borderRadius)).toBe('0px');
 expect(await content.locator('html').evaluate(()=>window.scrollY)).toBe(0);
}

test('V2 embeds without duplicate shell, grows with content, and survives reload and history',async({page})=>{
 await mockApi(page,user('ADMIN',rolePermissions.ADMIN));await fixtureV2(page);
 await page.goto('/#page=overview');
 await expect(page).toHaveURL(/#page=v2-dashboard$/);
 const frame=page.locator('iframe[title="Điều hành V2"]'),content=page.frameLocator('iframe[title="Điều hành V2"]');
 await expect(frame).toHaveAttribute('src','/v2/mockup/baoq-mockup-v2.html?embed=1#view=dashboard');
 await expect(content.locator('.site-header')).toBeHidden();
 await expect(content.locator('.site-foot')).toBeHidden();
 await expect(content.locator('.ops-side')).toBeHidden();
 await expect(content.locator('.crumbs')).toBeHidden();
 await expect(content.locator('.slim-title')).toBeHidden();
 await expect(content.getByRole('button',{name:'Tùy chỉnh tổng quan',exact:true})).toBeVisible();
 await expect(content.getByLabel('Vai trò demo',{exact:true})).toHaveCount(0);
 await expect(content.getByLabel('Kỳ dữ liệu',{exact:true})).toBeVisible();
 await expect(content.locator('#demo-chip')).toHaveCount(0);
 await expectV2ContentHeight(page);
 await page.screenshot({path:test.info().outputPath('TASK-132-embed-windows-desktop.png'),fullPage:true});
 await content.locator('.ops-main a[href="#view=tx"]').first().click();
 await expect(page).toHaveURL(/#page=v2-tx$/);
 await expect(page.locator('.ops-side [aria-current="page"]')).toHaveText('Thu–bán');
 await page.reload();
 await expect(frame).toHaveAttribute('src','/v2/mockup/baoq-mockup-v2.html?embed=1#view=tx');
 await page.goBack();await expect(page).toHaveURL(/#page=v2-dashboard$/);
 await page.goForward();await expect(page).toHaveURL(/#page=v2-tx$/);
 // A window message from the parent itself is not a message from the embedded frame.
 await page.evaluate(()=>window.postMessage({type:'baoq-v2-view',hash:'#view=costs'},location.origin));
 await page.evaluate(()=>{
  const source=document.querySelector('iframe')!.contentWindow;
  window.dispatchEvent(new MessageEvent('message',{origin:'https://wrong-origin.test',source,data:{type:'baoq-v2-view',hash:'#view=costs'}}));
  window.dispatchEvent(new MessageEvent('message',{origin:location.origin,source,data:{type:'baoq-v2-view',hash:'#view=unknown'}}));
  window.dispatchEvent(new MessageEvent('message',{origin:'https://wrong-origin.test',source,data:{type:'baoq-v2-overlay',open:true}}));
  window.postMessage({type:'baoq-v2-overlay',open:true},location.origin);
 });
 await expect(page).toHaveURL(/#page=v2-tx$/);
 await expect(frame).not.toHaveClass(/is-overlay/);
 await page.setViewportSize({width:390,height:844});
 await expectV2ContentHeight(page);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:test.info().outputPath('TASK-132-embed-windows-mobile.png'),fullPage:true});
});
test('V2 content uses page scroll; detail overlays cover and lock the window',async({page})=>{
 await mockApi(page,user('ADMIN',rolePermissions.ADMIN));await fixtureV2(page);
 await page.goto('/#page=v2-checks');
 const frame=page.locator('iframe[title="Điều hành V2"]'),content=page.frameLocator('iframe[title="Điều hành V2"]');
 for(const viewport of [{width:1440,height:1000},{width:1024,height:900},{width:390,height:844}]){
  await page.setViewportSize(viewport);await expectV2ContentHeight(page);
  for(const close of ['Escape','button','scrim','Back']){
   const opener=content.locator('[data-alert]').first();await opener.scrollIntoViewIfNeeded();
   const before=await content.locator('#main').boundingBox(),scroll=await page.evaluate(()=>scrollY);
   await opener.click();
   const sheet=content.locator('.sheet.is-open');await expect(sheet).toBeVisible();
   await expect.poll(async()=>{
    const box=await frame.boundingBox();return box?Math.abs(box.y)+Math.abs(box.height-viewport.height):Infinity;
   }).toBeLessThanOrEqual(2);
   await expect.poll(async()=>{
    const box=await sheet.boundingBox();return box?Math.abs(box.y+box.height-viewport.height):Infinity;
   }).toBeLessThanOrEqual(2);
   const box=(await sheet.boundingBox())!;
   expect(Math.abs(box.height-viewport.height*(viewport.width<700?.92:1))).toBeLessThanOrEqual(2);
   const after=(await content.locator('#main').boundingBox())!;
   expect(Math.abs(after.x-before!.x)+Math.abs(after.y-before!.y)+Math.abs(after.width-before!.width)).toBeLessThanOrEqual(3);
   await expect(page.locator('.site-header')).toHaveAttribute('inert','');
   expect(await page.locator('body').evaluate(el=>getComputedStyle(el).position)).toBe('fixed');
   const lockedTop=await page.locator('body').evaluate(el=>el.style.top);
   await page.mouse.move(2,2);await page.mouse.wheel(0,400);
   expect(await page.locator('body').evaluate(el=>el.style.top)).toBe(lockedTop);
   expect(await content.locator('h2[tabindex="-1"]').evaluateAll(els=>els.some(el=>el===document.activeElement))).toBe(true);
   await sheet.press('Shift+Tab');
   expect(await sheet.evaluate(el=>el.contains(document.activeElement))).toBe(true);
   if(close==='Escape')await sheet.press('Escape');
   else if(close==='button')await sheet.locator('[data-close]').click();
   else if(close==='scrim')await content.locator('.scrim').click({position:{x:2,y:2}});
   else await page.goBack();
   await expect(content.locator('.sheet')).toHaveCount(0);
   await expect.poll(()=>page.evaluate(()=>scrollY)).toBe(scroll);
   await expect(opener).toBeFocused();
   await expect(page.locator('.site-header')).not.toHaveAttribute('inert','');
  }
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:test.info().outputPath(`TASK-136-${viewport.width}.png`),fullPage:true});
 }
 for(const viewport of [{width:1440,height:1000},{width:1024,height:900},{width:390,height:844}]){
  await page.setViewportSize(viewport);
  for(const [view,selector] of [['tx','button[data-record]'],['inventory','button[data-item]']]){
  await page.goto('/#page=v2-'+view);await expectV2ContentHeight(page);
  await content.locator(selector).first().click();await expect(content.locator('.dialog.is-open')).toBeVisible();
  await expect.poll(()=>frame.evaluate(el=>el.getBoundingClientRect().top)).toBe(0);
  if(viewport.width>=700)await expect.poll(async()=>{
   const box=(await content.locator('.dialog').boundingBox())!;
   return Math.abs(box.x+box.width/2-viewport.width/2)+Math.abs(box.y+box.height/2-viewport.height/2);
  }).toBeLessThanOrEqual(2);
  await content.locator('.dialog').press('Escape');await expect(content.locator('.dialog')).toHaveCount(0);
  }
 }
 await page.goto('/#page=v2-checks&alert=DEMO-E01');await page.reload();
 await expect(content.locator('.sheet.is-open')).toBeVisible();
 await expect.poll(()=>frame.evaluate(el=>el.getBoundingClientRect().top)).toBe(0);
 await content.locator('.sheet').press('Escape');await expect(page).toHaveURL(/#page=v2-checks$/);
 await page.goto('/#page=v2-dashboard');await expectV2ContentHeight(page);
 expect((await frame.boundingBox())!.height).toBeGreaterThan(844);
 await page.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight));
 expect(await page.evaluate(()=>scrollY)).toBeGreaterThan(0);
 expect(await content.locator('html').evaluate(()=>scrollY)).toBe(0);
});

test('V2 direct mode retains its shell and Vietnamese serif headings',async({page})=>{
 await fixtureV2(page);await page.goto('/v2/mockup/baoq-mockup-v2.html#view=dashboard');
 await expect(page.locator('.site-header')).toBeVisible();
 await expect(page.locator('.site-foot')).toBeVisible();
 await expect(page.locator('.slim-title')).toBeVisible();
 expect(await page.locator('html').evaluate(el=>el.classList.contains('embedded'))).toBe(false);
 await page.screenshot({path:test.info().outputPath('TASK-132-direct-windows.png'),fullPage:true});
});
for(const role of ['MANAGER','STAFF'] as const){
 test(`${role} cannot embed V2 through a deep link`,async({page})=>{
  await mockApi(page,user(role,rolePermissions[role]));
  await page.goto('/#page=v2-kpi');
  await expect(page.getByText('Bạn chưa có quyền xem mục này')).toBeVisible();
  await expect(page.locator('iframe')).toHaveCount(0);
 });
}
