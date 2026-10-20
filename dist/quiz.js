/* Local sound/character contrasts only: never pull unrelated vocabulary as choices. */
(function(root){
'use strict';
const shuffle=(list,random=Math.random)=>{const a=[...list];for(let i=a.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
const hira=s=>s.replace(/[ァ-ヶ]/g,c=>String.fromCharCode(c.charCodeAt(0)-96));
const kata=s=>s.replace(/[ぁ-ゖ]/g,c=>String.fromCharCode(c.charCodeAt(0)+96));
const small={'ゃ':'や','ゅ':'ゆ','ょ':'よ','ぁ':'あ','ぃ':'い','ぅ':'う','ぇ':'え','ぉ':'お'};
const soundGroups=['かが','きぎ','くぐ','けげ','こご','さざ','しじ','すず','せぜ','そぞ','ただ','ちぢ','つづ','てで','とど','はばぱ','ひびぴ','ふぶぷ','へべぺ','ほぼぽ'];
const nearGroups=['あお','いえ','うお','きしち','くつ','けせて','こそと','なまら','にみり','ぬめ','ねれわ','のほも','ひい','ふう','やゆよ','はか','むす','ろる','せけ','んむ'];
const vowel={};for(const row of ['あいうえお','かきくけこ','がぎぐげご','さしすせそ','ざじずぜぞ','たちつてと','だぢづでど','なにぬねの','はひふへほ','ばびぶべぼ','ぱぴぷぺぽ','まみむめも','らりるれろ'])[...row].forEach((c,i)=>vowel[c]='あいうえお'[i]);Object.assign(vowel,{'や':'あ','ゆ':'う','よ':'お','ゃ':'あ','ゅ':'う','ょ':'お','わ':'あ','を':'お','ぁ':'あ','ぃ':'い','ぅ':'う','ぇ':'え','ぉ':'お'});
function phonetic(s){let out='';for(const c of hira(s)){if(c==='ー')out+=vowel[out.at(-1)]||'ー';else out+=c;}return out.replace(/([おこごそぞとのほぼぽもよょろ])う/g,'$1お').replace(/([えけげせぜてでねへべぺめれ])い/g,'$1え');}
function distance(a,b){const t=[...a],u=[...b],r=Array.from({length:u.length+1},(_,i)=>i);for(let i=0;i<t.length;i++){let before=r[0];r[0]=i+1;for(let j=0;j<u.length;j++){const old=r[j+1];r[j+1]=Math.min(r[j+1]+1,r[j]+1,before+(t[i]!==u[j]));before=old;}}return r[u.length];}
function kanaOptions(w,random=Math.random){
 const isKata=/^[ァ-ヺー]+$/.test(w.kana),correct=isKata?w.kana:hira(w.kana),base=hira(correct),out=new Set(),accepted=new Set([correct,...(w.acceptedKana||[])].map(phonetic));
 const add=s=>{if(!s||/^[っゃゅょぁぃぅぇぉー]/.test(hira(s))||s.includes('っっ'))return;const candidate=isKata?kata(s):s;if(candidate!==correct&&!accepted.has(phonetic(candidate))&&distance(correct,candidate)<=2)out.add(candidate);};
 for(const s of shuffle(w.kanaDistractors||[],random))add(s);
 const variants=[];
 const change=(i,c)=>base.slice(0,i)+c+base.slice(i+1);
 for(let i=0;i<base.length;i++){
  const c=base[i];for(const g of soundGroups)if(g.includes(c))for(const k of g)if(k!==c)variants.push(change(i,k));
  if(small[c])variants.push(change(i,small[c]));
  if(c==='っ')variants.push(base.slice(0,i)+base.slice(i+1));
  if(c==='ー'||(i>0&&(c===vowel[base[i-1]]||(c==='う'&&vowel[base[i-1]]==='お')||(c==='い'&&vowel[base[i-1]]==='え'))))variants.push(base.slice(0,i)+base.slice(i+1));
 }
 for(const s of shuffle(variants,random))add(s);
 for(let i=0;out.size<6&&i<base.length;i++)for(const g of nearGroups)if(g.includes(base[i]))for(const k of g)if(k!==base[i])add(change(i,k));
 for(let i=0;out.size<3&&i<base.length;i++)for(const k of 'かきくけこさしすせそたちつてとなにぬねの')if(k!==base[i])add(change(i,k));
 return shuffle([correct,...[...out].slice(0,3)],random);
}
// Japanese character confusions. Alter a target character, preserving the rest of the word.
const groups=['切刈刊','手毛午','注住柱','文丈六','建健鍵','築策筑','紹招昭','介会界','先失洗','輩軍車','隣輪倫','値植直','段断般','航杭抗','空窓穴','便使更','事時寺','務霧努','室屋至','図園国','書暑署','館管官','学覚字','校効郊','語話誤','賃貸貨','金全釜','日目白','本木末','読続売','聞問間','問門間','間問閑','会合回','通道週','通道連','帰掃婦','思恩恵','想相箱','料科斜','理埋里','旅族旋','保呆堡','険検倹','発登廃','表俵麦','受授愛','賞常掌','信借伸','集隼隻','中仲申','習翌羽','週周調','期棋基','記紀起','議義儀','気汽汽','温湿湯','暖緩援','暑署著','熱熟勢','寒塞察','高商亭','低抵底','安案字','少小沙','多夕移','近斤折','遠園猿','新親薪','古占吉','大太犬','小少水','広床鉱','狭挟峡','長帳張','短矢知','強弾弱','弱羽弟','速連束','早草卓','悪恵思','良郎浪','美実羊','正止王','好奴如','難漢灘','易昜場','優憂僕','甘廿世','痛病通','辛幸新','明朋朗','暗音闇','冷令涼','涼凍諒','忙忘亡','楽薬葉','面画向','白自百','静清精','賑振震','麗鹿慶','利梨刊','不下否','元天云','暇仮瑕','上土止','下卞不','嫌謙兼','切幼功','要票西','毎母海','朝潮韓','夜液役','午牛干','前箭剪','後復腹','今令念','年午牛','去法云','先失夫','昨作咋','昨昨作','時持待','誕延庭','季李秀','節筋策','春奏秦','夏復憂','秋秒和','冬終各','天夭夫','雨両雲','雪雷雲','台合治','風鳳凡','震振賑','花化華','桜楼櫻','車軍東','電雷雪','転伝軒','自目白','動働勧','飛非羽','病疾疲','院完員','員貝円','局句司','店占点','屋握室','公六八','園遠国','場揚湯','部倍郡','家象豪','国囲因','外夕処','内肉丙','所折析','右石古','左在佐','後復得','父交文','母毎毋','兄只況','姉妹市','弟第弔','妹姉未','両雨西','友支反','生主王','専博恵','攻功政','教数孝','育青肩','顔額頑','体休本','頭頬類','髪発友','目自白','口日囗','耳取耶','歯齢止','足走是','水氷永','茶荼菜','牛午生','乳孔乱','果菓東','菜採采','肉内丙','魚漁角','薬楽葉','飯飲板','飲飯欲','菓果葉','酒洒酉','食良飢','米来未','名各右','性姓生','住柱注','紙氏紙江','辞辟乱','雑集雄','誌詩誌','報服幸','告吉舌','写与冩','真直具','画田由','映英影','音意章','意音息','専博尊','科料斜','数教楼','計討針','算筒簿','育青肖','準准隼','備供借','説悦脱','例列烈','参惨珍','加力如','掃婦帰','除余途','洗先浄','濯耀躍','使便吏','方万放','交文父','流硫疏','展張属','始治姑','終絡級','起越走','着看養','入人八','出山凹','乗乖秉','待持侍','持待特','作昨佐','買買取','売壱克','貸貨資','借惜措','返反坂','送迷逆','遅違達','覚党学','泳永詠','選撰遷','探深操','誘透秀','調周綢','疲皮被','伝転云','止正上','撮最取','治始冶','払仏拡','降隆陥','見貝児','換喚検','受愛授','比北此','切刊刈','取職叙','覚党営','済清斉','走赴越','座坐庄','開閉閑','閉開閑','合会台','守寺宇','忘忙亡','落洛絡','泣立涙','脱説悦','求球救','戻涙戸','笑答笠','願原頑','祝視況','汚汗污','進準追','路絡洛','約釣的','満備両','仲沖伸','平半干','断新析','禁森林','相想箱','談諸語','講購構','招紹召','残浅銭','全企金','世卅丗','助肋且','力刀九','知和智','歩止少','急怠息','置直署','押抽申','重里童','軽経径','庫車車','完院定','感惑憾','関開間','心必志','管官館','看着盾','護獲穫','示宗末','度渡席','成戊式','効郊校','景影京','現視規','在存任','定宇完','象像家','蔵臓倉','卒率辛','般船盤','然熱燃','様模樹','様模樹','素索系','種類穂','類頬頼','順須訓','将奨状','奨将賞','省少肖','略格絡','植値殖','診珍疹','察祭擦','配酉酒','全企金','設役没','界畑堺','政攻放','優憂僕','賛替費','存仔在','滞帯滴','滞帯滴','対耐村','都郡者','確礎碓','卓早章','頼瀬頑','偶隅遇','保呆堡','域或城','土士工','志士心','挑桃跳','徹撤徴','電雪雷','源原願','陶淘陳','芸雲伝','同洞司','特持待','徴微徹','途余除','伴半拌','富福冨','鳥烏島','眺跳兆','流硫疏','並普普','記紀紀','荷何苛','納純内','登澄灯','昇升早','葉業蝶','箱相籍','恥耻聴','散敬敢','展張居','離難雌','晴清精','額顔題','判版刊','控空採','越超走','秘必秤','拾捨拍','増憎僧','減滅咸','普晋音','物牧特','価値西','雰雪気','囲園固','変恋赤','料科斜','夢蘿蒙','余途除','預頂領','貯貴財','呼吸吁','喜善吉','宜宣且','解触角','寮療僚','象像家','列例刑','若苦右','割害剖','我找武'];
groups.push('行待術衡街','来未米束東','食良飯倉','手毛乎午','分文公介今','自目白百','曲由田典','服報役板','分文公介今','肉内丙因','本木末未','日目白田','入人八又');
const chars=new Map();for(const g of groups)for(const c of g){const a=chars.get(c)||new Set();for(const n of g)if(n!==c)a.add(n);chars.set(c,a);}
const written=w=>(w.quizWritten||w.word).replace(/（.*?）/g,'');
function kanjiOptions(w,random=Math.random){
 const correct=written(w),out=new Set(),accepted=new Set([correct,...(w.acceptedWritten||[])]);
 const add=s=>{if(s!==correct&&!accepted.has(s)&&distance(correct,s)<=2)out.add(s);};
 for(const s of shuffle(w.kanjiDistractors||[],random))add(s);
 const variants=[];for(let i=0;i<correct.length;i++)if(/[一-龯々]/.test(correct[i]))for(const c of chars.get(correct[i])||[])variants.push(correct.slice(0,i)+c+correct.slice(i+1));
 for(const s of shuffle(variants,random))add(s);
 if(out.size<3)for(let i=0;i<correct.length;i++)if(/[一-龯]/.test(correct[i]))for(const c of '末未木本日目白'){add(correct.slice(0,i)+c+correct.slice(i+1));if(out.size>=3)break;}
 return shuffle([correct,...[...out].slice(0,3)],random);
}
function contextHint(w){
 const target=written(w),p=(w.phrases||[]).find(p=>p.jp.includes(target));
 if(p)return '语境：'+p.jp.split(target).join(w.kana);
 if(w.meaning.includes(target))return '请选择正确写法';
 return w.meaning;
}
function createQuestion(words,state,previousId=null,random=Math.random){
 let pool=words.filter(w=>state.words[w.id]?.seen>0&&(state.words[w.id].readingStreak||0)<5);
 if(pool.length>1)pool=pool.filter(w=>w.id!==previousId);if(!pool.length)return null;
 const w=pool[Math.floor(random()*pool.length)],hasKanji=/[一-龯]/.test(written(w)),type=hasKanji&&random()<.5?'kanji':'kana';
 const options=type==='kanji'?kanjiOptions(w,random):kanaOptions(w,random);
 if(options.length!==4)throw Error('Unable to form four distinct choices: '+w.word);
 return {id:w.id,type,options,answer:type==='kanji'?written(w):(/^[ァ-ヺー]+$/.test(w.kana)?w.kana:hira(w.kana)),prompt:type==='kanji'?w.kana:hasKanji?written(w):w.meaning,hint:type==='kanji'?contextHint(w):hasKanji?w.meaning:'中文提示 · 选择正确假名',selected:null};
}
const api={shuffle,phonetic,distance,kanaOptions,kanjiOptions,createQuestion,written};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.KotobaQuiz=api;
})(typeof window!=='undefined'?window:globalThis);
