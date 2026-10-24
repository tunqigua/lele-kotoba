const test=require('node:test'),assert=require('node:assert/strict');
const E=require('../dist/engine.js'),at=s=>Date.parse(s+'+08:00');

test('study time is split exactly at Beijing midnight, including year changes',()=>{
 const s=E.fresh();E.recordStudyTime(s,at('2026-10-23T23:59:50'),at('2026-10-24T00:00:20'));
 assert.equal(s.studyTime['2026-10-23'],10000);assert.equal(s.studyTime['2026-10-24'],20000);
 E.recordStudyTime(s,at('2026-12-31T23:59:55'),at('2027-01-01T00:00:05'));
 assert.equal(s.studyTime['2026-12-31'],5000);assert.equal(s.studyTime['2027-01-01'],5000);
});

test('time backup validation preserves real durations, rejects bad values, and does not invent historical hours',()=>{
 const s=E.fresh(),day=E.today(),t=Date.now();E.recordStudyTime(s,t-3600000,t);
 s.studyTime['bad']=300;s.studyTime['2099-01-01']=123;s.studyTime['2026-01-01']=-1;s.studyTime['2026-01-02']=Infinity;s.studyTime['2026-01-03']=E.DAY+1;
 const v=E.validate(s,new Set());assert.equal(v.studyTime[day],s.studyTime[day]);assert.equal(Object.keys(v.studyTime).length,1);
 const legacy=E.fresh();delete legacy.studyTime;assert.deepEqual(E.validate(legacy,new Set()).studyTime,{});
 assert.equal(E.recordStudyTime(s,t,t-100),false);assert.equal(E.recordStudyTime(s,NaN,t),false);assert.equal(E.recordStudyTime(s,t,t+E.DAY+1),false);
});
