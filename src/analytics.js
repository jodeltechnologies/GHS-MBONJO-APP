// ---------------------------------------------------------------------------
// School analytics
// ---------------------------------------------------------------------------
// Pure aggregation over records the caller has already been allowed to see.
// Nothing here reads the database or the DOM, and nothing here decides who may
// see what — the caller filters the rows first, so a teacher's figures are built
// only from their own classes. That keeps the access rules in one place
// (src/access.js) and makes every number below testable on its own.
//
// Two honesty rules run through all of it:
//
//   * A missing record is never treated as a zero. A class with no roll call has
//     no attendance rate, not 0%. An unmarked subject is not a fail. Every figure
//     carries the count it was computed from so the reader can judge it.
//   * School days are inferred from the register, never assumed. A weekday on
//     which nobody anywhere took a roll call is not counted as a school day, so
//     holidays and strike days do not quietly ruin the coverage figures.

import {timetableDays,timetablePeriods,periodSpan} from './domain.js';

export const attendanceStatuses=['present','late','absent','excused'];
// Present and late both mean the student was in the lesson. Excused means the
// school accepted the absence, so it is reported separately rather than folded
// into either side.

export const rate=(attended,counted)=>counted>0?attended/counted:null;
const pct=v=>v===null?null:Math.round(v*1000)/10;

// One attendance summary from a list of attendance records.
function tally(records){
 const t={present:0,late:0,absent:0,excused:0,total:0};
 for(const r of records){
  const s=r.status;
  if(!attendanceStatuses.includes(s))continue;
  t[s]++;t.total++;
 }
 // Excused absences are left out of the rate: they are neither a win nor a
 // truancy, and counting them as absent punishes a class for doing the paperwork.
 const counted=t.present+t.late+t.absent;
 return {...t,counted,rate:pct(rate(t.present+t.late,counted))};
}

const isoDay=date=>{
 const d=new Date(date+'T00:00:00Z');
 return Number.isFinite(d.getTime())?timetableDays[(d.getUTCDay()+6)%7]||null:null;
};
// Monday of the week a date falls in, as YYYY-MM-DD: the x axis of the trend.
export function weekStart(date){
 const d=new Date(date+'T00:00:00Z');
 if(!Number.isFinite(d.getTime()))return null;
 d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7));
 return d.toISOString().slice(0,10);
}
export const inRange=(date,from,to)=>typeof date==='string'&&(!from||date>=from)&&(!to||date<=to);

