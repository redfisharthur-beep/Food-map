import { chromium } from 'playwright';

const origin='https://food-map.redfisharthur.workers.dev';
const browser=await chromium.launch({headless:true});
const sizes=[{width:360,height:800},{width:390,height:844},{width:430,height:932},{width:768,height:1024}];
try {
  for (const viewport of sizes) {
    const page=await browser.newPage({viewport,deviceScaleFactor:1,locale:'zh-TW',isMobile:viewport.width<600,hasTouch:viewport.width<600});
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(origin,{waitUntil:'domcontentloaded',timeout:30000});
    await page.locator('#home-image-hotspots .county-hit').first().waitFor();
    const countyCount=await page.locator('#home-image-hotspots .county-hit').count();
    const names=await page.locator('#home-image-hotspots .county-hit').evaluateAll(items=>new Set(items.map(x=>x.dataset.county)).size);
    if(names!==19 || countyCount<19)throw new Error('County SVG regions '+countyCount+' counties '+names);
    if(await page.locator('#home-view .site-head,#home-view #county-list,#home-view .home-intro').count())throw new Error('Homepage includes extra text or buttons');
    const ui=await page.evaluate(()=>({
      header:getComputedStyle(document.querySelector('.site-head')).display,
      footer:getComputedStyle(document.querySelector('.site-foot')).display,
      map:getComputedStyle(document.querySelector('#home-image')).display
    }));
    if(ui.header!=='none'||ui.footer!=='none'||ui.map==='none')
      throw new Error('Homepage is not image-only: '+JSON.stringify(ui));
    if((await page.locator('#home-image').evaluate(img=>img.naturalWidth))===0)throw new Error('Homepage map image failed to load');
    const before=await page.evaluate(()=>({doc:document.documentElement.scrollWidth,client:document.documentElement.clientWidth}));
    if(before.doc>before.client+1)throw new Error('Homepage horizontal overflow at '+viewport.width+': '+JSON.stringify(before));
    await page.locator('.county-hit[data-county="彰化縣"]').click();
    await page.locator('#results-view').waitFor({state:'visible'});
    if(viewport.width===360) {
      const images=[];
      page.on('response',res=>{if(res.url().includes('/api/photo'))images.push({status:res.status(),urlLength:res.url().length});});
      await page.locator('.restaurant-card:not(.skeleton)').first().waitFor({timeout:35000});
      const img=page.locator('.restaurant-card:not(.skeleton) img').first();
      await img.waitFor({timeout:12000});
      await img.evaluate(el=>new Promise(resolve=>{
        if(el.complete)return resolve();
        el.addEventListener('load',resolve,{once:true});
        el.addEventListener('error',resolve,{once:true});
      }));
      const state=await img.evaluate(el=>({complete:el.complete,width:el.naturalWidth,height:el.naturalHeight}));
      console.log('PHOTO TEST',JSON.stringify(state),JSON.stringify(images));
      if(!state.width)throw new Error('Live restaurant photo failed: '+JSON.stringify(images));
      const badText=await page.locator('.restaurant-card').allTextContents();
      if(badText.some(txt=>/近期獨立(食記|評價)|查看最新顧客評論|有找到獨立心得/.test(txt)))
        throw new Error('Generic boilerplate feature was displayed');
    }
    const townCount=await page.locator('#town option').count();
    if(townCount<20)throw new Error('Missing towns '+townCount);
    await page.locator('#town').selectOption('溪湖鎮');
    await page.locator('#meals button[data-value="午餐"]').click();
    await page.locator('#cuisines button[data-value="日式"]').click();
    const buttons=await page.locator('button.active').count();
    if(buttons<3)throw new Error('Filter selected state missing');
    const after=await page.evaluate(()=>({doc:document.documentElement.scrollWidth,client:document.documentElement.clientWidth}));
    if(after.doc>after.client+1)throw new Error('Results horizontal overflow at '+viewport.width+': '+JSON.stringify(after));
    if(errors.length)throw new Error('Uncaught client errors '+errors.join(';'));
    console.log('VIEWPORT PASS',viewport.width,'home',before,'results',after,'towns',townCount,'active',buttons);
    await page.close();
  }
} finally {
  await browser.close();
}
