import test from 'node:test';import assert from 'node:assert/strict';
import {generateTimetable,lessonBlocks,teacherWeekCost,compactTeacherWeeks,timetableRow,timetableFor,timetableDays,timetablePeriods,slotsFor,subjectCode,classes,buildJobs} from '../src/domain.js';

const FORM5_END=880;
const capacity=cls=>timetableDays.reduce((n,d)=>n+slotsFor(cls,d,FORM5_END).length,0);

// A load shaped like the school's own sheets, at the tightness a real register has.
const JUNIOR=[['English Language',5],['French',4],['Mathematics',5],['Biology',3],['Chemistry',3],['Physics',3],['History',2],['Geography',2],['Citizenship',2],['Computer Science',2],['Food and Nutrition',2],['Literature in English',2],['Physical Education',1]];
const SENIOR=[['English Language',4],['French',3],['Mathematics',5],['Biology',4],['Chemistry',4],['Physics',4],['Computer Science',3],['Geography',2],['History',2],['Literature in English',2],['Economics',2]];
const SIXTH=[['Mathematics',6],['Physics',5],['Chemistry',5],['Biology',5],['Computer Science',4],['Economics',4],['Geography',4],['History',3],['Literature in English',3]];
const planFor=c=>c.includes('Sixth')?SIXTH:/Form [45]/.test(c)?SENIOR:JUNIOR;
function schoolLoad(list=classes,maxPerTeacher=22){
 const demand=new Map();
 for(const c of list)for(const [s,p] of planFor(c))demand.set(s,(demand.get(s)||0)+p);
 const pools=new Map();
 for(const [s,total] of demand)pools.set(s,Array.from({length:Math.max(1,Math.ceil(total/maxPerTeacher))},(_,i)=>`${s.slice(0,4).toUpperCase()}-${i+1}`));
 const out=[],running=new Map();
 for(const c of list)for(const [s,p] of planFor(c)){
  const pick=pools.get(s).slice().sort((a,b)=>(running.get(a)||0)-(running.get(b)||0)||a.localeCompare(b))[0];
  running.set(pick,(running.get(pick)||0)+p);
  out.push({class:c,subject:s,teacherId:pick,department:s,periods:p});
 }
 return out;
}

// Every hard rule a printed timetable must satisfy.
function conflicts(entries,assignments){
 const bad=[];
 const byDay=new Map();
 for(const e of entries){if(!byDay.has(e.day))byDay.set(e.day,[]);byDay.get(e.day).push(e);}
 for(const [day,list] of byDay)for(let i=0;i<list.length;i++)for(let j=i+1;j<list.length;j++){
  const a=list[i],b=list[j];
  if(a.start<b.end&&b.start<a.end){
   if(a.class===b.class)bad.push(`${a.class} double-booked ${day}`);
   if(a.teacherId===b.teacherId)bad.push(`${a.teacherId} double-booked ${day}`);
  }
 }
 for(const a of assignments){
  const got=entries.filter(e=>e.class===a.class&&e.subject===a.subject&&e.teacherId===a.teacherId).length;
  if(got!==a.periods)bad.push(`${a.class} ${a.subject}: ${got} of ${a.periods} periods`);
 }
 for(const cls of new Set(entries.map(e=>e.class)))for(const day of timetableDays){
  for(const s of new Set(entries.filter(e=>e.class===cls&&e.day===day).map(e=>e.subject))){
   const runs=entries.filter(e=>e.class===cls&&e.day===day&&e.subject===s).sort((x,y)=>x.start-y.start);
   for(let k=1;k<runs.length;k++)if(runs[k].start!==runs[k-1].end)bad.push(`${cls} meets ${s} twice on ${day}`);
  }
 }
 for(const e of entries){
  const slots=slotsFor(e.class,e.day,FORM5_END);
  if(!slots.some(s=>s.start===e.start&&s.end===e.end))bad.push(`${e.class} ${e.day} lesson outside the school day`);
 }
 return bad;
}

test('weekly periods split into doubles with one single left over',()=>{
 assert.deepEqual(lessonBlocks(1),[1]);
 assert.deepEqual(lessonBlocks(2),[2]);
 assert.deepEqual(lessonBlocks(3),[2,1]);
 assert.deepEqual(lessonBlocks(4),[2,2]);
 assert.deepEqual(lessonBlocks(5),[2,2,1]);
 assert.deepEqual(lessonBlocks(6),[2,2,2]);
});

