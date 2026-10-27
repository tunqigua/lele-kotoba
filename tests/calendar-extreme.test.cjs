const test=require('node:test'),assert=require('node:assert/strict');
const E=require('../dist/engine.js');
const at=s=>Date.parse(s+'+08:00'),evening=at('2026-10-20T21:48:00'),midnight=at('2026-10-21T00:00:00');
const words=['a','b','c','d'].map(id=>({id,priority:'A',source:'book',lesson:'7-1'})),ids=new Set(words.map(w=>w.id));
const copy=s=>E.validate(JSON.parse(JSON.stringify(s)),ids);

test('new words receive their first spaced review at Beijing midnight',()=>{
 for(const time of ['2026-10-20T00:00:00','2026-10-20T21:48:00','2026-10-20T23:59:59']){
  const s=E.fresh();E.rate(s,'a','good',at(time));assert.equal(s.words.a.due,midnight);
  assert.equal(E.counts(s,midnight-1).due,0);assert.equal(E.counts(s,midnight).due,1);
  E.rate(s,'a','hard',at(time));assert.equal(E.counts(s,midnight).due,1);
 }
 const s=E.fresh();E.rate(s,'a','good',evening);E.rate(s,'a','good',midnight);
 assert.equal(s.words.a.due,at('2026-10-24T00:00:00'));
 E.rate(s,'a','good',at('2026-10-24T19:30:00'));assert.equal(s.words.a.due,at('2026-10-31T00:00:00'));
 const end=E.fresh();E.rate(end,'a','good',at('2026-12-31T23:59:59'));assert.equal(end.words.a.due,at('2027-01-01T00:00:00'));
});

test('yesterday’s reading errors and uncertain cards remain scheduled after same-day success',()=>{
 const s=E.fresh();
 for(const id of ['a','b','c','d']){E.rate(s,id,'good',evening-E.DAY*5);s.words[id].due=midnight+E.DAY*20;}
 E.recordReading(s,'a',false,'kana',evening);E.recordReading(s,'a',true,'kanji',evening+1);
 E.rate(s,'b','hard',evening);E.rate(s,'b','good',evening+1);
 E.rate(s,'c','again',evening);E.rate(s,'c','good',evening+1);
 assert.equal(E.counts(s,midnight-1).due,1,'lifetime ranking includes today’s reading error');
 assert.deepEqual(E.queue(words,s,'review',midnight).map(w=>w.id).sort(),['a','b','c']);
 const restored=copy(s);assert.deepEqual(E.queue(words,restored,'review',midnight).map(w=>w.id).sort(),['a','b','c']);
 E.rate(restored,'a','good',midnight);assert.equal(E.isDue(restored.words.a,midnight),true,'daily reading is still due after a card review');
 E.recordReading(restored,'a',false,'kanji',midnight+10);E.recordReading(restored,'a',true,'kana',midnight+15);E.rate(restored,'a','good',midnight+20);
 assert.equal(E.isDue(restored.words.a,midnight+30),false);
 assert.equal(E.isDue(restored.words.a,midnight+E.DAY),true,'a new error today must survive a successful review today');
});

test('unfinished reviews survive reload and quotas, including same-day errors',()=>{
 const s=E.fresh();s.settings.reviewGoal=1;E.rate(s,'a','hard',evening);
 assert.deepEqual(E.queue(words,s,'review',evening).map(w=>w.id),[],'today’s new word stays in its learning session until tomorrow');
 assert.deepEqual(E.queue(words,s,'mixed',evening).slice(0,1).map(w=>w.id),['a']);
 E.rate(s,'a','hard',midnight);assert.equal(s.words.a.reviewPending,true);
 const restored=copy(s);assert.deepEqual(E.queue(words,restored,'review',midnight).map(w=>w.id),['a']);
 E.rate(restored,'a','good',midnight+100);assert.equal(E.isDue(restored.words.a,midnight+100),false);
});

test('old time-of-day schedules migrate to midnight without losing progress or resurrecting completed reviews',()=>{
 const s=E.fresh();E.rate(s,'a','good',evening);s.words.a.due=midnight+21*3600000;
 const restored=copy(s);assert.equal(restored.words.a.due,midnight);assert.equal(restored.words.a.seen,1);
 assert.deepEqual(copy(restored),restored,'migration is idempotent');
 E.rate(s,'b','hard',evening-E.DAY);E.rate(s,'b','good',evening);
 assert.deepEqual(copy(s).words.b.troubleDays,[],'yesterday’s error was already reviewed today');
});

