const test=require('node:test'),assert=require('node:assert/strict');
const E=require('../dist/engine.js');
const now=Date.parse('2026-11-01T10:00:00+08:00');
const words=['a','b','c'].map(id=>({id,priority:'A',lesson:'1-1'}));
function setup(){const s=E.fresh();for(const {id} of words)E.rate(s,id,'good',now-4*E.DAY);return s;}
test('today mixed study counts old words after they leave candidates, without modifying records',()=>{
 const s=setup();E.queue(words,s,'mixed',now);assert.equal(s.reviewPlan,null);
 E.rate(s,'a','good',now);const before=JSON.stringify(s);
 assert.equal(E.counts(s,now).reviewToday,1);assert.equal(JSON.stringify(s),before);
 assert.equal(E.queue(words,s,'review',now).length,2);assert.ok(s.reviewPlan.ids.includes('a'));
 const restored=E.validate(s,new Set(words.map(w=>w.id)));
 assert.equal(E.counts(restored,now).reviewToday,1);
 E.rate(restored,'a','good',now+1000);assert.equal(E.counts(restored,now).reviewToday,1);
 E.rate(restored,'new','good',now);assert.equal(E.counts(restored,now).reviewToday,1);
 assert.equal(E.counts(restored,now+E.DAY).reviewToday,0);
});
test('completions outside a fixed plan count without deleting or expanding the plan',()=>{
 const s=setup();s.settings.reviewGoal=1;E.queue(words,s,'review',now);
 const plan=JSON.stringify(s.reviewPlan);const outside=words.find(w=>!s.reviewPlan.ids.includes(w.id)).id;
 E.rate(s,outside,'good',now);assert.equal(E.counts(s,now).reviewToday,1);
 assert.equal(JSON.stringify(s.reviewPlan),plan);
});