// ---------------------------------------------------------------------------
// Attendance
// ---------------------------------------------------------------------------
// `records` are attendance record data objects: {studentId,class,date,status,assignmentId}
// `students` are student record objects {id,data:{name,class,gender,...}}.
export function attendanceReport(records,{students=[],timetableEntries=[],from='',to='',watchBelow=80,minLessons=5}={}){
 const rows=records.filter(r=>r&&inRange(r.date,from,to)&&attendanceStatuses.includes(r.status));
 const overall=tally(rows);

 const group=(keyOf)=>{
  const m=new Map();
  for(const r of rows){const k=keyOf(r);if(k===null||k===undefined)continue;if(!m.has(k))m.set(k,[]);m.get(k).push(r);}
  return m;
 };
 const summarise=(m,extra=()=>({}))=>[...m].map(([key,list])=>({key,...tally(list),...extra(key,list)}));

 const byClass=summarise(group(r=>r.class)).sort((a,b)=>String(a.key).localeCompare(String(b.key)));
 const byWeek=summarise(group(r=>weekStart(r.date))).sort((a,b)=>String(a.key).localeCompare(String(b.key)));
 const byWeekday=timetableDays.map(day=>{
  const list=rows.filter(r=>isoDay(r.date)===day);
  return {key:day,...tally(list)};
 });

 // Which period of the day a lesson sat in, so the school can see whether the
 // last periods of the afternoon are being skipped. An attendance record does not
 // store a time, so the period is read back from the timetable: the class, the
 // subject and the weekday identify the lesson. A lesson the timetable places
 // twice on the same day is left out rather than guessed at.
 const slotOf=new Map();
 for(const e of timetableEntries){
  if(!e||!e.class||!e.subject||!e.day)continue;
  const k=[e.class,e.subject,e.day].join('\u0001');
  const span=periodSpan({start:+e.start,end:+e.end});
  const first=span.length?timetablePeriods[span[0]].n:null;
  if(first===null)continue;
  if(!slotOf.has(k))slotOf.set(k,new Set());
  slotOf.get(k).add(first);
 }
 const periodOf=r=>{
  const set=slotOf.get([r.class,r.subject,isoDay(r.date)].join('\u0001'));
  return set&&set.size===1?[...set][0]:null;
 };
 const byPeriod=timetablePeriods.map(p=>{
  const list=rows.filter(r=>periodOf(r)===p.n);
  return {key:p.n,...tally(list)};
 }).filter(x=>x.total>0);

 const nameOf=new Map(students.map(s=>[s.id,s.data?.name||'']));
 const classOf=new Map(students.map(s=>[s.id,s.data?.class||'']));
 const genderOf=new Map(students.map(s=>[s.id,s.data?.gender||'']));

 const byGender=summarise(group(r=>genderOf.get(r.studentId)||''))
  .filter(x=>x.key)
  .sort((a,b)=>String(a.key).localeCompare(String(b.key)));

 // The watchlist: students whose attendance has fallen below the threshold.
 // A student with only a lesson or two on record is left out — one absence out
 // of two lessons is 50% and means nothing.
 const perStudent=summarise(group(r=>r.studentId),key=>({
  name:nameOf.get(key)||'',class:classOf.get(key)||''}));
 const watchlist=perStudent
  .filter(s=>s.counted>=minLessons&&s.rate!==null&&s.rate<watchBelow)
  .sort((a,b)=>a.rate-b.rate||b.absent-a.absent||String(a.name).localeCompare(String(b.name)));

 return {
  overall,byClass,byWeek,byWeekday,byPeriod,byGender,watchlist,
  students:perStudent.length,
  days:[...new Set(rows.map(r=>r.date))].length,
  watchBelow,minLessons};
}

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------
// `marks` are mark record data objects: {studentId,class,subject,assessment,year,mark,coefficient,status}
// Only published marks are summarised — a draft is a teacher's working note, not
// a result, and averaging drafts would report figures nobody has approved.
export const PASS_MARK=10;   // out of 20, the usual Cameroonian pass
export const MARK_BANDS=[[0,5],[5,10],[10,12],[12,14],[14,16],[16,20.0001]];

// A blank mark is missing, not zero. Number('') and Number(null) are both 0, so
// the emptiness has to be checked before the conversion — otherwise every
// unmarked pupil silently drags the class average down.
const markValue=d=>{
 const raw=d?.mark;
 if(raw===''||raw===null||raw===undefined||(typeof raw==='string'&&!raw.trim()))return null;
 const n=Number(raw);
 return Number.isFinite(n)&&n>=0&&n<=20?n:null;
};

function markStats(list){
 const values=list.map(markValue).filter(v=>v!==null);
 if(!values.length)return {count:0,average:null,pass:0,passRate:null,highest:null,lowest:null};
 const pass=values.filter(v=>v>=PASS_MARK).length;
 return {
  count:values.length,
  average:Math.round(values.reduce((a,b)=>a+b,0)/values.length*100)/100,
  pass,passRate:pct(pass/values.length),
  highest:Math.max(...values),lowest:Math.min(...values)};
}

export function resultsReport(marks,{year='',assessment='',students=[]}={}){
 const rows=marks.filter(m=>m&&m.status==='published'&&(!year||m.year===year)&&(!assessment||m.assessment===assessment)&&markValue(m)!==null);
 const overall=markStats(rows);
 const by=keyOf=>{
  const m=new Map();
  for(const r of rows){const k=keyOf(r);if(!k)continue;if(!m.has(k))m.set(k,[]);m.get(k).push(r);}
  return [...m].map(([key,list])=>({key,...markStats(list)}));
 };
 const bySubject=by(r=>r.subject).sort((a,b)=>b.average-a.average||String(a.key).localeCompare(String(b.key)));
 const byClass=by(r=>r.class).sort((a,b)=>String(a.key).localeCompare(String(b.key)));

 // Distribution across mark bands, which is what shows whether a subject average
 // of 11 is a tight cluster or half the class failing and half doing well.
 const distribution=MARK_BANDS.map(([lo,hi])=>({
  key:`${lo}–${hi>20?20:hi}`,lo,hi,
  count:rows.filter(r=>{const v=markValue(r);return v>=lo&&v<hi;}).length}));

 // Progress across the six sequences, so a class can be seen improving or slipping.
 const sequences=[...new Set(marks.filter(m=>m.status==='published'&&(!year||m.year===year)).map(m=>m.assessment))]
  .filter(Boolean)
  .sort((a,b)=>String(a).localeCompare(String(b),undefined,{numeric:true}))
  .map(name=>({key:name,...markStats(marks.filter(m=>m.status==='published'&&(!year||m.year===year)&&m.assessment===name))}));

 const genderOf=new Map(students.map(s=>[s.id,s.data?.gender||'']));
 const byGender=by(r=>genderOf.get(r.studentId)||'').filter(x=>x.key).sort((a,b)=>String(a.key).localeCompare(String(b.key)));

 return {overall,bySubject,byClass,distribution,sequences,byGender,
         subjects:bySubject.length,classes:byClass.length};
}

