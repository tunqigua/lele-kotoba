const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const E=require('../dist/engine.js'),Q=require('../dist/quiz.js');
const ctx={window:{}};vm.runInNewContext(fs.readFileSync(__dirname+'/../dist/data.js','utf8'),ctx);
const {words,meta}=ctx.window.KOTOBA_DATA,find=name=>words.find(w=>w.word===name);
const rows=fs.readFileSync(__dirname+'/../tools/supplement-20261105.tsv','utf8').trim().split('\n').filter(l=>!l.startsWith('#')).map(l=>l.split('|'));

test('all 111 checklist rows are covered with 104 additions and seven existing IDs',()=>{
 assert.equal(rows.length,111);assert.equal(meta.supplementImports.sourceRows,111);
 assert.equal(meta.supplementImports.added,104);assert.equal(meta.supplementImports.matched,7);
 assert.equal(words.length,2936);assert.equal(words.filter(w=>w.source==='supplement').length,104);
 assert.deepEqual(Array.from(meta.supplementImports.records.filter(r=>r.status==='existing'),r=>r.word).sort(),['わざと','わずか','愛情','怒る','あきらめる','扱う','溢れる'].sort());
 rows.forEach(([name,kana,,,note,jp,exampleKana,zh,label,,rawKana,rawWord,,section,originalNumber],i)=>{
  const w=find(name);assert.ok(w,name);assert.equal(w.kana,kana);assert.ok(w.note);
  const source=w.sources.find(s=>s.collection==='supplement20261105'&&s.number===i+1);
  assert.ok(source,name);assert.equal(source.entry,rawWord);assert.equal(source.reading,rawKana);
  assert.equal(source.section,section);assert.equal(source.originalNumber,Number(originalNumber));
  assert.equal(source.page,null);assert.equal(source.lesson,null);
  assert.equal(w.example.jp,jp);assert.equal(w.example.kana,exampleKana);assert.equal(w.example.zh,zh);
  assert.ok(w.collocations.some(c=>c.jp===jp&&c.kana===exampleKana&&c.meaning===zh&&c.tip===note),name);
  if(label)assert.equal(w.transitivity,label,name);
 });
});

test('corrected spellings, homophones, word classes and negative expressions stay distinct',()=>{
 assert.equal(find('怒る').kana,'おこる');assert.ok(find('起こる'));assert.ok(!words.some(w=>w.kana==='いこる'));
 assert.ok(find('じき'));assert.ok(find('時期'));assert.notEqual(find('じき').id,find('時期').id);
 assert.ok(!find('居ぐ'));assert.ok(!find('直に'));
 for(const [name,variant]of [['あきらめる','諦める'],['わざと','態と'],['わずか','僅か'],['今更','今さら']])assert.ok(find(name).acceptedWritten.includes(variant));
 for(const [name,pos]of [['怪しい','い形容词'],['改める','二类动词'],['一応','副词'],['一途','な形容词·名词'],['一生','名词'],['衣服','名词'],['いない','固定表达']])assert.equal(find(name).pos,pos);
 assert.equal(find('いない').forms,null);assert.equal(find('いる').forms.nai,'いない');
 for(const [name,masu,te,nai]of [['操る','あやつります','あやつって','あやつらない'],['偽る','いつわります','いつわって','いつわらない'],['承る','うけたまわります','うけたまわって','うけたまわらない'],['当てはまる','あてはまります','あてはまって','あてはまらない']]){
  assert.equal(find(name).forms.masu,masu);assert.equal(find(name).forms.te,te);assert.equal(find(name).forms.nai,nai);
 }
 const a=find('浮かぶ'),b=find('浮かべる');assert.ok(a.counterparts.some(p=>p.id===b.id));assert.ok(b.counterparts.some(p=>p.id===a.id));
});

test('expanded vocabulary preserves saved records and makes new words available to learning and quizzes',()=>{
 const state=E.fresh(),old=find('扱う'),added=find('相槌'),now=Date.parse('2026-11-05T02:00:00Z');
 E.rate(state,old.id,'again',now-E.DAY);state.words[old.id].star=true;
 const snapshot=JSON.parse(JSON.stringify(state)),loaded=E.validate(snapshot,new Set(words.map(w=>w.id)));
 for(const key of ['stage','due','seen','lapses','star','cardAgainMax','cardAgainStreak'])assert.equal(loaded.words[old.id][key],state.words[old.id][key],key);
 assert.ok(!loaded.words[added.id]);
 assert.ok(E.filter(words,{priority:'all',lesson:'all'}).some(w=>w.id===added.id));
 for(const [name]of rows){const w=find(name),q=Q.questionForWord(w,()=>.4,words);assert.equal(q.options.length,4,name);assert.equal(q.options.filter(x=>x===q.answer).length,1,name);}
});
