const test=require('node:test'),assert=require('node:assert/strict');
const E=require('../dist/engine.js');
const words=['a','b','c','d','e'].map(id=>({id,priority:'A',source:'book',lesson:'7-1'}));
const ids=new Set(words.map(w=>w.id));
const session=names=>({mode:'mixed',queue:[...names],index:0,done:0,startSize:names.length});

test('both non-recognized grades return after one or two other words',()=>{
 for(const grade of ['again','hard'])for(const [random,gap]of [[()=>0,1],[()=>.999,2]]){
  const s=session(['a','b','c','d']);
  E.advanceSession(s,grade,random);
  assert.equal(s.done,0);
  assert.equal(s.queue[s.index+gap],'a');
  for(let i=0;i<gap;i++)E.advanceSession(s,'good',random);
  assert.equal(s.queue[s.index],'a');
  assert.equal(s.startSize,4);
  assert.equal(s.done,gap);
 }
});

test('repetitions have no cap and only recognized words advance completion',()=>{
 const s=session(['a','b','c','d']),state=E.fresh();let attempts=0,steps=0;
 while(s.index<s.queue.length&&steps++<100){
  const id=s.queue[s.index],grade=id==='a'&&attempts++<9?(attempts%2?'again':'hard'):'good';
  const before=s.done;
  E.rate(state,id,grade);
  E.advanceSession(s,grade,()=>0);
  assert.equal(s.done,before+(grade==='good'?1:0));
  assert.equal(state.words[id].relearning,grade!=='good');
 }
 assert.ok(steps<100);
 assert.equal(attempts,10);
 assert.equal(s.done,4);
 assert.equal(s.index,s.queue.length);
 assert.ok(Object.values(state.words).every(w=>!w.relearning));
});

test('a run of uncertain answers cannot keep pushing an earlier retry away',()=>{
 for(const random of [()=>0,()=>.999]){
  const s=session(['a','b','c','d','e']),last=new Map();
  for(let i=0;i<60;i++){
   const id=s.queue[s.index];assert.ok(id);
   if(last.has(id))assert.ok(i-last.get(id)<=3,`${id} waited too long`);
   last.set(id,i);
   E.advanceSession(s,i%2?'again':'hard',random);
  }
  assert.ok(last.has('a'),'first word must keep returning');
  assert.equal(s.done,0);
  assert.equal(s.startSize,5);
 }
});

test('the final one or two words cannot disappear before recognition',()=>{
 const s=session(['a','b']);
 E.advanceSession(s,'hard',()=>.999);
 assert.equal(s.queue[s.index],'b');
 E.advanceSession(s,'good');
 for(let i=0;i<8;i++){
  assert.equal(s.queue[s.index],'a');
  E.advanceSession(s,i%2?'again':'hard');
  assert.equal(s.done,1);
 }
 E.advanceSession(s,'good');
 assert.equal(s.done,2);
 assert.equal(s.queue[s.index],undefined);
});

test('unfinished words survive reload, backup and exhausted daily quotas',()=>{
 const state=E.fresh();state.settings.newGoal=1;state.settings.reviewGoal=1;
 E.rate(state,'a','hard');
 assert.equal(E.counts(state).newToday,1);
 assert.equal(E.counts(state).due,1,'same-day errors are part of lifetime ranking');
 const restored=E.validate(JSON.parse(JSON.stringify(state)),ids);
 assert.equal(restored.words.a.relearning,true);
 assert.deepEqual(E.queue(words,restored,'mixed').map(w=>w.id),['a']);
 assert.deepEqual(E.queue(words,restored,'review').map(w=>w.id),['a']);
 assert.deepEqual(E.queue(words,restored,'review',E.reviewDue()).map(w=>w.id),['a']);
 E.rate(restored,'a','good');
 assert.equal(restored.words.a.relearning,false);
 assert.deepEqual(E.queue(words,restored,'mixed'),[]);
 E.recordReading(restored,'a',false);
 assert.equal(restored.words.a.relearning,false,'reading training has its own repetition rule');
});

test('only current-day unresolved legacy grades migrate as unfinished',()=>{
 const state=E.fresh();E.rate(state,'a','hard');E.rate(state,'b','again',Date.now()-E.DAY*2);E.rate(state,'c','good');
 for(const w of Object.values(state.words))delete w.relearning;
 const restored=E.validate(state,ids);
 assert.equal(restored.words.a.relearning,true);
 assert.equal(restored.words.b.relearning,false);
 assert.equal(restored.words.c.relearning,false);
});

test('daily review quotas never remove unfinished reviews',()=>{
 const state=E.fresh();state.settings.reviewGoal=1;
 E.rate(state,'a','hard',Date.now()-E.DAY*3);
 E.rate(state,'b','good',Date.now()-E.DAY*3);
 E.rate(state,'a','hard');
 assert.equal(E.counts(state).reviewToday,0);
 assert.deepEqual(E.queue(words,state,'review').map(w=>w.id),['a']);
 state.settings.priority='B';
 assert.deepEqual(E.queue(words,state,'review').map(w=>w.id),['a'],'lifetime review always draws from the whole vocabulary');
});
