const test=require('node:test'),assert=require('node:assert/strict');
const E=require('../dist/engine.js');
const words=[
 {id:'a',lesson:'1-1',source:'book',priority:'A'},
 {id:'b',lesson:'1-2',source:'book',priority:'B'},
 {id:'c',lesson:'3-1',source:'book',priority:'A'},
 {id:'d',lesson:'2-1',source:'book',priority:'A'},
 {id:'e',lesson:null,source:'book',priority:'A'},
 {id:'f',lesson:null,source:'exam',priority:'A'}
];
test('one or multiple lessons select a union without duplicate words',()=>{
 const s=E.fresh();s.settings.lesson=['1','3','1'];
 assert.deepEqual(E.filter(words,s.settings).map(w=>w.id),['a','b','c']);
 s.settings.priority='A';assert.deepEqual(E.filter(words,s.settings).map(w=>w.id),['a','c']);
 s.settings.lesson='1';assert.deepEqual(E.filter(words,s.settings).map(w=>w.id),['a']);
 s.settings.priority='all';s.settings.lesson=['3','exam'];assert.deepEqual(E.filter(words,s.settings).map(w=>w.id),['c','f']);
 s.settings.lesson='all';assert.equal(E.filter(words,s.settings).length,6);
});
test('multiple lessons survive backup validation and keep legacy single/all choices',()=>{
 const ids=new Set(words.map(w=>w.id)),s=E.fresh();
 E.rate(s,'a','again');s.settings.newGoal=null;s.settings.reviewGoal=null;
 const progress=JSON.stringify({words:s.words,logs:s.logs,dailyWords:s.dailyWords});
 for(const selected of ['all','3','exam',['1','3'],['3','exam']]){
  s.settings.lesson=selected;
  const restored=E.validate(JSON.parse(JSON.stringify(s)),ids);
  assert.deepEqual(restored.settings.lesson,selected);
  assert.equal(restored.settings.newGoal,null);assert.equal(restored.settings.reviewGoal,null);
  assert.equal(restored.words.a.lapses,s.words.a.lapses);
  assert.deepEqual(restored.logs,s.logs);
 }
 assert.equal(JSON.stringify({words:s.words,logs:s.logs,dailyWords:s.dailyWords}),progress);
 s.settings.lesson=['1','1','99',null];assert.equal(E.validate(s,ids).settings.lesson,'1');
 s.settings.lesson=[];assert.equal(E.validate(s,ids).settings.lesson,'all');
});
test('unlimited new-word queue respects all selected lessons and existing learning',()=>{
 const s=E.fresh();s.settings.lesson=['1','3'];s.settings.newGoal=null;
 E.rate(s,'b','good');
 assert.deepEqual(E.queue(words,s,'new',Date.now(),()=>.5).map(w=>w.id).sort(),['a','c']);
 assert.equal(s.words.b.seen,1);
});
