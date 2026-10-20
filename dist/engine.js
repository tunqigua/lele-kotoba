/* Small, dependency-free study engine. Browser and Node share the same logic. */
(function(root){
'use strict';
const KEY='lele-kotoba-v2', LEGACY_KEY='lele-kotoba-v1', DAY=86400000, INTERVALS=[1,3,7,14,30,60];
const today=(now=Date.now())=>new Date(now+8*3600000).toISOString().slice(0,10);
const fresh=()=>({schema:1,words:{},logs:[],settings:{newGoal:20,reviewGoal:50,priority:'all',lesson:'all'},savedAt:null});
function validate(raw,ids){
 if(!raw||raw.schema!==1||typeof raw.words!=='object'||Array.isArray(raw.words)||!Array.isArray(raw.logs))throw Error('备份格式不匹配，请选择「拾词」导出的 JSON 文件。');
 const next=fresh();
 for(const [id,v]of Object.entries(raw.words)){
  if(!ids.has(id))continue;
  if(!v||!Number.isInteger(v.stage)||v.stage<0||v.stage>5||!Number.isFinite(v.due)||v.due<0||v.due>Date.now()+DAY*730||!Number.isFinite(v.seen)||v.seen<0||!Number.isFinite(v.lapses)||v.lapses<0)throw Error('备份中有无效的单词进度。');
  const history=raw.logs.filter(l=>l&&l.id===id&&['quizRight','quizWrong'].includes(l.grade));let legacyStreak=0;for(const l of history)legacyStreak=l.grade==='quizRight'?Math.min(5,legacyStreak+1):0;
  const readingStreak=Number.isInteger(v.readingStreak)&&v.readingStreak>=0&&v.readingStreak<=5?v.readingStreak:legacyStreak;
  next.words[id]={readingStreak,readingTotal:Number.isInteger(v.readingTotal)&&v.readingTotal>=0?v.readingTotal:history.filter(l=>l.grade==='quizRight').length,stage:v.stage,due:v.due,seen:Math.min(v.seen,100000),lapses:Math.min(v.lapses,100000),star:!!v.star,lastReviewDay:typeof v.lastReviewDay==='string'?v.lastReviewDay:null,learnedOn:typeof v.learnedOn==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v.learnedOn)?v.learnedOn:today()};
 }
 next.logs=raw.logs.slice(-20000).filter(l=>l&&ids.has(l.id)&&/^\d{4}-\d{2}-\d{2}$/.test(l.day)&&['again','hard','good','quizWrong','quizRight'].includes(l.grade)).map(l=>({id:l.id,day:l.day,grade:l.grade,isNew:!!l.isNew,...(['kana','kanji'].includes(l.quizType)?{quizType:l.quizType}:{})}));
 const s=raw.settings||{};
 next.settings.newGoal=Number.isInteger(s.newGoal)&&s.newGoal>=1&&s.newGoal<=100?s.newGoal:20;
 next.settings.reviewGoal=Number.isInteger(s.reviewGoal)&&s.reviewGoal>=1&&s.reviewGoal<=200?s.reviewGoal:50;
 next.settings.priority=['all','A','B','C'].includes(s.priority)?s.priority:'all';
 next.settings.lesson=typeof s.lesson==='string'&&/^(all|exam|[1-9]|1[0-5])$/.test(s.lesson)?s.lesson:'all';
 next.savedAt=typeof raw.savedAt==='string'?raw.savedAt:null;return next;
}
function counts(state,now=Date.now()){
 const logs=state.logs.filter(l=>l.day===today(now));
 return {learned:Object.values(state.words).filter(w=>w.seen>0).length,mastered:Object.values(state.words).filter(w=>w.seen>0&&w.stage>=3).length,due:Object.values(state.words).filter(w=>w.seen>0&&w.due<=now).length,newToday:new Set(logs.filter(l=>l.isNew).map(l=>l.id)).size,reviewToday:new Set(logs.filter(l=>!l.isNew&& !l.grade.startsWith('quiz')&&!logs.some(a=>a.id===l.id&&a.isNew)).map(l=>l.id)).size,answers:logs.length};
}
function rate(state,id,grade,now=Date.now()){
 if(!['again','hard','good'].includes(grade))throw Error('Invalid grade');
 const old=state.words[id]||{stage:0,due:0,seen:0,lapses:0,star:false,learnedOn:today(now)};
 const isNew=old.seen===0;
 const stage=grade==='again'?0:grade==='hard'?Math.max(0,old.stage-1):(isNew?0:old.lastReviewDay===today(now)?old.stage:Math.min(5,old.stage+1));
 state.words[id]={...old,stage,lastReviewDay:today(now),seen:old.seen+1,lapses:old.lapses+(grade==='again'?1:0),due:now+(grade==='again'?600000:grade==='hard'?DAY:DAY*INTERVALS[stage]),learnedOn:isNew?today(now):old.learnedOn};
 state.logs.push({id,day:today(now),grade,isNew});state.logs=state.logs.slice(-20000);return state.words[id];
}
function filter(words,settings){return words.filter(w=>(settings.priority==='all'||w.priority===settings.priority)&&(settings.lesson==='all'||(settings.lesson==='exam'?w.source==='exam':w.lesson&&w.lesson.split('-')[0]===settings.lesson)));}
function queue(words,state,mode='mixed',now=Date.now()){
 const selected=filter(words,state.settings),c=counts(state,now);
 const due=selected.filter(w=>state.words[w.id]?.seen>0&&state.words[w.id].due<=now).sort((a,b)=>state.words[a.id].due-state.words[b.id].due).slice(0,Math.max(0,state.settings.reviewGoal-c.reviewToday));
 const unseen=selected.filter(w=>!state.words[w.id]?.seen).slice(0,Math.max(0,state.settings.newGoal-c.newToday));
 return mode==='review'?due:mode==='new'?unseen:[...due,...unseen];
}
function readingPool(words,state){return words.filter(w=>state.words[w.id]?.seen>0&&(state.words[w.id].readingStreak||0)<5);}
function recordReading(state,id,correct,type='kana',now=Date.now()){
 const w=state.words[id];if(!w?.seen||w.readingStreak>=5)return false;
 w.readingStreak=correct?Math.min(5,(w.readingStreak||0)+1):0;
 w.readingTotal=(w.readingTotal||0)+(correct?1:0);
 if(!correct)w.lapses++;
 state.logs.push({id,day:today(now),grade:correct?'quizRight':'quizWrong',isNew:false,quizType:type});state.logs=state.logs.slice(-20000);return true;
}
const api={KEY,LEGACY_KEY,DAY,INTERVALS,today,fresh,validate,counts,rate,filter,queue,readingPool,recordReading};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.KotobaEngine=api;
})(typeof window!=='undefined'?window:globalThis);
