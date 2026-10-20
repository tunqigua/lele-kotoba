const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const E=require('../dist/engine.js'),Q=require('../dist/quiz.js');
const box={window:{}};vm.runInNewContext(fs.readFileSync(__dirname+'/../dist/data.js','utf8'),box);
const words=Array.from(box.window.KOTOBA_DATA.words.slice(0,2)),w=words[0],other=words[1],ids=new Set(words.map(w=>w.id));
const now=Date.parse('2026-10-20T23:18:00+08:00');
const restored=s=>E.validate(JSON.parse(JSON.stringify(s)),ids);
function stable(){const s=E.fresh();E.rate(s,w.id,'good',now-4*E.DAY);for(let i=0;i<5;i++)E.recordReading(s,w.id,true,i%2?'kana':'kanji',now+(i-4)*E.DAY);return s;}

test('five cross-day correct answers switch reading to 7, 14, then recurring 30-day checks at Beijing midnight',()=>{
 const s=stable(),a=s.words[w.id];let due=E.reviewDue(now,7);
 assert.equal(a.readingStreak,5);assert.equal(a.readingStage,0);assert.equal(a.readingDue,due);
 assert.equal(E.readingPool(words,s,due-1).length,0);assert.equal(Q.createQuestion(words,s,null,()=>.9,due-1),null);
 for(const [stage,days]of [[1,14],[2,30],[2,30]]){
  const question=Q.createQuestion(words,s,null,()=>.9,due);assert.equal(question.id,w.id);
  assert.ok(E.recordReading(s,w.id,true,question.type,due));assert.equal(a.readingStage,stage);
  assert.equal(a.readingDue,E.reviewDue(due,days));assert.equal(a.readingStreak,5);
  due=a.readingDue;
 }
});

test('one failed low-frequency check restores normal reading training and next-day review',()=>{
 const s=stable(),a=s.words[w.id],due=a.readingDue;
 a.due=E.reviewDue(due,60); // This word has no independently due word card.
 assert.equal(E.isDue(a,due-1),false);assert.equal(E.isDue(a,due),true);
 assert.deepEqual(E.queue(words,s,'review',due).map(x=>x.id),[w.id]);
 assert.ok(E.recordReading(s,w.id,false,'kanji',due));
 assert.equal(a.readingStreak,0);assert.equal(a.readingStage,0);assert.equal(a.readingDue,0);
 assert.equal(a.readingWrong,1);assert.equal(E.readingPool(words,s,due).length,1);
 assert.equal(E.isDue(a,due),false);assert.equal(E.isDue(a,E.reviewDue(due)),true);
 for(let i=0;i<5;i++)E.recordReading(s,w.id,true,'kana',due+(i+1)*E.DAY);
 assert.equal(a.readingStage,0);assert.equal(a.readingDue,E.reviewDue(due+5*E.DAY,7));
});

test('old graduated records migrate using their last correct day and retain counters, favorite and card schedule',()=>{
 const s=stable(),a=s.words[w.id],cardDue=a.due;
 a.star=true;a.readingWrong=8;delete a.readingRule;delete a.readingDue;delete a.readingStage;
 const v=restored(s);assert.equal(v.words[w.id].readingDue,E.reviewDue(now,7));
 assert.equal(v.words[w.id].readingStreak,5);assert.equal(v.words[w.id].readingWrong,8);
 assert.equal(v.words[w.id].due,cardDue);assert.equal(v.words[w.id].star,true);
 assert.deepEqual(restored(v),v,'reloading must not move a check another seven days forward');
 v.logs=[];assert.deepEqual(restored(v).words[w.id],v.words[w.id],'stored schedule survives trimmed logs');
 const due=v.words[w.id].readingDue;E.recordReading(v,w.id,true,'kana',due);
 const again=restored(v);assert.equal(again.words[w.id].readingStage,1);assert.equal(again.words[w.id].readingDue,E.reviewDue(due,14));
});

test('normal word-card reviews cannot postpone a pending reading check',()=>{
 const s=stable(),due=s.words[w.id].readingDue;
 E.rate(s,w.id,'good',due-E.DAY);assert.equal(s.words[w.id].readingDue,due);
 E.rate(s,w.id,'good',due);assert.equal(E.isDue(s.words[w.id],due),true);
 E.recordReading(s,w.id,true,'kana',due);assert.equal(E.isDue(s.words[w.id],due),false);
});

test('normal words remain trainable while stable readings rest, then both become eligible when checks are due',()=>{
 const s=stable(),due=s.words[w.id].readingDue;E.rate(s,other.id,'good',now);
 assert.deepEqual(E.readingPool(words,s,now).map(x=>x.id),[other.id]);
 assert.deepEqual(E.readingPool(words,s,due).map(x=>x.id),[w.id,other.id]);
 assert.equal(Q.createQuestion(words,s,other.id,()=>.1,due).id,w.id);
});

test('one correct answer hides both reading types for today and returns at the next midnight before five rounds',()=>{
 const s=E.fresh(),late=Date.parse('2026-10-20T23:59:59+08:00');E.rate(s,w.id,'good',late);s.words[w.id].due=E.reviewDue(late,60);
 assert.ok(E.recordReading(s,w.id,true,'kanji',late));assert.equal(s.words[w.id].readingStreak,1);
 assert.equal(E.recordReading(s,w.id,true,'kana',late+1),false);
 assert.equal(E.readingPool(words,s,late+1).length,0);
 const next=E.reviewDue(late);assert.equal(E.readingPool(words,s,next).length,1);
 assert.equal(E.isDue(s.words[w.id],next),true,'the next daily reading round appears even if its card is due later');
 const v=restored(s);assert.equal(E.readingPool(words,v,late+1).length,0);
});

test('repeated wrong answers remain eligible until corrected; a correction never increases the cross-day streak',()=>{
 const s=E.fresh();E.rate(s,w.id,'good',now-E.DAY);E.recordReading(s,w.id,true,'kana',now-E.DAY);
 for(let i=0;i<6;i++){assert.ok(E.recordReading(s,w.id,false,i%2?'kana':'kanji',now+i));assert.equal(E.readingPool(words,s,now+i).length,1);}
 assert.equal(s.words[w.id].readingStreak,0);assert.equal(s.words[w.id].readingWrong,6);
 assert.ok(E.recordReading(s,w.id,true,'kana',now+10));assert.equal(s.words[w.id].readingStreak,0);
 assert.equal(E.readingPool(words,s,now+11).length,0);
 assert.equal(E.recordReading(s,w.id,false,'kanji',now+12),false,'a completed word cannot be graded twice today');
 assert.ok(E.recordReading(s,w.id,true,'kanji',now+3*E.DAY));assert.equal(s.words[w.id].readingStreak,1,'missed days do not count as errors');
});
