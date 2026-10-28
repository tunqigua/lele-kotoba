const test=require('node:test'),assert=require('node:assert/strict');
const E=require('../dist/engine.js');
const now=Date.now(),words=Array.from({length:1200},(_,i)=>({id:'limit-'+i,priority:'A',lesson:'1-1'}));

test('unlimited new words includes the entire remaining selected pool',()=>{
 const s=E.fresh();s.settings.newGoal=null;
 E.rate(s,words[0].id,'good',now);
 const queue=E.queue(words,s,'new',now);
 assert.equal(queue.length,1199);
 assert.equal(new Set(queue.map(w=>w.id)).size,1199);
 assert(!queue.some(w=>w.id===words[0].id));
 s.settings.newGoal=1;assert.equal(E.queue(words,s,'new',now).length,0);
 s.settings.newGoal=1000;assert.equal(E.queue(words,s,'new',now).length,999);
});

test('unlimited reviews preserve completed work and survive a JSON backup roundtrip',()=>{
 const s=E.fresh(),ids=new Set(words.map(w=>w.id));
 for(const w of words)E.rate(s,w.id,'good',now-2*E.DAY);
 s.settings.reviewGoal=50;const first=E.queue(words,s,'review',now)[0];
 E.rate(s,first.id,'good',now);
 const before=JSON.stringify({words:s.words,logs:s.logs});
 s.settings.reviewGoal=null;s.settings.newGoal=null;
 assert.equal(E.queue(words,s,'review',now).length,1199);
 assert.equal(s.reviewPlan.ids.length,1200);
 assert.equal(JSON.stringify({words:s.words,logs:s.logs}),before);
 const restored=E.validate(JSON.parse(JSON.stringify(s)),ids);
 assert.equal(restored.settings.newGoal,null);assert.equal(restored.settings.reviewGoal,null);
 assert.equal(restored.reviewPlan.goal,null);assert.equal(restored.reviewPlan.ids.length,1200);
 assert.equal(E.queue(words,restored,'review',now).length,1199);
 assert.equal(restored.words[first.id].reviewedOn,E.today(now));
 restored.settings.reviewGoal=1;assert.equal(E.queue(words,restored,'review',now).length,0);
 restored.settings.reviewGoal=1000;assert.equal(E.queue(words,restored,'review',now).length,999);
});

test('positive whole numbers have no former 100/200 caps and invalid goals stay rejected',()=>{
 for(const n of [1,101,201,999,1000,100000,Number.MAX_SAFE_INTEGER,null]){
  const s=E.fresh();s.settings.newGoal=n;s.settings.reviewGoal=n;
  const restored=E.validate(JSON.parse(JSON.stringify(s)),new Set());
  assert.equal(restored.settings.newGoal,n);assert.equal(restored.settings.reviewGoal,n);
 }
 for(const n of [0,-1,1.5,Infinity,NaN,'无上限','1000',undefined])assert.equal(E.validGoal(n),false);
 const legacy=E.validate(E.fresh(),new Set());
 assert.equal(legacy.settings.newGoal,20);assert.equal(legacy.settings.reviewGoal,50);
});
