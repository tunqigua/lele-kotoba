// UI wiring checks with a DOM substitute, not a visual browser test.
const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
const els=new Map(),handlers={},storage=new Map();
function el(s){if(!els.has(s))els.set(s,{innerHTML:'',textContent:'',style:{},value:'',dataset:{},classList:{add(){},remove(){},toggle(){}},showModal(){this.open=true;},close(){this.open=false;},click(){},remove(){},files:[]});return els.get(s);}
const document={querySelector(s){if(s==='dialog[open]')return [...els.values()].find(v=>v.open)||null;return el(s);},querySelectorAll(){return[];},addEventListener(n,cb){handlers[n]=cb;},createElement(tag){return {...el(tag+Math.random()),set id(x){els.set('#'+x,this);},get id(){return'';}};},body:{append(){}}};
let clock=Date.parse('2026-10-20T21:48:00+08:00');
const FakeDate=class extends Date{constructor(...args){super(...(args.length?args:[clock]));}static now(){return clock;}};
const initialMath=Object.create(Math);initialMath.random=()=>.999999;
const winHandlers={},ctx={document,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},location:{hash:''},history:{replaceState(a,b,h){ctx.location.hash=h;}},setTimeout(){return 1;},clearTimeout(){},Date:FakeDate,Intl,Map,Set,Math:initialMath,Blob,URL,SpeechSynthesisUtterance(){},console};
ctx.window={...ctx,scrollY:0,scrollTo(){},addEventListener(n,cb){winHandlers[n]=cb;}};
vm.createContext(ctx);for(const f of ['data.js','engine.js','quiz.js','app.js'])vm.runInContext(fs.readFileSync(__dirname+'/../dist/'+f,'utf8'),ctx,{filename:f});
function action(name,data={}){const button={dataset:{action:name,...data},disabled:false};handlers.click({target:{closest(s){return s==='[data-action]'?button:null;}}});}
function nav(v){ctx.location.hash='#'+v;winHandlers.hashchange();}
function options(){return [...el('#main').innerHTML.matchAll(/data-answer="([^"]+)"/g)].map(m=>m[1]);}
const readState=()=>JSON.parse(storage.get(ctx.window.KotobaEngine.KEY));
const first=ctx.window.KOTOBA_DATA.words[0];assert.equal(first.word,'行く');
action('quiz');assert.match(el('#main').innerHTML,/先学词，再训练/);assert.equal(options().length,0);
action('card');action('reveal');assert.match(el('#main').innerHTML,/联合记忆/);action('rate',{grade:'good'});assert.equal(readState().words[first.id].seen,1);
action('quiz');assert.equal(options().length,0,'today’s new cards wait until tomorrow for reading');clock+=86400000;winHandlers.focus();action('quiz');
function answer(correct=true){const o=options();assert.equal(o.length,4);assert.equal(new Set(o).size,4);const a=o.find(v=>v==='いく'||v==='行く');assert.ok(a);action('quizAnswer',{answer:correct?a:o.find(v=>v!==a)});}
for(let i=0;i<4;i++){answer();action('nextQuiz');assert.equal(options().length,0);if(i<3){clock+=86400000;winHandlers.focus();}}assert.equal(readState().words[first.id].readingStreak,4);
clock+=86400000;winHandlers.focus();answer(false);assert.match(el('#main').innerHTML,/计数已归零/);assert.equal(readState().words[first.id].readingStreak,0);action('nextQuiz');
assert.equal(options().length,4);answer(true);assert.match(el('#main').innerHTML,/今日订正完成/);action('nextQuiz');assert.equal(options().length,0);assert.equal(readState().words[first.id].readingStreak,0);
for(let i=0;i<5;i++){clock+=86400000;winHandlers.focus();answer();action('nextQuiz');assert.equal(options().length,0);}assert.equal(readState().words[first.id].readingStreak,5);assert.match(el('#main').innerHTML,/本轮读音练习已完成/);
for(const v of ['library','mistakes','review','stats','about','today']){nav(v);assert.ok(el('#main').innerHTML.length>300);assert.ok(!el('#main').innerHTML.includes('undefined'));}
nav('library');handlers.input({target:{id:'wordSearch',value:'借りる'}});assert.match(el('#wordTable').innerHTML,/借りる/);
const id=ctx.window.KOTOBA_DATA.words.find(w=>w.word==='借りる').id;action('detail',{id});assert.match(el('#detailContent').innerHTML,/かりられる/);assert.match(el('#detailContent').innerHTML,/联合记忆/);el('#detailDialog').close();action('star',{id});nav('mistakes');assert.match(el('#main').innerHTML,/借りる/);
action('settings');assert.ok(el('#settingsDialog').open);el('#newGoal').value='30';el('#reviewGoal').value='60';el('#saveSettings').onclick();assert.equal(readState().settings.newGoal,30);
// Exercise the actual card buttons as well as the shared scheduling engine.
const repeatState=ctx.window.KotobaEngine.fresh();repeatState.settings.newGoal=3;
winHandlers.storage({key:ctx.window.KotobaEngine.KEY,newValue:JSON.stringify(repeatState)});
nav('today');action('card');
const cardWord=()=>el('#main').innerHTML.match(/<div class="word-core"><h2 lang="ja">([^<]+)<\/h2>/)?.[1];
let repeated=0,cardSteps=0;
while(repeated<7&&cardSteps++<30){
 const word=cardWord();assert.ok(word);
 action('reveal');
 if(word===first.word){action('rate',{grade:repeated++%2?'again':'hard'});assert.equal(readState().words[first.id].relearning,true);}
 else action('rate',{grade:'good'});
}
assert.equal(repeated,7,'both non-good buttons must keep returning the word after the old two-retry cap');
assert.match(el('#main').innerHTML,/本组 2 \/ 3/);
assert.equal(cardWord(),first.word);
winHandlers.storage({key:ctx.window.KotobaEngine.KEY,newValue:JSON.stringify(readState())});
assert.equal(cardWord(),first.word,'unfinished word must survive a validated reload');
action('reveal');action('rate',{grade:'good'});
assert.equal(readState().words[first.id].relearning,false);
assert.match(el('#main').innerHTML,/这一组，已经记进去了/);
console.log('PASS: six views; reading low-frequency transition/reset; repeated again/hard until good; reload persistence; stable group progress; phrases, search, details, favorites and settings.');
// The new list uses reading errors only, and its badge updates on the fifth error.
const E=ctx.window.KotobaEngine,known=ctx.window.KOTOBA_DATA.words.slice(0,3);
handlers.input({target:{id:'wordSearch',value:''}});
const wrongState=E.fresh();E.rate(wrongState,first.id,'good');
for(let i=0;i<4;i++)E.recordReading(wrongState,first.id,false,i%2?'kana':'kanji');
winHandlers.storage({key:E.KEY,newValue:JSON.stringify(wrongState)});nav('extreme');
assert.match(el('#main').innerHTML,/还没有符合条件的极易错词/);assert.equal(el('#extremeNav').textContent,0);
nav('today');action('quiz');answer(false);assert.equal(readState().words[first.id].readingWrong,5);
assert.equal(el('#extremeNav').textContent,1);nav('extreme');assert.match(el('#main').innerHTML,/累计错 5 次/);
assert.match(el('#main').innerHTML,/行く/);
// A tab left open on the empty review page updates at Beijing midnight, with no reload.
clock=Date.parse('2026-10-20T21:48:00+08:00');
ctx.Math=Object.create(Math);ctx.Math.random=()=>.1;winHandlers.focus();
const daily=E.fresh();for(const w of known)E.rate(daily,w.id,'good',clock);
winHandlers.storage({key:E.KEY,newValue:JSON.stringify(daily)});nav('review');
assert.equal(options().length,0);assert.match(el('#main').innerHTML,/到期的词，都复习好了/);
clock=Date.parse('2026-10-21T00:00:00+08:00');winHandlers.focus();
assert.equal(el('#dueNav').textContent,3);assert.equal(options().length,4);
assert.ok(!el('#main').innerHTML.includes('data-action="card"'),'review must not have separate card/reading tabs');
const modes=new Set();let steps=0,wrongOnce=false;
while(!el('#main').innerHTML.includes('到期的词，都复习好了')&&steps++<15){
 const o=options();
 if(o.length){
  modes.add('quiz');const prompt=el('#main').innerHTML.match(/<h2 lang="ja" class="[^"]*">([^<]+)<\/h2>/)?.[1];
  const w=known.find(w=>w.kana===prompt||ctx.window.KotobaQuiz.written(w)===prompt);assert.ok(w,prompt);
  const a=o.find(v=>v===w.kana||v===ctx.window.KotobaQuiz.written(w));assert.ok(a);
  action('quizAnswer',{answer:wrongOnce?a:o.find(v=>v!==a)});wrongOnce=true;
  assert.match(el('#main').innerHTML,/quiz-feedback/,'feedback stays visible until Continue');
  ctx.Math.random=()=>.9;action('nextQuiz');
 }else{
  modes.add('card');assert.ok(cardWord());action('reveal');ctx.Math.random=()=>.1;action('rate',{grade:'good'});
 }
}
assert.ok(steps<15);assert.deepEqual([...modes].sort(),['card','quiz']);
assert.equal(E.counts(readState(),clock).due,0);assert.equal(E.counts(readState(),clock+E.DAY).due,1,'today’s reading error is scheduled again tomorrow');
// Stable readings get word cards until their low-frequency check becomes due.
const graduated=E.fresh();E.rate(graduated,first.id,'good',clock-E.DAY);graduated.words[first.id].readingRule='daily-v1';graduated.words[first.id].readingStreak=5;graduated.words[first.id].readingDue=E.reviewDue(clock,7);
winHandlers.storage({key:E.KEY,newValue:JSON.stringify(graduated)});nav('review');ctx.Math.random=()=>.1;
assert.equal(options().length,0);assert.equal(cardWord(),first.word);
console.log('PASS: extreme fifth-error list; live midnight unlock; mixed review cards/questions; feedback, retries and next-day errors; stable readings rest between checks.');

// Low-frequency checks return at midnight, extend on success, and recover on failure.
const maintenance=E.fresh();E.rate(maintenance,first.id,'good',clock);
maintenance.words[first.id].readingRule='daily-v1';maintenance.words[first.id].readingStreak=5;maintenance.words[first.id].readingStage=0;
maintenance.words[first.id].readingDue=E.reviewDue(clock,7);maintenance.words[first.id].due=E.reviewDue(clock,60);
winHandlers.storage({key:E.KEY,newValue:JSON.stringify(maintenance)});nav('today');action('quiz');
assert.equal(options().length,0);assert.match(el('#main').innerHTML,/下次读音练习/);
clock=maintenance.words[first.id].readingDue;winHandlers.focus();assert.equal(options().length,4);
answer(true);assert.match(el('#main').innerHTML,/已转低频抽查/);
assert.equal(readState().words[first.id].readingStage,1);assert.equal(readState().words[first.id].readingDue,E.reviewDue(clock,14));
action('nextQuiz');assert.equal(options().length,0);
const checkState=readState();checkState.words[first.id].due=E.reviewDue(clock,60);
winHandlers.storage({key:E.KEY,newValue:JSON.stringify(checkState)});nav('review');
assert.equal(options().length,0);clock=checkState.words[first.id].readingDue;ctx.Math.random=()=>.9;winHandlers.focus();
assert.equal(options().length,4,'a due reading check must be served even when random selection would prefer a card');
answer(false);const failed=readState().words[first.id];
assert.equal(failed.readingStreak,0);assert.equal(failed.readingDue,0);assert.equal(failed.readingWrong,1);assert.equal(failed.reviewPending,true);
winHandlers.storage({key:E.KEY,newValue:JSON.stringify(readState())});
assert.equal(options().length,4,'an unfinished failed reading review remains a reading question after reload');
answer(true);assert.equal(readState().words[first.id].readingStreak,0);action('nextQuiz');nav('today');action('quiz');
assert.equal(options().length,0,'after correction, this word stops for today');clock+=E.DAY;winHandlers.focus();
assert.equal(options().length,4,'failed stable word returns to normal training on the next day');
console.log('PASS: low-frequency empty state; midnight return; 14-day extension; mixed review forced check; failure/reset and unfinished review reload.');

// Both prior storage versions migrate automatically; old tabs cannot overwrite the new schedule.
const legacyProgress=E.fresh();E.rate(legacyProgress,first.id,'good',clock);
legacyProgress.words[first.id].star=true;for(let i=0;i<5;i++)E.recordReading(legacyProgress,first.id,true,'kana',clock+(i-4)*E.DAY);delete legacyProgress.words[first.id].readingRule;delete legacyProgress.words[first.id].readingDue;delete legacyProgress.words[first.id].readingStage;delete legacyProgress.words[first.id].readingDoneDay;
const legacyJson=JSON.stringify(legacyProgress);
for(const legacyKey of E.LEGACY_KEYS){
 storage.delete(E.KEY);for(const key of E.LEGACY_KEYS)storage.delete(key);storage.set(legacyKey,legacyJson);
 ctx.location.hash='#today';vm.runInContext(fs.readFileSync(__dirname+'/../dist/app.js','utf8'),ctx,{filename:'app.js'});
 const migrated=readState().words[first.id];assert.equal(migrated.seen,1);assert.equal(migrated.star,true);
 assert.equal(migrated.readingStreak,5);assert.equal(migrated.readingDue,E.reviewDue(clock,7));
 assert.equal(storage.get(legacyKey),legacyJson,'migration leaves old storage untouched');
}
console.log('PASS: automatic legacy progress migration to isolated daily-plan storage.');
// Regular cards and the extra-new-word button both draw across the full word pool.
function randomSeed(seed){let n=seed;return()=>{n=(1664525*n+1013904223)>>>0;return n/4294967296;};}
const allWords=ctx.window.KOTOBA_DATA.words,randomState=E.fresh();randomState.settings.newGoal=1;
const expectedFirst=E.queue(allWords,randomState,'new',clock,randomSeed(73))[0];
ctx.Math.random=randomSeed(73);winHandlers.storage({key:E.KEY,newValue:JSON.stringify(randomState)});nav('today');action('card');
assert.equal(cardWord(),ctx.window.KotobaQuiz.written(expectedFirst));
assert.ok(!Array.from(allWords.slice(0,20)).some(w=>w.id===expectedFirst.id),'daily card must not be confined to the alphabetic prefix');
action('reveal');action('rate',{grade:'good'});assert.match(el('#main').innerHTML,/这一组，已经记进去了/);
const afterRandom=readState(),expectedExtra=E.shuffle(E.filter(allWords,afterRandom.settings).filter(w=>!afterRandom.words[w.id]?.seen),randomSeed(101)).slice(0,10);
ctx.Math.random=randomSeed(101);action('extra');assert.equal(cardWord(),ctx.window.KotobaQuiz.written(expectedExtra[0]));
const extraSeen=new Set();for(let i=0;i<10;i++){const label=cardWord();assert.equal(label,ctx.window.KotobaQuiz.written(expectedExtra[i]));assert.ok(!extraSeen.has(label));extraSeen.add(label);action('reveal');action('rate',{grade:'good'});}
assert.match(el('#main').innerHTML,/这一组，已经记进去了/);
console.log('PASS: new cards and extra-new draws randomize the full pool; learned-only review excludes unseen words.');
// The daily reading group is yesterday's 20 plus 10 earlier learned words, fixed at 30.
const daily30=E.fresh(),yesterdaySet=new Set(Array.from(allWords.slice(0,20),w=>w.id));
for(const w of allWords.slice(0,20))E.rate(daily30,w.id,'good',clock-E.DAY);
for(const w of allWords.slice(20,60))E.rate(daily30,w.id,'good',clock-7*E.DAY);
for(const w of allWords.slice(60,70))E.rate(daily30,w.id,'good',clock);
const originalQuestion=ctx.window.KotobaQuiz.createQuestion;let lastQuestion;
ctx.window.KotobaQuiz.createQuestion=(...args)=>(lastQuestion=originalQuestion(...args));
ctx.Math.random=randomSeed(67);winHandlers.storage({key:E.KEY,newValue:JSON.stringify(daily30)});nav('today');action('quiz');
const fixedIds=readState().readingPlan.ids;assert.equal(fixedIds.length,30);assert.equal(fixedIds.filter(id=>yesterdaySet.has(id)).length,20);
assert.ok(!fixedIds.some(id=>Array.from(allWords.slice(60,70),w=>w.id).includes(id)));
const completedIds=new Set();let attempts30=0;
while(options().length&&attempts30++<40){
 assert.ok(lastQuestion&&fixedIds.includes(lastQuestion.id));
 const snapshot=readState();if(fixedIds.some(id=>yesterdaySet.has(id)&&snapshot.words[id].readingDoneDay!==E.today(clock)))assert.ok(yesterdaySet.has(lastQuestion.id));
 const correct=attempts30!==1,id=lastQuestion.id;action('quizAnswer',{answer:correct?lastQuestion.answer:lastQuestion.options.find(a=>a!==lastQuestion.answer)});
 if(correct)completedIds.add(id);action('nextQuiz');
 if(attempts30===3){winHandlers.storage({key:E.KEY,newValue:JSON.stringify(readState())});assert.deepEqual(readState().readingPlan.ids,fixedIds);}
}
assert.equal(attempts30,31);assert.equal(completedIds.size,30);assert.equal(options().length,0);assert.match(el('#main').innerHTML,/今日读音 30 \/ 30/);
nav('stats');nav('today');action('quiz');assert.equal(options().length,0,'finished daily plan never refills with another thirty words');
assert.deepEqual(readState().readingPlan.ids,fixedIds);
clock+=E.DAY;winHandlers.focus();assert.equal(readState().readingPlan.day,E.today(clock));assert.equal(readState().readingPlan.ids.length,30);
assert.ok(Array.from(allWords.slice(60,70),w=>w.id).every(id=>readState().readingPlan.ids.includes(id)));
ctx.window.KotobaQuiz.createQuestion=originalQuestion;
// Five actual card presses qualify separately from pronunciation errors.
const cardOnly=E.fresh();cardOnly.settings.newGoal=1;ctx.Math.random=()=>.999999;
winHandlers.storage({key:E.KEY,newValue:JSON.stringify(cardOnly)});nav('today');action('card');
for(let i=1;i<=5;i++){action('reveal');action('rate',{grade:'again'});assert.equal(readState().words[first.id].cardAgainStreak,i);assert.equal(el('#extremeNav').textContent,i===5?1:0);}
action('reveal');action('rate',{grade:'good'});nav('extreme');assert.match(el('#main').innerHTML,/最高连点 5 次/);assert.match(el('#main').innerHTML,/行く/);
assert.equal(readState().words[first.id].readingWrong||0,0);
console.log('PASS: fixed 20+10 daily reading list; yesterday first; correction does not add a slot; midnight rollover; fifth card-again inclusion.');
