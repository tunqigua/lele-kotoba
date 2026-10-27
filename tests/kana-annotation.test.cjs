const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(__dirname+'/../dist/app.js','utf8');
const helper=source.slice(source.indexOf('const esc='),source.indexOf('const priorityLabel='));
const annotate=vm.runInNewContext(helper+'\nkanaRuby');
const parts=s=>[...annotate(s).matchAll(/<ruby class="kana-ruby">([^<]*)<rt>([^<]*)<\/rt><\/ruby>/g)].map(m=>[m[1],m[2]]);

test('katakana annotation preserves long vowels, small kana, mixed writing and punctuation',()=>{
 assert.deepEqual(parts('コーヒー'),[['コー','こー'],['ヒー','ひー']]);
 assert.deepEqual(parts('キャップ'),[['キャ','きゃ'],['ッ','っ'],['プ','ぷ']]);
 assert.deepEqual(parts('コピー機'),[['コ','こ'],['ピー','ぴー']]);
 assert.deepEqual(parts('ヴァ・ガ'),[['ヴァ','ゔぁ'],['ガ','が']]);
 assert.deepEqual(parts('ｶﾞｯﾂﾎﾟｰｽﾞ'),[['ｶﾞ','が'],['ｯ','っ'],['ﾂ','つ'],['ﾎﾟｰ','ぽー'],['ｽﾞ','ず']]);
 assert.equal(annotate('あいう'), 'あいう');
});

test('annotation escapes text before adding markup',()=>{
 const result=annotate('<script>カ</script>');
 assert.ok(result.includes('&lt;script&gt;'));assert.ok(!result.includes('<script>'));
 assert.match(result,/<ruby class="kana-ruby">カ<rt>か<\/rt><\/ruby>/);
});
