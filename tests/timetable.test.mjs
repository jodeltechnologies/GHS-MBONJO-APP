import test from 'node:test';import assert from 'node:assert/strict';
import {generateTimetable,lessonBlocks,teacherWeekCost,compactTeacherWeeks,timetableRow,timetableFor,timetableDays,timetablePeriods,slotsFor,subjectCode,classes} from '../src/domain.js';

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
 assert.ok(avgGaps<2,`average ${avgGaps.toFixed(2)} free periods per teacher per week`);
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

test('an over-committed class is named instead of searching for the impossible',()=>{
 const load=[{class:'Form 1A',subject:'Mathematics',teacherId:'T1',department:'Mathematics',periods:30},
             {class:'Form 1A',subject:'English Language',teacherId:'T2',department:'English',periods:20}];
 assert.throws(()=>generateTimetable(load,FORM5_END,classes),/Form 1A is assigned 50 periods.*only has 38/s);
});

test('a teacher assigned more periods than the school week is named',()=>{
 const load=[{class:'Form 1A',subject:'Mathematics',teacherId:'T1',department:'Mathematics',periods:25},
             {class:'Form 1B',subject:'Mathematics',teacherId:'T1',department:'Mathematics',periods:25}];
 assert.throws(()=>generateTimetable(load,FORM5_END,classes),/One teacher is assigned 50 periods/);
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
