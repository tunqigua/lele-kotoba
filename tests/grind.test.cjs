const test=require('node:test'),assert=require('node:assert/strict');
const E=require('../dist/engine.js'),Q=require('../dist/quiz.js');
const words=Array.from({length:90},(_,i)=>({id:'w'+i,word:'学校',kana:'がっこう',meaning:'学校',priority:'A',lesson:'7-1',source:'book'}));
const ids=new Set(words.map(w=>w.id)),now=Date.parse('2026-10-21T12:00:00+08:00');
function seeded(seed=23){let n=seed;return()=>{n=(n*1664525+1013904223)>>>0;return n/4294967296;};}
function fixture(n=70){const s=E.fresh();for(const w of words.slice(0,n))E.rate(s,w.id,'good',now);return s;}

test('grind includes every learned unqualified word regardless of quotas, daily completion or due dates',()=>{
 const s=fixture();s.settings.newGoal=1;s.settings.reviewGoal=1;s.settings.priority='C';s.settings.lesson='exam';
 Object.assign(s.words.w0,{readingStreak:5,readingDue:E.reviewDue(now,30)});s.words.w1.grindStreak=5;
 s.words.w2.readingDoneDay=E.today(now);s.words.w3.readingDue=E.reviewDue(now,7);
 s.words.w70={seen:0,star:true};const pool=E.grindPool(words,s);
 assert.equal(pool.length,68);assert.ok(pool.some(w=>w.id==='w2'));assert.ok(pool.some(w=>w.id==='w3'));
 assert.ok(!pool.some(w=>['w0','w1','w70'].includes(w.id)));
 const q=Q.questionForWord(words[2],seeded());assert.equal(q.options.length,4);assert.equal(q.id,'w2');
});

test('shuffle rounds cover the full pool before repeating, with fresh orders and no adjacent boundary repeats',()=>{
 const s=fixture(12),random=seeded(),rounds=[],lastAt=new Map();let previous=null,step=0;
 for(let round=0;round<5;round++){
  const chosen=[];
  for(let i=0;i<12;i++){const w=E.nextGrindWord(words,s,random);assert.notEqual(w.id,previous);if(lastAt.has(w.id))assert.ok(step-lastAt.get(w.id)>6,'large pools separate repeated words by at least six other questions');lastAt.set(w.id,step++);chosen.push(w.id);previous=w.id;E.recordGrind(s,w.id,false,'kana',now);}
  assert.equal(new Set(chosen).size,12);rounds.push(chosen);
 }
 assert.equal(s.grindSession.round,5);assert.notDeepEqual(rounds[0],rounds[1]);
 assert.ok(words.slice(0,12).every(w=>s.words[w.id].readingWrong===5));
 assert.equal(E.extremePool(words,s).length,12);
});

test('five correct grind answers graduate within a day; one failure after four resets only that word',()=>{
 const s=fixture(2);for(let i=0;i<4;i++){E.recordGrind(s,'w0',true,i%2?'kana':'kanji',now+i);E.recordGrind(s,'w1',true,'kana',now+i);}
 assert.equal(s.words.w0.grindStreak,4);E.recordGrind(s,'w0',false,'kanji',now+5);
 assert.equal(s.words.w0.grindStreak,0);assert.equal(s.words.w1.grindStreak,4);
 for(let i=1;i<=5;i++){E.recordGrind(s,'w0',true,'kana',now+5+i);assert.equal(s.words.w0.grindStreak,i);}
 assert.ok(!E.grindPool(words,s).some(w=>w.id==='w0'));assert.equal(E.recordGrind(s,'w0',true,'kana',now+20),false);
 assert.equal(E.grindPool(words,s).length,1);assert.equal(E.nextGrindWord(words,s).id,'w1');
 E.recordGrind(s,'w1',true,'kanji',now+21);assert.equal(E.nextGrindWord(words,s),null);
});

test('grind progress and shuffled remainder survive validation and backup without losing normal plans',()=>{
 const s=fixture(45);E.dailyReadingPlan(words,s,now);const plan=JSON.parse(JSON.stringify(s.readingPlan));
 const random=seeded();for(let i=0;i<7;i++){const w=E.nextGrindWord(words,s,random);E.recordGrind(s,w.id,i!==0,'kana',now);}
 const copy=E.validate(JSON.parse(JSON.stringify(s)),ids);assert.deepEqual(copy.grindSession,s.grindSession);
 assert.deepEqual(copy.readingPlan,plan);for(const w of words.slice(0,45))assert.equal(copy.words[w.id].grindStreak,s.words[w.id].grindStreak||0);
 assert.equal(copy.logs.filter(l=>l.grade.startsWith('grind')).length,7);
 assert.equal(E.nextGrindWord(words,copy,seeded(99)).id,s.grindSession.remaining[0]);
});

