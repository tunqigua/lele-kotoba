// UI wiring checks with a DOM substitute, not a visual browser test.
const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
const els=new Map(),handlers={},storage=new Map(),spoken=[];
function el(s){if(!els.has(s))els.set(s,{innerHTML:'',textContent:'',style:{},value:'',dataset:{},classList:{add(){},remove(){},toggle(){}},showModal(){this.open=true;},close(){this.open=false;},click(){},remove(){},files:[]});return els.get(s);}
const document={querySelector(s){if(s==='dialog[open]')return [...els.values()].find(v=>v.open)||null;return el(s);},querySelectorAll(){return[];},addEventListener(n,cb){handlers[n]=cb;},createElement(tag){return {...el(tag+Math.random()),set id(x){els.set('#'+x,this);},get id(){return'';}};},body:{append(){}}};
let studyTimer;
let clock=Date.parse('2026-10-20T21:48:00+08:00');
const FakeDate=class extends Date{constructor(...args){super(...(args.length?args:[clock]));}static now(){return clock;}};
const initialMath=Object.create(Math);initialMath.random=()=>.999999;
const winHandlers={},ctx={document,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},location:{hash:''},history:{replaceState(a,b,h){ctx.location.hash=h;}},setTimeout(cb,delay){if(delay===20000)studyTimer=cb;return 1;},clearTimeout(){},Date:FakeDate,Intl,Map,Set,Math:initialMath,Blob,URL,SpeechSynthesisUtterance:function(text){this.text=text;},speechSynthesis:{getVoices:()=>[{lang:'ja-JP',name:'test'}],cancel(){},speak(u){spoken.push(u);}},console};
ctx.window={...ctx,scrollY:0,scrollTo(){},addEventListener(n,cb){winHandlers[n]=cb;}};
vm.createContext(ctx);for(const f of ['data.js','engine.js','quiz.js','app.js'])vm.runInContext(fs.readFileSync(__dirname+'/../dist/'+f,'utf8'),ctx,{filename:f});
function action(name,data={}){const before=spoken.length,button={dataset:{action:name,...data},disabled:false};handlers.click({target:{closest(s){return s==='[data-action]'?button:null;}}});if(!['reveal','speak','quizAnswer'].includes(name))assert.equal(spoken.length,before,'navigation, next questions and rerenders must be silent');}
function nav(v){const before=spoken.length;ctx.location.hash='#'+v;winHandlers.hashchange();assert.equal(spoken.length,before,'changing sections must not pronounce an answer');}
function options(){return [...el('#main').innerHTML.matchAll(/data-answer="([^"]+)"/g)].map(m=>m[1]);}
const readState=()=>JSON.parse(storage.get(ctx.window.KotobaEngine.KEY));
const first=ctx.window.KOTOBA_DATA.words[0];assert.equal(first.word,'行く');
action('quiz');assert.match(el('#main').innerHTML,/先学词，再训练/);assert.equal(options().length,0);
assert.equal(spoken.length,0,'startup and unopened questions must be silent');action('card');assert.ok(!el('#main').innerHTML.includes('常用搭配与用法'),'usage stays hidden until reveal');action('reveal');assert.equal(spoken.length,1);assert.match(el('#main').innerHTML,/常用搭配与用法/);assert.match(el('#main').innerHTML,/がっこうにいく/);assert.match(el('#main').innerHTML,/去学校/);assert.match(el('#main').innerHTML,/联合记忆/);action('rate',{grade:'good'});assert.equal(readState().words[first.id].seen,1);
action('quiz');assert.equal(options().length,0,'today’s new cards wait until tomorrow for reading');clock+=86400000;winHandlers.focus();action('quiz');assert.equal(spoken.length,1,'a new unanswered reading question must be silent');
function answer(correct=true){const o=options();assert.equal(o.length,4);assert.equal(new Set(o).size,4);const a=o.find(v=>v==='いく'||v==='行く');assert.ok(a);const before=spoken.length;action('quizAnswer',{answer:correct?a:o.find(v=>v!==a)});assert.equal(spoken.length,before+1,'both right and wrong choices trigger exactly one pronunciation');assert.equal(spoken.at(-1).text,first.kana,'always pronounce the target, never the wrong option');assert.equal(spoken.at(-1).lang,'ja-JP');action('quizAnswer',{answer:a});assert.equal(spoken.length,before+1,'duplicate answer clicks must not repeat speech');}
for(let i=0;i<4;i++){answer();action('nextQuiz');assert.equal(options().length,0);if(i<3){clock+=86400000;winHandlers.focus();}}assert.equal(readState().words[first.id].readingStreak,4);
clock+=86400000;winHandlers.focus();answer(false);assert.match(el('#main').innerHTML,/计数已归零/);assert.equal(readState().words[first.id].readingStreak,0);action('nextQuiz');
assert.equal(options().length,4);answer(true);assert.match(el('#main').innerHTML,/今日订正完成/);action('nextQuiz');assert.equal(options().length,0);assert.equal(readState().words[first.id].readingStreak,0);
for(let i=0;i<5;i++){clock+=86400000;winHandlers.focus();answer();action('nextQuiz');assert.equal(options().length,0);}assert.equal(readState().words[first.id].readingStreak,5);assert.match(el('#main').innerHTML,/本轮读音练习已完成/);
for(const v of ['library','mistakes','review','stats','about','today']){nav(v);assert.ok(el('#main').innerHTML.length>300);assert.ok(!el('#main').innerHTML.includes('undefined'));}
nav('library');handlers.input({target:{id:'wordSearch',value:'借りる'}});assert.match(el('#wordTable').innerHTML,/借りる/);
const id=ctx.window.KOTOBA_DATA.words.find(w=>w.word==='借りる').id;action('detail',{id});assert.match(el('#detailContent').innerHTML,/常用搭配与用法/);assert.match(el('#detailContent').innerHTML,/かりられる/);assert.match(el('#detailContent').innerHTML,/联合记忆/);el('#detailDialog').close();action('star',{id});nav('mistakes');assert.match(el('#main').innerHTML,/借りる/);
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
const daily=E.fresh();for(const w of known){E.rate(daily,w.id,'hard',clock);E.rate(daily,w.id,'good',clock);}
winHandlers.storage({key:E.KEY,newValue:JSON.stringify(daily)});nav('review');
assert.equal(options().length,0);assert.match(el('#main').innerHTML,/今日错词复习已完成/);
clock=Date.parse('2026-10-21T00:00:00+08:00');winHandlers.focus();
assert.equal(el('#dueNav').textContent,3);assert.equal(options().length,4);
assert.ok(!el('#main').innerHTML.includes('data-action="card"'),'review must not have separate card/reading tabs');
const modes=new Set();let steps=0,wrongOnce=false;
while(!el('#main').innerHTML.includes('今日错词复习已完成')&&steps++<15){
 const o=options();
 if(o.length){
  modes.add('quiz');const prompt=el('#main').innerHTML.match(/<h2 lang="ja" class="[^"]*">([^<]+)<\/h2>/)?.[1];
  const w=known.find(w=>w.kana===prompt||w.meaning===prompt||ctx.window.KotobaQuiz.written(w)===prompt);assert.ok(w,prompt);
  const a=o.find(v=>v===w.kana||v===ctx.window.KotobaQuiz.written(w));assert.ok(a);
  action('quizAnswer',{answer:wrongOnce?a:o.find(v=>v!==a)});wrongOnce=true;
  assert.match(el('#main').innerHTML,/quiz-feedback/,'feedback stays visible until Continue');
  ctx.Math.random=()=>.9;action('nextQuiz');
 }else{
  modes.add('card');assert.ok(cardWord());action('reveal');ctx.Math.random=()=>.1;action('rate',{grade:'good'});
 }
}
assert.ok(steps<15);assert.deepEqual([...modes].sort(),['card','quiz']);
assert.equal(E.counts(readState(),clock).due,0);assert.equal(E.counts(readState(),clock+E.DAY).due,3,'the previous three days of errors are selected again tomorrow');
// Stable readings get word cards until their low-frequency check becomes due.
const graduated=E.fresh();E.rate(graduated,first.id,'hard',clock-E.DAY);E.rate(graduated,first.id,'good',clock-E.DAY);graduated.words[first.id].readingRule='daily-v1';graduated.words[first.id].readingStreak=5;graduated.words[first.id].readingDue=E.reviewDue(clock,7);
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
assert.equal(options().length,0);clock=checkState.words[first.id].readingDue;
checkState.logs.push({id:first.id,day:E.today(clock-E.DAY),grade:'quizWrong',isNew:false});
winHandlers.storage({key:E.KEY,newValue:JSON.stringify(checkState)});ctx.Math.random=()=>.9;winHandlers.focus();
assert.equal(options().length,4,'a due reading check must be served even when random selection would prefer a card');
answer(false);const failed=readState().words[first.id];
assert.equal(failed.readingStreak,0);assert.equal(failed.readingDue,0);assert.equal(failed.readingWrong,2);assert.equal(failed.reviewPending,true);
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
// Yesterday's complete group plus ten historical words may exceed thirty.
const daily35=E.fresh(),yesterdaySet=new Set(Array.from(allWords.slice(0,25),w=>w.id));
for(const w of allWords.slice(0,25))E.rate(daily35,w.id,'good',clock-E.DAY);
for(const w of allWords.slice(25,60))E.rate(daily35,w.id,'good',clock-7*E.DAY);
for(const w of allWords.slice(60,70))E.rate(daily35,w.id,'good',clock);
const originalQuestion=ctx.window.KotobaQuiz.createQuestion;let lastQuestion;
ctx.window.KotobaQuiz.createQuestion=(...args)=>(lastQuestion=originalQuestion(...args));
ctx.Math.random=randomSeed(67);winHandlers.storage({key:E.KEY,newValue:JSON.stringify(daily35)});nav('today');action('quiz');
const fixedIds=readState().readingPlan.ids;assert.equal(fixedIds.length,35);assert.equal(fixedIds.filter(id=>yesterdaySet.has(id)).length,25);
assert.ok(!fixedIds.some(id=>Array.from(allWords.slice(60,70),w=>w.id).includes(id)));
const completedIds=new Set();let attempts35=0;const audioModes=new Set();
while(options().length&&attempts35++<40){
 assert.ok(lastQuestion&&fixedIds.includes(lastQuestion.id));
 const snapshot=readState();if(fixedIds.some(id=>yesterdaySet.has(id)&&snapshot.words[id].readingDoneDay!==E.today(clock)))assert.ok(yesterdaySet.has(lastQuestion.id));
 const correct=attempts35!==1,id=lastQuestion.id,beforeAudio=spoken.length;audioModes.add(lastQuestion.type);action('quizAnswer',{answer:correct?lastQuestion.answer:lastQuestion.options.find(a=>a!==lastQuestion.answer)});assert.equal(spoken.length,beforeAudio+1);assert.equal(spoken.at(-1).text,allWords.find(w=>w.id===id).kana);
 if(correct)completedIds.add(id);action('nextQuiz');
 if(attempts35===3){winHandlers.storage({key:E.KEY,newValue:JSON.stringify(readState())});assert.deepEqual(readState().readingPlan.ids,fixedIds);}
}
assert.equal(attempts35,36);assert.equal(completedIds.size,35);assert.deepEqual([...audioModes].sort(),['kana','kanji']);assert.equal(options().length,0);assert.match(el('#main').innerHTML,/今日读音 35 \/ 35/);
nav('stats');nav('today');action('quiz');assert.equal(options().length,0,'finished daily plan never refills with more historical words');
assert.deepEqual(readState().readingPlan.ids,fixedIds);
clock+=E.DAY;winHandlers.focus();assert.equal(readState().readingPlan.day,E.today(clock));assert.equal(readState().readingPlan.ids.length,20);
assert.ok(Array.from(allWords.slice(60,70),w=>w.id).every(id=>readState().readingPlan.ids.includes(id)));
ctx.window.KotobaQuiz.createQuestion=originalQuestion;
// Five actual card presses qualify separately from pronunciation errors.
const cardOnly=E.fresh();cardOnly.settings.newGoal=1;ctx.Math.random=()=>.999999;
winHandlers.storage({key:E.KEY,newValue:JSON.stringify(cardOnly)});nav('today');action('card');
for(let i=1;i<=5;i++){action('reveal');action('rate',{grade:'again'});assert.equal(readState().words[first.id].cardAgainStreak,i);assert.equal(el('#extremeNav').textContent,i===5?1:0);}
action('reveal');action('rate',{grade:'good'});nav('extreme');assert.match(el('#main').innerHTML,/最高连点 5 次/);assert.match(el('#main').innerHTML,/行く/);
assert.equal(readState().words[first.id].readingWrong||0,0);
console.log('PASS: all yesterday words plus ten historical words; backup above thirty; fixed daily draw; midnight rollover; fifth card-again inclusion; correct-target audio after both answer types with no pre-answer or duplicate speech.');

// Unlimited grind uses only questions, independently of daily completion and quotas.
const grindState=E.fresh();grindState.settings.newGoal=1;grindState.settings.reviewGoal=1;grindState.settings.priority='C';grindState.settings.lesson='exam';
const grindKnown=allWords.slice(0,12);
for(const w of grindKnown){E.rate(grindState,w.id,'good',clock-E.DAY);E.recordReading(grindState,w.id,true,'kana',clock);}
grindState.words[grindKnown[11].id].readingStreak=5;grindState.words[grindKnown[11].id].readingDue=E.reviewDue(clock,7);
grindState.words[first.id].grindStreak=4;E.dailyReadingPlan(allWords,grindState,clock);
const regularPlan=JSON.stringify(grindState.readingPlan),regularDone=grindKnown.map(w=>grindState.words[w.id].readingDoneDay);
const originalForWord=ctx.window.KotobaQuiz.questionForWord;let grindQuestion;
ctx.window.KotobaQuiz.questionForWord=(...args)=>(grindQuestion=originalForWord(...args));ctx.Math.random=randomSeed(37);
winHandlers.storage({key:E.KEY,newValue:JSON.stringify(grindState)});nav('grind');
assert.equal(el('#grindNav').textContent,11);assert.equal(options().length,4);assert.match(el('#main').innerHTML,/累计错 0 次/);
assert.ok(!el('#main').innerHTML.includes('data-action="reveal"'),'grind never shows a word card');
assert.ok(!el('#main').innerHTML.includes('data-action="card"'),'grind has no card tab');
const roundIds=new Map(),grindTypes=new Set();let grindSteps=0,lastGrindId=null,wrongGrindId;
while(options().length&&grindSteps++<80){
 const q=grindQuestion,id=q.id,before=readState(),w=grindKnown.find(w=>w.id===id),round=before.grindSession.round;
 assert.ok(w&&id!==grindKnown[11].id);assert.notEqual(id,lastGrindId);lastGrindId=id;
 const inRound=roundIds.get(round)||new Set();assert.ok(!inRound.has(id),'a word occurs only once in a shuffled round');inRound.add(id);roundIds.set(round,inRound);grindTypes.add(q.type);
 const correct=grindSteps!==1,choice=correct?q.answer:q.options.find(a=>a!==q.answer),speechBefore=spoken.length;
 action('quizAnswer',{answer:choice});const after=readState();
 assert.equal(spoken.length,speechBefore+1);assert.equal(spoken.at(-1).text,w.kana);
 assert.equal(after.words[id].grindStreak,correct?(before.words[id].grindStreak||0)+1:0);
 if(!correct){wrongGrindId=id;assert.match(el('#main').innerHTML,/累计错 1 次/);assert.match(el('#main').innerHTML,/狂刷计数已归零/);}
 action('quizAnswer',{answer:q.answer});assert.equal(spoken.length,speechBefore+1);assert.deepEqual(readState().words[id],after.words[id]);
 assert.equal(JSON.stringify(after.readingPlan),regularPlan);assert.deepEqual(grindKnown.map(w=>after.words[w.id].readingDoneDay),regularDone);
 if(after.words[id].grindStreak===5)assert.match(el('#main').innerHTML,/本词已移出狂刷/);
 action('nextQuiz');
}
assert.ok(grindSteps>30&&grindSteps<80);assert.equal(options().length,0);assert.match(el('#main').innerHTML,/狂刷已全部达标/);
assert.equal(el('#grindNav').textContent,0);assert.deepEqual([...grindTypes].sort(),['kana','kanji']);
assert.equal(readState().words[wrongGrindId].readingWrong,1,'success never clears the lifetime wrong total');
nav('stats');nav('grind');assert.equal(options().length,0,'qualified words stay out on re-entry');
// A later uncertain card reopens even a previously cross-day-qualified word; keyboard and speech match clicks.
const reopened=readState(),reopenedId=grindKnown[11].id;E.rate(reopened,reopenedId,'hard',clock);
winHandlers.storage({key:E.KEY,newValue:JSON.stringify(reopened)});assert.equal(options().length,4);assert.equal(el('#grindNav').textContent,1);
const keyIndex=grindQuestion.options.indexOf(grindQuestion.answer),keySpeech=spoken.length;
handlers.keydown({key:String(keyIndex+1),target:{matches(){return false;},closest(){return null;}},preventDefault(){}});
assert.equal(readState().words[reopenedId].grindStreak,1);assert.equal(spoken.length,keySpeech+1);
handlers.keydown({key:'Enter',target:{matches(){return false;},closest(){return null;}},preventDefault(){}});
assert.equal(options().length,4);assert.equal(spoken.length,keySpeech+1,'next question starts silently even with only one remaining word');
ctx.window.KotobaQuiz.questionForWord=originalForWord;
console.log('PASS: question-only unlimited grind; all learned scopes; full shuffled rounds; fifth-success removal; wrong/reset and lifetime label; no daily-plan consumption; navigation persistence; keyboard answers and correct-target speech.');

// Red ru-ending first-class warnings appear beneath the word, without mislabeling second-class verbs.
for(const [name,expected]of [['帰る',true],['入る',true],['走る',true],['食べる',false],['借りる',false],['着る',false]]){
 const w=allWords.find(w=>w.word===name),s=E.fresh();s.settings.newGoal=1;E.rate(s,w.id,'hard',clock-E.DAY);E.rate(s,w.id,'good',clock-E.DAY);
 winHandlers.storage({key:E.KEY,newValue:JSON.stringify(s)});nav('today');action('card');assert.equal(cardWord(),name);
 const warning=/<div class="verb-warning">一类动词<\/div>/;assert.equal(warning.test(el('#main').innerHTML),expected,name+' card');
 if(expected)assert.ok(el('#main').innerHTML.includes('</h2><div class="verb-warning">一类动词</div>'),'warning sits directly below the word');
 action('reveal');assert.equal(warning.test(el('#main').innerHTML),expected,name+' revealed card');
 action('detail',{id:w.id});assert.equal(warning.test(el('#detailContent').innerHTML),expected,name+' detail');el('#detailDialog').close();
 action('quiz');assert.equal(options().length,4);assert.equal(warning.test(el('#main').innerHTML),expected,name+' reading question');
 nav('grind');assert.equal(options().length,4);assert.equal(warning.test(el('#main').innerHTML),expected,name+' grind question');
}
assert.match(fs.readFileSync(__dirname+'/../dist/style.css','utf8'),/\.verb-warning\{color:#b43d39;/);
const importedWord=allWords.find(w=>w.word==='いらっしゃる');action('detail',{id:importedWord.id});assert.match(el('#detailContent').innerHTML,/扩展词表二 第186页/);el('#detailDialog').close();
const firstImport=allWords.find(w=>w.word==='味気ない');action('detail',{id:firstImport.id});assert.match(el('#detailContent').innerHTML,/扩展词表一 第225页/);el('#detailDialog').close();
console.log('PASS: red ru-ending first-class warnings on cards, both question modes and details; second-class verbs remain unmarked; two imported indexes keep distinct source labels.');
for(const [name,source]of [['擦る','初级补充词表 · 原表第93项'],['外出','中级补充词表 · 原表第22项']]){
 const w=allWords.find(w=>w.word===name),s=E.fresh();s.settings.newGoal=1;E.rate(s,w.id,'hard',clock-E.DAY);E.rate(s,w.id,'good',clock-E.DAY);
 winHandlers.storage({key:E.KEY,newValue:JSON.stringify(s)});nav('today');action('card');assert.match(el('#main').innerHTML,new RegExp(source));
 action('reveal');assert.ok(!el('#main').innerHTML.includes('第null页'));assert.ok(!el('#main').innerHTML.includes('第undefined项'));
 action('detail',{id:w.id});assert.ok(el('#detailContent').innerHTML.includes(source));el('#detailDialog').close();
}
console.log('PASS: Word vocabulary uses original entry numbers on cards and details without invented pages.');

// Real app tracking pauses on background/idle, splits midnight, and survives backup.
clock=Date.parse('2025-12-31T23:59:40+08:00');
winHandlers.storage({key:E.KEY,newValue:JSON.stringify(E.fresh())});nav('today');
clock+=20000;studyTimer();clock+=20000;studyTimer();
assert.equal(readState().studyTime['2025-12-31'],20000);
assert.equal(readState().studyTime['2026-01-01'],20000);
document.hidden=true;handlers.visibilitychange();clock+=60000;studyTimer();
assert.equal(readState().studyTime['2026-01-01'],20000,'background time is excluded');
document.hidden=false;handlers.visibilitychange();
for(let i=0;i<7;i++){clock+=20000;studyTimer();}
assert.equal(readState().studyTime['2026-01-01'],140000,'idle tracking stops after two minutes');
handlers.pointerdown();clock+=10000;studyTimer();
assert.equal(readState().studyTime['2026-01-01'],150000,'activity restarts tracking');
nav('stats');clock+=20000;studyTimer();
assert.equal(readState().studyTime['2026-01-01'],150000,'viewing stats is not study time');
assert.match(el('#main').innerHTML,/今天是 2026年01月01日/);
assert.match(el('#main').innerHTML,/aria-current="date"/);
assert.match(el('#main').innerHTML,/未记录/);
assert.match(el('#main').innerHTML,/2026年1月/);
action('calendarPrev');assert.match(el('#main').innerHTML,/2025年12月/);
action('calendarNext');assert.match(el('#main').innerHTML,/2026年1月/);
const timedBackup=E.validate(readState(),new Set(allWords.map(w=>w.id)));
assert.equal(timedBackup.studyTime['2026-01-01'],150000);
// Counterparts in each detail point back to the other verb, with kana and Chinese.
const autoVerb=allWords.find(w=>w.word==='開く（あく）'),transVerb=allWords.find(w=>w.word==='開ける');
action('detail',{id:autoVerb.id});assert.match(el('#detailContent').innerHTML,/自动词/);assert.match(el('#detailContent').innerHTML,/对应他动词/);assert.match(el('#detailContent').innerHTML,/開ける/);assert.match(el('#detailContent').innerHTML,/あける/);el('#detailDialog').close();
action('detail',{id:transVerb.id});assert.match(el('#detailContent').innerHTML,/他动词/);assert.match(el('#detailContent').innerHTML,/对应自动词/);assert.match(el('#detailContent').innerHTML,/開く（あく）/);el('#detailDialog').close();
console.log('PASS: active study time, background/idle pauses, midnight/year split, calendar navigation, backup hours and bidirectional verb details.');

// Calendar red styling uses the exact five-minute threshold and never marks future days.
clock=Date.parse('2026-10-24T12:00:00+08:00');
const redDays=E.fresh();redDays.studyTime={'2026-10-20':0,'2026-10-21':299999,'2026-10-22':300000,'2026-10-23':3600000,'2026-10-24':299999};
winHandlers.storage({key:E.KEY,newValue:JSON.stringify(redDays)});nav('stats');
const dayClass=key=>el('#main').innerHTML.match(new RegExp('<div class="([^"]*)"[^>]*><time datetime="'+key+'"'))?.[1];
for(const day of ['20','21','24'])assert.match(dayClass('2026-10-'+day),/is-short-study/);
assert.match(dayClass('2026-10-19'),/is-short-study/,'unrecorded past dates stay labeled unrecorded but are red');
for(const day of ['22','23','25'])assert.doesNotMatch(dayClass('2026-10-'+day),/is-short-study/);
assert.match(dayClass('2026-10-24'),/is-today/,'today remains identified even when red');
redDays.studyTime['2026-10-24']=300000;
winHandlers.storage({key:E.KEY,newValue:JSON.stringify(redDays)});nav('stats');
assert.doesNotMatch(dayClass('2026-10-24'),/is-short-study/,'exactly five minutes clears red after progress updates');
console.log('PASS: calendar red below five minutes, normal at five minutes, unrecorded dates and future-date exclusion.');
