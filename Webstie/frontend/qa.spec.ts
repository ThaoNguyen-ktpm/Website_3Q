import {test,expect} from '@playwright/test';
test('CEO drilldown, URL filters, repeated details, back, reload and blank period',async({page})=>{
 await page.goto('http://127.0.0.1:8787');
 await page.getByLabel('Vai trò demo').selectOption('ceo');
 await page.locator('.apps-trigger').click(); await page.locator('#apps-menu').getByRole('button',{name:'Điều hành',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Chưa chọn kỳ dữ liệu'})).toBeVisible();
 await page.getByLabel('Kỳ dữ liệu').selectOption('2026-10');
 await expect(page.getByText('190.000.000 ₫',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:/Online 65.000.000/}).click();
 await expect(page).toHaveURL(/field=channel/);
 await expect(page.getByRole('button',{name:'Mở DEMO-S002',exact:true})).toBeVisible();
 for(let i=0;i<3;i++){
  await page.getByRole('button',{name:'Mở DEMO-S002',exact:true}).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button',{name:'Đóng chi tiết'}).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
 }
 await page.reload();
 await expect(page.getByRole('button',{name:/Bỏ lọc: Kênh = Online/})).toBeVisible();
 await page.getByRole('button',{name:'Mở DEMO-S002',exact:true}).click();
 await page.goBack();
 await expect(page.getByRole('dialog')).not.toBeVisible();
 await page.getByRole('button',{name:/Bỏ lọc: Kênh = Online/}).click();
 await expect(page.locator('tbody tr')).toHaveCount(7);
 await page.getByRole('button',{name:'Tổng quan điều hành',exact:true}).click();
 await page.getByRole('button',{name:/2 cảnh báo cần kiểm tra/}).click();
 await expect(page.locator('tbody tr')).toHaveCount(2);
 await page.getByRole('button',{name:'Mở DEMO-E01',exact:true}).click();
 await expect(page.getByText('Điều kiện hoàn thành',{exact:true})).toBeVisible();
 await page.keyboard.press('Escape');
 await expect(page.getByRole('dialog')).not.toBeVisible();
});
test('cofounder denied; inventory grant works; mobile layout',async({page})=>{
 await page.goto('http://127.0.0.1:8787');
 await page.getByLabel('Vai trò demo').selectOption('cofounder');
 await page.locator('.apps-trigger').click(); await page.locator('#apps-menu').getByRole('button',{name:'Điều hành',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('chưa được cấp quyền');
 await page.getByLabel('Vai trò demo').selectOption('inventory');
 await page.locator('.apps-trigger').click(); await page.locator('#apps-menu').getByRole('button',{name:'Điều hành',exact:true}).click();
 await page.getByLabel('Kỳ dữ liệu').selectOption('2026-10');
 await expect(page.locator('tbody tr')).toHaveCount(4);
 await page.setViewportSize({width:390,height:844});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});
test('KPI costs, sale and aging reconcile; local visual review',async({page})=>{
 await page.goto('http://127.0.0.1:8787');
 await page.getByLabel('Vai trò demo').selectOption('ceo');
 await page.locator('.apps-trigger').click(); await page.locator('#apps-menu').getByRole('button',{name:'Điều hành',exact:true}).click();
 await page.getByLabel('Kỳ dữ liệu').selectOption('2026-10');
 await expect(page.getByText('190.000.000 ₫',{exact:true})).toBeVisible();
 await page.screenshot({path:'../docs/dashboard-local-qa.png',fullPage:true});
 await page.getByRole('button',{name:/An 70.000.000/}).click();
 await expect(page.locator('tbody tr')).toHaveCount(2);
 await page.getByRole('button',{name:'Tổng quan điều hành',exact:true}).click();
 await page.getByRole('button',{name:/Tồn từ 90 ngày/}).click();
 await expect(page.locator('tbody tr')).toHaveCount(2);
 await page.getByRole('button',{name:'Tổng quan điều hành',exact:true}).click();
 await page.getByRole('button',{name:/Tổng chi phí 162.500.000/}).click();
 await expect(page.getByText('27.500.000 ₫',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:/Xem giá vốn theo giao dịch/}).click();
 await expect(page.locator('tbody tr')).toHaveCount(7);
});
// v2 shell: espresso header + drawer replaces the old sidebar shell and launcher; the HOME task board replaces .department-column.
test('one shared shell from home to module, detail and browser back',async({page,context})=>{
 await page.goto('http://127.0.0.1:8787');
 await page.getByLabel('Vai trò demo').selectOption('ceo');
 const origin=new URL(page.url()).origin;
 const x=await page.locator('header').evaluate(el=>el.getBoundingClientRect().x);
 await expect(page.locator('.ops-side')).toHaveCount(0);
 await expect(page.locator('#home-h1')).toBeVisible();
 await expect(page.locator('.rows li').first()).toBeVisible();
 await page.locator('.apps-trigger').click(); await page.locator('#apps-menu').getByRole('button',{name:'Điều hành',exact:true}).click();
 expect(new URL(page.url()).origin).toBe(origin);
 expect(await page.locator('header').evaluate(el=>el.getBoundingClientRect().x)).toBe(x);
 await expect(page.locator('header')).toBeVisible();
 await expect(page.getByRole('navigation',{name:'Đường dẫn'})).toContainText('Điều hành');
 await page.getByLabel('Kỳ dữ liệu').selectOption('2026-10');
 await page.getByRole('button',{name:/Doanh thu thuần 190.000.000/}).click();
 await page.getByRole('button',{name:'Mở DEMO-S001',exact:true}).click();
 await expect(page.getByRole('dialog')).toBeVisible();
 await page.goBack();
 await expect(page.getByRole('dialog')).not.toBeVisible();
 await page.goBack();
 await expect(page.getByRole('heading',{name:'Tổng quan điều hành',exact:true,level:1})).toBeVisible();
 await page.getByRole('button',{name:'← Trang chủ',exact:true}).click();
 await expect(page.locator('#home-h1')).toBeVisible();
 await expect(page.locator('.ops-side')).toHaveCount(0);
 await expect(page.getByRole('navigation',{name:'Đường dẫn'})).toHaveCount(0);
 expect(await page.locator('header').evaluate(el=>el.getBoundingClientRect().x)).toBe(x);
 await page.goBack();
 await expect(page.getByRole('heading',{name:'Tổng quan điều hành',exact:true,level:1})).toBeVisible();
 expect(context.pages()).toHaveLength(1);
 expect(new URL(page.url()).origin).toBe(origin);
});
// v2 replaces the two donuts with share bars (one button per row) and the weekly bars with a column+line chart.
test('empty-state action reveals share bars, bridge and weekly chart with drilldown',async({page})=>{
 await page.goto('http://127.0.0.1:8787');
 await page.getByLabel('Vai trò demo').selectOption('ceo');
 await page.locator('.apps-trigger').click(); await page.locator('#apps-menu').getByRole('button',{name:'Điều hành',exact:true}).click();
 await page.getByRole('button',{name:/Xem biểu đồ demo/}).click();
 await expect(page.getByRole('heading',{name:'Đóng góp theo kênh',exact:true})).toBeVisible();
 await expect(page.getByRole('heading',{name:'Đóng góp theo sale',exact:true})).toBeVisible();
 await expect(page.getByRole('heading',{name:'Từ doanh thu đến kết quả',exact:true})).toBeVisible();
 await expect(page.getByRole('heading',{name:'Doanh thu & kết quả theo tuần'})).toBeVisible();
 await page.getByRole('button',{name:/01–07\/10: doanh thu 100.000.000/}).click();
 await expect(page.locator('tbody tr')).toHaveCount(3);
 await page.goBack();
 await expect(page.getByRole('heading',{name:'Doanh thu & kết quả theo tuần'})).toBeVisible();
});
// v2: original logo centred in the 56px header (no hover panel); the menu is a modal drawer with two levels.
test('header logo centred, drawer levels and dismissal, responsive home',async({page})=>{
 await page.goto('http://127.0.0.1:8787');
 for(const width of [1440,1024,768,390]){
  await page.setViewportSize({width,height:900});
  expect(await page.locator('header').evaluate(el=>el.getBoundingClientRect().height)).toBe(56);
  const logo=page.locator('.wordmark img');
  expect(await logo.evaluate((el:HTMLImageElement)=>el.complete&&el.naturalWidth===2048)).toBe(true);
  const bounds=await page.locator('.wordmark').boundingBox(),right=await page.locator('.header-right').boundingBox();
  if(width>=768)expect(Math.abs(bounds!.x+bounds!.width/2-width/2)).toBeLessThan(2); // phones: logo follows Menu (no room to centre)
  expect(bounds!.x+bounds!.width).toBeLessThanOrEqual(right!.x);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.locator('.apps-trigger').click();
  await expect(page.locator('#apps-menu')).toBeVisible();
  await page.getByRole('button',{name:'Mở mục con của Điều hành'}).click();
  await expect(page.getByRole('navigation',{name:'Mục con Điều hành'}).getByRole('button',{name:'Thu–bán'})).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#apps-menu')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#apps-menu')).not.toBeVisible();
  await expect(page.locator('.apps-trigger')).toBeFocused();
  await page.locator('.apps-trigger').click();
  await page.mouse.click(width-5,880);
  await expect(page.locator('#apps-menu')).not.toBeVisible();
 }
 await page.screenshot({path:'../docs/home-board-mobile-qa.png',fullPage:true});
 await page.setViewportSize({width:1440,height:900});
 await page.screenshot({path:'../docs/home-board-desktop-qa.png',fullPage:true});
});
test('tasks create/edit/checklist/comments/completion preview with VI EN state continuity',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8787');
 await page.locator('.apps-trigger').click(); await page.locator('#apps-menu').getByRole('button',{name:'Công việc',exact:true}).click();
 await page.getByRole('button',{name:'+ Tạo việc demo',exact:true}).click();
 await page.getByLabel('Tên công việc',{exact:true}).fill('Công việc mẫu không dịch');
 await page.getByLabel('Hạn hoàn thành',{exact:true}).fill('2026-10-25');
 await page.getByRole('button',{name:'Switch language / Đổi ngôn ngữ'}).click();
 await expect(page.getByLabel('Task title',{exact:true})).toHaveValue('Công việc mẫu không dịch');
 await page.getByRole('button',{name:'Create task',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Task details',exact:true})).toBeVisible();
 await page.getByLabel('Assignee',{exact:true}).selectOption('Bình · demo');
 await page.getByLabel('New checklist item',{exact:true}).fill('Kiểm tra công việc');
 await page.getByRole('button',{name:'Add item',exact:true}).click();
 await page.getByLabel('Kiểm tra công việc',{exact:true}).check();
 await page.getByLabel('Demo comment',{exact:true}).fill('Bình luận tiếng Việt giữ nguyên');
 await page.getByRole('button',{name:'Add comment',exact:true}).click();
 await page.getByLabel('Status',{exact:true}).selectOption('Hoàn thành');
 await expect(page.getByRole('region',{name:'Telegram preview'})).toContainText('SIMULATION · NOT SENT');
 await expect(page.getByRole('region',{name:'Telegram preview'})).toContainText('Người giao · demo');
 const url=page.url();await page.getByRole('button',{name:'Switch language / Đổi ngôn ngữ'}).click();
 expect(page.url()).toBe(url);await expect(page.getByLabel('Tên công việc',{exact:true})).toHaveValue('Công việc mẫu không dịch');
 await expect(page.getByText('Bình luận tiếng Việt giữ nguyên',{exact:true})).toBeVisible();
 await page.getByRole('link',{name:/Mở công việc trong BAOQ/}).click();
 await page.reload();await expect(page.getByLabel('Trạng thái',{exact:true})).toHaveValue('Hoàn thành');
 await page.getByRole('button',{name:'Đóng công việc',exact:true}).click();
 await page.getByLabel('Lọc công việc',{exact:true}).selectOption('done');
 await expect(page.locator('.task-row')).toHaveCount(1);
 await page.getByRole('button',{name:'Telegram · Chưa kết nối',exact:true}).click();
 await page.getByLabel('Chu kỳ nhắc lặp',{exact:true}).selectOption('hour');
 await page.getByLabel('Giới hạn số lần nhắc',{exact:true}).selectOption('2');
 await page.getByLabel('Giờ yên lặng bắt đầu',{exact:true}).fill('21:00');
 await page.getByRole('button',{name:'Switch language / Đổi ngôn ngữ'}).click();
 await expect(page.getByLabel('Reminder cadence',{exact:true})).toHaveValue('hour');
 await expect(page.getByLabel('Quiet hours start',{exact:true})).toHaveValue('21:00');
 await page.getByRole('button',{name:'Preview due reminder',exact:true}).click();
 await expect(page.getByRole('region',{name:'Telegram preview'})).toBeVisible();
 await page.screenshot({path:'../docs/tasks-telegram-en.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.getByRole('button',{name:'← Home',exact:true}).click();
 await expect(page.locator('#home-h1')).toBeVisible();await expect(page.locator('.ops-side')).toHaveCount(0);
 await page.screenshot({path:'../docs/tasks-portal-en-mobile.png',fullPage:true});
 expect(errors).toEqual([]);
});
test('English dashboard filtering and role warning persist on reload',async({page})=>{
 await page.goto('http://127.0.0.1:8787');await page.getByLabel('Vai trò demo').selectOption('ceo');
 await page.getByRole('button',{name:'Switch language / Đổi ngôn ngữ'}).click();
 await page.locator('.apps-trigger').click(); await page.locator('#apps-menu').getByRole('button',{name:'Operations',exact:true}).click();
 await page.getByRole('button',{name:/View demo charts/}).click();
 await page.getByRole('button',{name:/Online 65.000.000/}).click();
 await expect(page.locator('tbody tr')).toHaveCount(3);await page.reload();
 await expect(page.getByRole('button',{name:/Clear filter:/})).toBeVisible();
 await page.getByRole('button',{name:'Open DEMO-S002',exact:true}).click();
 await expect(page.getByRole('dialog')).toBeVisible();await page.getByRole('button',{name:'Close details'}).click();
 await page.getByLabel('Demo role').selectOption('cofounder');await page.locator('.apps-trigger').click(); await page.locator('#apps-menu').getByRole('button',{name:'Operations',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('no access');
});
// Luxury Workspace layer: launcher row, logo panel input modes, motion budget, flat amounts, history and contrast.
// v2 layer: HOME work-first board, drawer, motion budget, flat amounts, history, contrast, policy frame and alert sheet.
const overflowFree=(page:import('@playwright/test').Page)=>page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth);
const flat=(s:string[])=>s.map(x=>x.replace(/\s/g,' '));
test('v2 home: task board above the fold, shortcuts open in same tab, coming-soon apps inert, VI/EN',async({page,context})=>{
 await page.goto('http://127.0.0.1:8787');await page.getByLabel('Vai trò demo').selectOption('ceo');
 for(const [w,h] of [[1440,900],[1024,768],[768,1024],[390,844]]){
  await page.setViewportSize({width:w,height:h});
  expect((await page.locator('.work .seg').first().boundingBox())!.y).toBeLessThan(h);
  expect(await overflowFree(page)).toBe(true);
 }
 await page.setViewportSize({width:1440,height:900});
 const side=page.getByRole('complementary',{name:'Đi tới'});
 await side.getByRole('link',{name:/Tất cả công việc/}).focus();await page.keyboard.press('Enter');
 await expect(page.getByRole('heading',{name:'Công việc',exact:true,level:1})).toBeVisible();
 await page.goBack();await expect(side).toBeVisible();
 await side.getByRole('link',{name:/Tổng quan điều hành/}).focus();await page.keyboard.press('Enter');
 await expect(page.getByRole('heading',{name:'Tổng quan điều hành',exact:true,level:1})).toBeVisible();
 await page.getByRole('button',{name:'← Trang chủ',exact:true}).click();
 await page.locator('.apps-trigger').click();
 const soon=page.locator('#apps-menu .soon li');await expect(soon).toHaveCount(3);
 for(const li of await soon.all()){await expect(li).toContainText('Chưa triển khai');await expect(li.locator('button,a')).toHaveCount(0)}
 await page.keyboard.press('Escape');
 const url=page.url();await page.getByRole('button',{name:'Switch language / Đổi ngôn ngữ'}).click();
 await expect(page.getByRole('complementary',{name:'Go to'})).toContainText('Executive overview');
 await page.locator('.apps-trigger').click();await expect(page.locator('#apps-menu .soon')).toContainText('Not implemented');await page.keyboard.press('Escape');
 expect(page.url()).toBe(url);expect(context.pages()).toHaveLength(1);
});
test('v2 home: filters use replaceState, task sheet opens from the list and closes with Back',async({page})=>{
 await page.goto('http://127.0.0.1:8787');
 const before=await page.evaluate(()=>history.length);
 await page.getByRole('button',{name:/^Hoàn thành/}).click();
 await expect(page).toHaveURL(/homeFilter=done/);
 await page.getByRole('button',{name:/^Đang mở/}).click();
 expect(await page.evaluate(()=>history.length)).toBe(before);
 await page.locator('#home-dept').selectOption('Studio');
 await expect(page).toHaveURL(/homeDept=Studio/);
 await page.locator('.rows a').first().click();
 await expect(page.getByRole('dialog',{name:/Chuẩn bị bộ ảnh/})).toBeVisible();
 await page.goBack();
 await expect(page.getByRole('dialog')).not.toBeVisible();
 await expect(page).toHaveURL(/homeDept=Studio/);
});
test('v2 drawer: repeated open/close returns focus; brand returns home',async({page})=>{
 await page.goto('http://127.0.0.1:8787/#page=tasks');
 for(let i=0;i<3;i++){
  await page.locator('.apps-trigger').click();await expect(page.locator('#apps-menu')).toBeVisible();
  await page.keyboard.press('Escape');await expect(page.locator('#apps-menu')).not.toBeVisible();
  await expect(page.locator('.apps-trigger')).toBeFocused();
 }
 await page.getByRole('button',{name:'BAOQ Luxury, Trang chủ'}).click();
 await expect(page.locator('#home-h1')).toBeVisible();
});
test.describe('v2 touch',()=>{
 test.use({hasTouch:true,isMobile:true,viewport:{width:390,height:844}});
 test('tap opens drawer, operations and demo charts without overflow',async({page,context})=>{
  await page.goto('http://127.0.0.1:8787');await page.getByLabel('Vai trò demo').selectOption('ceo');
  expect(await overflowFree(page)).toBe(true);
  await page.locator('.apps-trigger').tap();
  await page.locator('#apps-menu').getByRole('button',{name:'Điều hành',exact:true}).tap();
  await expect(page.getByRole('heading',{name:'Tổng quan điều hành',exact:true,level:1})).toBeVisible();
  await page.getByRole('button',{name:/Xem biểu đồ demo/}).tap();
  await expect(page.locator('.kvalue').first()).toHaveText(/^190\.000\.000\s₫$/);
  expect(await overflowFree(page)).toBe(true);expect(context.pages()).toHaveLength(1);
 });
});
test('v2 motion stays within 120–280 ms, never disables input; reduced motion removes it',async({page})=>{
 const budget=()=>page.evaluate(()=>{const bad:string[]=[];const s=(v:string)=>v.split(',').map(x=>parseFloat(x)*(x.trim().endsWith('ms')?.001:1));
  for(const el of document.querySelectorAll('*')){const cs=getComputedStyle(el);for(const d of [...s(cs.transitionDuration),...(cs.animationName==='none'?[]:s(cs.animationDuration))])if(d&&(d<.12||d>.28))bad.push(`${el.className}:${d}`);
   if(el.matches('.kcard,.apps-trigger,dialog[open],dialog[open] button')&&cs.pointerEvents==='none')bad.push('pointer-events:'+el.className);}
  return bad;});
 await page.goto('http://127.0.0.1:8787');await page.getByLabel('Vai trò demo').selectOption('ceo');
 expect(await budget()).toEqual([]);
 await page.locator('.apps-trigger').click();expect(await budget()).toEqual([]);
 await page.keyboard.press('Escape');
 await page.evaluate(()=>{location.hash='page=overview&period=2026-10'});
 const card=page.locator('.kcard').first();await expect(card).toBeVisible();expect(await budget()).toEqual([]);
 await page.evaluate(()=>{location.hash='page=transactions&period=2026-10'});
 await page.getByRole('button',{name:'Mở DEMO-S001',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();
 expect(await budget()).toEqual([]);await page.keyboard.press('Escape');
 await page.emulateMedia({reducedMotion:'reduce'});await page.evaluate(()=>{location.hash='page=overview&period=2026-10'});
 await card.hover();expect(await card.evaluate(el=>getComputedStyle(el).transform)).toBe('none');
 await page.locator('.apps-trigger').click();await expect(page.locator('#apps-menu')).toBeVisible();
 expect(await page.evaluate(()=>document.getAnimations().filter(a=>a.playState==='running').length)).toBe(0);
});
test('v2 amounts render final and flat, no count-up',async({page})=>{
 await page.goto('http://127.0.0.1:8787');await page.getByLabel('Vai trò demo').selectOption('ceo');
 await page.evaluate(()=>{location.hash='page=overview&period=2026-10'});
 const values=page.locator('.kpi strong');await expect(values).toHaveCount(4);
 const first=await values.allTextContents();
 expect(flat(first)).toEqual(['190.000.000 ₫','162.500.000 ₫','27.500.000 ₫','111.000.000 ₫']);
 await page.waitForTimeout(600);expect(await values.allTextContents()).toEqual(first);
 expect(await values.first().evaluate(el=>getComputedStyle(el).fontVariantNumeric)).toContain('tabular-nums');
});
test('v2 Back/Forward restore drilldown filter and record dialog',async({page,context})=>{
 await page.goto('http://127.0.0.1:8787');await page.getByLabel('Vai trò demo').selectOption('ceo');
 await page.evaluate(()=>{location.hash='page=overview&period=2026-10'});
 await page.getByRole('button',{name:/Online 65.000.000/}).click();await expect(page.locator('tbody tr')).toHaveCount(3);
 await page.getByRole('button',{name:'Mở DEMO-S002',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();
 await page.goBack();await expect(page.getByRole('dialog')).not.toBeVisible();await expect(page.getByRole('button',{name:/Bỏ lọc: Kênh = Online/})).toBeVisible();
 await page.goBack();await expect(page.getByRole('heading',{name:'Tổng quan điều hành',exact:true})).toBeVisible();
 await page.goForward();await expect(page.getByRole('button',{name:/Bỏ lọc: Kênh = Online/})).toBeVisible();await expect(page.locator('tbody tr')).toHaveCount(3);
 await page.goForward();await expect(page.getByRole('dialog')).toBeVisible();
 await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).not.toBeVisible();
 expect(context.pages()).toHaveLength(1);
});
test('v2 text contrast meets WCAG AA on home, dashboard, tables, tasks and policy',async({page})=>{
 await page.goto('http://127.0.0.1:8787');await page.getByLabel('Vai trò demo').selectOption('ceo');
 for(const hash of ['','page=overview&period=2026-10','page=transactions&period=2026-10&field=channel&value=Online','page=errors&period=2026-10','page=tasks','page=policy','page=policy&group=access']){
  await page.evaluate(h=>{location.hash=h},hash);await page.waitForTimeout(350);
  const failures=await page.evaluate(()=>{const parse=(c:string)=>{const p=(c.match(/rgba?\(([^)]+)\)/)?.[1]||'').split(/[ ,\/]+/).filter(Boolean).map(Number);return p.length>=3?{r:p[0],g:p[1],b:p[2],a:p.length>3?p[3]:1}:null};
   const lum=({r,g,b}:{r:number;g:number;b:number})=>{const f=(v:number)=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)};return .2126*f(r)+.7152*f(g)+.0722*f(b)};
   const bg=(el:Element|null)=>{for(let e=el;e;e=e.parentElement){const c=parse(getComputedStyle(e).backgroundColor);if(c&&c.a>.5)return c}return {r:255,g:255,b:255,a:1}};
   const out:string[]=[];const walk=document.createTreeWalker(document.getElementById('root')!,NodeFilter.SHOW_TEXT);let n:Node|null;
   while((n=walk.nextNode())){const el=n.parentElement;if(!n.nodeValue?.trim()||!el||el.closest('button:disabled,svg'))continue;const r=el.getBoundingClientRect();if(!r.width||!r.height)continue;
    const cs=getComputedStyle(el),a=lum(parse(cs.color)!),b=lum(bg(el)),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05),size=parseFloat(cs.fontSize);
    if(ratio<((size>=24||(Number(cs.fontWeight)>=700&&size>=18.66))?3:4.5))out.push(`${n.nodeValue.trim().slice(0,30)} ${ratio.toFixed(2)}`);}
   return out;});
  expect(failures,hash||'home').toEqual([]);
 }
});
test('v2 alert sheet: opens from overview, links to the record, Escape returns focus',async({page})=>{
 await page.goto('http://127.0.0.1:8787');await page.getByLabel('Vai trò demo').selectOption('ceo');
 await page.evaluate(()=>{location.hash='page=overview&period=2026-10'});
 const first=page.locator('.alerts button').first();await first.click();
 const sheet=page.getByRole('dialog',{name:/./});await expect(sheet).toBeVisible();
 await expect(page).toHaveURL(/alert=/);
 await page.keyboard.press('Escape');await expect(sheet).not.toBeVisible();await expect(first).toBeFocused();
 await first.click();await page.getByRole('button',{name:'Mở bản ghi liên quan'}).click();
 await expect(page.getByRole('heading',{name:'Chi tiết bản ghi'})).toBeVisible();
 await page.getByRole('button',{name:'Đóng chi tiết'}).click();
 await page.goBack();await page.goBack();await expect(page.getByRole('dialog')).toBeVisible(); // Back reopens the warning sheet
 await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).not.toBeVisible();
 await page.getByRole('button',{name:/Xem tất cả: \d+ cảnh báo cần kiểm tra/}).click();
 await expect(page.getByRole('heading',{name:'Kiểm tra',exact:true,level:1})).toBeVisible();
});
test('v2 policy frame: nothing pre-filled, 100% rule blocks save, draft persists locally only',async({page})=>{
 await page.goto('http://127.0.0.1:8787/#page=policy');await page.evaluate(()=>localStorage.removeItem('baoq-policy-draft-v2'));await page.reload();
 await expect(page.getByRole('heading',{name:'Đối soát & chia tiền'})).toBeVisible();
 for(const input of await page.locator('#pol-form input').all())await expect(input).toHaveValue('');
 await page.locator('#pf-reconcile-partner').fill('40');await page.locator('#pf-reconcile-bao').fill('50');
 await expect(page.locator('#pf-reconcile-bao-e')).toContainText('100%');
 await page.getByRole('button',{name:'Lưu nháp DEMO'}).click();
 await expect(page.locator('#pf-reconcile-bao')).toBeFocused();
 expect(await page.evaluate(()=>localStorage.getItem('baoq-policy-draft-v2'))).toBeNull();
 await page.locator('#pf-reconcile-bao').fill('60');
 await page.getByRole('button',{name:'Lưu nháp DEMO'}).click();
 await page.reload();await expect(page.locator('#pf-reconcile-partner')).toHaveValue('40');
 await page.getByRole('link',{name:/Hoa hồng/}).click();await expect(page).toHaveURL(/group=commission/);
 await expect(page.locator('#pol-preview')).toContainText('Không tính');
 expect(await overflowFree(page)).toBe(true);
});
test('v2 not-connected pages show a placeholder and no figures',async({page})=>{
 await page.goto('http://127.0.0.1:8787');await page.getByLabel('Vai trò demo').selectOption('ceo');
 await page.locator('.apps-trigger').click();await page.getByRole('button',{name:'Mở mục con của Điều hành'}).click();
 await page.getByRole('navigation',{name:'Mục con Điều hành'}).getByRole('button',{name:'Ký gửi'}).click();
 await expect(page.locator('.ops-main').getByRole('heading',{name:'Chưa kết nối nguồn',level:2})).toBeVisible();
 await expect(page.locator('.ops-main')).not.toContainText('₫');
});
test('v2 drawer focus ring is not clipped by the drawer',async({page})=>{
 await page.goto('http://127.0.0.1:8787');
 for(const w of [1440,390]){
  await page.setViewportSize({width:w,height:900});
  await page.locator('.apps-trigger').click();
  const link=page.locator('#apps-menu .nav-link').first();await link.focus();await page.keyboard.press('Tab');await page.keyboard.press('Shift+Tab');
  await expect(link).toBeFocused();
  const {ring,box}=await link.evaluate(el=>{const cs=getComputedStyle(el),o=parseFloat(cs.outlineWidth)+parseFloat(cs.outlineOffset),r=el.getBoundingClientRect(),p=el.closest('dialog')!.getBoundingClientRect();return {ring:{l:r.left-o,r:r.right+o},box:{l:p.left,r:p.right}}});
  expect(ring.l,`${w}px left`).toBeGreaterThanOrEqual(box.l);expect(ring.r,`${w}px right`).toBeLessThanOrEqual(box.r);
  await page.keyboard.press('Escape');expect(await overflowFree(page)).toBe(true);
 }
});
