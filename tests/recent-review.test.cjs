const test=require('node:test'),assert=require('node:assert/strict');
const E=require('../dist/engine.js');
const now=Date.parse('2026-10-24T12:00:00+08:00');
const words=Array.from({length:125},(_,i)=>({id:'w'+String(i).padStart(3,'0'),priority:i%2?'B':'A',lesson:'1-1'}));
const ids=new Set(words.map(w=>w.id));
function setup(){const s=E.fresh();for(const w of words)E.rate(s,w.id,'good',now-100*E.DAY);return s;}
function error(s,id,count,days=1,grade='quizWrong',context){for(let i=0;i<count;i++)s.logs.push({id,day:E.today(now-days*E.DAY),grade,isNew:false,...(context?{context}:{})});}

test('50 selects the lifetime top 50, 100 selects the top 100, independent of date and study filters',()=>{
 const s=setup();for(let i=0;i<125;i++){error(s,words[i].id,i+1,i<50?90:1);s.words[words[i].id].due=now+20*E.DAY;}
 s.settings.priority='C';s.settings.lesson='exam';
 const expected=words.slice().reverse().map(w=>w.id);
 assert.deepEqual(E.queue(words,s,'review',now).map(w=>w.id),expected.slice(0,50));
 s.settings.reviewGoal=100;
 assert.deepEqual(E.queue(words,s,'review',now).map(w=>w.id),expected.slice(0,100));
 assert.equal(E.counts(s,now).due,100);
});

test('ranking includes old and same-day errors and never resets with a month or year change',()=>{
 const s=setup();error(s,'w000',5,90);error(s,'w001',3,31);error(s,'w002',2,0);
 assert.deepEqual(E.reviewIds(s,now),['w000','w001','w002']);
 assert.deepEqual(E.reviewIds(s,now+400*E.DAY),['w000','w001','w002']);
});

test('counts all error sources once without doubling reading bookkeeping or lifetime lapse totals',()=>{
 const s=E.fresh();E.rate(s,'w000','good',now-E.DAY);
 E.rate(s,'w000','again',now);E.rate(s,'w000','hard',now);
 E.recordReading(s,'w000',false,'kana',now);E.rate(s,'w000','hard',now,'reading');
 E.recordGrind(s,'w000',false,'kanji',now);
 assert.equal(s.words.w000.reviewWrong,4);
 E.recordReading(s,'w000',true,'kana',now);E.rate(s,'w000','good',now,'reading');
 assert.equal(s.words.w000.reviewWrong,4,'correct answers never clear the total');
 const restored=E.validate(s,ids);assert.equal(restored.words.w000.reviewWrong,4);
 assert.equal(E.validate(restored,ids).words.w000.reviewWrong,4,'migration is idempotent');
 restored.logs=[];assert.equal(E.validate(restored,ids).words.w000.reviewWrong,4,'trimmed logs cannot erase totals');
});

test('legacy totals recover errors older than the retained log window without adding reading lapses twice',()=>{
 const s=setup(),w=s.words.w000;delete w.reviewWrong;w.lapses=21;w.readingWrong=15;
 error(s,'w000',2,80,'again');error(s,'w000',3,40,'hard');error(s,'w000',5,1);error(s,'w000',5,1,'hard','reading');
 const restored=E.validate(s,ids);assert.equal(restored.words.w000.reviewWrong,24);
 assert.equal(E.validate(restored,ids).words.w000.reviewWrong,24);
});

test('the chosen list survives errors, completion and reload; changing the goal extends it and a new day reranks it',()=>{
 const s=setup();for(let i=0;i<125;i++)error(s,words[i].id,i+1,40);
 const ranked=E.queue(words,s,'review',now).map(w=>w.id),first=ranked[0];
 E.rate(s,first,'hard',now);assert.equal(E.counts(s,now).reviewToday,0);
 error(s,'w000',200,0);
 assert.deepEqual(E.reviewIds(s,now),ranked,'outside errors do not refill a fixed daily list');
 E.rate(s,first,'good',now);
 const restored=E.validate(s,ids);assert.deepEqual(E.reviewIds(restored,now),ranked);
 assert.equal(E.queue(words,restored,'review',now).length,49);
 for(const id of ranked)E.rate(restored,id,'good',now);
 assert.deepEqual(E.queue(words,restored,'review',now),[]);assert.equal(E.counts(restored,now).reviewToday,50);
 restored.settings.reviewGoal=100;assert.equal(E.reviewIds(restored,now).length,100);
 assert.ok(E.reviewIds(restored,now).includes('w000'));
 assert.equal(E.reviewIds(restored,now+E.DAY)[0],'w000');
});

test('no errors yields no reviews and fewer than the selected number stays the actual count',()=>{
 const s=setup();assert.deepEqual(E.queue(words,s,'review',now),[]);
 error(s,'w000',1);error(s,'w001',2);
 assert.deepEqual(E.queue(words,s,'review',now).map(w=>w.id),['w001','w000']);
});