test('a full 14-class school week generates without a single clash',()=>{
 const load=schoolLoad();
 const entries=generateTimetable(load,FORM5_END,classes);
 assert.equal(entries.length,load.reduce((n,a)=>n+a.periods,0));
 assert.deepEqual(conflicts(entries,load),[]);
});

test('teachers are grouped: most periods sit next to another of their own',()=>{
 const load=schoolLoad();
 const entries=generateTimetable(load,FORM5_END,classes);
 const adjacent=entries.filter(e=>entries.some(o=>o!==e&&o.teacherId===e.teacherId&&o.day===e.day&&(o.end===e.start||o.start===e.end)));
 assert.ok(adjacent.length/entries.length>0.85,`only ${Math.round(100*adjacent.length/entries.length)}% of periods run on from another`);
});

test('teachers come to school on fewer than five days on average',()=>{
 const load=schoolLoad();
 const entries=generateTimetable(load,FORM5_END,classes);
 const ids=[...new Set(entries.map(e=>e.teacherId))];
 const stats=ids.map(id=>teacherWeekCost(entries,id));
 const avgDays=stats.reduce((n,s)=>n+s.days,0)/stats.length;
 const avgGaps=stats.reduce((n,s)=>n+s.gaps,0)/stats.length;
 assert.ok(avgDays<4.3,`average ${avgDays.toFixed(2)} days per teacher`);
 assert.ok(stats.filter(s=>s.days===5).length<ids.length/3,'too many teachers in school all five days');
 assert.ok(avgGaps<1.5,`average ${avgGaps.toFixed(2)} free periods per teacher per week`);
});

test('the same assignments always produce the same timetable',()=>{
 const load=schoolLoad(classes.slice(0,6));
 const a=generateTimetable(load,FORM5_END,classes),b=generateTimetable(load,FORM5_END,classes);
 const shape=e=>e.map(x=>[x.class,x.subject,x.day,x.start].join('|')).sort().join('\n');
 assert.equal(shape(a),shape(b));
});

test('compacting never breaks a valid timetable',()=>{
 const load=schoolLoad(classes.slice(0,8));
 const entries=generateTimetable(load,FORM5_END,classes);
 const again=compactTeacherWeeks(entries,FORM5_END);
 assert.equal(again.length,entries.length);
 assert.deepEqual(conflicts(again,load),[]);
});

const wide={maxSubjectPerWeek:30};  // so these reach the check they are about

test('an over-committed class is named instead of searching for the impossible',()=>{
 const load=[{class:'Form 1A',subject:'Mathematics',teacherId:'T1',department:'Mathematics',periods:30},
             {class:'Form 1A',subject:'English Language',teacherId:'T2',department:'English',periods:20}];
 assert.throws(()=>generateTimetable(load,FORM5_END,classes,{preferences:{...wide,maxSubjectPerDay:4}}),/Form 1A is assigned 50 periods.*only has 38/s);
});

test('a teacher assigned more periods than the preferences allow is named',()=>{
 // One teacher across five classes, 40 periods, against a week that holds 38.
 const load=['Form 1A','Form 1B','Form 2A','Form 2B','Form 3A'].map(c=>({class:c,subject:'Mathematics',teacherId:'T1',department:'Mathematics',periods:8}));
 assert.throws(()=>generateTimetable(load,FORM5_END,classes,{preferences:{...wide,maxSubjectPerDay:4}}),/One teacher is assigned 40 periods a week, but the preferences leave room for only 38/);
});

test('a subject that cannot fit at its daily limit is named',()=>{
 const load=[{class:'Form 1A',subject:'Mathematics',teacherId:'T1',department:'Mathematics',periods:12}];
 assert.throws(()=>generateTimetable(load,FORM5_END,classes,{preferences:{...wide,maxSubjectPerDay:2}}),
  /Form 1A cannot fit 12 periods of Mathematics into a week at no more than 2 a day/);
});

test('an assignment above the weekly subject limit is named',()=>{
 const load=[{class:'Form 1A',subject:'Mathematics',teacherId:'T1',department:'Mathematics',periods:12}];
 assert.throws(()=>generateTimetable(load,FORM5_END,classes,{preferences:{maxSubjectPerWeek:10}}),
  /Form 1A is assigned 12 periods of Mathematics a week, above the limit of 10/);
});

