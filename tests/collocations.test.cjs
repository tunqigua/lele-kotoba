const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const ctx={window:{}};vm.runInNewContext(fs.readFileSync(__dirname+'/../dist/data.js','utf8'),ctx);
const {words,meta}=ctx.window.KOTOBA_DATA,find=name=>words.find(w=>w.word===name),ids=new Set(words.map(w=>w.id));
const source=JSON.parse(fs.readFileSync(__dirname+'/../tools/collocations.json','utf8'));

test('every one of 2832 vocabulary entries has authored Japanese, full kana and Chinese usage',()=>{
 assert.equal(source.entries.length,2832);assert.equal(new Set(source.entries.map(e=>e.id)).size,2832);
 let count=0;
 const repeats=new Map();
 for(const entry of source.entries){
  const w=words.find(w=>w.id===entry.id);assert.ok(w,entry.word);
  assert.equal(w.word,entry.word);assert.equal(w.kana,entry.kana);
  assert.ok(w.collocations.length>=1);assert.equal(w.collocations.length,entry.items.length);
  for(const c of w.collocations){
   count++;assert.ok(c.jp&&c.kana&&c.meaning,w.word);
   assert.match(c.kana,/^[ぁ-ゖァ-ヺー・、。！？!?「」『』（）\s]+$/u,w.word);
   assert.notEqual(c.jp,w.word,'a bare headword is not a collocation: '+w.word);
   assert.notEqual(c.meaning,w.pos,w.word);assert.notEqual(c.tip,w.pos,w.word);
   assert.ok(c.words.some(x=>x.id===w.id),w.word);
   assert.equal(new Set(c.words.map(x=>x.id)).size,c.words.length,w.word);
   assert.ok(c.words.every(x=>ids.has(x.id)&&x.word&&x.kana&&x.meaning),w.word);
   repeats.set(c.jp,(repeats.get(c.jp)||0)+1);
  }
  assert.notEqual(w.note,w.pos+'。',w.word);
  assert.notEqual(w.usageNote,w.pos+'。',w.word);
 }
 assert.equal(count,2926);assert.equal(meta.collocations.total,count);
 assert.equal(meta.collocations.wordsCovered,2832);
 assert.ok(meta.collocations.replacedGenericNotes>=1800);
 assert.ok(Math.max(...repeats.values())<=4,'avoid repeating a generic phrase across unrelated targets');
});

test('collocations preserve the target reading, inflections, and legitimate counter sound changes',()=>{
 const hira=s=>s.replace(/[ァ-ヶ]/g,c=>String.fromCharCode(c.charCodeAt(0)-96));
 const exceptions={'鍵がかかる':['かぎがかかっている'],'〜軒':['さんげん'],'本（量词）':['さんぼん']};
 for(const w of words){
  const k=w.kana,readings=[k,...Object.values(w.forms||{}).filter(Boolean),...(exceptions[w.word]||[])];
  if(w.pos.includes('形容词')&&k.endsWith('い'))for(const ending of ['く','かった','くない'])readings.push(k.slice(0,-1)+ending);
  if((w.pos.includes('动词')||w.pos==='接尾词')&&k.endsWith('る'))readings.push(k.slice(0,-1));
  for(const c of w.collocations)assert.ok(readings.some(r=>hira(c.kana).includes(hira(r))),w.word+' '+c.kana);
 }
 for(const [word,kana]of [['開く','ひらく'],['開く（あく）','あく'],['空く','あく'],['空く（すく）','すく'],['描く','えがく'],['応援','おうえん']]){
  const w=find(word);assert.ok(w.collocations[0].kana.includes(kana),word);
 }
 assert.equal(find('応援').collocations[0].jp,'選手を応援する');
 assert.equal(find('降りる').collocations[0].jp,'電車を降りる');
 assert.ok(find('メーカー').collocations[0].jp.includes('に問い合わせる'));
});

test('joint memory only uses valid companion IDs and stays available alongside the usage content',()=>{
 const unique=new Set();
 for(const w of words)for(const p of w.phrases){
  unique.add(p.jp+'\n'+p.kana);
  assert.ok(p.words.length>=2);assert.ok(p.words.every(x=>ids.has(x.id)));
 }
 assert.equal(unique.size,meta.phraseCount);
 assert.equal(words.filter(w=>w.phrases.length).length,meta.wordsWithPhrases);
 assert.ok(meta.wordsWithPhrases>2200);
 assert.equal(words.filter(w=>w.example).length,30,'preserve the existing complete example sentences');
 for(const [target,fragment]of [['なるべく','なる'],['まっすぐ','すぐ'],['持ち帰る','帰る']]){
  for(const c of find(target).collocations)assert.ok(!c.words.some(x=>x.id===find(fragment).id),target+' must not link its substring '+fragment);
 }
});
