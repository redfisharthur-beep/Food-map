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
    await page.locator('#county-list .county-button').first().waitFor();
    const countyCount=await page.locator('#county-list .county-button').count();
    if(countyCount!==22)throw new Error('County count '+countyCount);
    const before=await page.evaluate(()=>({doc:document.documentElement.scrollWidth,client:document.documentElement.clientWidth}));
    if(before.doc>before.client+1)throw new Error('Homepage horizontal overflow at '+viewport.width+': '+JSON.stringify(before));
    await page.getByRole('button',{name:'彰化縣'}).click();
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
