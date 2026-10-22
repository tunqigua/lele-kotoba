const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const context={window:{}};vm.runInNewContext(fs.readFileSync(__dirname+'/../dist/data.js','utf8'),context);
const {words,meta}=context.window.KOTOBA_DATA,find=name=>words.find(w=>w.word===name);
const input=JSON.parse(fs.readFileSync(__dirname+'/../tools/document-vocabulary.json','utf8'));

test('Word sources only add missing vocabulary and account for every readable entry once',()=>{
 assert.equal(meta.documentImports.sourceRows,601);assert.equal(meta.documentImports.added,267);
 let added=0,matched=0;
 for(const doc of input.documents){
  const report=meta.documentImports.collections.find(c=>c.collection===doc.collection);
  assert.equal(report.sourceRows,doc.rows.length);
  for(const row of doc.rows){
   const records=report.records.filter(r=>r.number===row.number);
   assert.equal(records.length,row.kana.split('・').length);
   for(const record of records){
    const word=find(record.word);assert.ok(word);assert.ok(word.acceptedKana.includes(record.reading));
    if(record.status==='added'){
     added++;assert.equal(word.source,'document');assert.equal(word.collection,doc.collection);
     assert.equal(word.page,null);assert.equal(word.lesson,null);
     const source=word.sources.find(s=>s.document===doc.document&&s.number===row.number);
     assert.ok(source,'the original document source remains when matching photos are attached');
    }else matched++;
   }
  }
 }
 assert.equal(added,267);assert.equal(matched,335);assert.equal(words.filter(w=>w.source==='document').length,added);
 const legacy=JSON.parse(fs.readFileSync(__dirname+'/legacy-words.json','utf8'));assert.equal(legacy.length,2503);
 for(const old of legacy){const w=words.find(w=>w.id===old.id);assert.ok(w);assert.equal(w.word,old.word);assert.equal(w.kana,old.kana);}
});

test('legitimate variants merge while different readings and meanings remain distinct',()=>{
 for(const name of ['入口','石鹸','茶碗','子供','週間','毎年（まいねん）'])assert.ok(!find(name),name);
 assert.ok(find('毎年').acceptedKana.includes('まいねん'));
 for(const [word,variant]of [['入り口','入口'],['石けん','石鹸'],['茶わん','茶碗'],['子ども','子供']])assert.ok(find(word).acceptedWritten.includes(variant));
 assert.equal(find('生物').kana,'せいぶつ');assert.equal(find('生物（いきもの）').kana,'いきもの');
 assert.equal(find('紅葉').kana,'こうよう');assert.equal(find('紅葉（もみじ）').kana,'もみじ');
 assert.ok(find('習慣'));assert.ok(find('〜週間'));assert.ok(find('敬意'));assert.ok(find('経緯'));assert.ok(find('成長'));assert.ok(find('清聴'));
});

test('source typos and shifted cells never become training answers',()=>{
 for(const [word,kana]of [['活躍','かつやく'],['価値','かち'],['外出','がいしゅつ'],['教学棟','きょうがくとう'],['天敵','てんてき'],['団地','だんち']])assert.equal(find(word).kana,kana);
 assert.ok(!find('地'));assert.ok(!find('名·动3自'));assert.ok(!find('副'));
 assert.equal(find('リラックス').meaning,'放松,松弛');assert.equal(find('リラックス').forms.te,'リラックスして');
 assert.equal(find('擦る').pos,'一类动词');assert.equal(find('擦る').forms.te,'こすって');assert.equal(find('擦る').forms.nai,'こすらない');
 assert.equal(find('証明書').pos,'名词');assert.ok(find('証明書').meaning.includes('文件'));
 assert.equal(find('麻花').sources[0].table,2);assert.equal(meta.documentImports.unresolved.length,1);
 assert.equal(meta.documentImports.unresolved[0].number,290);
});
