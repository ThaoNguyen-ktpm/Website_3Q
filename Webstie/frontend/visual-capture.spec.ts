import {test,type Page} from '@playwright/test';
// Screenshot set for design review. Synthetic demo data only; no assertions on layout here (see qa.spec.ts).
const base='http://127.0.0.1:8787';
const dir='../docs/qa/'+(process.env.BAOQ_SHOTS||'capture');
const shot=(page:Page,name:string,fullPage=true)=>page.screenshot({path:`${dir}/${name}.png`,fullPage});
async function role(page:Page,value:string){await page.goto(base);await page.getByLabel(/Vai trò demo|Demo role/).selectOption(value);}
async function route(page:Page,hash:string){await page.evaluate(h=>{location.hash=h},hash);await page.waitForTimeout(350);}
async function english(page:Page){await page.getByRole('button',{name:'Switch language / Đổi ngôn ngữ'}).click();await page.waitForTimeout(200);}

test('home VI widths',async({page})=>{
 await role(page,'ceo');
 for(const w of [1440,1024,768,390]){await page.setViewportSize({width:w,height:w<700?844:900});await page.waitForTimeout(300);await shot(page,`home-vi-${w}`);}
});
test('home EN and app drawer',async({page})=>{
 await role(page,'ceo');
 await page.locator('.apps-trigger').click();await page.waitForTimeout(350);await shot(page,'home-apps-menu-1440',false);
 await page.keyboard.press('Escape');
 await english(page);await shot(page,'home-en-1440');
});
test('home keyboard focus',async({page})=>{
 await role(page,'ceo');
 await page.evaluate(()=>(document.activeElement as HTMLElement|null)?.blur());
 for(let i=0;i<4;i++)await page.keyboard.press('Tab');
 await page.waitForTimeout(300);await shot(page,'home-keyboard-focus-1440',false);
});
test('home reduced motion',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 await role(page,'ceo');await page.locator('.apps-trigger').click();await page.waitForTimeout(100);await shot(page,'home-reduced-motion-drawer-1440',false);
});
test('dashboard views',async({page})=>{
 await role(page,'ceo');
 await route(page,'page=overview');await shot(page,'dashboard-empty-period-1440');
 await route(page,'page=overview&period=2026-10');await shot(page,'dashboard-overview-1440');
 await route(page,'page=transactions&period=2026-10&field=channel&value=Online');await shot(page,'dashboard-filter-online-1440');
 await page.getByRole('button',{name:'Mở DEMO-S002',exact:true}).click();await page.waitForTimeout(350);await shot(page,'dashboard-dialog-1440',false);
 await page.keyboard.press('Escape');
 await page.setViewportSize({width:390,height:844});await route(page,'page=overview&period=2026-10');await shot(page,'dashboard-overview-390');
 await page.setViewportSize({width:1440,height:1000});await english(page);await shot(page,'dashboard-overview-en-1440');
});
test('inventory role',async({page})=>{
 await role(page,'inventory');await route(page,'page=inventory&period=2026-10');await shot(page,'dashboard-inventory-role-1440');
});
test.describe('touch',()=>{
 test.use({hasTouch:true,isMobile:true,viewport:{width:390,height:844}});
 test('home touch',async({page})=>{await role(page,'ceo');await page.locator('.apps-trigger').tap();await page.waitForTimeout(350);await shot(page,'home-touch-drawer-390',false);});
});
test('policy frame',async({page})=>{
 await role(page,'ceo');
 for(const g of ['reconcile','access','commission']){await route(page,'page=policy&group='+g);await shot(page,`policy-${g}-1440`);}
 await page.setViewportSize({width:390,height:844});await route(page,'page=policy&group=reconcile');await shot(page,'policy-reconcile-390');
});
