// Bake the composited room for loading and WebGL-unavailable states.
const fs=require('node:fs'),path=require('node:path'),sharp=require('sharp');
const {chromium}=require('../../.tools/rea-runtime/node_modules/playwright-core');
(async()=>{
  const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  try {
    const page=await browser.newPage({viewport:{width:1680,height:944},deviceScaleFactor:1});
    if(process.env.HERO_FIXTURE)await page.route('**/api/page-data/home',r=>r.fulfill({contentType:'application/json',body:fs.readFileSync(process.env.HERO_FIXTURE,'utf8')}));
    await page.goto(process.env.HERO_URL||'http://localhost:3001',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>document.querySelector('.scroll-room')?.dataset.sofaStatus==='ready',{}, {timeout:90000});
    for(const[index,id,name]of[[0,'living','Зочны өрөө'],[1,'bedroom','Унтлагын өрөө'],[2,'office','Ажлын өрөө']]){
      await page.getByRole('button',{name:`0${index+1} ${name}`,exact:true}).click();await page.waitForTimeout(1600);
      await page.waitForFunction(()=>document.querySelector('.scroll-room canvas')?.dataset.roomSettled==='true',{}, {timeout:60000});
      const css=await page.addStyleTag({content:'.store-header,.scroll-room-copy,.scroll-room-footer,.scroll-room-tools,.scroll-room-hotspot,.scroll-room-shade,nextjs-portal{visibility:hidden!important}'});
      const buffer=await page.locator('.scroll-room-stage').screenshot();
      await sharp(buffer).webp({quality:91}).toFile(path.resolve(`public/interior/hybrid/${id}-poster.webp`));
      await css.evaluate(e=>e.remove());
    }
    console.log('Saved three composited 1680 x 944 room posters.');
  }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
