const test=require('node:test'),assert=require('node:assert/strict');
const E=require('../dist/engine.js');
const now=Date.parse('2026-10-24T12:00:00+08:00');
const words=Array.from({length:65},(_,i)=>({id:'w'+String(i).padStart(2,'0'),priority:'A',lesson:'1-1'}));
function setup(){const s=E.fresh();for(const w of words)E.rate(s,w.id,'good',now-10*E.DAY);return s;}
function error(s,id,count,days=1,grade='quizWrong',context){for(let i=0;i<count;i++)s.logs.push({id,day:E.today(now-days*E.DAY),grade,isNew:false,...(context?{context}:{})});}

test('daily review selects the 50 most frequent recent errors regardless of old due dates',()=>{
 const s=setup();for(let i=0;i<60;i++){error(s,words[i].id,i+1);s.words[words[i].id].due=now+20*E.DAY;}
 error(s,words[60].id,100,4);error(s,words[61].id,100,0);
 const ranked=E.recentReviewIds(s,now);assert.equal(ranked.length,50);
 assert.deepEqual(ranked,words.slice(10,60).reverse().map(w=>w.id));
 assert.deepEqual(new Set(E.queue(words,s,'review',now).map(w=>w.id)),new Set(ranked));
 assert.equal(E.counts(s,now).due,50);
});

test('three complete Beijing calendar days include their boundaries and exclude today and future logs',()=>{
 const s=setup();for(const [id,days]of [['w00',3],['w01',2],['w02',1],['w03',4],['w04',0],['w05',-1]])error(s,id,1,days);
 assert.deepEqual(E.recentReviewIds(s,now),['w02','w01','w00']);
 const end=E.fresh();E.rate(end,'x','hard',Date.parse('2026-12-31T23:59:59+08:00'));
 assert.deepEqual(E.recentReviewIds(end,Date.parse('2027-01-01T00:00:00+08:00')),['x']);
 assert.deepEqual(E.recentReviewIds(end,Date.parse('2027-01-04T00:00:00+08:00')),[]);
});

test('counts all error sources once and breaks ties by latest error then stable ID',()=>{
 const s=setup();s.settings.reviewGoal=3;
 error(s,'w00',1,3,'again');error(s,'w00',1,2,'hard');error(s,'w00',1,1,'grindWrong');
 error(s,'w01',2);error(s,'w01',2,1,'hard','reading');
 error(s,'w02',2,2);error(s,'w03',2,2);error(s,'w04',30,1,'quizRight');
 error(s,'unknown',30);s.words.w05.seen=0;error(s,'w05',30);
 assert.deepEqual(E.recentReviewIds(s,now),['w00','w01','w02']);
});

test('attempts do not finish reviews, reload keeps retries, and completion never backfills rank 51',()=>{
 const s=setup();for(let i=0;i<60;i++)error(s,words[i].id,i+1);
 const ranked=E.recentReviewIds(s,now),first=ranked[0];
 E.rate(s,first,'hard',now);assert.equal(E.counts(s,now).reviewToday,0);assert.equal(E.queue(words,s,'review',now).length,50);
 const ids=new Set(words.map(w=>w.id)),restored=E.validate(JSON.parse(JSON.stringify(s)),ids);
 assert.equal(E.queue(words,restored,'review',now).length,50);
 E.rate(restored,first,'good',now);assert.equal(E.counts(restored,now).reviewToday,1);
 assert.equal(E.queue(words,restored,'review',now).length,49);assert.deepEqual(E.recentReviewIds(restored,now),ranked);
 error(restored,'w00',100,0);assert.deepEqual(E.recentReviewIds(restored,now),ranked);
 for(const id of ranked)E.rate(restored,id,'good',now);
 assert.deepEqual(E.queue(words,E.validate(restored,ids),'review',now),[]);
 assert.equal(E.counts(restored,now).reviewToday,50);
 assert.ok(E.recentReviewIds(restored,now+E.DAY).includes('w00'));
});

test('no recent errors means no reviews, with fewer than fifty left as the actual count',()=>{
 const s=setup();assert.deepEqual(E.queue(words,s,'review',now),[]);
 error(s,'w00',1);error(s,'w01',2);assert.equal(E.queue(words,s,'review',now).length,2);
 s.settings.priority='B';assert.deepEqual(E.queue(words,s,'review',now),[]);
});
