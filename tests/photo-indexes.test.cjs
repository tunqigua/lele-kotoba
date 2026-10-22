const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const ctx={window:{}};vm.runInNewContext(fs.readFileSync(__dirname+'/../dist/data.js','utf8'),ctx);
const {words,meta}=ctx.window.KOTOBA_DATA,find=word=>words.find(w=>w.word===word);

test('all 1228 source entries have traceable records from their actual index and page',()=>{
 const counts={225:57,226:64,227:67,228:64,229:65,230:68,231:64,232:62,233:62,234:62,235:62,236:56,237:31,186:55,187:67,188:64,189:68,190:66,191:62,192:62};
 let total=0;
 for(const [file,collection]of [['index-225-237.tsv','index3'],['index-186-192.tsv','index4']]){
  let page=null,pageCounts={};
  for(const line of fs.readFileSync(__dirname+'/../tools/'+file,'utf8').split('\n')){
   if(!line||line.startsWith('#'))continue;if(line.startsWith('@')){page=Number(line.slice(1));pageCounts[page]=0;continue;}
   const [entry,kana,,pos]=line.split('|');assert.ok(kana&&pos);pageCounts[page]++;total++;
   const matches=words.filter(w=>w.sources.some(s=>s.collection===collection&&s.page===page&&s.entry===entry));assert.ok(matches.length,collection+' '+page+' '+entry);
   assert.ok(matches.every(w=>w.sources.some(s=>s.collection===collection&&s.page===page&&/^IMG_50\d\d [34]\.JPG$/.test(s.photo))));
  }
  for(const [page,n]of Object.entries(pageCounts))assert.equal(n,counts[page]);
 }
 assert.equal(total,1228);assert.equal(meta.indexImports.sourceRows,total);assert.equal(meta.indexImports.added,1208);
});

test('canonical corrections and homophones keep unambiguous meanings rather than accepting textbook typos',()=>{
 assert.equal(find('バドミントン').kana,'バドミントン');assert.ok(!find('バトミントン'));assert.match(find('バドミントン').note,/原印/);
 for(const [word,meaning]of [['訪ねる','拜访'],['尋ねる','询问'],['直す','修理'],['治す','治疗']])assert.ok(find(word).meaning.includes(meaning));
 assert.ok(!find('訪ねる・尋ねる'));assert.ok(!find('直す・治す'));assert.equal(find('何年').kana,'なにどし');assert.equal(find('清水').kana,'きよみず');
 assert.ok(find('講義').meaning.includes('讲课'));assert.ok(!find('講義').meaning.includes('讲义'));assert.ok(!find('珍しい').meaning.includes('珍贵'));
 assert.ok(find('〜以上').sources.some(s=>s.collection==='index3'&&s.entry==='以上'));assert.ok(find('少なくとも').sources.some(s=>s.entry==='すくなくとも'));
});

test('special conjugations and the ru-ending first-class verbs retain their actual classes',()=>{
 for(const [word,masu,te,nai]of [['いらっしゃる','いらっしゃいます','いらっしゃって','いらっしゃらない'],['なさる','なさいます','なさって','なさらない'],['愛する','あいします','あいして','あいさない'],['存じる','ぞんじます','ぞんじて','ぞんじない']]){
  assert.equal(find(word).forms.masu,masu);assert.equal(find(word).forms.te,te);assert.equal(find(word).forms.nai,nai);
 }
 for(const word of ['帰る','入る','走る','切る','要る','参る','太る','眠る','持ち帰る','なさる']){assert.equal(find(word).pos,'一类动词');assert.ok(find(word).kana.endsWith('る'));}
 for(const word of ['食べる','着る','借りる','似る','煮る','閉じる'])assert.equal(find(word).pos,'二类动词');
});
