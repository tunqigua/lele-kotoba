const test=require('node:test'),assert=require('node:assert/strict');
const E=require('../dist/engine.js');
const words=['a','b','c','d','e'].map(id=>({id,priority:'A',source:'book',lesson:'7-1'})),ids=new Set(words.map(w=>w.id)),now=Date.now();
function fixture(count=5){const s=E.fresh();for(const w of words.slice(0,count))E.rate(s,w.id,'good',now-E.DAY);E.dailyReadingPlan(words,s,now,()=>0);return s;}
const copy=s=>E.validate(JSON.parse(JSON.stringify(s)),ids);

test('a mistake needs three correct corrections; a second mistake resets only that word',()=>{
 const s=fixture();E.recordReading(s,'a',false,'kana',now);
 for(let i=1;i<=2;i++){E.recordReading(s,'a',true,'kanji',now+i);assert.equal(s.words.a.readingRetryStreak,i);assert.equal(E.dailyReadingStatus(words,s,now).done,0);}
 E.recordReading(s,'a',false,'meaning',now+3);assert.equal(s.words.a.readingRetryStreak,0);assert.equal(s.words.a.readingWrong,2);
 for(let i=1;i<=3;i++)E.recordReading(s,'a',true,'kana',now+3+i);
 assert.equal(s.words.a.readingRetry,false);assert.equal(s.words.a.readingStreak,0);assert.equal(E.dailyReadingStatus(words,s,now).done,1);
 assert.equal(E.recordReading(s,'a',true,'kana',now+10),false);assert.equal(s.words.b.readingRetry,undefined);
});

test('each correction is separated by two or three other words, including the final remaining mistake',()=>{
 for(const random of [()=>0,()=>.999]){
  const s=fixture();for(const id of ['b','c','d','e'])E.recordReading(s,id,true,'kana',now);
  E.recordReading(s,'a',false,'kana',now,false,random);let last=0,hits=0,step=0;
  while(s.words.a.readingRetry&&step++<30){
   const next=E.nextReadingWord(words,s,random,now);assert.ok(next);
   if(next.word.id==='a'){assert.equal(step-last-1,random()===0?2:3);last=step;hits++;assert.equal(next.practice,false);}
   else assert.equal(next.practice,true);
   E.recordReading(s,next.word.id,true,'kana',now,next.practice,random);
  }
  assert.equal(hits,3);assert.equal(E.nextReadingWord(words,s,random,now),null);
  assert.deepEqual(E.dailyReadingStatus(words,s,now),{total:5,done:5,remaining:0});
  for(const id of ['b','c','d','e'])assert.equal(s.words[id].readingStreak,1,'spacers do not inflate mastery');
 }
});

test('interleaved mistakes complete without starvation for many random orders',()=>{
 for(let seed=1;seed<=50;seed++){
  let n=seed;const random=()=>{n=(1664525*n+1013904223)>>>0;return n/4294967296;};
  const s=fixture(),last=new Map();let step=0;
  while(E.dailyReadingStatus(words,s,now).remaining&&step++<100){
   const next=E.nextReadingWord(words,s,random,now);assert.ok(next);
   const id=next.word.id,retry=s.words[id].readingRetry;
   if(retry&&last.has(id))assert.ok(step-last.get(id)>=3,'at least two intervening words');
   const correct=!!s.words[id].readingWrong||next.practice;
   E.recordReading(s,id,correct,'kana',now,next.practice,random);last.set(id,step);
  }
  assert.ok(step<100);assert.equal(E.dailyReadingStatus(words,s,now).done,5);
 }
});

test('reload and backup preserve correction count, spacing, favorites and cumulative errors',()=>{
 let s=fixture();s.words.a.star=true;E.recordReading(s,'a',false,'kana',now);E.recordReading(s,'a',true,'kanji',now);
 s=copy(s);assert.equal(s.words.a.readingRetry,true);assert.equal(s.words.a.readingRetryStreak,1);assert.equal(s.words.a.readingDoneDay,null);assert.equal(s.words.a.star,true);assert.equal(s.words.a.readingWrong,1);
 assert.notEqual(E.nextReadingWord(words,s,()=>0,now).word.id,'a');
 assert.deepEqual(copy(s),s);
 E.rate(s,'a','good',now);assert.equal(s.words.a.readingRetry,true,'a card cannot bypass corrections');
 s.logs=[];assert.equal(copy(s).words.a.readingRetryStreak,1,'progress survives trimmed logs');
});

test('unfinished correction survives midnight and a reduced daily goal',()=>{
 let s=fixture();E.recordReading(s,'a',false,'kana',now);E.recordReading(s,'a',true,'kana',now);s.settings.readingGoal=1;E.dailyReadingPlan(words,s,now,()=>0);
 const tomorrow=E.reviewDue(now);s=copy(s);const plan=E.dailyReadingPlan(words,s,tomorrow,()=>0);
 assert.ok(plan.ids.includes('a'));assert.equal(s.words.a.readingRetryStreak,1);
 E.recordReading(s,'a',true,'kana',tomorrow);assert.equal(s.words.a.readingRetry,true);
 E.recordReading(s,'a',true,'kana',tomorrow+1);assert.equal(s.words.a.readingRetry,false);assert.equal(s.words.a.readingStreak,0);
});

test('a wrong spacer becomes a correction instead of being silently ignored',()=>{
 const s=fixture();for(const id of ['a','b'])E.recordReading(s,id,true,'kana',now);
 const total=s.readingPlan.ids.length;E.recordReading(s,'b',false,'kana',now,true);
 assert.equal(s.words.b.readingRetry,true);assert.equal(s.words.b.readingDoneDay,null);assert.equal(s.words.b.readingWrong,1);assert.equal(s.readingPlan.ids.length,total);
});

test('a one-word library leaves correction pending instead of repeating it immediately',()=>{
 const s=fixture(1);E.recordReading(s,'a',false,'kana',now);
 assert.equal(E.nextReadingWord(words,s,()=>0,now),null);assert.equal(s.words.a.readingRetry,true);assert.equal(E.dailyReadingStatus(words,s,now).done,0);
});

test('old unresolved errors enter three-correction practice without reopening completed words',()=>{
 const s=fixture();E.recordReading(s,'a',false,'kana',now);delete s.words.a.readingRetry;delete s.words.a.readingRetryStreak;
 let loaded=copy(s);assert.equal(loaded.words.a.readingRetry,true);assert.equal(loaded.words.a.readingRetryStreak,0);
 for(let i=0;i<3;i++)E.recordReading(loaded,'a',true,'kana',now+i);
 loaded=copy(loaded);assert.equal(loaded.words.a.readingRetry,false);assert.equal(loaded.words.a.readingDoneDay,E.today(now));
});
