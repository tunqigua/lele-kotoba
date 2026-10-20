// UI wiring checks with a DOM substitute, not a visual browser test.
const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
const els=new Map(),handlers={},storage=new Map();
function el(s){if(!els.has(s))els.set(s,{innerHTML:'',textContent:'',style:{},value:'',dataset:{},classList:{add(){},remove(){},toggle(){}},showModal(){this.open=true;},close(){this.open=false;},click(){},remove(){},files:[]});return els.get(s);}
const document={querySelector(s){if(s==='dialog[open]')return [...els.values()].find(v=>v.open)||null;return el(s);},querySelectorAll(){return[];},addEventListener(n,cb){handlers[n]=cb;},createElement(tag){return {...el(tag+Math.random()),set id(x){els.set('#'+x,this);},get id(){return'';}};},body:{append(){}}};
const winHandlers={},ctx={document,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},location:{hash:''},history:{replaceState(a,b,h){ctx.location.hash=h;}},setTimeout(){return 1;},clearTimeout(){},Date,Intl,Map,Set,Math,Blob,URL,SpeechSynthesisUtterance(){},console};
ctx.window={...ctx,scrollY:0,scrollTo(){},addEventListener(n,cb){winHandlers[n]=cb;}};
vm.createContext(ctx);for(const f of ['data.js','engine.js','quiz.js','app.js'])vm.runInContext(fs.readFileSync(__dirname+'/../dist/'+f,'utf8'),ctx,{filename:f});
function action(name,data={}){const button={dataset:{action:name,...data},disabled:false};handlers.click({target:{closest(s){return s==='[data-action]'?button:null;}}});}
function nav(v){ctx.location.hash='#'+v;winHandlers.hashchange();}
function options(){return [...el('#main').innerHTML.matchAll(/data-answer="([^"]+)"/g)].map(m=>m[1]);}
const readState=()=>JSON.parse(storage.get(ctx.window.KotobaEngine.KEY));
const first=ctx.window.KOTOBA_DATA.words[0];assert.equal(first.word,'行く');
action('quiz');assert.match(el('#main').innerHTML,/先学词，再训练/);assert.equal(options().length,0);
action('card');action('reveal');assert.match(el('#main').innerHTML,/联合记忆/);action('rate',{grade:'good'});assert.equal(readState().words[first.id].seen,1);
action('quiz');
function answer(correct=true){const o=options();assert.equal(o.length,4);assert.equal(new Set(o).size,4);const a=o.find(v=>v==='いく'||v==='行く');assert.ok(a);action('quizAnswer',{answer:correct?a:o.find(v=>v!==a)});}
for(let i=0;i<4;i++){answer();action('nextQuiz');}assert.equal(readState().words[first.id].readingStreak,4);
answer(false);assert.match(el('#main').innerHTML,/计数已归零/);assert.equal(readState().words[first.id].readingStreak,0);action('nextQuiz');
for(let i=0;i<5;i++){answer();action('nextQuiz');}assert.equal(readState().words[first.id].readingStreak,5);assert.equal(options().length,0);assert.match(el('#main').innerHTML,/已学词已全部过关/);
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
console.log('PASS: six views; reading graduation/reset; repeated again/hard until good; reload persistence; stable group progress; phrases, search, details, favorites and settings.');
// The new list uses reading errors only, and its badge updates on the fifth error.
const E=ctx.window.KotobaEngine,known=ctx.window.KOTOBA_DATA.words.slice(0,3);
handlers.input({target:{id:'wordSearch',value:''}});
const wrongState=E.fresh();E.rate(wrongState,first.id,'good');
for(let i=0;i<4;i++){E.recordReading(wrongState,first.id,false,i%2?'kana':'kanji');E.recordReading(wrongState,first.id,true);}
winHandlers.storage({key:E.KEY,newValue:JSON.stringify(wrongState)});nav('extreme');
assert.match(el('#main').innerHTML,/还没有符合条件的极易错词/);assert.equal(el('#extremeNav').textContent,0);
nav('today');action('quiz');answer(false);assert.equal(readState().words[first.id].readingWrong,5);
assert.equal(el('#extremeNav').textContent,1);nav('extreme');assert.match(el('#main').innerHTML,/累计错 5 次/);
assert.match(el('#main').innerHTML,/行く/);
// A tab left open on the empty review page updates at Beijing midnight, with no reload.
let clock=Date.parse('2026-10-20T21:48:00+08:00');
ctx.Date=class extends Date{constructor(...args){super(...(args.length?args:[clock]));}static now(){return clock;}};
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
// Already-graduated readings continue to get word cards rather than re-entering reading training.
const graduated=E.fresh();E.rate(graduated,first.id,'good',clock-E.DAY);graduated.words[first.id].readingStreak=5;
winHandlers.storage({key:E.KEY,newValue:JSON.stringify(graduated)});nav('review');ctx.Math.random=()=>.1;
assert.equal(options().length,0);assert.equal(cardWord(),first.word);
console.log('PASS: extreme fifth-error list; live midnight unlock; mixed review cards/questions; feedback, retries and next-day errors; graduated readings stay retired.');