test('a bad assignment row is rejected before anything is placed',()=>{
 assert.throws(()=>generateTimetable([{class:'Form 1A',subject:'Maths',teacherId:'',department:'d',periods:2}],FORM5_END,classes),/needs a class, teacher, subject/);
 assert.throws(()=>generateTimetable([{class:'Nowhere',subject:'Maths',teacherId:'T',department:'d',periods:2}],FORM5_END,classes),/needs a class, teacher, subject/);
});

test('a double period prints as one merged box, and nothing merges across the break',()=>{
 const entries=[
  {class:'Form 1A',subject:'Mathematics',teacherId:'T1',day:'Monday',start:450,end:500},
  {class:'Form 1A',subject:'Mathematics',teacherId:'T1',day:'Monday',start:500,end:550},
  {class:'Form 1A',subject:'Biology',teacherId:'T2',day:'Monday',start:600,end:650},
  {class:'Form 1A',subject:'Biology',teacherId:'T2',day:'Monday',start:680,end:730}];
 const cells=timetableRow(entries,'Monday');
 const maths=cells.find(c=>c.lessons[0]?.subject==='Mathematics');
 assert.equal(maths.span,2,'the double should be one box two periods wide');
 const bio=cells.filter(c=>c.lessons[0]?.subject==='Biology');
 assert.equal(bio.length,2,'period 4 and period 5 sit either side of the break and must stay apart');
 assert.ok(bio.every(c=>c.span===1));
});

test('the teacher sheet counts periods per subject and the weekly total',()=>{
 const entries=[
  {class:'Form 5A',subject:'Computer Science',teacherId:'T1',day:'Tuesday',start:680,end:730},
  {class:'Form 5B',subject:'Computer Science',teacherId:'T1',day:'Tuesday',start:830,end:880},
  {class:'Lower Sixth Science',subject:'Information Technology',teacherId:'T1',day:'Thursday',start:550,end:600},
  {class:'Form 1A',subject:'Mathematics',teacherId:'T2',day:'Monday',start:450,end:500}];
 const {subjects,total}=timetableFor(entries,{teacherId:'T1'});
 assert.equal(total,3);
 assert.deepEqual(subjects,[{subject:'Computer Science',count:2},{subject:'Information Technology',count:1}]);
});

test('subject codes match the printed sheets and fall back sensibly',()=>{
 assert.equal(subjectCode('Computer Science'),'CSC');
 assert.equal(subjectCode('Food and Nutrition'),'F&N');
 assert.equal(subjectCode('Literature in English'),'LIT');
 assert.equal(subjectCode('Further Maths',[{name:'Further Maths',code:'fm'}]),'FM');
 assert.equal(subjectCode('Technical Drawing'),'TD');
});

test('the printed columns are the school bell schedule',()=>{
 assert.equal(timetablePeriods.length,10);
 assert.equal(timetablePeriods[0].start,450);   // 07:30
 assert.equal(timetablePeriods[3].end,650);     // 10:50, then the break
 assert.equal(timetablePeriods[4].start,680);   // 11:20
 assert.equal(timetablePeriods[9].end,960);     // 16:00
 assert.equal(capacity('Form 1A'),38);
 assert.equal(capacity('Lower Sixth Science'),42);
});

// ---------------------------------------------------------------------------
// Generation preferences
// ---------------------------------------------------------------------------
import {defaultPreferences,normalizePreferences} from '../src/domain.js';

const periodsOn=(e,teacherId,day)=>e.filter(x=>x.teacherId===teacherId&&x.day===day).length;
const daysOf=(e,teacherId)=>new Set(e.filter(x=>x.teacherId===teacherId).map(x=>x.day)).size;

test('preferences are clamped, and unknown subjects and staff are dropped',()=>{
 const p=normalizePreferences({
  form5End:'nonsense',lastPeriod:99,maxSubjectPerDay:0,maxSubjectPerWeek:-4,maxTeacherPerDay:500,maxTeacherDays:9,
  subjects:{'Mathematics':{pattern:'hourly',morning:'true',maxPerDay:77},'Astrology':{pattern:'single'}},
  teachers:{T1:{off:['Monday','Monday','Caturday'],maxDays:0,maxPerDay:'x'},GHOST:{off:['Friday']}}},
  {subjectNames:['Mathematics'],teacherIds:['T1']});
 assert.equal(p.form5End,880);
 assert.equal(p.lastPeriod,10);
 assert.equal(p.maxSubjectPerDay,1);
 assert.equal(p.maxSubjectPerWeek,1);
 assert.equal(p.maxTeacherPerDay,10);
 assert.equal(p.maxTeacherDays,5);
 assert.equal(p.subjects.Mathematics.pattern,'auto');   // 'hourly' is not a pattern
 assert.equal(p.subjects.Mathematics.morning,true);
 assert.equal(p.subjects.Mathematics.maxPerDay,4);
 assert.equal(p.subjects.Astrology,undefined);          // not a subject in this school
 assert.deepEqual(p.teachers.T1.off,['Monday']);        // deduplicated, Caturday dropped
 assert.equal(p.teachers.T1.maxDays,1);
 assert.equal(p.teachers.T1.maxPerDay,null);
 assert.equal(p.teachers.GHOST,undefined);
});