test('grind does not certify cross-day reading success or consume ordinary daily quotas',()=>{
 const s=fixture(2);E.recordReading(s,'w0',true,'kana',now);E.dailyReadingPlan(words,s,now);
 const before=JSON.stringify(s.readingPlan),due=s.words.w0.due,day=s.words.w0.readingDoneDay;
 for(let i=0;i<5;i++)E.recordGrind(s,'w0',true,'kanji',now+i);
 assert.equal(s.words.w0.readingStreak,1);assert.equal(s.words.w0.readingDoneDay,day);assert.equal(s.words.w0.due,due);
 assert.equal(JSON.stringify(s.readingPlan),before);assert.equal(E.counts(s,now).reviewToday,0);assert.equal(E.counts(s,now).newToday,2);
});

test('later normal reading errors or uncertain cards bring graduated words back',()=>{
 const s=fixture(2);for(const id of ['w0','w1'])for(let i=0;i<5;i++)E.recordGrind(s,id,true,'kana',now+i);
 assert.equal(E.grindPool(words,s).length,0);E.recordReading(s,'w0',false,'kana',now+10);
 assert.equal(s.words.w0.grindStreak,0);assert.ok(E.grindPool(words,s).some(w=>w.id==='w0'));
 s.words.w1.readingStreak=5;E.rate(s,'w1','hard',now+11);assert.ok(E.grindPool(words,s).some(w=>w.id==='w1'));
 assert.equal(s.words.w1.readingStreak,5,'card uncertainty does not erase the separate pronunciation history');
 const restored=E.validate(JSON.parse(JSON.stringify(s)),ids);assert.equal(E.grindPool(words,restored).length,2);
});

test('grind wrong totals retain lifetime errors, schedule tomorrow and leave card-again sequences alone',()=>{
 const s=fixture(1);for(let i=0;i<4;i++)E.rate(s,'w0','again',now);E.recordReading(s,'w0',false,'kana',now);
 for(let i=0;i<4;i++)E.recordGrind(s,'w0',false,i%2?'kana':'kanji',now+i);
 assert.equal(s.words.w0.readingWrong,5);assert.equal(s.words.w0.cardAgainStreak,4);assert.equal(E.extremePool(words,s).length,1);
 assert.ok(s.words.w0.troubleDays.includes(E.today(E.reviewDue(now))));
 E.recordGrind(s,'w0',true,'kana',now+10);assert.equal(s.words.w0.readingWrong,5);
 const restored=E.validate(JSON.parse(JSON.stringify(s)),ids);assert.equal(restored.words.w0.readingWrong,5);
 restored.logs=[];assert.equal(E.validate(restored,ids).words.w0.readingWrong,5);
});

test('past mistakes come first inside every round, including a saved queue, while the recent-word gap still applies',()=>{
 const s=fixture(12),random=seeded();s.words.w3.readingWrong=2;s.words.w8.lapses=1;s.words.w11.grindRequired=true;
 s.grindSession={remaining:['w0','w1','w3','w2','w8','w4','w11','w5','w6','w7','w9','w10'],recent:[],lastId:null,round:1};
 const first=[];for(let i=0;i<3;i++)first.push(E.nextGrindWord(words,s,random).id);
 assert.deepEqual(first,['w3','w8','w11'],'a pre-update saved queue also prioritizes errors immediately');
 const order=[...first];while(s.grindSession.remaining.length)order.push(E.nextGrindWord(words,s,random).id);
 assert.equal(new Set(order).size,12,'error priority must not drop the other learned words');
 const next=[];for(let i=0;i<3;i++)next.push(E.nextGrindWord(words,s,random).id);
 assert.deepEqual(new Set(next),new Set(first));
 const crowded=fixture(12);crowded.words.w3.readingWrong=1;
 crowded.grindSession={remaining:['w0','w3','w1','w2','w4','w5','w6','w7','w8','w9','w10','w11'],recent:['w3'],lastId:'w3',round:1};
 assert.notEqual(E.nextGrindWord(words,crowded,random).id,'w3','priority never forces an immediate retry');
});
