const test=require('node:test'),assert=require('node:assert/strict');
const E=require('../dist/engine.js');
const words=Array.from({length:100},(_,i)=>({id:'w'+i,priority:i%2?'A':'B',lesson:(i%2?'7':'15')+'-1',source:'book'}));
const ids=new Set(words.map(w=>w.id)),now=Date.parse('2026-10-21T12:00:00+08:00');
function seeded(seed=41){let n=seed;return()=>{n=(1664525*n+1013904223)>>>0;return n/4294967296;};}
function learned(s,start,end,days){for(const w of words.slice(start,end))E.rate(s,w.id,'good',now-days*E.DAY);}
function fixture(){const s=E.fresh();learned(s,0,20,1);learned(s,20,70,7);learned(s,70,80,0);return s;}

test('daily reading selects yesterday’s 20 plus 10 random earlier words, never unseen or unattempted new words',()=>{
 const s=fixture();s.settings.priority='C';s.settings.lesson='exam';const p=E.dailyReadingPlan(words,s,now,seeded());
 assert.equal(p.ids.length,30);assert.equal(new Set(p.ids).size,30);
 assert.equal(p.ids.filter(id=>s.words[id].learnedOn===E.today(now-E.DAY)).length,20);
 assert.equal(p.ids.filter(id=>s.words[id].learnedOn<E.today(now-E.DAY)).length,10);
 assert.ok(p.ids.every(id=>s.words[id].seen>0&&s.words[id].learnedOn<E.today(now)));
 assert.ok(!p.ids.some(id=>Number(id.slice(1))>=70));
 assert.deepEqual(E.dailyReadingPool(words,s,now).map(w=>w.id).sort(),words.slice(0,20).map(w=>w.id).sort(),'yesterday’s words are trained first');
});

test('a fixed daily plan does not refill after correct answers and survives reload and backup',()=>{
 const s=fixture(),p=E.dailyReadingPlan(words,s,now,seeded());const selected=[...p.ids];
 for(const id of selected){E.recordReading(s,id,false,'kana',now);E.recordReading(s,id,true,'kanji',now+1);}
 assert.equal(E.dailyReadingPool(words,s,now).length,0);assert.deepEqual(E.dailyReadingStatus(words,s,now),{total:30,done:30,remaining:0});
 assert.deepEqual(E.dailyReadingPlan(words,s,now,seeded(99)).ids,selected);
 const v=E.validate(JSON.parse(JSON.stringify(s)),ids);assert.deepEqual(v.readingPlan.ids,selected);assert.equal(E.dailyReadingPool(words,v,now).length,0);
});

test('tomorrow’s new plan promotes today’s new words and preserves the 30-word cap at the Beijing midnight boundary',()=>{
 const s=fixture(),p=E.dailyReadingPlan(words,s,now,seeded());const boundary=E.reviewDue(now);
 assert.equal(E.dailyReadingPlan(words,s,boundary-1),p);
 const tomorrow=E.dailyReadingPlan(words,s,boundary,seeded(60));assert.equal(tomorrow.day,E.today(boundary));assert.equal(tomorrow.ids.length,30);
 assert.ok(words.slice(70,80).every(w=>tomorrow.ids.includes(w.id)),'today’s new words receive priority tomorrow');
});

test('yesterday shortfalls use earlier learned words, but future low-frequency checks remain resting',()=>{
 const s=E.fresh();learned(s,0,5,1);learned(s,5,55,7);
 for(const w of words.slice(5,25)){Object.assign(s.words[w.id],{readingRule:'daily-v1',readingStreak:5,readingDue:E.reviewDue(now,7)});}
 const p=E.dailyReadingPlan(words,s,now,seeded());assert.equal(p.ids.length,30);assert.ok(words.slice(0,5).every(w=>p.ids.includes(w.id)));
 assert.ok(!p.ids.some(id=>Number(id.slice(1))>=5&&Number(id.slice(1))<25));
 const few=E.fresh();learned(few,0,7,1);learned(few,7,10,3);learned(few,10,20,0);
 assert.equal(E.dailyReadingPlan(words,few,now,seeded()).ids.length,10);
});

test('work attempted before the update stays in today’s plan without adding unlimited replacements',()=>{
 const s=fixture();for(const w of words.slice(20,27))E.recordReading(s,w.id,true,'kana',now);
 const p=E.dailyReadingPlan(words,s,now,seeded());assert.equal(p.ids.length,30);assert.ok(words.slice(20,27).every(w=>p.ids.includes(w.id)));
 assert.equal(E.dailyReadingStatus(words,s,now).done,7);assert.equal(E.dailyReadingStatus(words,s,now).remaining,23);
});

test('unselected reading schedules wait while card reviews still work normally',()=>{
 const s=fixture(),p=E.dailyReadingPlan(words,s,now,seeded());
 const selected=p.ids[0],outside=words.slice(20,70).find(w=>!p.ids.includes(w.id)).id;
 for(const id of [selected,outside]){s.words[id].due=E.reviewDue(now,60);s.words[id].readingDue=E.dayStart(now);}
 assert.equal(E.isDue(s.words[selected],now,s),true);assert.equal(E.isDue(s.words[outside],now,s),false);
 s.words[outside].due=E.dayStart(now);assert.equal(E.isDue(s.words[outside],now,s),true,'a due word card remains eligible');
 assert.equal(E.readingPlanned(s,outside,now),false);assert.equal(E.recordReading(s,outside,true,'kana',now),false,'unselected words cannot consume extra daily slots');
});

test('a surplus of yesterday words can fill missing historical slots without including unseen words',()=>{
 const s=E.fresh();learned(s,0,35,1);const p=E.dailyReadingPlan(words,s,now,seeded());
 assert.equal(p.ids.length,30);assert.ok(p.ids.every(id=>s.words[id]?.learnedOn===E.today(now-E.DAY)));
});
