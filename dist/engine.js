/* Small, dependency-free study engine. Browser and Node share the same logic. */
(function(root){
'use strict';
const KEY='lele-kotoba-v4', LEGACY_KEY='lele-kotoba-v3', EARLIEST_KEY='lele-kotoba-v2', LEGACY_KEYS=['lele-kotoba-v3','lele-kotoba-v2','lele-kotoba-v1'], DAY=86400000, INTERVALS=[1,3,7,14,30,60], READING_INTERVALS=[7,14,30];
const READING_PLAN_RULE='yesterday-plus-10-v1';
function shuffle(list,random=Math.random){const a=[...list];for(let i=a.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
const today=(now=Date.now())=>new Date(now+8*3600000).toISOString().slice(0,10);
const dayStart=(now=Date.now())=>Date.parse(today(now)+'T00:00:00+08:00');
const reviewDue=(now=Date.now(),days=1)=>dayStart(now)+days*DAY;
const validDay=d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d);
const readingCheckDue=(w,now=Date.now())=>!!(w?.seen&&w.readingDoneDay!==today(now)&&Number.isFinite(w.readingDue)&&w.readingDue>0&&w.readingDue<=now);
const readingReady=(w,now=Date.now())=>!!(w?.seen&&w.readingDoneDay!==today(now)&&((w.readingStreak||0)<5?(w.readingDue||0)<=now:readingCheckDue(w,now)));
const readingAllowed=(w,now,state)=>!state?.readingPlan||state.readingPlan.day!==today(now)||state.readingPlan.ids.some(id=>state.words[id]===w);
const isDue=(w,now=Date.now(),state=null)=>!!(w?.seen&&(w.reviewPending||w.due<=now||(readingAllowed(w,now,state)&&(w.readingRetry||readingCheckDue(w,now)))||(w.troubleDays||[]).some(d=>d<=today(now))));
function markTrouble(w,now){w.troubleDays=[...new Set([...(w.troubleDays||[]),today(reviewDue(now))])].sort();}
const fresh=()=>({schema:1,words:{},logs:[],readingPlan:null,grindSession:null,settings:{newGoal:20,reviewGoal:50,priority:'all',lesson:'all'},savedAt:null});
function validate(raw,ids){
 if(!raw||raw.schema!==1||typeof raw.words!=='object'||Array.isArray(raw.words)||!Array.isArray(raw.logs))throw Error('备份格式不匹配，请选择「拾词」导出的 JSON 文件。');
 const next=fresh();
 const lastCardGrades=new Map();
 for(const l of raw.logs)if(l&&['again','hard','good'].includes(l.grade))lastCardGrades.set(l.id,l);
 for(const [id,v]of Object.entries(raw.words)){
  if(!ids.has(id))continue;
  if(!v||!Number.isInteger(v.stage)||v.stage<0||v.stage>5||!Number.isFinite(v.due)||v.due<0||v.due>Date.now()+DAY*730||!Number.isFinite(v.seen)||v.seen<0||!Number.isFinite(v.lapses)||v.lapses<0)throw Error('备份中有无效的单词进度。');
  const history=raw.logs.filter(l=>l&&l.id===id&&['quizRight','quizWrong'].includes(l.grade)&&validDay(l.day));
  const daily=new Map();for(const l of history){const day=daily.get(l.day)||{wrong:false,right:false,last:null};day.wrong=day.wrong||l.grade==='quizWrong';day.right=day.right||l.grade==='quizRight';day.last=l.grade;daily.set(l.day,day);}
  let legacyStreak=0;for(const [,d]of [...daily].sort(([a],[b])=>a.localeCompare(b)))legacyStreak=d.wrong?0:d.right?Math.min(5,legacyStreak+1):legacyStreak;
  let legacyCardStreak=0,legacyCardMax=0;
  for(const l of raw.logs)if(l&&l.id===id&&l.context!=='reading'&&['again','hard','good'].includes(l.grade)){legacyCardStreak=l.grade==='again'?legacyCardStreak+1:0;legacyCardMax=Math.max(legacyCardMax,legacyCardStreak);}
  const cardAgainStreak=Number.isInteger(v.cardAgainStreak)&&v.cardAgainStreak>=0?Math.min(v.cardAgainStreak,100000):legacyCardStreak;
  const cardAgainMax=Math.max(cardAgainStreak,legacyCardMax,Number.isInteger(v.cardAgainMax)&&v.cardAgainMax>=0?Math.min(v.cardAgainMax,100000):0);
  const dailyRule=v.readingRule==='daily-v1';
  const readingStreak=dailyRule&&Number.isInteger(v.readingStreak)&&v.readingStreak>=0&&v.readingStreak<=5?v.readingStreak:legacyStreak;
  const lastReading=history.at(-1),lastFailed=history.filter(l=>l.grade==='quizWrong').at(-1);
  const readingDoneDay=dailyRule&&validDay(v.readingDoneDay)?v.readingDoneDay:lastReading?.grade==='quizRight'?lastReading.day:null;
  const readingFailedDay=dailyRule&&validDay(v.readingFailedDay)?v.readingFailedDay:lastFailed?.day||null;
  const lastCard=lastCardGrades.get(id),relearning=v.seen>0&&(typeof v.relearning==='boolean'?v.relearning:lastCard?.day===today()&&['again','hard'].includes(lastCard.grade));
  const cardHistory=raw.logs.filter(l=>l&&l.id===id&&['again','hard','good','quizWrong','grindWrong'].includes(l.grade)&&validDay(l.day));
  const reviewedOn=[validDay(v.reviewedOn)?v.reviewedOn:'',...cardHistory.filter(l=>l.grade==='good').map(l=>l.day)].sort().at(-1)||null;
  const troubleDays=[...new Set([...(Array.isArray(v.troubleDays)?v.troubleDays.filter(validDay):[]),...cardHistory.filter(l=>l.grade!=='good').map(l=>today(Date.parse(l.day+'T00:00:00+08:00')+DAY))])].filter(d=>!reviewedOn||d>reviewedOn).sort();
  const reviewPending=!!v.reviewPending&&relearning;
  const due=v.due>0?Math.max(dayStart(v.due),relearning&&lastCard?.day===today()&&!reviewPending?reviewDue():0):0;
  const readingWrong=Math.max(Number.isSafeInteger(v.readingWrong)&&v.readingWrong>=0?v.readingWrong:0,history.filter(l=>l.grade==='quizWrong').length+raw.logs.filter(l=>l&&l.id===id&&l.grade==='grindWrong').length);
  const grindStreak=Number.isInteger(v.grindStreak)&&v.grindStreak>=0&&v.grindStreak<=5?v.grindStreak:0;
  const readingStage=dailyRule&&readingStreak>=5&&Number.isInteger(v.readingStage)&&v.readingStage>=0&&v.readingStage<READING_INTERVALS.length?v.readingStage:0;
  const lastReadingDay=history.filter(l=>l.grade==='quizRight'&&validDay(l.day)).at(-1)?.day;
  const baseline=lastReadingDay?Date.parse(lastReadingDay+'T00:00:00+08:00'):Number.isFinite(Date.parse(raw.savedAt))?Date.parse(raw.savedAt):Date.now();
  const readingDue=dailyRule&&Number.isFinite(v.readingDue)&&v.readingDue>=0&&v.readingDue<=Date.now()+DAY*730?(v.readingDue?dayStart(v.readingDue):0):readingStreak>=5?reviewDue(baseline,READING_INTERVALS[0]):readingDoneDay?reviewDue(Date.parse(readingDoneDay+'T00:00:00+08:00')):0;
  next.words[id]={grindRequired:!!v.grindRequired,grindStreak,cardAgainStreak,cardAgainMax,readingRetry:!!v.readingRetry&&readingDoneDay!==today(),readingRule:'daily-v1',readingDoneDay,readingFailedDay,readingDue,readingStage,readingWrong,troubleDays,reviewedOn,reviewPending,readingStreak,readingTotal:Number.isInteger(v.readingTotal)&&v.readingTotal>=0?v.readingTotal:history.filter(l=>l.grade==='quizRight').length,stage:v.stage,due,seen:Math.min(v.seen,100000),lapses:Math.min(v.lapses,100000),star:!!v.star,relearning,lastReviewDay:typeof v.lastReviewDay==='string'?v.lastReviewDay:null,learnedOn:typeof v.learnedOn==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v.learnedOn)?v.learnedOn:today()};
 }
 next.logs=raw.logs.slice(-20000).filter(l=>l&&ids.has(l.id)&&/^\d{4}-\d{2}-\d{2}$/.test(l.day)&&['again','hard','good','quizWrong','quizRight','grindRight','grindWrong'].includes(l.grade)).map(l=>({id:l.id,day:l.day,grade:l.grade,isNew:!!l.isNew,...(l.context==='reading'?{context:'reading'}:{}),...(['kana','kanji'].includes(l.quizType)?{quizType:l.quizType}:{})}));
 if(raw.readingPlan&&validDay(raw.readingPlan.day)&&Array.isArray(raw.readingPlan.ids)){
  next.readingPlan={day:raw.readingPlan.day,ids:[...new Set(raw.readingPlan.ids)].filter(id=>ids.has(id)&&next.words[id]?.seen>0),...(raw.readingPlan.rule===READING_PLAN_RULE?{rule:READING_PLAN_RULE}:{})};
 }
 if(raw.grindSession&&Array.isArray(raw.grindSession.remaining))next.grindSession={remaining:[...new Set(raw.grindSession.remaining)].filter(id=>ids.has(id)&&next.words[id]?.seen>0),recent:(Array.isArray(raw.grindSession.recent)?raw.grindSession.recent:[]).filter(id=>ids.has(id)&&next.words[id]?.seen>0).slice(-8),lastId:ids.has(raw.grindSession.lastId)?raw.grindSession.lastId:null,round:Number.isSafeInteger(raw.grindSession.round)&&raw.grindSession.round>=0?raw.grindSession.round:0};
 const s=raw.settings||{};
 next.settings.newGoal=Number.isInteger(s.newGoal)&&s.newGoal>=1&&s.newGoal<=100?s.newGoal:20;
 next.settings.reviewGoal=Number.isInteger(s.reviewGoal)&&s.reviewGoal>=1&&s.reviewGoal<=200?s.reviewGoal:50;
 next.settings.priority=['all','A','B','C'].includes(s.priority)?s.priority:'all';
 next.settings.lesson=typeof s.lesson==='string'&&/^(all|exam|[1-9]|1[0-5])$/.test(s.lesson)?s.lesson:'all';
 next.savedAt=typeof raw.savedAt==='string'?raw.savedAt:null;return next;
}
function counts(state,now=Date.now()){
 const logs=state.logs.filter(l=>l.day===today(now));
 return {learned:Object.values(state.words).filter(w=>w.seen>0).length,mastered:Object.values(state.words).filter(w=>w.seen>0&&w.stage>=3).length,due:Object.values(state.words).filter(w=>isDue(w,now,state)).length,newToday:new Set(logs.filter(l=>l.isNew).map(l=>l.id)).size,reviewToday:new Set(logs.filter(l=>!l.isNew&&!l.grade.startsWith('quiz')&&!l.grade.startsWith('grind')&&!logs.some(a=>a.id===l.id&&a.isNew)).map(l=>l.id)).size,answers:logs.length};
}
function rate(state,id,grade,now=Date.now(),context='card'){
 if(!['again','hard','good'].includes(grade))throw Error('Invalid grade');
 const old=state.words[id]||{stage:0,due:0,seen:0,lapses:0,star:false,learnedOn:today(now)};
 const isNew=old.seen===0,cardAgainStreak=context==='reading'?(old.cardAgainStreak||0):grade==='again'?Math.min(100000,(old.cardAgainStreak||0)+1):0,cardAgainMax=Math.max(old.cardAgainMax||0,cardAgainStreak);
 const stage=grade==='again'?0:grade==='hard'?Math.max(0,old.stage-1):(isNew?0:old.lastReviewDay===today(now)?old.stage:Math.min(5,old.stage+1));
 state.words[id]={...old,cardAgainStreak,cardAgainMax,stage,relearning:grade!=='good',reviewPending:grade!=='good'&&isDue(old,now,state),reviewedOn:grade==='good'?today(now):old.reviewedOn,lastReviewDay:today(now),seen:old.seen+1,lapses:old.lapses+(grade==='again'?1:0),due:reviewDue(now,grade==='good'?INTERVALS[stage]:1),learnedOn:isNew?today(now):old.learnedOn};
 if(grade!=='good'){state.words[id].grindStreak=0;state.words[id].grindRequired=true;}
 if(grade==='good')state.words[id].troubleDays=(old.troubleDays||[]).filter(d=>d>today(now));else markTrouble(state.words[id],now);
 state.logs.push({id,day:today(now),grade,isNew,...(context==='reading'?{context:'reading'}:{})});state.logs=state.logs.slice(-20000);return state.words[id];
}
function filter(words,settings){return words.filter(w=>(settings.priority==='all'||w.priority===settings.priority)&&(settings.lesson==='all'||(settings.lesson==='exam'?w.source==='exam':w.lesson&&w.lesson.split('-')[0]===settings.lesson)));}
function queue(words,state,mode='mixed',now=Date.now(),random=Math.random){
 const selected=filter(words,state.settings),c=counts(state,now);
 const pending=shuffle(selected.filter(w=>state.words[w.id]?.seen>0&&(mode==='review'?(state.words[w.id].reviewPending||(state.words[w.id].readingRetry&&readingPlanned(state,w.id,now))):(state.words[w.id].relearning||(state.words[w.id].readingRetry&&readingPlanned(state,w.id,now))))),random);
 const due=shuffle(shuffle(selected.filter(w=>isDue(state.words[w.id],now,state)&&!pending.some(p=>p.id===w.id)),random).sort((a,b)=>state.words[a.id].due-state.words[b.id].due).slice(0,Math.max(0,state.settings.reviewGoal-c.reviewToday)),random);
 // Draw from the entire eligible pool before applying the daily limit.
 const unseen=shuffle(selected.filter(w=>!state.words[w.id]?.seen),random).slice(0,Math.max(0,state.settings.newGoal-c.newToday));
 return [...pending,...(mode==='review'?due:mode==='new'?unseen:[...due,...unseen])];
}
function advanceSession(session,grade,random=Math.random){
 if(!['again','hard','good'].includes(grade))throw Error('Invalid grade');
 const id=session.queue[session.index];if(!id)return null;
 // Keep exactly one future copy; only an explicit "good" completes a word.
 const remaining=session.queue.slice(session.index+1).filter(next=>next!==id);
 if(grade==='good')session.done++;
 else{
  const seen=new Set(session.queue.slice(0,session.index+1));
  let afterRetries=0;
  for(let i=0;i<remaining.length;i++)if(seen.has(remaining[i]))afterRetries=i+1;
  // Preserve previously scheduled retries, so a run of "hard" answers cannot starve a word.
  remaining.splice(Math.min(Math.max(1+Math.floor(random()*2),afterRetries),remaining.length),0,id);
 }
 session.queue.splice(session.index+1,session.queue.length,...remaining);
 session.index++;return id;
}
function readingPool(words,state,now=Date.now()){return words.filter(w=>readingReady(state.words[w.id],now));}
function dailyReadingPlan(words,state,now=Date.now(),random=Math.random){
 const day=today(now);if(state.readingPlan?.day===day&&state.readingPlan.rule===READING_PLAN_RULE)return state.readingPlan;
 const yesterday=today(dayStart(now)-DAY),known=new Map(words.filter(w=>state.words[w.id]?.seen>0).map(w=>[w.id,w]));
 const ids=[],chosen=new Set(),add=id=>{if(known.has(id)&&!chosen.has(id)){ids.push(id);chosen.add(id);}};
 // Count work already attempted today when introducing a new plan or importing progress.
 for(const l of state.logs)if(l.day===day&&['quizRight','quizWrong'].includes(l.grade))add(l.id);
 const eligible=w=>state.words[w.id].learnedOn<day&&(readingReady(state.words[w.id],now)||state.words[w.id].readingDoneDay===day);
 const yesterdayWords=shuffle(words.filter(w=>known.has(w.id)&&eligible(w)&&state.words[w.id].learnedOn===yesterday&&!chosen.has(w.id)),random);
 for(const w of yesterdayWords)add(w.id);
 let olderCount=ids.filter(id=>state.words[id].learnedOn<yesterday).length;
 const addOlder=id=>{const w=known.get(id);if(olderCount<10&&w&&eligible(w)&&state.words[id].learnedOn<yesterday&&!chosen.has(id)){add(id);olderCount++;}};
 // Reuse the historical draw when upgrading today's old 30-word plan.
 if(state.readingPlan?.day===day)for(const id of state.readingPlan.ids)addOlder(id);
 const olderWords=shuffle(words.filter(w=>known.has(w.id)&&eligible(w)&&state.words[w.id].learnedOn<yesterday&&!chosen.has(w.id)),random);
 for(const w of olderWords)addOlder(w.id);
 state.readingPlan={day,ids,rule:READING_PLAN_RULE};return state.readingPlan;
}
function readingPlanned(state,id,now=Date.now()){return !state.readingPlan||state.readingPlan.day!==today(now)||state.readingPlan.ids.includes(id);}
function dailyReadingStatus(words,state,now=Date.now()){
 const plan=dailyReadingPlan(words,state,now),done=plan.ids.filter(id=>state.words[id]?.readingDoneDay===today(now)).length;
 return {total:plan.ids.length,done,remaining:plan.ids.filter(id=>readingReady(state.words[id],now)).length};
}
function dailyReadingPool(words,state,now=Date.now()){
 const plan=dailyReadingPlan(words,state,now),ids=new Set(plan.ids),pool=words.filter(w=>ids.has(w.id)&&readingReady(state.words[w.id],now)),yesterday=today(dayStart(now)-DAY);
 const first=pool.filter(w=>state.words[w.id].learnedOn===yesterday);
 return first.length?first:pool;
}
function recordReading(state,id,correct,type='kana',now=Date.now()){
 const w=state.words[id];if(!readingReady(w,now)||!readingPlanned(state,id,now))return false;
 const day=today(now),wasStable=w.readingStreak>=5;
 w.readingRule='daily-v1';
 w.readingTotal=(w.readingTotal||0)+(correct?1:0);
 if(correct){
  w.readingDoneDay=day;w.readingRetry=false;
  // A correction finishes today's practice, but does not certify a fresh retrieval.
  w.readingStreak=w.readingFailedDay===day?0:Math.min(5,(w.readingStreak||0)+1);
  if(w.readingStreak>=5){w.grindRequired=false;w.readingStage=wasStable?Math.min(READING_INTERVALS.length-1,(w.readingStage||0)+1):0;w.readingDue=reviewDue(now,READING_INTERVALS[w.readingStage]);}
  else{w.readingStage=0;w.readingDue=reviewDue(now);}
 }else{
  w.readingFailedDay=day;w.readingStreak=0;w.readingStage=0;w.readingDue=0;w.grindStreak=0;w.grindRequired=true;
  w.lapses++;w.readingWrong=(w.readingWrong||0)+1;markTrouble(w,now);
 }
 state.logs.push({id,day:today(now),grade:correct?'quizRight':'quizWrong',isNew:false,quizType:type});state.logs=state.logs.slice(-20000);return true;
}
function extremePool(words,state){return words.filter(w=>state.words[w.id]?.seen>0&&((state.words[w.id].readingWrong||0)>=5||(state.words[w.id].cardAgainMax||0)>=5));}
const grindReady=w=>!!(w?.seen&&((w.readingStreak||0)<5||w.grindRequired)&&(w.grindStreak||0)<5);
function grindPool(words,state){return words.filter(w=>grindReady(state.words[w.id]));}
function nextGrindWord(words,state,random=Math.random){
 const pool=grindPool(words,state),known=new Map(pool.map(w=>[w.id,w]));
 const s=state.grindSession||(state.grindSession={remaining:[],recent:[],lastId:null,round:0});
 s.remaining=s.remaining.filter(id=>known.has(id));
 if(!s.remaining.length&&pool.length){s.remaining=shuffle(pool.map(w=>w.id),random);s.round++;}
 // Space recent words across the round boundary as well; larger pools allow a longer gap.
 const gap=Math.min(6,Math.floor(pool.length/2)),recent=(s.recent||[]).slice(-gap),available=s.remaining.findIndex(id=>!recent.includes(id));
 if(available>0)[s.remaining[0],s.remaining[available]]=[s.remaining[available],s.remaining[0]];
 if(s.remaining[0]===s.lastId&&s.remaining.length>1){const j=1+Math.floor(random()*(s.remaining.length-1));[s.remaining[0],s.remaining[j]]=[s.remaining[j],s.remaining[0]];}
 const id=s.remaining.shift();if(!id)return null;s.lastId=id;s.recent=[...(s.recent||[]),id].slice(-8);return known.get(id);
}
function recordGrind(state,id,correct,type='kana',now=Date.now()){
 const w=state.words[id];if(!grindReady(w))return false;
 w.grindStreak=correct?Math.min(5,(w.grindStreak||0)+1):0;
 if(correct){w.readingTotal=(w.readingTotal||0)+1;if(w.grindStreak>=5)w.grindRequired=false;}
 else{w.grindRequired=true;w.readingRule='daily-v1';w.readingStreak=0;w.readingStage=0;w.readingDue=0;w.readingFailedDay=today(now);w.readingWrong=(w.readingWrong||0)+1;w.lapses++;markTrouble(w,now);}
 state.logs.push({id,day:today(now),grade:correct?'grindRight':'grindWrong',isNew:false,quizType:type});state.logs=state.logs.slice(-20000);return true;
}
const api={KEY,LEGACY_KEY,EARLIEST_KEY,LEGACY_KEYS,DAY,INTERVALS,READING_INTERVALS,shuffle,today,dayStart,reviewDue,isDue,readingReady,readingCheckDue,dailyReadingPlan,dailyReadingPool,dailyReadingStatus,readingPlanned,extremePool,grindPool,nextGrindWord,recordGrind,fresh,validate,counts,rate,filter,queue,advanceSession,readingPool,recordReading};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.KotobaEngine=api;
})(typeof window!=='undefined'?window:globalThis);