// ---------------------------------------------------------------------------
// Roll-call coverage
// ---------------------------------------------------------------------------
// Was the register actually taken? Without this, a class nobody records looks
// identical to a class with perfect attendance, and every figure above is built
// on sand.
//
// Expected lessons come from the published timetable. School days are inferred:
// a date counts only if somebody, somewhere in the school, took a roll call that
// day. Holidays therefore drop out by themselves, and the school is never told
// off for not teaching on Christmas Day. The trade-off is that a day the whole
// school forgot the register is invisible, which is stated in the report.
export function coverageReport(attendance,timetableEntries,{from='',to='',assignments=[],nameFor=()=>''}={}){
 const rows=attendance.filter(r=>r&&inRange(r.date,from,to));
 const schoolDays=[...new Set(rows.map(r=>r.date))].sort();
 const dayOf=new Map(schoolDays.map(d=>[d,isoDay(d)]));

 // Lessons actually recorded, as one entry per (class, subject, date).
 const recorded=new Set();
 const byAssignment=new Map(assignments.map(a=>[a.id,a.data]));
 for(const r of rows){
  const a=byAssignment.get(r.assignmentId);
  const subject=a?.subject??r.subject??'';
  recorded.add([r.class,subject,r.date].join('\u0001'));
 }

 const lessons=timetableEntries.filter(e=>e&&e.class&&e.subject);
 const expected=[];
 for(const date of schoolDays){
  const weekday=dayOf.get(date);
  if(!weekday)continue;
  for(const e of lessons.filter(x=>x.day===weekday)){
   expected.push({class:e.class,subject:e.subject,teacherId:e.teacherId,date,
                  taken:recorded.has([e.class,e.subject,date].join('\u0001'))});
  }
 }
 // A double period is two timetable entries but one roll call, so collapse them.
 const unique=new Map();
 for(const x of expected)unique.set([x.class,x.subject,x.date].join('\u0001'),x);
 const list=[...unique.values()];

 const summarise=keyOf=>{
  const m=new Map();
  for(const x of list){const k=keyOf(x);if(!k)continue;if(!m.has(k))m.set(k,{expected:0,taken:0});const v=m.get(k);v.expected++;if(x.taken)v.taken++;}
  return [...m].map(([key,v])=>({key,...v,missed:v.expected-v.taken,rate:pct(rate(v.taken,v.expected))}));
 };
 const byTeacher=summarise(x=>x.teacherId)
  .map(x=>({...x,name:nameFor(x.key)||x.key}))
  .sort((a,b)=>a.rate-b.rate||b.missed-a.missed);
 const byClass=summarise(x=>x.class).sort((a,b)=>a.rate-b.rate||String(a.key).localeCompare(String(b.key)));

 const taken=list.filter(x=>x.taken).length;
 return {
  schoolDays:schoolDays.length,
  expected:list.length,taken,missed:list.length-taken,
  rate:pct(rate(taken,list.length)),
  byTeacher,byClass,
  firstDay:schoolDays[0]||'',lastDay:schoolDays.at(-1)||''};
}

// Everything the Analytics tab shows, from records the caller may already read.
export function schoolAnalytics({attendance=[],marks=[],students=[],assignments=[],timetableEntries=[],
                                 from='',to='',year='',assessment='',watchBelow=80,minLessons=5,nameFor=()=>''}={}){
 return {
  range:{from,to,year,assessment},
  attendance:attendanceReport(attendance,{students,timetableEntries,from,to,watchBelow,minLessons}),
  results:resultsReport(marks,{year,assessment,students}),
  coverage:coverageReport(attendance,timetableEntries,{from,to,assignments,nameFor})};
}
