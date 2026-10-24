const test=require('node:test'),assert=require('node:assert/strict');
const E=require('../dist/engine.js');
const now=Date.parse('2026-10-24T12:00:00+08:00');
const words=Array.from({length:125},(_,i)=>({id:'w'+String(i).padStart(3,'0'),priority:i%2?'B':'A',lesson:'1-1'}));
const ids=new Set(words.map(w=>w.id));
function setup(){const s=E.fresh();for(const w of words){E.rate(s,w.id,'good',now-100*E.DAY);Object.assign(s.words[w.id],{stage:3,due:E.reviewDue(now,14),readingStreak:5,readingDue:E.reviewDue(now,14)});}return s;}
function error(s,id,count,days=1,grade='quizWrong',context){for(let i=0;i<count;i++)s.logs.push({id,day:E.today(now-days*E.DAY),grade,isNew:false,...(context?{context}:{})});}
function weak(s,id,count){Object.assign(s.words[id],{stage:1,due:E.reviewDue(now,2),readingStreak:0,readingDue:E.reviewDue(now,2),reviewWrong:count});}

test('all 25 yesterday-new words and yesterday errors precede due words and high-error supplements',()=>{
 const s=setup();s.settings.priority='C';s.settings.lesson='exam';
 for(const w of words.slice(0,25)){E.rate(s,w.id,'good',now-E.DAY);s.words[w.id].learnedOn=E.today(now-E.DAY);}
 for(let i=25;i<30;i++){error(s,words[i].id,i-24);s.words[words[i].id].reviewFailedDay=E.today(now-E.DAY);}
 for(const w of words.slice(30,40))s.words[w.id].due=E.dayStart(now)-2*E.DAY;
 for(let i=40;i<60;i++)weak(s,words[i].id,i+1);
 s.words.w100.reviewWrong=10000;
 const list=E.queue(words,s,'review',now).map(w=>w.id);assert.equal(list.length,50);
 assert.deepEqual(list.slice(0,5),['w029','w028','w027','w026','w025']);
 assert.deepEqual(new Set(list.slice(5,30)),new Set(words.slice(0,25).map(w=>w.id)));
 assert.deepEqual(list.slice(30,40),words.slice(30,40).map(w=>w.id));
 assert.deepEqual(list.slice(40),words.slice(50,60).reverse().map(w=>w.id));
 assert.ok(!list.includes('w100'),'a mature word is not pulled forward for lifetime errors');
});

test('due words need no error history; oldest overdue first, while future mastered words rest',()=>{
 const s=setup();s.words.w000.due=E.dayStart(now)-E.DAY;s.words.w001.due=E.dayStart(now)-3*E.DAY;
 assert.deepEqual(E.reviewIds(s,now),['w001','w000']);
 assert.deepEqual(E.reviewIds(setup(),now),[],'no quota padding with future mastered words');
});

test('50 and 100 are caps; yesterday priorities survive goal changes and completed work keeps its slot',()=>{
 const s=setup();for(let i=0;i<125;i++)weak(s,words[i].id,i+1);
 const selected=E.queue(words,s,'review',now).map(w=>w.id);assert.equal(selected.length,50);
 E.rate(s,selected[0],'good',now);assert.equal(E.counts(s,now).reviewToday,1);
 s.settings.reviewGoal=100;assert.equal(E.queue(words,s,'review',now).length,99);
 assert.equal(s.reviewPlan.ids.length,100);assert.ok(s.reviewPlan.ids.includes(selected[0]));
 const restored=E.validate(s,ids);assert.equal(E.queue(words,restored,'review',now).length,99);
 restored.settings.reviewGoal=50;assert.equal(E.queue(words,restored,'review',now).length,49);
});

