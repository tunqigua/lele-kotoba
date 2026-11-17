'use strict';
(()=>{
const reading=value=>value.normalize('NFKC').replace(/[ァ-ヶ]/g,c=>String.fromCharCode(c.charCodeAt(0)-0x60));
const written=w=>(w.quizWritten||w.word).replace(/（.*?）/g,'');
const han=/\p{Script=Han}/u;
const smallKana=/[ぁぃぅぇぉゃゅょゎ]/;
const units=text=>reading(text).match(/[ぁ-ゖ][ぁぃぅぇぉゃゅょゎ]?ー?|[^\s]/gu)||[];
const glosses=w=>w.meaning.split(/[；;，,]/).map(s=>s.trim()).filter(s=>/^[\p{Script=Han}]{2,10}$/u.test(s));
const add=(index,key,item)=>{if(!index.has(key))index.set(key,[]);index.get(key).push(item);};
const groups=value=>value.replace(/\p{Script=Han}+/gu,'漢').replace(/[ぁ-ゖ]+/g,'あ').replace(/[ァ-ヶー]+/g,'ア').replace(/[a-zA-Z]+/g,'A');
const scriptNames={'漢':'汉字','あ':'平假名','ア':'片假名','A':'字母'};
const posOf=w=>w.pos.split('·')[0];
const coreWord=w=>!/(助词|助动词|接头|接尾|感叹词)/.test(w.pos);
const preferred=(a,b)=>a.priority.localeCompare(b.priority)||written(a).length-written(b).length||written(a).localeCompare(written(b),'ja');

const semanticPairs=[
 ['ありがとう','感謝','道谢和表达感谢'],['いくら','値段','问多少钱与价格'],
 ['誰','どなた','询问同一个人称，どなた更礼貌'],['また','再び','都可以表示再一次'],
 ['ありがたい','感謝','受到帮助时的感谢'],['偽る','うそ','虚假陈述与谎言'],
 ['劣る','優れる','比较时的一差一优'],['おなか','ぺこぺこ','お腹がぺこぺこ，肚子饿'],
 ['俺','僕','口语中的男性自称'],['固い','柔らかい','描述软硬的一对反义词'],
 ['かばん','荷物','出门时携带的物品'],['髪の毛','髪','都可以指头发'],
 ['かわいい','子猫','可用「かわいい子猫」来记'],['かわいそう','同情','觉得可怜与同情'],
 ['渇く','水','口渴时想喝水'],['挫く','怪我','扭伤属于受伤'],
 ['悔しい','残念','都能表达对结果的遗憾'],['超える','越える','超过界限与越过界线'],
 ['擦る','目','「目を擦る」是揉眼睛'],['こつ','方法','诀窍是做事的方法'],
 ['コンパ','パーティー','聚会场景'],['叱る','怒る','责骂和因某事生气'],
 ['ジーンズ','ズボン','牛仔裤是裤子的一种'],['そのまま','変える','保持原样与改变'],
 ['そろそろ','もうすぐ','都能表达时间快到了'],['畳','和室','日式房间里的榻榻米'],
 ['玉ねぎ','野菜','洋葱是蔬菜'],['ダンボール','箱','纸板常用来做箱子'],
 ['浸かる','お風呂','泡澡场景'],['尽くす','努力','用尽全力、付出努力'],
 ['つまずく','転ぶ','绊到以后可能摔倒'],['Tシャツ','シャツ','都属于上衣'],
 ['どうぞ','ください','都是常见的请托或邀请表达'],['涙','泣く','哭泣时常会流泪'],
 ['なんでも','何','「何でも」里的「何」表示什么'],['なんとか','間に合う','「なんとか間に合う」表示设法赶上'],
 ['ぬいぐるみ','おもちゃ','毛绒玩具是玩具的一种'],['猫','犬','常见的两种宠物'],
 ['のどか','静か','都可形容安宁的环境'],['俳句','詩','俳句属于诗歌'],
 ['嵌める','指輪','「指輪を嵌める」是戴戒指'],['ひらひら','花びら','花瓣轻飘的场景'],
 ['拾う','落とす','东西掉落与捡起来'],['もの','物','都可以指东西或事物'],
 ['夢','希望','目标或愿望这一语义'],['弱い','強い','描述强弱的一对反义词'],
 ['湧く','泉','「泉が湧く」是泉水涌出'],['アナウンサー','放送','播音员的工作与播报'],
 ['カメラ','写真','用相机拍照片'],['カレー','料理','咖喱是一道料理'],
 ['ケーキ','お菓子','都可联想到甜点'],['サラダ','野菜','蔬菜是沙拉常用食材'],
 ['セーター','服','毛衣是衣服的一种'],['チョコレート','お菓子','都可联想到甜食'],
 ['チーム','選手','选手组成队伍'],['ニワトリ','卵','鸡会产蛋'],
 ['ネクタイ','締める','「ネクタイを締める」是系领带'],['ハンバーガー','パン','汉堡用面包夹馅'],
 ['パズル','解く','「パズルを解く」是解谜'],['ビル','建物','大楼属于建筑物'],
 ['ビール','お酒','啤酒是酒的一种'],['ブランド','商品','品牌用来辨识商品'],
 ['メーカー','製品','制造商生产产品'],['リストラ','失業','裁员可能导致失业'],
 ['レベルアップ','上達','都与水平变高有关'],['ローン','借りる','贷款是借钱的一种方式'],
 ['ワイシャツ','ネクタイ','常一起搭配的服饰'],['あ','あっ','都可表示突然注意到事情'],
 ['うん','はい','都能表示肯定或应答，语气不同'],['さあ','始める','「さあ、始めよう」用于招呼开始'],
 ['〜冊','本','「冊」可用来数书'],['ねえ','呼ぶ','「ねえ」可以引起对方注意'],
 ['もしもし','電話','打电话时的招呼'],['この','その','同属放在名词前的指示词'],
 ['こう','そう','都能指示做事方式'],['誰','何','分别问人和事物'],
 ['かわいい','猫','可联想「かわいい猫」'],['〜冊','雑誌','杂志也用「冊」计数']
];

const additionalSenses=[
 ["薄い","厚い","用来对照厚薄"],
 ["成績","試験","考试会有成绩"],
 ["暑さ","暑い","暑い描述天气热，暑さ是炎热的程度"],
 ["油","醤油","厨房里常把油和酱油一起用"],
 ["網の目","網/インターネット","网眼是网的孔隙，也可从网络的网状结构联想"],
 ["一般的","普通","描述通常、常见的情况"],
 ["今まで","これから","从过去到现在与从现在往后"],
 ["歌","歌う","歌是所唱的内容"],
 ["絵本","絵","绘本里有图画"],
 ["炎症","痛み/病気","炎症可能伴随疼痛等症状"],
 ["お仕着せ","制服/規則","お仕着せ也可指统一发放的衣物，或强行规定的做法"],
 ["お姉さん","姉","都指姐姐，使用场合不同"],
 ["温暖化","気候","气候逐渐变暖"],
 ["温度","気温","气温是空气的温度"],
 ["会長","社長","组织或公司中的负责人称谓"],
 ["活字","印刷/出版","活字用于排版印刷与出版"],
 ["活力","元気","都可联想到精力和生气"],
 ["家電","冷蔵庫","冰箱是家用电器"],
 ["金","お金","都可表示钱"],
 ["可能性","可能","可能性的核心意思是存在某种可能"],
 ["神様","神社","在神社参拜神明"],
 ["髪の毛","髪の色/頭","头发长在头上，也可以描述它的颜色"],
 ["彼ら","彼","彼是他，彼ら可表示他们"],
 ["かわいそう","悲しい/悲しむ","都可联想到不如意的场景，かわいそう表达同情"],
 ["看護師","病院","护士常在医院工作"],
 ["館内","図書館","図書館の館内是馆内空间的一个例子"],
 ["学問","研究","研究可以加深对某门学问的认识"],
 ["画面","テレビ","可以联想电视的画面"],
 ["気候","天気","气候是长期特征，天气是短期状况"],
 ["教務課","学生課","学校里服务师生的两个不同部门"],
 ["距離","近い","距离短可以说近い"],
 ["挫く","痛い","扭到脚可能会疼"],
 ["靴下","靴","鞋袜经常一起穿戴"],
 ["具体的","抽象的","具体和抽象相对"],
 ["敬語","尊敬語","尊敬语是敬语的一类"],
 ["現場","現地/場所","都涉及事情发生或开展工作的地点"],
 ["現物","写真","实物可以和照片对照"],
 ["恋人","結婚","恋爱和结婚属于人际关系的不同阶段"],
 ["功績","業績","都可表示取得的成绩或成果"],
 ["紅茶","お茶","红茶是茶的一种"],
 ["超える","限度/制限","超える可用于超过限度或限制"],
 ["心強い","安心","有可以依靠的人会感到安心"],
 ["擦る","目薬/目","用眼部场景联想「目を擦る」"],
 ["個性","性格","都可用于描述一个人的特点"],
 ["国花","桜/花","国花用一种有代表性的花象征国家"],
 ["国旗","国歌/国","国旗与国家身份有关"],
 ["此れ","それ","礼貌问答中用来区分这个和那个"],
 ["困難","難しい","困难对应难以完成的情况"],
 ["誤解","理解","正确理解与误解相对"],
 ["五重塔","寺/お寺","有些寺院建有五重塔"],
 ["災害","地震","地震可能造成灾害"],
 ["最高","最低","最高与最低相对"],
 ["差別","平等","区别对待与平等对照"],
 ["残業","仕事","加班是延长工作时间"],
 ["指示","命令","都是要求别人采取行动，口气不同"],
 ["芝生","公園","公园里常有草坪"],
 ["主人公","物語","主人公是故事中的主要人物"],
 ["食材","料理","食材用来做料理"],
 ["諸国","外国","都可以谈到其他国家"],
 ["新刊","出版","新刊是新出版的书刊"],
 ["侵入","入る","侵入有未经允许进入的意思"],
 ["新品","中古","全新的物品与二手物品对照"],
 ["事実","うそ","事实与谎言相对"],
 ["時代遅れ","流行","过时与流行相对"],
 ["実際","本当","都可谈真实情况"],
 ["自動","手動/機械","自动运行可联想到机器与手动操作"],
 ["渋滞","交通","道路堵塞是交通问题"],
 ["寿命","長生き/年齢","寿命可以用生存的年数衡量"],
 ["人災","天災","人为灾害与自然灾害相对"],
 ["人生","生活","都可用来谈人如何度过自己的生活"],
 ["すき焼き","牛肉","牛肉是寿喜烧的常用食材"],
 ["砂","砂浜/海","沙子让人联想到海边的沙滩"],
 ["滑り落ちる","転ぶ/落ちる","都是失去稳定后可能发生的动作"],
 ["世界一","一番","世界一表示在世界范围内排第一"],
 ["設備","機械","机器可以作为设施或设备的一部分"],
 ["戦士","戦争/戦う","战士参加战斗"],
 ["全体","部分","整体与部分相对"],
 ["騒音","うるさい","噪声让人感觉吵"],
 ["そろそろ","もう/まもなく","都可用来提示时间已到或快到了"],
 ["存在","ある","ある可表达事物存在"],
 ["雑巾","掃除","抹布用来打扫"],
 ["経つ","時間","「時間が経つ」表示时间过去"],
 ["大歓迎","歓迎/ようこそ","都能表达欢迎"],
 ["大名","城/武士","封建时期的大名常与武士和城郭联系在一起"],
 ["代名詞","私/僕","第一人称的「私」「僕」都是代词"],
 ["地位","役職/社長","职务可以反映人在组织中的地位"],
 ["知恵","知識","智慧和知识都与认知有关"],
 ["力仕事","体力","体力活需要体力"],
 ["縮み志向","小型/小さい","偏好把事物做小"],
 ["茶会","お茶","茶会以饮茶为核心"],
 ["調味料","塩","盐是一种调味料"],
 ["通信","電話","电话是通信方式之一"],
 ["つまずく","転ぶ/落ちる","绊到以后可能摔倒"],
 ["Tシャツ","服","Ｔ恤是衣服的一种"],
 ["天災","地震","地震是自然灾害的一种"],
 ["伝承","伝統","相传下来的内容与传统有关"],
 ["電磁波","電波","无线电波属于电磁波"],
 ["登録","会員","登记成为会员"],
 ["遠く","近く","远处与近处相对"],
 ["特徴","特色/個性","都指使人或事物具有区别的特点"],
 ["途中","最後/終わる","在过程当中与到达终点对照"],
 ["何年","生まれる","可以用来问出生年份对应的生肖"],
 ["波","海","海浪是最常见的波浪之一"],
 ["人称","代名詞","代词可根据人称分类"],
 ["人情味","親切/優しい","可以联想到体谅和善待他人"],
 ["熱","体温","发热可通过测体温来判断"],
 ["年度","一年/年","年度按年划分"],
 ["納税","税金","纳税是缴纳税款"],
 ["俳句","文学/作品","俳句是文学作品的一种"],
 ["履物","靴","鞋属于穿在脚上的东西"],
 ["恥","恥ずかしい","羞耻与感到羞耻"],
 ["花火","祭り/夏祭り","祭典上常有烟火表演"],
 ["嵌める","手袋","可以用「手袋をはめる」表示戴手套"],
 ["張り紙","掲示/お知らせ","张贴的纸条可以用来发布告示"],
 ["版画","印刷/絵","版画通过印制形成图画"],
 ["日当たり","日光/太陽","日照好表示容易照到阳光"],
 ["ひらひら","桜/落ち葉","用樱花花瓣或落叶轻轻飘落来记"],
 ["昼寝","寝る","午睡是白天睡一会儿"],
 ["頻度","回数/よく","频度可用单位时间内的次数表示，「よく」可表示经常"],
 ["美化語","敬語","美化语是敬语体系中的一类"],
 ["病棟","入院","住院患者通常住在病栋"],
 ["相応しい","似合う","都可谈是否合适、相配"],
 ["太る","痩せる","变胖与变瘦相对"],
 ["震える","寒い","寒冷时可能发抖"],
 ["武士","大名/侍","武士可从日本封建时期的大名与家臣联想"],
 ["文庫版","本/小説","书和小说可以发行文库版"],
 ["平均","点数/成績","可以计算分数或成绩的平均值"],
 ["包丁","切る","用菜刀切食材"],
 ["待ち時間","並ぶ/待つ","排队或等待会产生等候时间"],
 ["右手","左手/左","右手和左手相对"],
 ["味噌","味噌汁","味噌是味噌汤的主要调味料"],
 ["見なす","考える/判断","都可用于对某件事作出认定或判断"],
 ["身の周り","周り/近く","都与周围、附近有关系"],
 ["昔話","物語/話","过去流传的故事属于物语"],
 ["報いる","恩返し/感謝","报答恩情与表达感谢属于相近情境"],
 ["名作","作品","名作是有名的作品"],
 ["名物","お土産/特産品","当地名物常可作为伴手礼"],
 ["申し遅れる","自己紹介/紹介","常用于补作自我介绍"],
 ["申す","言う","申す可作言う的谦逊说法"],
 ["門","入口/玄関","都是出入场所的入口"],
 ["友情","友達","友情发生在朋友之间"],
 ["優先席","電車/席","公共交通上常设优先席"],
 ["床","部屋","房间里有地板"],
 ["油断","注意","疏忽大意与留意小心相对"],
 ["欲望","欲しい","都涉及想要得到某种东西"],
 ["理想","現実","理想和现实可以对照"],
 ["利点","欠点/便利","优点或便利之处，可与不足对照"],
 ["臨時","一時/特別","临时设置常为特定情况而设"],
 ["老人","高齢者/お年寄り","都可以指老年人"],
 ["ニワトリ","鶏肉/卵","鸡可以产蛋，也是鸡肉的来源"],
 ["パズル","問題/答え","解谜可以从寻找问题答案来联想"],
 ["〜合う","互い/一緒に","表示动作由彼此共同参与"],
 ["〜以上","以下/〜以下","用来对照范围的上限和下限"],
 ["〜箇","〜個/数える","作计数单位时可以联想数东西"],
 ["各〜","それぞれ/別々","都可用于区分各自或每一项"],
 ["〜歳","年齢","「歳」是年龄的计量单位"],
 ["〜様","〜さん/さん","都是接在人名后的称呼，「様」更郑重"],
 ["中国","中国語","中国语指中文"],
 ["東京湾","東京","东京湾位于东京一带，名称与东京有关"],
 ["福岡","九州","福冈位于九州"],
 ["〜分","割合/十分","表示十分之一等比例"],
 ["名所","観光","观光时常去有名的景点"],
 ["曜日","月曜日/土曜日","星期一或星期六都是具体的曜日"],
 ["お仕着せ","決まり","现成的规定强加给别人，可想成别人定下的规矩"],
 ["具体的","譬え","把抽象的说明讲具体时，可以举例子"],
 ["超える","〜以上","都可涉及某个数值的界限，以上包含该数值"],
 ["擦る","眠い","困时常有揉眼睛的动作"],
 ["最高","一番","都能表示排在第一或程度最高"],
 ["差別","尊重","尊重他人与歧视别人是两种不同的态度"],
 ["指示","言う","发出指示时会告诉别人该怎么做"],
 ["新品","新しい","新品就是崭新的物品"],
 ["自動","自動車","可以用汽车的自动挡联想到自动操作"],
 ["寿命","年","寿命可以用存活的年数衡量"],
 ["設備","施設","设施是供人使用的场所或条件，设备是其中的装置"],
 ["戦士","武士","历史上的武士也是作战者"],
 ["大歓迎","迎える","欢迎到访者时会迎接他们"],
 ["調味料","醤油","酱油是一种调味料"],
 ["伝承","伝統的","代代相传的内容，可联想到传统习俗"],
 ["電磁波","信号","电磁波可以传送信号"],
 ["登録","記録","登记时会把资料记入记录"],
 ["熱","病院","发热严重时可能会去医院检查"],
 ["納税","お金","把应缴的税款交出去"],
 ["嵌める","指","把戒指套在手指上"],
 ["理想","夢","都可指希望将来达到的状态"],
 ["老人","年寄り","都可指老年人"],
 ["ニワトリ","鳥","鸡是一种鸟"],
 ["〜歳","いくつ","用「おいくつですか」问几岁时，以「〜歳」回答"],
];

function build(words,hints={},radicals={},kanjiReadings={}){
 const byId=new Map(words.map(w=>[w.id,w])),byWord=new Map();
 const byHan=new Map(),byRadical=new Map(),byKana=new Map(),byEdge=new Map(),byShape=new Map(),byGloss=new Map(),byForm=new Map(),byEnding=new Map();
 const entries=new Map(),stems=new Map(),derivatives=new Map(),curated=new Map(),contexts=new Map();
 const segmenter=typeof Intl.Segmenter==='function'?new Intl.Segmenter('ja',{granularity:'word'}):null;

 for(const w of [...words].sort(preferred)){
  const text=written(w),kana=reading(w.kana),mora=units(kana),shape=groups(text),pos=posOf(w);
  const chars=[...new Set([...text].filter(c=>han.test(c)))];
  entries.set(w.id,{text,kana,mora,shape,pos,chars});
  if(!byWord.has(text))byWord.set(text,w);
  if(!byWord.has(w.word))byWord.set(w.word,w);
  for(const char of chars){
   add(byHan,char,w);
   if(radicals[char])add(byRadical,radicals[char],w);
  }
  add(byKana,kana,w);
  add(byShape,shape,w);
  add(byEnding,pos+'|'+text.slice(-1),w);
  for(const gloss of glosses(w))add(byGloss,gloss,w);
  if(mora.length){
   add(byEdge,'start|'+mora[0],w);
   add(byEdge,'end|'+mora.at(-1),w);
  }
  if(coreWord(w))add(byForm,text,w);
  const suffix=text.match(/[ぁ-ゖ]+$/)?.[0];
  if(!suffix||!chars.length||!kana.endsWith(suffix)||!w.forms?.masu?.endsWith('ます'))continue;
  const base=text.slice(0,-suffix.length),stem=kana.slice(0,-suffix.length);
  const masu=reading(w.forms.masu);
  if(!masu.startsWith(stem))continue;
  const stemText=base+masu.slice(stem.length,-2);
  add(stems,stemText+'|'+masu.slice(0,-2),w);
  for(const form of Object.values(w.forms)){
   if(!form)continue;
   const real=reading(form);
   if(real.startsWith(stem))add(byForm,base+real.slice(stem.length),w);
  }
 }
 for(const w of words){
  const e=entries.get(w.id);
  if(!w.pos.includes('名词'))continue;
  for(const verb of stems.get(e.text+'|'+e.kana)||[]){
   if(w===verb)continue;
   add(derivatives,w.id,{word:verb,why:'词形是这个动词的ます形词干'});
   add(derivatives,verb.id,{word:w,why:'这个名词与ます形词干同形同读'});
  }
 }
 for(const [left,right,why] of [...semanticPairs,...additionalSenses]){
  const a=byWord.get(left),b=right.split('/').map(value=>byWord.get(value)).find(Boolean);
  if(a&&b){add(curated,a.id,{word:b,why});add(curated,b.id,{word:a,why});}
 }
 for(const owner of words){
  for(const {jp,words:linked=[]} of owner.collocations||[]){
   for(const {id} of linked){
    if(id!==owner.id)add(contexts,id,{word:owner,why:`可放进同一个搭配「${jp}」来记`});
   }
  }
 }
 const nominalized=words.filter(w=>w.pos.includes('名词')&&derivatives.has(w.id));
 const makeLinks=(w)=>{
  const e=entries.get(w.id),letter=new Map(),sound=new Map(),form=new Map(),meaning=new Map();
  function link(bucket,word,why,rank=0){
   if(!word||word.id===w.id||written(word)===e.text)return;
   const key=written(word),old=bucket.get(key);
   if(!old||rank<old.rank)bucket.set(key,{word,why,rank});
  }
  for(const [id,why] of hints[w.id]?.[1]||[]){
   const word=byId.get(id);
   if(why.startsWith('拼音声韵'))link(sound,word,why,3);
   else if(!why.includes('变音前'))link(letter,word,why,0);
  }
  for(const char of e.chars){
   for(const word of byHan.get(char)||[])link(letter,word,`同有「${char}」字`,1);
   const radical=radicals[char];
   if(!radical)continue;
   for(const word of byRadical.get(radical)||[]){
    const match=entries.get(word.id).chars.find(c=>radicals[c]===radical);
    if(match&&match!==char)link(letter,word,`「${char}」和「${match}」同属「${radical}」部`,4);
   }
  }
  for(const word of byKana.get(e.kana)||[])link(sound,word,'全词假名读音相同',0);
  for(const side of ['start','end']){
   const a=side==='start'?e.mora:[...e.mora].reverse();
   for(const word of byEdge.get(side+'|'+a[0])||[]){
    const b=entries.get(word.id).mora,other=side==='start'?b:[...b].reverse();
    let count=0;
    while(count<a.length&&a[count]===other[count])count++;
    const match=(side==='start'?a.slice(0,count):a.slice(0,count).reverse()).join('');
    if(match&&!smallKana.test(match[0])&&match!=='ー'){
     link(sound,word,`${side==='start'?'开头':'末尾'}都读「${match}」`,12-2*count+(side==='end'?1:0));
    }
   }
  }
  if(!sound.size&&e.mora[0]?.endsWith('ー')){
   const original=e.mora[0],short=original.slice(0,-1);
   for(const word of byEdge.get('start|'+short)||[]){
    link(sound,word,`开头读音相近，「${original}」比「${short}」多一拍`);
   }
  }
  if(letter.size<6){
   for(const word of words){
    const target=entries.get(word.id).text;
    const common=[...e.text].find(c=>/[ぁ-ゖァ-ヶA-Z]/.test(c)&&target.includes(c));
    if(common)link(letter,word,`写法里都有${/[A-Z]/.test(common)?'字母':'假名'}「${common}」`,7);
    if(e.text==='血'&&target.includes('皿'))link(letter,word,'「血」的下半部分写作「皿」',0);
    if(e.text==='DVD'&&/^[A-Z]+$/.test(target))link(letter,word,'都由大写字母写成',8);

   }
  }
  for(const {word,why} of derivatives.get(w.id)||[])link(form,word,why);
  if(w.pos.includes('名词')&&derivatives.has(w.id)){
   for(const word of nominalized)link(form,word,'都可以用对应动词的ます形词干来记',1);
  }
  for(const word of byEnding.get(e.pos+'|'+e.text.slice(-1))||[]){
   link(form,word,`同是${e.pos}，词尾都写「${e.text.slice(-1)}」`,e.text.length===written(word).length?2:3);
  }
  for(const word of byShape.get(e.shape)||[]){
   const description=[...e.shape].map(c=>scriptNames[c]).join('＋');
   if(!description)continue;
   const sameLength=e.text.length===written(word).length;
   const why=e.shape==='漢'&&sameLength?`都是 ${e.text.length} 个汉字组成的词`:`都是「${description}」的写法`;
   link(form,word,why,4+(posOf(word)===e.pos?0:2)+(sameLength?0:1));
  }
   if(!form.size){
   for(const word of words){
    if(e.shape.includes('漢')&&e.shape.includes('あ')&&entries.get(word.id).shape.includes('漢')&&entries.get(word.id).shape.includes('あ')){
     link(form,word,'写法都由汉字和平假名混合构成',9);
    }
   }
  }
  for(const {word,why} of curated.get(w.id)||[])link(meaning,word,why);
  for(const pair of w.counterparts||[])link(meaning,byId.get(pair.id),`这个动作的对应${pair.transitivity}`,1);
  for(const gloss of glosses(w)){
   for(const word of byGloss.get(gloss)||[])link(meaning,word,`词表释义都有「${gloss}」`,2);
  }
  const examples=[...(w.collocations||[]),...(w.phrases||[])];
  for(const {jp,words:linked=[]} of examples){
   for(const {id} of linked)link(meaning,byId.get(id),`可放进同一个搭配「${jp}」来记`,3);
  }
  for(const {word,why} of contexts.get(w.id)||[])link(meaning,word,why,4);
  if(segmenter&&meaning.size<8){
   for(const {jp} of examples.slice(0,5)){
    const segments=[...segmenter.segment(jp)];
    for(let i=0;i<segments.length;i++){
     if(!segments[i].isWordLike)continue;
     let text='';
     for(const segment of segments.slice(i,i+5)){
      if(!segment.isWordLike)break;
      text+=segment.segment;
      for(const word of byForm.get(text)||[]){
       if(text.length>1||han.test(text))link(meaning,word,`一起出现在「${jp}」`,5);
      }
     }
    }
    if(meaning.size>=8)break;
   }
  }
  const buckets=[letter,sound,form,meaning].map(group=>[...group.values()].sort((a,b)=>a.rank-b.rank).slice(0,12));
  const order=[3,0,2,1].sort((a,b)=>buckets[a].length-buckets[b].length);
  const branches=[],used=new Set();
  // Find distinct words even where two branches offer the same strongest match.
  for(let count=4;count>0;count--){
   if(assign(0,count))break;
  }
  function assign(i,remaining){
   if(i===order.length)return remaining===0;
   if(remaining>order.length-i)return false;
   const index=order[i];
   if(remaining){
    for(const item of buckets[index]){
     const key=written(item.word);
     if(used.has(key))continue;
     branches[index]=item;
     used.add(key);
     if(assign(i+1,remaining-1))return true;
     used.delete(key);
     delete branches[index];
    }
   }
   return assign(i+1,remaining);
  }
  return Array.from({length:4},(_,i)=>branches[i]||null);
 };
 const example=['経済','経営','営業','授業','業績'].map(word=>byWord.get(word));
 function connection(from,to,char){
  return {char,fromReading:kanjiReadings[from.id]?.[char],toReading:kanjiReadings[to.id]?.[char]};
 }
 function chainFor(word){
  const words=[word],links=[],used=new Set([written(word)]);
  if(example.every(Boolean)&&example.includes(word)){
   return {words:example,links:['経','営','業','業'].map((char,i)=>connection(example[i],example[i+1],char))};
  }
  function extend(atStart){
   const end=atStart?words[0]:words[words.length-1];
   const previous=(atStart?links[0]:links[links.length-1])?.char;
   let best=null;
   for(const char of entries.get(end.id).chars){
    for(const candidate of byHan.get(char)){
     if(used.has(written(candidate)))continue;
     const edge=atStart?connection(candidate,end,char):connection(end,candidate,char);
     const known=edge.fromReading&&edge.toReading;
     const same=known&&edge.fromReading===edge.toReading;
     const score=(same?30:known?6:10)+(char!==previous?9:0)+
                 (entries.get(candidate.id).chars.length>1?3:0)+(coreWord(candidate)?2:0);
     if(!best||score>best.score)best={candidate,edge,score};
    }
   }
   if(!best)return false;
   used.add(written(best.candidate));
   if(atStart){words.unshift(best.candidate);links.unshift(best.edge);}
   else{words.push(best.candidate);links.push(best.edge);}
   return true;
  }
  for(let i=0;i<4;i++){
   const atStart=i%2===0;
   if(!extend(atStart)&&!extend(!atStart))break;
  }
  return {words,links};
 }
 return {forWord:makeLinks,chainFor};
}
window.KotobaMemory={build};
})();
