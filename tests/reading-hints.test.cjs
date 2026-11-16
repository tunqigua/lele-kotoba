const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {runInNewContext}=require('node:vm');

const context={window:{}};
for(const file of ['data.js','reading-hints.js']){
  runInNewContext(readFileSync(__dirname+'/../dist/'+file,'utf8'),context);
}
const {KOTOBA_DATA:{words},KOTOBA_READING_HINTS:hints}=context.window;
const byId=new Map(words.map(word=>[word.id,word]));

function hintFor(written){
  return hints[words.find(word=>word.word===written).id];
}

test('reading hints match the study examples and link to actual vocabulary entries',()=>{
  for(const [word, pattern] of [
    ['注文',/ちゅう.*单韵母例外/],['説明',/めい.*后鼻音/],['競争',/そう.*后鼻音/],
    ['学校',/がく＋こう → がっこう/],['設計',/せつ＋けい → せっけい/],
    ['失敗',/しつ＋はい → しっぱい.*は 也变成 ぱ/],['作家',/さく＋か → さっか/],
    ['薬局',/やく＋きょく → やっきょく/],['中国',/连浊.*ちゅうごく/],
    ['本棚',/连浊.*ほんだな/],['先輩',/半浊音.*せんぱい/]
  ]){
    assert.match(hintFor(word)[0].join('\n'),pattern,word);
  }
  for(const [word, example, reason] of [['郊外','交通',/声旁.*郊.*交.*こう/],['説明','小説',/説.*せつ/]]){
    const link=hintFor(word)[1].find(([id])=>byId.get(id).word===example);
    assert.ok(link,example);
    assert.match(link[1],reason);
  }
  for(const [id,[notes, links]] of Object.entries(hints)){
    assert.ok(byId.has(id));
    assert.ok(notes.length||links.length);
    assert.equal(new Set(links.map(([target])=>target)).size,links.length);
    for(const [target,reason] of links){
      assert.ok(byId.has(target)&&target!==id&&reason);
    }
  }
});

test('each vocabulary entry has four distinct, navigable memory anchors',()=>{
  runInNewContext(readFileSync(__dirname+'/../dist/memory-map.js','utf8'),context);
  const memory=context.window.KotobaMemory.build(words,hints,context.window.KOTOBA_RADICALS);
  const display=w=>(w.quizWritten||w.word).replace(/（.*?）/g,'');
  for(const word of words){
    const items=memory.forWord(word);
    assert.equal(items.filter(Boolean).length,4,word.word);
    assert.equal(new Set(items.map(item=>display(item.word))).size,4,word.word);
    for(const item of items){
      assert.ok(byId.has(item.word.id)&&display(item.word)!==display(word)&&item.why,word.word);
    }
  }
  const suburb=memory.forWord(words.find(w=>w.word==='郊外'));
  assert.equal(suburb[0].word.word,'交通');
  assert.match(suburb[0].why,/声旁/);
  const street=memory.forWord(words.find(w=>w.word==='通り'));
  assert.match(street[2].why,/ます形词干/);
});