test('daily plan is fixed, refresh preserves it, and overflow yesterday words stay overdue for tomorrow',()=>{
 const s=setup();for(const w of words.slice(0,75)){s.words[w.id].learnedOn=E.today(now-E.DAY);s.words[w.id].stage=0;s.words[w.id].due=E.dayStart(now);}
 const selected=E.queue(words,s,'review',now).map(w=>w.id);assert.equal(selected.length,50);
 error(s,'w100',500);assert.deepEqual(E.reviewIds(s,now),selected);
 for(const id of selected)E.rate(s,id,'good',now);
 const restored=E.validate(s,ids);assert.deepEqual(E.queue(words,restored,'review',now),[]);
 const tomorrow=E.queue(words,restored,'review',now+E.DAY).map(w=>w.id);
 assert.deepEqual(new Set(tomorrow),new Set([...words.slice(50,75).map(w=>w.id),'w100']));
});

test('first known word is due tomorrow; only successful due-day retrieval lengthens the interval',()=>{
 const s=E.fresh();let t=now;E.rate(s,'x','good',t);assert.equal(s.words.x.due,E.reviewDue(t));
 for(const interval of [3,7,14,30,60]){t=s.words.x.due;const preview=E.cardSchedule(s.words.x,'good',t);E.rate(s,'x','good',t);assert.equal(s.words.x.due,E.reviewDue(t,interval));assert.deepEqual(preview,{stage:s.words.x.stage,due:s.words.x.due});}
});

test('same-day correction after either uncertain button returns tomorrow instead of skipping a week',()=>{
 for(const grade of ['again','hard']){
  const s=setup();s.words.w000.due=E.dayStart(now);s.words.w000.stage=4;
  E.rate(s,'w000',grade,now);const preview=E.cardSchedule(s.words.w000,'good',now);E.rate(s,'w000','good',now);
  assert.equal(s.words.w000.stage,0);assert.equal(s.words.w000.due,E.reviewDue(now));assert.equal(preview.due,s.words.w000.due);
  const restored=E.validate(s,ids);assert.equal(restored.words.w000.reviewFailedDay,E.today(now));
  assert.ok(E.reviewIds(restored,now+E.DAY).includes('w000'));
 }
});

test('early extra practice never advances the stage or postpones the due date',()=>{
 const s=setup();weak(s,'w000',10);const due=s.words.w000.due,stage=s.words.w000.stage;
 E.rate(s,'w000','good',now);assert.equal(s.words.w000.due,due);assert.equal(s.words.w000.stage,stage);
 E.rate(s,'w000','good',now+1000);assert.equal(s.words.w000.due,due);assert.equal(s.words.w000.stage,stage);
});

test('a legacy pure-error plan upgrades to include yesterday new words without losing totals',()=>{
 const s=setup();s.words.w001.learnedOn=E.today(now-E.DAY);s.words.w000.reviewWrong=999;
 s.reviewPlan={day:E.today(now),goal:50,rule:'cumulative-v1',ids:['w000']};
 const restored=E.validate(s,ids);assert.equal(restored.reviewPlan,null);assert.equal(restored.words.w000.reviewWrong,999);
 assert.deepEqual(E.queue(words,restored,'review',now).map(w=>w.id),['w001']);assert.equal(restored.reviewPlan.rule,'spaced-v1');
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



test('reading and grind failures shorten a future card interval, and legacy same-day corrections migrate to tomorrow',()=>{
 for(const mode of ['reading','grind']){
  const s=setup();s.words.w000.readingStreak=0;s.words.w000.readingDue=0;s.words.w000.grindStreak=0;
  if(mode==='reading')E.recordReading(s,'w000',false,'kana',now);else E.recordGrind(s,'w000',false,'kana',now);
  assert.equal(s.words.w000.stage,0);assert.equal(s.words.w000.due,E.reviewDue(now));
 }
 const s=setup(),w=s.words.w000;delete w.reviewFailedDay;w.reviewedOn=E.today(now-E.DAY);
 error(s,'w000',1,1);w.due=E.reviewDue(now,30);w.stage=4;
 const restored=E.validate(s,ids);assert.equal(restored.words.w000.stage,0);assert.equal(restored.words.w000.due,E.dayStart(now));
 assert.deepEqual(E.validate(restored,ids),restored,'the upgrade does not keep shifting a due date');
});
