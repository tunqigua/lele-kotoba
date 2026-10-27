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
const fresh=()=>({schema:1,words:{},logs:[],studyTime:{},dailyWords:{},reviewPlan:null,readingPlan:null,grindSession:null,settings:{newGoal:20,reviewGoal:50,priority:'all',lesson:'all'},savedAt:null});
function recordDailyWord(state,{id,day,grade,isNew}){
 const wrong=grade==='quizWrong';
 if(!isNew&&!wrong)return;
 state.dailyWords=state.dailyWords||{};
 const row=state.dailyWords[day]||(state.dailyWords[day]={learned:[],wrong:[]});
 if(isNew&&!row.learned.includes(id))row.learned.push(id);
 if(wrong&&!row.wrong.includes(id))row.wrong.push(id);
}
function appendLog(state,log){
 recordDailyWord(state,log);
 state.logs.push(log);state.logs=state.logs.slice(-20000);
}
function reviewErrorCount(w={},logs=[]){
 let again=0,hard=0,wrong=0;
 for(const l of logs){if(l.context==='reading')continue;if(l.grade==='again')again++;else if(l.grade==='hard')hard++;else if(['quizWrong','grindWrong'].includes(l.grade))wrong++;}
 const stored=Number.isSafeInteger(w.reviewWrong)&&w.reviewWrong>=0?w.reviewWrong:0;
 // Lapses already includes reading/grind errors; never add those totals twice.
 return Math.max(stored,Math.max(w.lapses||0,(w.readingWrong||0)+again,wrong+again)+hard);
}
function validate(raw,ids){
 if(!raw||raw.schema!==1||typeof raw.words!=='object'||Array.isArray(raw.words)||!Array.isArray(raw.logs))throw Error('备份格式不匹配，请选择「拾词」导出的 JSON 文件。');
 const next=fresh();
 const lastCardGrades=new Map();
 for(const l of raw.logs)if(l&&['again','hard','good'].includes(l.grade))lastCardGrades.set(l.id,l);
 // Group logs by word once: the migration below reads each word's history several times.
 const logsById=new Map();
 for(const l of raw.logs){if(!l||typeof l.id!=='string')continue;const bucket=logsById.get(l.id);if(bucket)bucket.push(l);else logsById.set(l.id,[l]);}
 // A record without learnedOn must not be treated as learned today, or every
 // migrated word joins tomorrow's "yesterday" reading plan at once.
 const savedAtDay=Number.isFinite(Date.parse(raw.savedAt))?today(Date.parse(raw.savedAt)):null;
 const migratedDay=today(dayStart()-2*DAY);
 for(const [id,v]of Object.entries(raw.words)){
  if(!ids.has(id))continue;
  if(!v||!Number.isInteger(v.stage)||v.stage<0||v.stage>5||!Number.isFinite(v.due)||v.due<0||v.due>Date.now()+DAY*730||!Number.isFinite(v.seen)||v.seen<0||!Number.isFinite(v.lapses)||v.lapses<0)throw Error('备份中有无效的单词进度。');
  const mine=logsById.get(id)||[],firstDay=mine.reduce((min,l)=>validDay(l.day)&&(!min||l.day<min)?l.day:min,null);
  const history=mine.filter(l=>['quizRight','quizWrong'].includes(l.grade)&&validDay(l.day));
  const daily=new Map();for(const l of history){const day=daily.get(l.day)||{wrong:false,right:false,last:null};day.wrong=day.wrong||l.grade==='quizWrong';day.right=day.right||l.grade==='quizRight';day.last=l.grade;daily.set(l.day,day);}
  let legacyStreak=0;for(const [,d]of [...daily].sort(([a],[b])=>a.localeCompare(b)))legacyStreak=d.wrong?0:d.right?Math.min(5,legacyStreak+1):legacyStreak;
  let legacyCardStreak=0,legacyCardMax=0;
  for(const l of mine)if(l.context!=='reading'&&['again','hard','good'].includes(l.grade)){legacyCardStreak=l.grade==='again'?legacyCardStreak+1:0;legacyCardMax=Math.max(legacyCardMax,legacyCardStreak);}
  const cardAgainStreak=Number.isInteger(v.cardAgainStreak)&&v.cardAgainStreak>=0?Math.min(v.cardAgainStreak,100000):legacyCardStreak;
  const cardAgainMax=Math.max(cardAgainStreak,legacyCardMax,Number.isInteger(v.cardAgainMax)&&v.cardAgainMax>=0?Math.min(v.cardAgainMax,100000):0);
  const dailyRule=v.readingRule==='daily-v1';
  const readingStreak=dailyRule&&Number.isInteger(v.readingStreak)&&v.readingStreak>=0&&v.readingStreak<=5?v.readingStreak:legacyStreak;
  const lastReading=history.at(-1),lastFailed=history.filter(l=>l.grade==='quizWrong').at(-1);
  const readingDoneDay=dailyRule&&validDay(v.readingDoneDay)?v.readingDoneDay:lastReading?.grade==='quizRight'?lastReading.day:null;
  const readingFailedDay=dailyRule&&validDay(v.readingFailedDay)?v.readingFailedDay:lastFailed?.day||null;
  const lastCard=lastCardGrades.get(id),relearning=v.seen>0&&(typeof v.relearning==='boolean'?v.relearning:lastCard?.day===today()&&['again','hard'].includes(lastCard.grade));
  const cardHistory=mine.filter(l=>['again','hard','good','quizWrong','grindWrong'].includes(l.grade)&&validDay(l.day));
  const reviewedOn=[validDay(v.reviewedOn)?v.reviewedOn:'',...cardHistory.filter(l=>l.grade==='good').map(l=>l.day)].sort().at(-1)||null;
  const troubleDays=[...new Set([...(Array.isArray(v.troubleDays)?v.troubleDays.filter(validDay):[]),...cardHistory.filter(l=>l.grade!=='good').map(l=>today(Date.parse(l.day+'T00:00:00+08:00')+DAY))])].filter(d=>!reviewedOn||d>reviewedOn).sort();
  const reviewPending=!!v.reviewPending&&relearning;
  let due=v.due>0?Math.max(dayStart(v.due),relearning&&lastCard?.day===today()&&!reviewPending?reviewDue():0):0;
  const readingWrong=Math.max(Number.isSafeInteger(v.readingWrong)&&v.readingWrong>=0?v.readingWrong:0,history.filter(l=>l.grade==='quizWrong').length+mine.filter(l=>l.grade==='grindWrong').length);
  const grindStreak=Number.isInteger(v.grindStreak)&&v.grindStreak>=0&&v.grindStreak<=5?v.grindStreak:0;
  const readingStage=dailyRule&&readingStreak>=5&&Number.isInteger(v.readingStage)&&v.readingStage>=0&&v.readingStage<READING_INTERVALS.length?v.readingStage:0;
  const lastReadingDay=history.filter(l=>l.grade==='quizRight'&&validDay(l.day)).at(-1)?.day;
  const baseline=lastReadingDay?Date.parse(lastReadingDay+'T00:00:00+08:00'):Number.isFinite(Date.parse(raw.savedAt))?Date.parse(raw.savedAt):Date.now();
  const readingDue=dailyRule&&Number.isFinite(v.readingDue)&&v.readingDue>=0&&v.readingDue<=Date.now()+DAY*730?(v.readingDue?dayStart(v.readingDue):0):readingStreak>=5?reviewDue(baseline,READING_INTERVALS[0]):readingDoneDay?reviewDue(Date.parse(readingDoneDay+'T00:00:00+08:00')):0;
  const reviewFailedDay=[validDay(v.reviewFailedDay)?v.reviewFailedDay:'',validDay(readingFailedDay)?readingFailedDay:'',...mine.filter(l=>l.context!=='reading'&&['again','hard','quizWrong','grindWrong'].includes(l.grade)&&validDay(l.day)).map(l=>l.day)].sort().at(-1)||null;
  let stage=v.stage;
  if(v.reviewFailedDay===undefined&&reviewFailedDay&&(!reviewedOn||reviewedOn<=reviewFailedDay)){stage=0;due=Math.min(due||Infinity,reviewDue(Date.parse(reviewFailedDay+'T00:00:00+08:00')));}
  next.words[id]={reviewFailedDay,reviewWrong:reviewErrorCount({...v,readingWrong},mine),grindRequired:!!v.grindRequired,grindStreak,cardAgainStreak,cardAgainMax,readingRetry:!!v.readingRetry&&readingDoneDay!==today(),readingRule:'daily-v1',readingDoneDay,readingFailedDay,readingDue,readingStage,readingWrong,troubleDays,reviewedOn,reviewPending,readingStreak,readingTotal:Number.isInteger(v.readingTotal)&&v.readingTotal>=0?v.readingTotal:history.filter(l=>l.grade==='quizRight').length,stage,due,seen:Math.min(v.seen,100000),lapses:Math.min(v.lapses,100000),star:!!v.star,relearning,lastReviewDay:typeof v.lastReviewDay==='string'?v.lastReviewDay:null,learnedOn:validDay(v.learnedOn)&&v.learnedOn<=today()?v.learnedOn:firstDay||(savedAtDay&&savedAtDay<today()?savedAtDay:null)||migratedDay};
 }
 next.logs=raw.logs.slice(-20000).filter(l=>l&&ids.has(l.id)&&/^\d{4}-\d{2}-\d{2}$/.test(l.day)&&['again','hard','good','quizWrong','quizRight','grindRight','grindWrong'].includes(l.grade)).map(l=>({id:l.id,day:l.day,grade:l.grade,isNew:!!l.isNew,...(l.context==='reading'?{context:'reading'}:{}),...(['kana','kanji'].includes(l.quizType)?{quizType:l.quizType}:{})}));
 if(raw.reviewPlan&&raw.reviewPlan.rule==='spaced-v1'&&validDay(raw.reviewPlan.day)&&Number.isInteger(raw.reviewPlan.goal)&&raw.reviewPlan.goal>=1&&raw.reviewPlan.goal<=200&&Array.isArray(raw.reviewPlan.ids)){
  next.reviewPlan={day:raw.reviewPlan.day,goal:raw.reviewPlan.goal,rule:'spaced-v1',ids:[...new Set(raw.reviewPlan.ids)].filter(id=>ids.has(id)&&next.words[id]?.seen>0).slice(0,raw.reviewPlan.goal)};
 }
 if(raw.readingPlan&&validDay(raw.readingPlan.day)&&Array.isArray(raw.readingPlan.ids)){
  next.readingPlan={day:raw.readingPlan.day,ids:[...new Set(raw.readingPlan.ids)].filter(id=>ids.has(id)&&next.words[id]?.seen>0),...(raw.readingPlan.rule===READING_PLAN_RULE?{rule:READING_PLAN_RULE}:{})};
 }
 if(raw.grindSession&&Array.isArray(raw.grindSession.remaining))next.grindSession={remaining:[...new Set(raw.grindSession.remaining)].filter(id=>ids.has(id)&&next.words[id]?.seen>0),recent:(Array.isArray(raw.grindSession.recent)?raw.grindSession.recent:[]).filter(id=>ids.has(id)&&next.words[id]?.seen>0).slice(-8),lastId:ids.has(raw.grindSession.lastId)?raw.grindSession.lastId:null,round:Number.isSafeInteger(raw.grindSession.round)&&raw.grindSession.round>=0?raw.grindSession.round:0};
 for(const [day,ms]of Object.entries(raw.studyTime&&typeof raw.studyTime==='object'&&!Array.isArray(raw.studyTime)?raw.studyTime:{}))if(validDay(day)&&day<=today()&&Number.isFinite(ms)&&ms>=0&&ms<=DAY)next.studyTime[day]=ms;
 // Keep calendar totals after detailed practice logs reach their retention limit.
 for(const [day,row]of Object.entries(raw.dailyWords&&typeof raw.dailyWords==='object'&&!Array.isArray(raw.dailyWords)?raw.dailyWords:{})){
  if(!validDay(day)||day>today()||!row||typeof row!=='object')continue;
  next.dailyWords[day]={};
  for(const kind of ['learned','wrong'])next.dailyWords[day][kind]=[...new Set(Array.isArray(row[kind])?row[kind]:[])].filter(id=>ids.has(id));
 }
 for(const log of raw.logs)if(log&&ids.has(log.id)&&validDay(log.day)&&log.day<=today()&&['again','hard','good','quizWrong','quizRight','grindRight','grindWrong'].includes(log.grade))recordDailyWord(next,log);
 for(const [id,w]of Object.entries(next.words))if(w.seen>0&&validDay(w.learnedOn)&&w.learnedOn<=today())recordDailyWord(next,{id,day:w.learnedOn,isNew:true});
 const s=raw.settings||{};
 next.settings.newGoal=Number.isInteger(s.newGoal)&&s.newGoal>=1&&s.newGoal<=100?s.newGoal:20;
 next.settings.reviewGoal=Number.isInteger(s.reviewGoal)&&s.reviewGoal>=1&&s.reviewGoal<=200?s.reviewGoal:50;
 next.settings.priority=['all','A','B','C'].includes(s.priority)?s.priority:'all';
 next.settings.lesson=typeof s.lesson==='string'&&/^(all|exam|[1-9]|1[0-5])$/.test(s.lesson)?s.lesson:'all';
 next.savedAt=typeof raw.savedAt==='string'?raw.savedAt:null;return next;
}
function recordStudyTime(state,start,end){
 if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start||end-start>DAY)return false;
 state.studyTime=state.studyTime||{};
 while(start<end){const day=today(start),stop=Math.min(end,reviewDue(start));state.studyTime[day]=Math.min(DAY,(state.studyTime[day]||0)+stop-start);start=stop;}
 return true;
}
const spacedDue=(w,now,state)=>!!(w.reviewPending||w.due<=now||(w.troubleDays||[]).some(d=>d<=today(now))||((w.readingStreak||0)>=5&&readingCheckDue(w,now)&&readingAllowed(w,now,state)));
function reviewCandidates(state,now=Date.now()){
 const day=today(now),yesterday=today(dayStart(now)-DAY),logsById=new Map(),yesterdayErrors=new Map();
 for(const l of state.logs){const bucket=logsById.get(l.id)||[];bucket.push(l);logsById.set(l.id,bucket);if(l.day===yesterday&&l.context!=='reading'&&['again','hard','quizWrong','grindWrong'].includes(l.grade))yesterdayErrors.set(l.id,(yesterdayErrors.get(l.id)||0)+1);}
 return Object.entries(state.words).filter(([,w])=>w.seen>0&&w.learnedOn!==day).map(([id,w])=>{
  const errors=reviewErrorCount(w,logsById.get(id)||[]),yesterdayWrong=yesterdayErrors.get(id)||Number(w.reviewFailedDay===yesterday||w.readingFailedDay===yesterday),recent=w.learnedOn===yesterday||yesterdayWrong>0||w.reviewPending;
  const group=recent?0:spacedDue(w,now,state)?1:errors>0&&w.stage<2&&(w.readingStreak||0)<5&&w.lastReviewDay!==day?2:3;
  return {id,group,errors,yesterdayWrong,pending:Number(!!w.reviewPending),due:w.due||0};
 }).filter(x=>x.group<3).sort((a,b)=>a.group-b.group||(a.group===0?b.pending-a.pending||b.yesterdayWrong-a.yesterdayWrong:a.group===1?a.due-b.due:0)||b.errors-a.errors||a.id.localeCompare(b.id));
}
function reviewIds(state,now=Date.now(),fix=false){
 const day=today(now),goal=state.settings.reviewGoal,plan=state.reviewPlan;
 if(plan?.day===day&&plan.goal===goal&&plan.rule==='spaced-v1'&&plan.ids.length)return plan.ids;
 // Work already completed in today's plan still occupies its daily slot when the goal changes.
 const done=plan?.day===day&&plan.rule==='spaced-v1'?plan.ids.filter(id=>state.words[id]?.reviewedOn===day&&!state.words[id].reviewPending):[];
 const ids=[...done,...reviewCandidates(state,now).map(x=>x.id).filter(id=>!done.includes(id))].slice(0,goal);
 if(fix&&(!plan||plan.rule!=='spaced-v1'||plan.day!==day||plan.goal!==goal||plan.ids.join()!==ids.join()))state.reviewPlan={day,goal,rule:'spaced-v1',ids};
 return ids;
}
function reviewReason(state,id,now=Date.now()){
 const w=state.words[id],yesterday=today(dayStart(now)-DAY);
 if(w.learnedOn===yesterday)return '昨日新词';
 if(w.reviewFailedDay===yesterday||w.readingFailedDay===yesterday||state.logs.some(l=>l.id===id&&l.day===yesterday&&l.context!=='reading'&&['again','hard','quizWrong','grindWrong'].includes(l.grade)))return '昨日错词';
 return spacedDue(w,now,state)?'到期复习':'错词巩固';
}
function cardSchedule(w,grade='good',now=Date.now()){
 if(grade!=='good')return {stage:grade==='again'?0:Math.max(0,(w?.stage||0)-1),due:reviewDue(now)};
 if(!w?.seen||w.reviewFailedDay===today(now)||w.readingFailedDay===today(now))return {stage:0,due:reviewDue(now)};
 // Extra practice before the due date must not advance the interval or postpone the scheduled check.
 if(w.due>now)return {stage:w.stage,due:w.due};
 const stage=w.lastReviewDay===today(now)?w.stage:Math.min(5,w.stage+1);
 return {stage,due:reviewDue(now,INTERVALS[stage])};
}
function counts(state,now=Date.now()){
 const logs=state.logs.filter(l=>l.day===today(now));
 const reviews=reviewIds(state,now),done=reviews.filter(id=>state.words[id].reviewedOn===today(now)&&!state.words[id].reviewPending).length;
 return {learned:Object.values(state.words).filter(w=>w.seen>0).length,mastered:Object.values(state.words).filter(w=>w.seen>0&&w.stage>=3).length,due:reviews.length-done,newToday:new Set(logs.filter(l=>l.isNew).map(l=>l.id)).size,reviewToday:done,answers:logs.length};
}
function rate(state,id,grade,now=Date.now(),context='card'){
 if(!['again','hard','good'].includes(grade))throw Error('Invalid grade');
 const old=state.words[id]||{stage:0,due:0,seen:0,lapses:0,star:false,learnedOn:today(now)};
 const isNew=old.seen===0,cardAgainStreak=context==='reading'?(old.cardAgainStreak||0):grade==='again'?Math.min(100000,(old.cardAgainStreak||0)+1):0,cardAgainMax=Math.max(old.cardAgainMax||0,cardAgainStreak);
 const {stage,due}=cardSchedule(old,grade,now);
 state.words[id]={...old,reviewFailedDay:grade!=='good'?today(now):old.reviewFailedDay||null,reviewWrong:reviewErrorCount(old)+(grade!=='good'&&context!=='reading'?1:0),cardAgainStreak,cardAgainMax,stage,relearning:grade!=='good',reviewPending:grade!=='good'&&isDue(old,now,state),reviewedOn:grade==='good'?today(now):old.reviewedOn,lastReviewDay:today(now),seen:old.seen+1,lapses:old.lapses+(grade==='again'?1:0),due,learnedOn:isNew?today(now):old.learnedOn};
 if(grade!=='good'){state.words[id].grindStreak=0;state.words[id].grindRequired=true;}
 // A word marked "认识了" has completed this round, so a pending reading retry
 // must not keep it in the due queue.
 if(grade==='good'){state.words[id].troubleDays=(old.troubleDays||[]).filter(d=>d>today(now));state.words[id].readingRetry=false;}else markTrouble(state.words[id],now);
 appendLog(state,{id,day:today(now),grade,isNew,...(context==='reading'?{context:'reading'}:{})});return state.words[id];
}
function filter(words,settings){return words.filter(w=>(settings.priority==='all'||w.priority===settings.priority)&&(settings.lesson==='all'||(settings.lesson==='exam'?w.source==='exam':w.lesson&&w.lesson.split('-')[0]===settings.lesson)));}
function queue(words,state,mode='mixed',now=Date.now(),random=Math.random){
 const selected=filter(words,state.settings),c=counts(state,now);
 const ranked=reviewIds(state,now,mode==='review'),byId=new Map(words.map(w=>[w.id,w]));
 const due=ranked.filter(id=>byId.has(id)&&(state.words[id].reviewedOn!==today(now)||state.words[id].reviewPending)).map(id=>byId.get(id));
 if(mode==='review')return due;
 const pending=shuffle(selected.filter(w=>state.words[w.id]?.seen>0&&(state.words[w.id].relearning||(state.words[w.id].readingRetry&&readingPlanned(state,w.id,now)))),random);
 // Draw from the entire eligible pool before applying the daily limit.
 const unseen=shuffle(selected.filter(w=>!state.words[w.id]?.seen),random).slice(0,Math.max(0,state.settings.newGoal-c.newToday));
 return [...pending,...(mode==='new'?unseen:[...due.filter(w=>!pending.some(p=>p.id===w.id)),...unseen])];
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
 w.reviewWrong=reviewErrorCount(w);
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
  w.reviewFailedDay=day;w.stage=0;w.due=reviewDue(now);w.reviewWrong++;w.lapses++;w.readingWrong=(w.readingWrong||0)+1;markTrouble(w,now);
 }
 appendLog(state,{id,day:today(now),grade:correct?'quizRight':'quizWrong',isNew:false,quizType:type});return true;
}
function extremePool(words,state){return words.filter(w=>state.words[w.id]?.seen>0&&((state.words[w.id].readingWrong||0)>=5||(state.words[w.id].cardAgainMax||0)>=5));}
const grindReady=w=>!!(w?.seen&&((w.readingStreak||0)<5||w.grindRequired)&&(w.grindStreak||0)<5);
function grindPool(words,state){return words.filter(w=>grindReady(state.words[w.id]));}
function nextGrindWord(words,state,random=Math.random){
 const pool=grindPool(words,state),known=new Map(pool.map(w=>[w.id,w]));
 const s=state.grindSession||(state.grindSession={remaining:[],recent:[],lastId:null,round:0});
 s.remaining=s.remaining.filter(id=>known.has(id));
 if(!s.remaining.length&&pool.length){s.remaining=shuffle(pool.map(w=>w.id),random);s.round++;}
 // Keep the randomized order inside each group, but serve past mistakes first.
 const hasErrors=id=>!!(state.words[id].readingWrong||state.words[id].lapses||state.words[id].grindRequired);
 s.remaining.sort((a,b)=>Number(hasErrors(b))-Number(hasErrors(a)));
 // Space recent words across the round boundary as well; larger pools allow a longer gap.
 const gap=Math.min(6,Math.floor(pool.length/2)),recent=(s.recent||[]).slice(-gap),available=s.remaining.findIndex(id=>!recent.includes(id));
 if(available>0)[s.remaining[0],s.remaining[available]]=[s.remaining[available],s.remaining[0]];
 if(s.remaining[0]===s.lastId&&s.remaining.length>1){const j=1+Math.floor(random()*(s.remaining.length-1));[s.remaining[0],s.remaining[j]]=[s.remaining[j],s.remaining[0]];}
 const id=s.remaining.shift();if(!id)return null;s.lastId=id;s.recent=[...(s.recent||[]),id].slice(-8);return known.get(id);
}
function recordGrind(state,id,correct,type='kana',now=Date.now()){
 const w=state.words[id];if(!grindReady(w))return false;
 w.reviewWrong=reviewErrorCount(w);
 w.grindStreak=correct?Math.min(5,(w.grindStreak||0)+1):0;
 if(correct){w.readingTotal=(w.readingTotal||0)+1;if(w.grindStreak>=5)w.grindRequired=false;}
 else{w.grindRequired=true;w.readingRule='daily-v1';w.readingStreak=0;w.readingStage=0;w.readingDue=0;w.readingFailedDay=today(now);w.readingWrong=(w.readingWrong||0)+1;w.reviewFailedDay=today(now);w.stage=0;w.due=reviewDue(now);w.reviewWrong++;w.lapses++;markTrouble(w,now);}
 appendLog(state,{id,day:today(now),grade:correct?'grindRight':'grindWrong',isNew:false,quizType:type});return true;
}
const api={KEY,LEGACY_KEY,EARLIEST_KEY,LEGACY_KEYS,DAY,INTERVALS,READING_INTERVALS,shuffle,today,dayStart,reviewDue,isDue,recordStudyTime,reviewErrorCount,reviewCandidates,reviewReason,cardSchedule,reviewIds,readingReady,readingCheckDue,dailyReadingPlan,dailyReadingPool,dailyReadingStatus,readingPlanned,extremePool,grindPool,nextGrindWord,recordGrind,fresh,validate,counts,rate,filter,queue,advanceSession,readingPool,recordReading};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.KotobaEngine=api;
})(typeof window!=='undefined'?window:globalThis);