test('defaults are the school week as it actually runs',()=>{
 const d=defaultPreferences();
 assert.equal(d.form5End,880);
 assert.equal(d.maxSubjectPerDay,2);      // one double
 assert.equal(d.maxTeacherPerDay,8);      // a Form 1-4 day is 8 periods
 assert.equal(d.maxTeacherDays,5);
});

// A lighter register, for the rules that need room to show themselves.
function lightLoad(list=classes.slice(0,10),perTeacher=3){
 const plan=[['Mathematics',5],['English Language',5],['French',4],['Biology',4],['Chemistry',4],['Physics',4],['History',3],['Geography',3],['Computer Science',3]];
 const out=[];
 for(const c of list)for(const [subject,periods] of plan)
  out.push({class:c,subject,teacherId:`${subject.slice(0,4).toUpperCase()}-${list.indexOf(c)%perTeacher}`,department:subject,periods});
 return out;
}

test('lessons stop after the latest period the school chose',()=>{
 const load=lightLoad(classes.slice(0,6)).filter(a=>a.subject!=='Computer Science'&&a.subject!=='Geography');
 const entries=generateTimetable(load,FORM5_END,classes,{preferences:{lastPeriod:6}});
 assert.deepEqual(conflicts(entries,load),[]);
 const latest=Math.max(...entries.map(e=>e.end));
 assert.equal(latest,timetablePeriods[5].end,`lessons ran to ${latest}, past the end of period 6`);
});

test('period 9 and 10 belong to Form 5 at 16:00 and Sixth Form only',()=>{
 assert.equal(slotsFor('Form 3A','Monday',880).at(-1).end,880);        // 14:40
 assert.equal(slotsFor('Form 5A','Monday',880).at(-1).end,880);
 assert.equal(slotsFor('Form 5A','Monday',960).at(-1).end,930);
 assert.equal(slotsFor('Lower Sixth Arts','Monday',880).at(-1).end,930);
 assert.equal(slotsFor('Form 3A','Monday',880,4).at(-1).end,650);      // capped at period 4
});

test('a day a teacher cannot come is left completely empty for them',()=>{
 const load=schoolLoad(classes.slice(0,8));
 const victims=[...new Set(load.map(a=>a.teacherId))].slice(0,3);
 const teachers={};
 victims.forEach((id,i)=>{teachers[id]={off:i===0?['Monday','Friday']:['Wednesday']};});
 const entries=generateTimetable(load,FORM5_END,classes,{preferences:{teachers}});
 assert.deepEqual(conflicts(entries,load),[]);
 assert.equal(periodsOn(entries,victims[0],'Monday'),0);
 assert.equal(periodsOn(entries,victims[0],'Friday'),0);
 assert.equal(periodsOn(entries,victims[1],'Wednesday'),0);
 assert.equal(periodsOn(entries,victims[2],'Wednesday'),0);
});

test('a teacher capped at three days comes in on three days',()=>{
 const load=schoolLoad(classes.slice(0,8));
 const ids=[...new Set(load.map(a=>a.teacherId))];
 const light=ids.filter(id=>load.filter(a=>a.teacherId===id).reduce((n,a)=>n+a.periods,0)<=18).slice(0,4);
 assert.ok(light.length,'the test load should contain some lighter teachers');
 const teachers=Object.fromEntries(light.map(id=>[id,{maxDays:3}]));
 const entries=generateTimetable(load,FORM5_END,classes,{preferences:{teachers}});
 assert.deepEqual(conflicts(entries,load),[]);
 for(const id of light)assert.ok(daysOf(entries,id)<=3,`${id} still comes in ${daysOf(entries,id)} days`);
});

