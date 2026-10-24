const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const ctx={window:{}};vm.runInNewContext(fs.readFileSync(__dirname+'/../dist/data.js','utf8'),ctx);
const {words,meta}=ctx.window.KOTOBA_DATA,find=name=>words.find(w=>w.word===name);

test('all 782 verb entries have a reading-specific classification without changing their conjugation class',()=>{
 const verbs=words.filter(w=>'动词サ变'.includes(w.pos)||w.pos.includes('动词')||w.pos.includes('サ变'));
 assert.equal(verbs.length,782);assert.equal(meta.verbTransitivity.total,782);
 for(const w of verbs)assert.ok(['自动词','他动词','自他动词','可能形'].includes(w.transitivity),w.word);
 for(const [name,label]of [['開く（あく）','自动词'],['開ける','他动词'],['開く','自他动词'],['いる','自动词'],['できる','自动词'],['くれる','他动词'],['やめる','他动词'],['する','自他动词'],['閉じる','自他动词'],['楽しめる','可能形'],['取れる','自动词']])assert.equal(find(name).transitivity,label,name);
 assert.equal(find('帰る').pos,'一类动词');assert.equal(find('食べる').pos,'二类动词');
 for(const w of words.filter(w=>!verbs.includes(w)))assert.equal(w.transitivity,undefined,w.word);
});

test('counterparts show both directions, exact readings, and valid links only for words already in the vocabulary',()=>{
 for(const [automatic,transitive]of [['開く（あく）','開ける'],['閉まる','閉める'],['入る','入れる'],['落ちる','落とす'],['始まる','始める'],['壊れる','壊す'],['治る','治す'],['汚れる','汚す']]){
  const a=find(automatic),b=find(transitive);
  assert.ok(a.counterparts.some(p=>p.id===b.id&&p.transitivity==='他动词'));
  assert.ok(b.counterparts.some(p=>p.id===a.id&&p.transitivity==='自动词'));
 }
 for(const w of words)for(const p of w.counterparts||[]){
  assert.ok(p.word&&p.kana&&p.meaning);assert.ok(['自动词','他动词'].includes(p.transitivity));
  if(p.id){const target=words.find(x=>x.id===p.id);assert.equal(target.word,p.word);assert.equal(target.kana,p.kana);assert.ok(target.counterparts.some(x=>x.id===w.id));}
 }
 const raise=find('上がる').counterparts.find(p=>p.word==='上げる');assert.equal(raise.id,undefined,'raising must not link the different give meaning of あげる');
 assert.ok(find('消す').counterparts.some(p=>p.word==='消える'&&!p.id));
});
