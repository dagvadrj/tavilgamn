const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const {chromium} = require('../../.tools/rea-runtime/node_modules/playwright-core');
const out = path.join(process.env.TEMP,'hybrid-qa'); fs.mkdirSync(out,{recursive:true});
(async()=>{
  const browser = await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  try {
    const errors=[];
    const page=await browser.newPage({viewport:{width:1680,height:944},deviceScaleFactor:1});
    // Optional captured public catalog fixture isolates UI QA from API outages.
    if (process.env.HERO_FIXTURE) await page.route('**/api/page-data/home',route=>route.fulfill({contentType:'application/json',body:fs.readFileSync(process.env.HERO_FIXTURE,'utf8')}));
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(process.env.HERO_URL||'http://localhost:3001',{waitUntil:'domcontentloaded',timeout:90000});
    await page.waitForFunction(()=>document.querySelector('.scroll-room')?.dataset.sofaStatus==='ready',{}, {timeout:90000});
    const settle=()=>page.waitForFunction(()=>document.querySelector('.scroll-room canvas')?.dataset.roomSettled==='true',{}, {timeout:60000});
    const result=[];
    for (const [label,width,height] of [['desktop',1680,944],['phone',378,671],['landscape',844,390]]) {
      await page.setViewportSize({width,height});
      for (const [index,name] of ['Зочны өрөө','Унтлагын өрөө','Ажлын өрөө'].entries()) {
        await page.getByRole('button',{name:`0${index+1} ${name}`,exact:true}).click();
        await page.waitForTimeout(1200); await settle();
        await page.screenshot({path:path.join(out,`${label}-${index}.png`)});
        const before=await page.locator('.scroll-room canvas').evaluate(c=>({...c.dataset}));
        const item=['Буйдан','Ор','Ажлын ширээ'][index];
        await page.getByRole('button',{name:`${item} · Дэлгэрэнгүй`,exact:true}).click();
        await page.waitForTimeout(1000); await settle();
        await page.screenshot({path:path.join(out,`${label}-${index}-focus.png`)});
        assert.equal(await page.getByRole('dialog').count(),1);
        assert.equal(await page.locator('.scroll-room canvas').count(),1);
        await page.keyboard.press('Escape'); await page.waitForTimeout(1000); await settle();
        const after=await page.locator('.scroll-room canvas').evaluate(c=>({...c.dataset}));
        assert.equal(after.roomFocus,'');
        const a=before.cameraPosition.split(',').map(Number),b=after.cameraPosition.split(',').map(Number);
        assert.ok(a.every((v,i)=>Math.abs(v-b[i])<.002));
        assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
        if(width<768||height<520) assert.equal(await page.locator('.scroll-room-copy').isVisible(),false);
        result.push({label,index,drawCalls:after.drawCalls,triangles:after.triangles,camera:after.cameraPosition});
      }
    }
    // Every retained interactive item can be opened, recolored and closed.
    await page.setViewportSize({width:378,height:671});
    for (const [index, name] of ['Зочны өрөө','Унтлагын өрөө','Ажлын өрөө'].entries()) {
      await page.getByRole('button',{name:`0${index+1} ${name}`,exact:true}).click();await page.waitForTimeout(1200);await settle();
      const names=await page.locator('.hybrid-item-links button').allTextContents();
      for(const item of names){
        await page.locator('.hybrid-item-links').getByRole('button',{name:item,exact:true}).click();await page.waitForTimeout(800);await settle();
        const dialog=page.getByRole('dialog');
        const first=await page.locator('.scroll-room canvas').screenshot();
        await dialog.locator('.scroll-room-swatches button').last().click();await page.waitForTimeout(300);await settle();
        const color=await dialog.getAttribute('data-color');
        const second=await page.locator('.scroll-room canvas').screenshot();assert.ok(!first.equals(second),`${item} should change the actual rendered material`);
        await page.keyboard.press('Escape');await page.waitForTimeout(800);await settle();
        await page.locator('.hybrid-item-links').getByRole('button',{name:item,exact:true}).click();assert.equal(await dialog.getAttribute('data-color'),color);
        await page.keyboard.press('Escape');await page.waitForTimeout(800);await settle();
      }
    }
    fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({result,errors},null,2)); assert.deepEqual(errors,[]);
    console.log(JSON.stringify({out,result,errors}));
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1});