test('no teacher exceeds the daily period limit',()=>{
 const load=schoolLoad(classes.slice(0,8));
 const entries=generateTimetable(load,FORM5_END,classes,{preferences:{maxTeacherPerDay:5}});
 assert.deepEqual(conflicts(entries,load),[]);
 for(const id of new Set(entries.map(e=>e.teacherId)))
  for(const day of timetableDays)
   assert.ok(periodsOn(entries,id,day)<=5,`${id} teaches ${periodsOn(entries,id,day)} periods on ${day}`);
});

test('no class exceeds the daily limit for one subject',()=>{
 // A cap of 1 also has to switch the subject to single periods: a double could
 // never satisfy it, so the two settings are resolved together.
 const load=lightLoad(classes.slice(0,8));
 const entries=generateTimetable(load,FORM5_END,classes,{preferences:{maxSubjectPerDay:1}});
 assert.deepEqual(conflicts(entries,load),[]);
 for(const cls of new Set(entries.map(e=>e.class)))
  for(const day of timetableDays){
   const count=new Map();
   for(const e of entries.filter(x=>x.class===cls&&x.day===day))count.set(e.subject,(count.get(e.subject)||0)+1);
   for(const [subject,n] of count)assert.ok(n<=1,`${cls} has ${n} periods of ${subject} on ${day}`);
  }
});

test('a subject set to singles is never given a double period',()=>{
 const load=lightLoad(classes.slice(0,6));
 const entries=generateTimetable(load,FORM5_END,classes,{preferences:{subjects:{'Physical Education':{pattern:'single'},'Mathematics':{pattern:'single'}}}});
 assert.deepEqual(conflicts(entries,load),[]);
 for(const cls of new Set(entries.map(e=>e.class)))for(const day of timetableDays){
  const maths=entries.filter(e=>e.class===cls&&e.day===day&&e.subject==='Mathematics').sort((a,b)=>a.start-b.start);
  for(let i=1;i<maths.length;i++)assert.notEqual(maths[i].start,maths[i-1].end,`${cls} got a double of Mathematics on ${day}`);
 }
});

test('a subject marked for the morning is pulled before the break',()=>{
 // A preference, not a rule: it needs a week with some room to act in. On a week
 // where the subject's teachers already need every morning slot, it can only yield.
 const load=lightLoad();
 const early=(e,sub)=>e.filter(x=>x.subject===sub&&x.start<650).length/e.filter(x=>x.subject===sub).length;
 const plain=generateTimetable(load,FORM5_END,classes);
 const tuned=generateTimetable(load,FORM5_END,classes,{preferences:{subjects:{'Physics':{morning:true}}}});
 assert.deepEqual(conflicts(tuned,load),[]);
 assert.ok(early(tuned,'Physics')>early(plain,'Physics')+0.05,
  `morning share only went from ${(100*early(plain,'Physics')).toFixed(0)}% to ${(100*early(tuned,'Physics')).toFixed(0)}%`);
});

test('a morning preference never costs a teacher an extra day',()=>{
 const load=lightLoad();
 const plain=generateTimetable(load,FORM5_END,classes);
 const tuned=generateTimetable(load,FORM5_END,classes,{preferences:{subjects:{'Physics':{morning:true}}}});
 const days=e=>{const ids=[...new Set(e.map(x=>x.teacherId))];return ids.reduce((n,id)=>n+teacherWeekCost(e,id).days,0)/ids.length;};
 assert.ok(days(tuned)<=days(plain)+0.35,`average days rose from ${days(plain).toFixed(2)} to ${days(tuned).toFixed(2)}`);
});

test('preferences that cannot be met are refused, naming the cause',()=>{
 const load=schoolLoad(classes.slice(0,4));
 const heaviest=[...new Set(load.map(a=>a.teacherId))]
  .map(id=>[id,load.filter(a=>a.teacherId===id).reduce((n,a)=>n+a.periods,0)])
  .sort((a,b)=>b[1]-a[1])[0][0];
 assert.throws(()=>generateTimetable(load,FORM5_END,classes,{preferences:{teachers:{[heaviest]:{maxDays:1}}}}),
  /leave room for only|unavailable on every day/);
 assert.throws(()=>generateTimetable(load,FORM5_END,classes,{preferences:{lastPeriod:3}}),
  /only has|no room for/);
});

test('a teacher with no free day left is refused clearly',()=>{
 const load=[{class:'Form 1A',subject:'Mathematics',teacherId:'T1',department:'Mathematics',periods:4}];
 assert.throws(()=>generateTimetable(load,FORM5_END,classes,{preferences:{teachers:{T1:{off:timetableDays}}}}),
  /unavailable on every day/);
});

