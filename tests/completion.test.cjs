const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const ctx={window:{}};vm.runInNewContext(fs.readFileSync(__dirname+'/../dist/data.js','utf8'),ctx);
const {words,meta}=ctx.window.KOTOBA_DATA,find=name=>words.find(w=>w.word===name);

test('all 720 original and continuation photo rows retain exact page, row and image provenance',()=>{
 const counts={original:{189:51,190:58,191:60,192:59,193:62,194:58,195:60,196:56,197:54,198:51},index4:{193:62,194:58,195:31}};
 let total=0;
 for(const [collection,file]of [['original','original-189-198.tsv'],['index4','index-193-195.tsv']]){
  let page,row=0;
  for(const line of fs.readFileSync(__dirname+'/../tools/'+file,'utf8').split('\n')){
   if(!line||line.startsWith('#'))continue;
   if(line.startsWith('@')){if(page)assert.equal(row,counts[collection][page]);page=Number(line.slice(1));row=0;continue;}
   const [entry,kana,,,lesson]=line.split('|');row++;total++;
   const matches=words.filter(w=>w.sources.some(s=>s.collection===collection&&s.page===page&&s.row===row&&s.entry===entry));
   assert.ok(matches.length,collection+' '+page+' '+entry);
   const expected=entry==='ギョーザ'?'ぎょうざ':kana;
   for(const w of matches){
    assert.ok(w.acceptedKana.includes(expected),entry+' '+w.word);
    const source=w.sources.find(s=>s.collection===collection&&s.page===page&&s.row===row&&s.entry===entry);
    assert.ok(source.photo.startsWith('IMG_'));assert.equal(source.lesson,lesson==='?'?null:lesson);
   }
  }
  assert.equal(row,counts[collection][page]);
 }
 assert.equal(total,720);assert.equal(meta.completionImports.previousTotal,2503);
 assert.equal(meta.completionImports.added,329);
 assert.equal(meta.completionImports.collections[0].added,183);
 assert.equal(meta.completionImports.collections[1].added,146);
});

test('all twelve previously imported photographed pages remain represented without omissions',()=>{
 let page,total=0;
 for(const line of fs.readFileSync(__dirname+'/../tools/additional.tsv','utf8').split('\n')){
  if(!line||line.startsWith('#'))continue;if(line.startsWith('@')){page=Number(line.slice(1));continue;}
  const [entry,kana]=line.split('|'),canonical=(entry==='頂く'?'いただく':entry).replace(/（.*?）/g,'');
  const matches=words.filter(w=>[w.word,w.quizWritten,...w.aliases||[]].some(n=>n&&n.replace(/（.*?）/g,'')===canonical)&&w.kana===kana);
  assert.ok(matches.some(w=>w.sources.some(s=>s.collection==='additional'&&s.page===page)),page+' '+entry);total++;
 }
 assert.equal(total,672);
});

test('orthographic equivalents merge but homophones with distinct meanings remain separate',()=>{
 for(const name of ['ここ','これ','ころ','そば','ところ','みんな','ギョーザ','目覚しい','こ〜'])assert.ok(!find(name),name);
 assert.ok(find('ご〜'));assert.equal(find('ご〜').kana,'ご');
 for(const name of ['掛ける','欠ける','勧める','進める','引く','弾く','貼る','張る'])assert.ok(find(name),name);
 for(const name of ['半月','悪口'])assert.equal(find(name).acceptedKana.length>=2,true);
 assert.ok(find('目覚ましい').acceptedWritten.includes('目覚しい'));
 assert.ok(find('貼る').acceptedWritten.includes('張る'));
 assert.equal(find('目下').kana,'めした');assert.equal(find('量').kana,'りょう');
 assert.equal(find('〜やすい').pos,'接尾词');
 assert.ok(!find('交流').sources.some(s=>s.collection==='original'));
 for(const [name,lesson]of [['たくさん','6-1'],['タクシー','14-2'],['冷たい','13-2']])assert.equal(find(name).lesson,lesson);
});

test('newly completed verbs use their actual conjugations',()=>{
 for(const [word,masu,te,nai]of [['くださる','くださいます','くださって','くださらない'],['やってくる','やってきます','やってきて','やってこない'],['報いる','むくいます','むくいて','むくいない'],['死ぬ','しにます','しんで','しなない'],['貼る','はります','はって','はらない']]){
  assert.equal(find(word).forms.masu,masu);assert.equal(find(word).forms.te,te);assert.equal(find(word).forms.nai,nai);
 }
 assert.equal(find('報いる').pos,'二类动词');
 assert.equal(find('くださる').pos,'一类动词');
});
