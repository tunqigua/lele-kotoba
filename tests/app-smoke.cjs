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