test('preferences do not cost the grouping they were added to protect',()=>{
 const load=schoolLoad();
 const entries=generateTimetable(load,FORM5_END,classes,{preferences:defaultPreferences()});
 const ids=[...new Set(entries.map(e=>e.teacherId))];
 const avgDays=ids.reduce((n,id)=>n+teacherWeekCost(entries,id).days,0)/ids.length;
 assert.deepEqual(conflicts(entries,load),[]);
 assert.ok(avgDays<4.3,`average ${avgDays.toFixed(2)} days per teacher with default preferences`);
});

// ---------------------------------------------------------------------------
// Groups: subjects that run at the same time, and classes taught together
// ---------------------------------------------------------------------------
// The school's own example: Form 5A periods 3 and 4 are Commerce and Geography at
// once — the Commerce students go to one hall, the Geography students to another —
// and where it can be done the same lesson is taught to Form 5B at the same time.

// The ordinary conflict checker counts a class or a teacher in two places as an
// error. Inside a group that is exactly what is meant to happen, so entries placed
// as one unit are collapsed before checking: one class slot, one teacher, one room.
function groupConflicts(entries){
 const bad=[];
 const byDay=new Map();
 for(const e of entries){if(!byDay.has(e.day))byDay.set(e.day,[]);byDay.get(e.day).push(e);}
 for(const [day,list] of byDay)for(let i=0;i<list.length;i++)for(let j=i+1;j<list.length;j++){
  const a=list[i],b=list[j];
  if(!(a.start<b.end&&b.start<a.end))continue;
  const sameUnit=a.unit&&a.unit===b.unit;
  if(a.class===b.class&&!sameUnit)bad.push(`${a.class} double-booked ${day} ${a.subject}/${b.subject}`);
  if(a.teacherId===b.teacherId&&!sameUnit)bad.push(`${a.teacherId} double-booked ${day}`);
 }
 for(const e of entries){
  const slots=slotsFor(e.class,e.day,FORM5_END);
  if(!slots.some(s=>s.start===e.start&&s.end===e.end))bad.push(`${e.class} ${e.day} lesson outside the school day`);
 }
 return bad;
}
const periodsOf=(entries,cls,subject)=>entries.filter(e=>e.class===cls&&e.subject===subject).length;
const filler=(cls,teacher='FILL')=>[{class:cls,subject:'English Language',teacherId:teacher+'-E',department:'English',periods:5},
                                    {class:cls,subject:'Mathematics',teacherId:teacher+'-M',department:'Mathematics',periods:5}];

test('two subjects in an option block take the same periods, and the class is busy once',()=>{
 const load=[...filler('Form 5A'),
  {class:'Form 5A',subject:'Commerce',teacherId:'COM',department:'Economics',periods:4},
  {class:'Form 5A',subject:'Geography',teacherId:'GEO',department:'Geography',periods:4}];
 const entries=generateTimetable(load,FORM5_END,['Form 5A'],{preferences:{form5End:FORM5_END,
  groups:[{name:'Form 5 options',classes:['Form 5A'],subjects:['Commerce','Geography'],mode:'parallel',merge:false}]}});
 assert.deepEqual(groupConflicts(entries),[]);
 assert.equal(periodsOf(entries,'Form 5A','Commerce'),4);
 assert.equal(periodsOf(entries,'Form 5A','Geography'),4);
 // Every Commerce period has Geography beside it, and the reverse.
 const slot=e=>e.day+'\u0001'+e.start;
 const com=new Set(entries.filter(e=>e.subject==='Commerce').map(slot));
 const geo=new Set(entries.filter(e=>e.subject==='Geography').map(slot));
 assert.deepEqual([...com].sort(),[...geo].sort(),'the option subjects do not line up');
 // The two together take four periods of the class week, not eight.
 const taken=new Set(entries.filter(e=>e.class==='Form 5A').map(slot));
 assert.equal(taken.size,4+5+5,'the option block should occupy the class slot once');
});

