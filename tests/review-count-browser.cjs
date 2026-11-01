const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const E=require('../dist/engine.js');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const ctx={window:{}};vm.runInNewContext(fs.readFileSync(__dirname+'/../dist/data.js','utf8'),ctx);
  const s=E.fresh(),now=Date.now(),errors=[];s.settings.newGoal=1;
  for(const w of ctx.window.KOTOBA_DATA.words.slice(0,3))E.rate(s,w.id,'good',now-4*E.DAY);
  const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(seed=>{if(!sessionStorage.getItem('review-test')){localStorage.setItem('lele-kotoba-v4',JSON.stringify(seed));sessionStorage.setItem('review-test','1');}},s);
  await page.goto(process.env.TEST_URL||'http://127.0.0.1:8883');
  const state=()=>page.evaluate(()=>JSON.parse(localStorage.getItem(window.KotobaEngine.KEY)));
  const initial=await state();
  await page.locator('[data-action="reveal"]').click();await page.locator('[data-action="rate"][data-grade="good"]').click();
  assert.match(await page.locator('.right-rail').textContent(),/今日复习1 \/ 50/);
  const after=await state();assert.equal(after.logs.length,initial.logs.length+1);
  assert.deepEqual(after.logs.slice(0,initial.logs.length),initial.logs);
  assert.equal(Object.values(after.words).filter(w=>w.seen>0).length,3);
  await page.reload();assert.match(await page.locator('.right-rail').textContent(),/今日复习1 \/ 50/);
  await page.locator('[data-view="review"]').click();assert.match(await page.locator('.right-rail').textContent(),/今日复习1 \/ 50/);
  assert.deepEqual((await state()).logs,after.logs);assert.deepEqual(errors,[]);
  console.log('PASS: mixed-study old-word completion counts immediately, survives reload and review navigation, and preserves all prior logs.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
