const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),vm=require('node:vm'),E=require('../dist/engine.js');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000},colorScheme:'light'}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const data={window:{}};vm.runInNewContext(fs.readFileSync(__dirname+'/../dist/data.js','utf8'),data);
  const seed=E.fresh(),known=data.window.KOTOBA_DATA.words[0];E.rate(seed,known.id,'good',Date.now()-3*E.DAY);
  seed.words[known.id].star=true;seed.words[known.id].readingWrong=2;
  await page.addInitScript(({key,seed})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(seed));},{key:E.KEY,seed});
  const url=process.env.TEST_URL||'http://127.0.0.1:8883';
  await page.goto(url);const toggle=page.locator('[data-action="togglePlan"]');
  const records=()=>page.evaluate(()=>{const s=JSON.parse(localStorage.getItem(window.KotobaEngine.KEY));return {words:s.words,logs:s.logs,settings:s.settings,readingPlan:s.readingPlan};});
  const stacked=async()=>{
   const core=await page.locator('.is-revealed>.word-core').boundingBox(),detail=await page.locator('.is-revealed>.card-detail').boundingBox(),bottom=await page.locator('.is-revealed>.card-bottom').boundingBox();
   assert(detail.y>=core.y+core.height-1,'explanations must sit below the word');
   assert(Math.abs(detail.x-core.x)<2,'word and explanations use the same column');
   assert(bottom.y>=detail.y+detail.height-1,'the footer must follow the complete explanation');
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal overflow');
   assert(await page.locator('.card-detail').evaluate(el=>el.scrollHeight<=el.clientHeight+1),'notes must not need a separate scrollbar');
  };
  assert.equal(await toggle.getAttribute('aria-expanded'),'true');
  assert.equal(await toggle.evaluate(el=>el.parentElement.id),'planTogglePanel');
  assert.equal(await toggle.innerText(),'');assert.equal(await toggle.locator('svg').count(),1);
  assert.equal(await toggle.getAttribute('aria-label'),'收起学习计划');
  await page.locator('[data-action="reveal"]').click();await stacked();
  const before=await records(),word=await page.locator('.word-core h2').textContent(),width=(await page.locator('.study-card').boundingBox()).width;
  await toggle.click();assert.equal(await toggle.getAttribute('aria-expanded'),'false');assert(!(await page.locator('#studyPlan').isVisible()));
  assert.equal(await toggle.evaluate(el=>el.parentElement.id),'planToggleToolbar');
  assert.equal(await toggle.getAttribute('title'),'展开学习计划');
  assert((await page.locator('.study-card').boundingBox()).width>width+200,'collapsed plan must give the card its width');
  assert.equal(await page.locator('.word-core h2').textContent(),word);assert.deepEqual(await records(),before);
  assert.equal(await toggle.evaluate(el=>el===document.activeElement),true,'keyboard focus stays on the toggle');
  await stacked();await page.reload();assert.equal(await toggle.getAttribute('aria-expanded'),'false');
  await page.locator('[data-action="reveal"]').click();await stacked();
  for(const viewport of [{width:1920,height:1080},{width:1280,height:900},{width:1024,height:700}]){await page.setViewportSize(viewport);await stacked();}
  await toggle.click();assert(await page.locator('#studyPlan').isVisible());await stacked();
  assert.equal(await toggle.evaluate(el=>el.parentElement.id),'planTogglePanel');
  await page.emulateMedia({colorScheme:'dark'});await stacked();
  if(process.env.SCREENSHOT_DIR){await page.emulateMedia({colorScheme:'light'});await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:process.env.SCREENSHOT_DIR+'/plan-expanded.png',fullPage:true});await toggle.click();await page.screenshot({path:process.env.SCREENSHOT_DIR+'/plan-collapsed.png',fullPage:true});}
  await page.locator('[data-action="quiz"]').click();await page.locator('[data-action="quizAnswer"]').first().click();
  const answered=await page.locator('.quiz-card').innerHTML(),afterAnswer=await records();
  await toggle.click();assert.equal(await page.locator('.quiz-card').innerHTML(),answered);assert.deepEqual(await records(),afterAnswer);
  await page.locator('[data-view="review"]').click();assert.equal(await toggle.count(),1);await toggle.click();
  await page.locator('[data-view="grind"]').click();assert.equal(await toggle.count(),1);
  const grindPlanVisible=await page.locator('#studyPlan').isVisible();await toggle.click();assert.equal(await page.locator('#studyPlan').isVisible(),!grindPlanVisible);
  const mobile=await browser.newPage({viewport:{width:390,height:844}});await mobile.goto(url);
  const mobileToggle=mobile.locator('[data-action="togglePlan"]');assert.equal(await mobileToggle.getAttribute('aria-expanded'),'false');
  await mobile.locator('[data-action="reveal"]').click();await mobileToggle.click();assert(await mobile.locator('#studyPlan').isVisible());
  assert(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  if(process.env.SCREENSHOT_DIR)await mobile.screenshot({path:process.env.SCREENSHOT_DIR+'/plan-mobile.png',fullPage:true});
  assert.deepEqual(errors,[]);console.log('PASS: stacked word cards, full-width collapse, preserved records and focus, reload persistence, desktop/mobile/dark layouts, and review/grind controls.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
