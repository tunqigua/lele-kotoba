const test=require('node:test'),assert=require('node:assert/strict');
const E=require('../dist/engine.js');
const words=Array.from({length:90},(_,i)=>({id:'w'+i,priority:['A','B','C'][Math.floor(i/30)],lesson:(i<45?'7':'15')+'-1',source:'book',volume:i<45?'upper':'lower'}));
const now=Date.parse('2026-10-21T10:00:00+08:00');
function seeded(seed=73){let n=seed;return()=>{n=(1664525*n+1013904223)>>>0;return n/4294967296;};}

test('new cards sample the entire unseen pool before the daily limit, mixing both volumes and priority bands',()=>{
 const s=E.fresh(),original=words.map(w=>w.id),q=E.queue(words,s,'new',now,seeded());
 assert.equal(q.length,20);assert.equal(new Set(q.map(w=>w.id)).size,20);
 assert.deepEqual(new Set(q.map(w=>w.volume)),new Set(['upper','lower']));
 assert.deepEqual(new Set(q.map(w=>w.priority)),new Set(['A','B','C']));
 assert.ok(q.some(w=>Number(w.id.slice(1))>=60),'must sample beyond the first alphabetically grouped batch');
 assert.deepEqual(words.map(w=>w.id),original,'learning order must not reorder the source dictionary');
 assert.notDeepEqual(q.map(w=>w.id),E.queue(words,s,'new',now,seeded(74)).map(w=>w.id));
});

test('random new groups respect learned progress, remaining daily quota, and explicit study scope',()=>{
 const s=E.fresh();E.rate(s,words[0].id,'good',now);E.rate(s,words[1].id,'hard',now);
 const q=E.queue(words,s,'new',now,seeded());
 assert.equal(q[0].id,words[1].id,'an unfinished card still returns before new words');
 assert.equal(q.length,19);assert.ok(q.slice(1).every(w=>!s.words[w.id]?.seen));
 s.settings.priority='C';const restricted=E.queue(words,s,'new',now,seeded());
 assert.equal(restricted.length,18);assert.ok(restricted.every(w=>w.priority==='C'));
 s.settings.lesson='7';assert.deepEqual(E.queue(words,s,'new',now,seeded()),[]);
});

test('review shuffles learned recent errors; unseen and same-day words never enter',()=>{
 const s=E.fresh();s.settings.reviewGoal=20;
 for(const w of words.slice(0,8))E.rate(s,w.id,'hard',now-E.DAY*2);
 E.rate(s,words[8].id,'good',now); // learned, but tomorrow’s review
 s.words[words[9].id]={stage:0,seen:0,due:0,lapses:0,star:true,reviewPending:true,readingRetry:true};
 const a=E.queue(words,s,'review',now,seeded(2)),b=E.queue(words,s,'review',now,seeded(7));
 assert.equal(a.length,8);assert.ok(a.every(w=>s.words[w.id].seen>0&&E.isDue(s.words[w.id],now)));
 assert.deepEqual(new Set(a.map(w=>w.id)),new Set(words.slice(0,8).map(w=>w.id)));
 assert.notDeepEqual(a.map(w=>w.id),b.map(w=>w.id));
 assert.ok(!a.some(w=>w.id===words[8].id||w.id===words[9].id));
});

test('a capped review group selects highest recent error counts before randomizing presentation',()=>{
 const s=E.fresh();s.settings.reviewGoal=2;
 for(let i=0;i<5;i++)for(let j=0;j<=i;j++)E.rate(s,words[i].id,'hard',now-E.DAY);
 const q=E.queue(words,s,'review',now,seeded());
 assert.deepEqual(new Set(q.map(w=>w.id)),new Set(['w4','w3']));
});