test('extremely difficult words count cumulative reading errors across both types, independent of streaks',()=>{
 const s=E.fresh();E.rate(s,'a','good',evening);E.rate(s,'b','good',evening);
 for(let i=0;i<5;i++){
  E.rate(s,'b','again',evening+i); // card errors qualify separately after five consecutive again grades
  E.recordReading(s,'a',false,i%2?'kanji':'kana',evening+i);
  assert.equal(s.words.a.readingStreak,0);
  if(i<4)assert.equal(E.extremePool(words,s).length,0);

 }
 assert.equal(s.words.a.readingWrong,5);assert.deepEqual(E.extremePool(words,s).map(w=>w.id),['a','b']);
 E.recordReading(s,'a',true,'kanji',evening+100);
 assert.equal(s.words.a.readingStreak,0);
 for(let i=1;i<=5;i++)E.recordReading(s,'a',true,'kanji',evening+i*E.DAY);
 assert.equal(s.words.a.readingStreak,5);assert.equal(E.readingPool(words,s).some(w=>w.id==='a'),false);
 assert.deepEqual(E.extremePool(words,copy(s)).map(w=>w.id),['a','b'],'graduation does not erase the cumulative list');
 assert.equal(E.recordReading(s,'a',false,'kana',evening+5*E.DAY+200),false);assert.equal(s.words.a.readingWrong,5);
});

test('legacy wrong-answer logs migrate once and lifetime totals survive log trimming',()=>{
 const s=E.fresh();E.rate(s,'a','good',evening);
 for(let i=0;i<5;i++)E.recordReading(s,'a',false,i%2?'kana':'kanji',evening+i);
 delete s.words.a.readingWrong;const restored=copy(s);assert.equal(restored.words.a.readingWrong,5);
 assert.equal(copy(restored).words.a.readingWrong,5);
 restored.logs=[];assert.equal(copy(restored).words.a.readingWrong,5);
});

test('calendar counts unique new words and reading-only mistakes per Beijing day',()=>{
 const s=E.fresh();
 E.rate(s,'a','again',evening);E.rate(s,'a','hard',evening+1);E.rate(s,'a','good',evening+2);
 E.rate(s,'b','good',evening+3);
 E.recordReading(s,'b',false,'kana',evening+4);E.rate(s,'b','hard',evening+5,'reading');
 E.recordGrind(s,'c',false,'kanji',evening+6); // unseen words cannot produce a result
 E.rate(s,'c','good',evening+7);E.recordGrind(s,'c',false,'kanji',evening+8);
 E.recordReading(s,'b',true,'kana',evening+9);E.rate(s,'b','good',evening+10);
 assert.deepEqual(s.dailyWords['2026-10-20'],{learned:['a','b','c'],wrong:['b']});
 E.rate(s,'a','hard',midnight);E.recordReading(s,'a',false,'kana',midnight+1);E.rate(s,'a','good',midnight+2);E.rate(s,'d','good',midnight+3);
 assert.deepEqual(s.dailyWords['2026-10-21'],{learned:['d'],wrong:['a']});
 const restored=copy(s);assert.deepEqual(restored.dailyWords,s.dailyWords);
 restored.logs=[];assert.deepEqual(copy(restored).dailyWords,s.dailyWords,'backups keep daily counts without detailed logs');
});

test('calendar migration deduplicates older logs and validates persisted daily word IDs',()=>{
 const s=E.fresh();E.rate(s,'a','good',evening);E.rate(s,'b','good',evening-E.DAY);
 delete s.dailyWords;
 s.logs.push({id:'a',day:'2026-10-20',grade:'hard',isNew:false},{id:'a',day:'2026-10-20',grade:'quizWrong',isNew:false});
 const restored=copy(s);
 assert.deepEqual(restored.dailyWords['2026-10-20'],{learned:['a'],wrong:['a']});
 assert.deepEqual(restored.dailyWords['2026-10-19'],{learned:['b'],wrong:[]});
 restored.dailyWords['2026-10-20'].wrong.push('missing','a');
 restored.dailyWords['bad-date']={learned:['a'],wrong:['a']};
 restored.dailyWords['2099-01-01']={learned:['a'],wrong:['a']};
 restored.dailyWords['2026-10-18']={learned:null,wrong:['missing','b','b']};
 const checked=copy(restored);
 assert.deepEqual(checked.dailyWords['2026-10-20'].wrong,['a']);
 assert.deepEqual(checked.dailyWords['2026-10-18'],{learned:[],wrong:['b']});
 assert.equal(checked.dailyWords['bad-date'],undefined);assert.equal(checked.dailyWords['2099-01-01'],undefined);
 assert.deepEqual(copy(checked),checked,'migration remains idempotent');
});