test('classes taught together sit the same lesson at the same time',()=>{
 const load=[...filler('Form 5A','A'),...filler('Form 5B','B'),
  {class:'Form 5A',subject:'Commerce',teacherId:'COM',department:'Economics',periods:4},
  {class:'Form 5B',subject:'Commerce',teacherId:'COM',department:'Economics',periods:4}];
 const entries=generateTimetable(load,FORM5_END,['Form 5A','Form 5B'],{preferences:{form5End:FORM5_END,
  groups:[{name:'Form 5 Commerce',classes:['Form 5A','Form 5B'],subjects:['Commerce'],mode:'apart',merge:true}]}});
 assert.deepEqual(groupConflicts(entries),[]);
 const slot=e=>e.day+'\u0001'+e.start;
 const a=entries.filter(e=>e.class==='Form 5A'&&e.subject==='Commerce').map(slot).sort();
 const b=entries.filter(e=>e.class==='Form 5B'&&e.subject==='Commerce').map(slot).sort();
 assert.equal(a.length,4);
 assert.deepEqual(a,b,'both classes must sit the lesson at the same time');
 // The teacher stands in front of one room for four periods, not eight.
 const {entries:sheet,total}=timetableFor(entries,{teacherId:'COM'});
 assert.equal(total,4,'the teacher sheet should show one lesson, not one per class');
 assert.ok(sheet.every(e=>/5A \+ 5B/.test(e.class)),'the sheet should name both classes on one row');
 assert.ok(teacherWeekCost(entries,'COM').gaps>=0,'a combined lesson must not read as a negative gap');
});

test('an option block merged across two classes does both at once',()=>{
 const load=[...filler('Form 5A','A'),...filler('Form 5B','B'),
  {class:'Form 5A',subject:'Commerce',teacherId:'COM',department:'Economics',periods:4},
  {class:'Form 5B',subject:'Commerce',teacherId:'COM',department:'Economics',periods:4},
  {class:'Form 5A',subject:'Geography',teacherId:'GEO',department:'Geography',periods:4},
  {class:'Form 5B',subject:'Geography',teacherId:'GEO',department:'Geography',periods:4}];
 const entries=generateTimetable(load,FORM5_END,['Form 5A','Form 5B'],{preferences:{form5End:FORM5_END,
  groups:[{name:'Form 5 options',classes:['Form 5A','Form 5B'],subjects:['Commerce','Geography'],mode:'parallel',merge:true}]}});
 assert.deepEqual(groupConflicts(entries),[]);
 const slot=e=>e.day+'\u0001'+e.start;
 const want=new Set(entries.filter(e=>e.class==='Form 5A'&&e.subject==='Commerce').map(slot));
 assert.equal(want.size,4);
 for(const cls of ['Form 5A','Form 5B'])for(const s of ['Commerce','Geography'])
  assert.deepEqual(new Set(entries.filter(e=>e.class===cls&&e.subject===s).map(slot)),want,`${cls} ${s} is out of step`);
 assert.equal(timetableFor(entries,{teacherId:'COM'}).total,4);
 assert.equal(timetableFor(entries,{teacherId:'GEO'}).total,4);
});

test('a group that cannot be taught as one lesson says why',()=>{
 const two=[{class:'Form 5A',subject:'Commerce',teacherId:'X',department:'Economics',periods:4},
            {class:'Form 5B',subject:'Commerce',teacherId:'Y',department:'Economics',periods:4}];
 const g=extra=>({form5End:FORM5_END,groups:[{name:'Form 5 Commerce',classes:['Form 5A','Form 5B'],subjects:['Commerce'],mode:'apart',merge:true,...extra}]});
 assert.throws(()=>generateTimetable(two,FORM5_END,['Form 5A','Form 5B'],{preferences:g()}),
  /assigned to more than one teacher/);
 const uneven=[{...two[0],teacherId:'X'},{...two[1],teacherId:'X',periods:3}];
 assert.throws(()=>generateTimetable(uneven,FORM5_END,['Form 5A','Form 5B'],{preferences:g()}),
  /same number of periods/);
 // Options must be the same size: a student cannot be in two halls for the odd period.
 const odd=[{class:'Form 5A',subject:'Commerce',teacherId:'X',department:'Economics',periods:4},
            {class:'Form 5A',subject:'Geography',teacherId:'Y',department:'Geography',periods:3}];
 assert.throws(()=>generateTimetable(odd,FORM5_END,['Form 5A'],{preferences:{form5End:FORM5_END,
  groups:[{name:'Options',classes:['Form 5A'],subjects:['Commerce','Geography'],mode:'parallel',merge:false}]}}),
  /same number of periods/);
});

