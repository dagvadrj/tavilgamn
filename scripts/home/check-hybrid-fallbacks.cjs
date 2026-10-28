const fs=require('node:fs'),assert=require('node:assert/strict');
const {chromium}=require('../../.tools/rea-runtime/node_modules/playwright-core');
const url=process.env.HERO_URL||'http://localhost:3001';
(async()=>{
  const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const results=[];
  try {
    for(const mode of ['no-webgl','model-error','slow-model','reduced-motion','context-loss','offscreen-return']){
      const context=await browser.newContext({viewport:{width:378,height:671},reducedMotion:mode==='reduced-motion'?'reduce':'no-preference'});
      const page=await context.newPage();
      if(process.env.HERO_FIXTURE)await page.route('**/api/page-data/home',r=>r.fulfill({contentType:'application/json',body:fs.readFileSync(process.env.HERO_FIXTURE,'utf8')}));
      if(mode==='no-webgl')await page.addInitScript(()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return /webgl/.test(type)?null:get.call(this,type,...args)}});
      if(mode==='model-error')await page.route('**/interior/hybrid/sofa.glb',r=>r.abort());
      if(mode==='slow-model')await page.route('**/interior/hybrid/sofa.glb',async r=>{await new Promise(resolve=>setTimeout(resolve,4000));await r.continue()});
      await page.goto(url,{waitUntil:'domcontentloaded',timeout:90000});
      if(mode==='no-webgl'){
        await page.getByRole('button',{name:'Дахин ачаалах',exact:true}).waitFor({timeout:60000});
        assert.equal(await page.locator('.scroll-room canvas').count(),0);
        assert.ok(await page.locator('.hybrid-backplate[data-active="true"] img').last().evaluate(i=>i.complete&&i.naturalWidth>0));
        await page.locator('.hybrid-item-links').getByRole('button',{name:'Буйдан',exact:true}).click();
        assert.ok((await page.getByRole('dialog').getByRole('link').getAttribute('href')).startsWith('/product/'));
      }else{
        if(mode==='slow-model'){
          await page.waitForFunction(()=>document.querySelector('.scroll-room')?.dataset.sofaStatus==='loading',{}, {timeout:60000});
          assert.ok(await page.locator('.hybrid-backplate[data-active="true"] img').last().evaluate(i=>i.complete&&i.naturalWidth>0));
        }
        await page.waitForFunction(()=>document.querySelector('.scroll-room')?.dataset.ready==='true',{}, {timeout:90000});
        if(mode==='model-error')assert.equal(await page.locator('.scroll-room').getAttribute('data-sofa-status'),'error');
        if(mode==='reduced-motion'){
          await page.getByRole('button',{name:'03 Ажлын өрөө',exact:true}).click();
          await page.waitForFunction(()=>document.querySelector('.scroll-room canvas')?.dataset.roomTravel==='2.000');
          assert.equal(await page.locator('.hybrid-backplate[data-active="true"]').evaluate(e=>getComputedStyle(e).transitionDuration),'0s');
          await page.getByRole('button',{name:'01 Зочны өрөө',exact:true}).click();
        }
        if(mode==='context-loss'){
          await page.locator('canvas').first().evaluate(c=>c.getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());
          await page.getByRole('button',{name:'Дахин ачаалах',exact:true}).click();
          await page.waitForFunction(()=>document.querySelector('.scroll-room')?.dataset.ready==='true',{}, {timeout:90000});
        }
        if(mode==='offscreen-return'){
          await page.evaluate(()=>scrollTo({top:document.querySelector('.scroll-room').getBoundingClientRect().bottom+scrollY+100,behavior:'instant'}));
          await page.waitForFunction(()=>document.querySelectorAll('.scroll-room canvas').length===0,{}, {timeout:30000});
          await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));
          await page.waitForFunction(()=>document.querySelector('.scroll-room')?.dataset.ready==='true',{}, {timeout:90000});
          const dot=await page.getByRole('button',{name:'Буйдан · Дэлгэрэнгүй',exact:true}).boundingBox();
          const canvas=page.locator('.scroll-room canvas'),box=await canvas.boundingBox();
          await canvas.click({position:{x:dot.x+dot.width/2-box.x-40,y:dot.y+dot.height/2-box.y-35},force:true});
          await page.getByRole('dialog').waitFor();await page.keyboard.press('Escape');
        }
        await page.locator('.hybrid-item-links').getByRole('button',{name:'Буйдан',exact:true}).click();
        const dialog=page.getByRole('dialog'),swatch=dialog.locator('.scroll-room-swatches button').first();
        await swatch.click();const color=await dialog.getAttribute('data-color');
        await page.keyboard.press('Escape');
        await page.locator('.hybrid-item-links').getByRole('button',{name:'Буйдан',exact:true}).click();
        assert.equal(await dialog.getAttribute('data-color'),color);
      }
      results.push({mode,passed:true}); await context.close();
    }
    console.log(JSON.stringify(results));fs.writeFileSync(process.env.TEMP+'/hybrid-fallbacks.json',JSON.stringify(results,null,2));
  }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
