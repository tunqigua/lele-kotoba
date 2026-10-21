const test=require('node:test'),assert=require('node:assert/strict');
const E=require('../dist/engine.js');const words=['a','b'].map(id=>({id})),ids=new Set(words.map(w=>w.id));

test('five consecutive again grades qualify on the fifth press and keep their history after recognition',()=>{
 const s=E.fresh();for(let i=1;i<=5;i++){E.rate(s,'a','again');assert.equal(s.words.a.cardAgainStreak,i);assert.equal(E.extremePool(words,s).length,i===5?1:0);}
 assert.equal(s.words.a.readingWrong||0,0);E.rate(s,'a','good');assert.equal(s.words.a.cardAgainStreak,0);assert.equal(s.words.a.cardAgainMax,5);
 assert.deepEqual(E.extremePool(words,s).map(w=>w.id),['a']);
});

test('hard and good interrupt the per-word sequence, while other words do not',()=>{
 const s=E.fresh();for(let i=0;i<4;i++)E.rate(s,'a','again');E.rate(s,'a','hard');E.rate(s,'a','again');
 assert.equal(s.words.a.cardAgainStreak,1);assert.equal(E.extremePool(words,s).length,0);
 E.rate(s,'a','good');for(let i=0;i<4;i++){E.rate(s,'a','again');E.rate(s,'b','good');}
 assert.equal(s.words.a.cardAgainStreak,4);assert.equal(E.extremePool(words,s).length,0);
 E.rate(s,'a','again');assert.deepEqual(E.extremePool(words,s).map(w=>w.id),['a']);
});

test('reading-review bookkeeping does not count as or interrupt an actual word-card choice',()=>{
 const s=E.fresh();for(let i=0;i<4;i++)E.rate(s,'a','again');
 E.rate(s,'a','good',Date.now(),'reading');assert.equal(s.words.a.cardAgainStreak,4);
 E.rate(s,'a','hard',Date.now(),'reading');assert.equal(s.words.a.cardAgainStreak,4);
 const v=E.validate(JSON.parse(JSON.stringify(s)),ids);assert.equal(v.words.a.cardAgainStreak,4);
 assert.ok(v.logs.some(l=>l.context==='reading'));E.rate(v,'a','again');assert.equal(v.words.a.cardAgainMax,5);
});

test('old card logs migrate independently of reading errors, and peak counts survive log trimming',()=>{
 const s=E.fresh();for(let i=0;i<5;i++)E.rate(s,'a','again');E.rate(s,'a','good');
 delete s.words.a.cardAgainStreak;delete s.words.a.cardAgainMax;const v=E.validate(s,ids);
 assert.equal(v.words.a.cardAgainStreak,0);assert.equal(v.words.a.cardAgainMax,5);
 v.logs=[];const again=E.validate(v,ids);assert.equal(again.words.a.cardAgainMax,5);assert.deepEqual(E.extremePool(words,again).map(w=>w.id),['a']);
});