test('a subject can be capped for the week on its own',()=>{
 const load=[{class:'Form 1A',subject:'Mathematics',teacherId:'M',department:'Mathematics',periods:6}];
 assert.throws(()=>generateTimetable(load,FORM5_END,['Form 1A'],
  {preferences:{form5End:FORM5_END,subjects:{Mathematics:{maxPerWeek:4}}}}),
  /above the limit of 4/);
 // The school-wide cap still applies to a subject with no cap of its own.
 assert.throws(()=>generateTimetable(load,FORM5_END,['Form 1A'],
  {preferences:{form5End:FORM5_END,maxSubjectPerWeek:5}}),/above the limit of 5/);
 assert.ok(generateTimetable(load,FORM5_END,['Form 1A'],
  {preferences:{form5End:FORM5_END,subjects:{Mathematics:{maxPerWeek:8}},maxSubjectPerWeek:6}}).length===6,
  'a subject may be allowed more than the school-wide default');
});

test('subjects asked to share a day do so without breaking any rule',()=>{
 const load=[...filler('Form 1A'),
  {class:'Form 1A',subject:'Physics',teacherId:'PHY',department:'Physics',periods:2},
  {class:'Form 1A',subject:'Chemistry',teacherId:'CHE',department:'Chemistry',periods:2}];
 const prefs={form5End:FORM5_END,groups:[{name:'Science day',classes:['Form 1A'],subjects:['Physics','Chemistry'],mode:'sameDay',merge:false}]};
 const entries=generateTimetable(load,FORM5_END,['Form 1A'],{preferences:prefs});
 assert.deepEqual(groupConflicts(entries),[]);
 const days=new Set(entries.filter(e=>['Physics','Chemistry'].includes(e.subject)).map(e=>e.day));
 assert.ok(days.size<=2,`the two sciences are spread over ${days.size} days`);
 // Still two separate lessons: nothing was merged behind the school's back.
 assert.equal(periodsOf(entries,'Form 1A','Physics'),2);
 assert.equal(periodsOf(entries,'Form 1A','Chemistry'),2);
});

test('a group is dropped, not obeyed blindly, when it names things that are gone',()=>{
 const p=normalizePreferences({groups:[
  {name:'Stale',classes:['Form 9Z'],subjects:['Commerce'],mode:'parallel'},
  {name:'Thin',classes:['Form 5A'],subjects:['Commerce'],mode:'parallel',merge:false},
  {name:'Real',classes:['Form 5A','Form 5B'],subjects:['Commerce','Geography'],mode:'parallel',merge:true}]},
  {subjectNames:['Commerce','Geography']});
 assert.deepEqual(p.groups.map(g=>g.name),['Real'],'only the group that can do something survives');
 assert.deepEqual(p.groups[0].classes,['Form 5A','Form 5B']);
 assert.equal(p.groups[0].merge,true);
 // A group with one subject is still a group when its job is to combine classes.
 const merged=normalizePreferences({groups:[{name:'Joint',classes:['Form 5A','Form 5B'],subjects:['Commerce'],mode:'apart',merge:true}]});
 assert.equal(merged.groups.length,1);
});

test('the whole school still solves with option blocks in every Form 5',()=>{
 const load=schoolLoad();
 // Replace the Form 5 Geography and Economics lines with an option block taught to
 // both streams at once, which is the arrangement the school described.
 const groups=[{name:'Form 5 options',classes:['Form 5A','Form 5B'],subjects:['Geography','Economics'],mode:'parallel',merge:true}];
 for(const cls of ['Form 5A','Form 5B'])for(const s of ['Geography','Economics']){
  const line=load.find(a=>a.class===cls&&a.subject===s);
  line.periods=2;line.teacherId=s.slice(0,4).toUpperCase()+'-1';
 }
 const entries=generateTimetable(load,FORM5_END,classes,{preferences:{form5End:FORM5_END,groups},deadlineMs:25000});
 assert.deepEqual(groupConflicts(entries),[]);
 const slot=e=>e.day+'\u0001'+e.start;
 const base=new Set(entries.filter(e=>e.class==='Form 5A'&&e.subject==='Geography').map(slot));
 assert.equal(base.size,2);
 for(const cls of ['Form 5A','Form 5B'])for(const s of ['Geography','Economics'])
  assert.deepEqual(new Set(entries.filter(e=>e.class===cls&&e.subject===s).map(slot)),base,`${cls} ${s} broke the block`);
 // Every other class is untouched and still complete.
 for(const a of load.filter(x=>!['Form 5A','Form 5B'].includes(x.class)))
  assert.equal(periodsOf(entries,a.class,a.subject),a.periods,`${a.class} ${a.subject}`);
});
