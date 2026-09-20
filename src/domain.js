import {requestTypes} from './document-requests.js';
import {postCatalogue} from './posts.js';
export const classes = [...Array.from({length:5},(_,i)=>['A','B'].map(s=>`Form ${i+1}${s}`)).flat(),'Lower Sixth Arts','Lower Sixth Science','Upper Sixth Arts','Upper Sixth Science'];
// A progression sheet is written for a level, not for a stream: one sheet covers
// Form 1A and Form 1B alike. A department that wants to follow its streams apart
// — because different teachers are at different points — tracks the sheet once
// per class instead, which is what splitting a subject means here.
export const levels=['Form 1','Form 2','Form 3','Form 4','Form 5','Lower Sixth','Upper Sixth'];
export function levelOf(cls){
 const form=/^Form\s*([1-5])/i.exec(String(cls||'').trim());
 if(form)return `Form ${form[1]}`;
 if(/lower\s*sixth/i.test(cls||''))return 'Lower Sixth';
 if(/upper\s*sixth/i.test(cls||''))return 'Upper Sixth';
 return String(cls||'').trim();
}
export const classesInLevel=(level,all=classes)=>all.filter(c=>levelOf(c)===levelOf(level));
// Department paperwork is filed under one of these, which is how the HOD's
// document library groups it.
export const documentCategories=['report','minutes','letter','note'];
export const itemCategories=['computer','printer','projector','network','laboratory','furniture','book','other'];
export const itemConditions=['working','needs repair','out of service'];
export const departments=['Mathematics','English','French','Physics','Biology','Computer Science','Food and Nutrition','Geography','History','Economics','Guidance and Counselling','Chemistry','Logic','Philosophy','Religious Studies','Physical Education'];
export const roles=postCatalogue.map(p=>p.id);
export const normalizeMatricule = v => String(v??'').trim().toUpperCase().replace(/[\s‐‑–—]/g,'').replace(/-/g,'');
// Returns a calendar date as YYYY-MM-DD, or '' when the value is absent or not a real date.
// Accepts the stored ISO form and the day/month/year form a phone keyboard may produce.
// It never guesses between day and month: 03/04/2010 is read as 3 April 2010.
export const normalizeBirthDate = v => {
 const s=String(v??'').trim();if(!s)return '';
 const iso=/^(\d{4})-(\d{2})-(\d{2})/.exec(s);
 const dmy=iso?null:/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s);
 if(!iso&&!dmy)return '';
 const [y,m,d]=iso?[+iso[1],+iso[2],+iso[3]]:[+dmy[3],+dmy[2],+dmy[1]];
 if(m<1||m>12||d<1||d>31||y<1900||y>2100)return '';
 const t=new Date(Date.UTC(y,m-1,d));
 if(t.getUTCFullYear()!==y||t.getUTCMonth()!==m-1||t.getUTCDate()!==d)return '';
 return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
};
export const promotionEligible = c => /^Form [1-4][A-Z]$/.test(c)||c.startsWith('Lower Sixth');
export const studies=(student,subject)=>Array.isArray(student.requiredSubjects)?[...student.requiredSubjects,...(student.subjects||[])].includes(subject):!Array.isArray(student.subjects)||student.subjects.length===0||student.subjects.includes(subject);
// The teaching slots one class has on one day.
// Forms 1 to 4 close at 14:40, so periods 9 and 10 exist only for Form 5 on the
// 16:00 setting and for Sixth Form. Wednesday closes at 13:00 for everybody.
// lastPeriod trims the day further still: set it to 8 and nothing is ever placed
// after 14:40, whatever the class.
export function slotsFor(cls,day,form5End,lastPeriod=10){
 const end=day==='Wednesday'?780:cls.startsWith('Form 5')?Number(form5End):cls.includes('Sixth')?960:880;
 if(!end)throw Error('Choose the Form 5 closing time before generating.');
 const cap=timetablePeriods[Math.min(10,Math.max(1,+lastPeriod||10))-1].end;
 const stop=Math.min(end,cap);
 const out=[]; for(let start=450;start+50<=stop;start+=50){if(start===650)start=680;if(start+50<=stop)out.push({start,end:start+50});}return out;
}
export const time = m => `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;
export const clockTime = m => {const h=Math.floor(m/60),x=h%12||12;return `${x}:${String(m%60).padStart(2,'0')} ${h<12?'AM':'PM'}`;};

// ---------------------------------------------------------------------------
// Printed timetable grid
// ---------------------------------------------------------------------------
// The school's bell schedule, as printed on the 2026-2027 sheets. Period 9 is a
// short 30-minute period; every other period runs 50 minutes. These are the ten
// columns of the printed sheet, and the break sits between periods 4 and 5.
export const timetablePeriods=[
 {n:1,start:450,end:500},{n:2,start:500,end:550},{n:3,start:550,end:600},{n:4,start:600,end:650},
 {n:5,start:680,end:730},{n:6,start:730,end:780},{n:7,start:780,end:830},{n:8,start:830,end:880},
 {n:9,start:880,end:910},{n:10,start:910,end:960}];
export const timetableBreak={start:650,end:680};
export const breakColumnIndex=4; // the break is drawn after period 4
export const timetableDays=['Monday','Tuesday','Wednesday','Thursday','Friday'];

// Which printed periods does one lesson occupy? A period counts as used when the
// lesson covers at least half of it. That keeps a 50-minute lesson placed at 14:40
// inside the short period 9 instead of bleeding a few minutes into period 10.
// A lesson that matches no period at all still claims the first one it touches, so
// nothing generated is ever silently dropped from the sheet.
export function periodSpan(entry){
 const out=[];
 timetablePeriods.forEach((p,i)=>{
  const overlap=Math.min(entry.end,p.end)-Math.max(entry.start,p.start);
  if(overlap>0&&overlap*2>=p.end-p.start)out.push(i);});
 if(out.length)return out;
 const touched=timetablePeriods.findIndex(p=>entry.start<p.end&&p.start<entry.end);
 return touched<0?[]:[touched];
}

// Builds one printable row per day as a list of cells. Adjacent periods holding the
// same lessons merge into a single wide cell, which is how a double period prints as
// one box. mergeEmpty joins blank periods too: the teacher sheet is mostly empty and
// reads better as a few large boxes, while the class sheet keeps every column visible.
export function timetableRow(entries,day,{mergeEmpty=false}={}){
 const slots=timetablePeriods.map(()=>[]);
 for(const e of entries.filter(e=>e.day===day))for(const i of periodSpan(e))slots[i].push(e);
 const signature=list=>list.map(e=>[e.subject,e.class,e.teacherId,e.group??''].join('\u0001')).sort().join('\u0002');
 const cells=[];
 slots.forEach((lessons,i)=>{
  const key=signature(lessons),last=cells[cells.length-1];
  // The break sits between periods 4 and 5, so a cell can never merge across it.
  const acrossBreak=i===breakColumnIndex;
  if(last&&!acrossBreak&&last.key===key&&(key!==''||mergeEmpty)){last.span++;return;}
  cells.push({key,span:1,from:i,lessons});});
 return cells;
}

// Every lesson of one teacher or one class, with the subject totals printed beside
// the teacher's sheet. Counts are periods per week, so a double period counts twice.
export function timetableFor(entries,{teacherId,class:cls}={}){
 const mine=entries.filter(e=>(teacherId?e.teacherId===teacherId:true)&&(cls?e.class===cls:true));
 const counts=new Map();
 for(const e of mine)counts.set(e.subject,(counts.get(e.subject)||0)+1);
 return {entries:mine,subjects:[...counts].map(([subject,count])=>({subject,count})).sort((a,b)=>a.subject.localeCompare(b.subject)),total:mine.length};
}

// Short codes as printed on the school's sheets. A subject record may carry its own
// `code`, which wins. Anything else falls back to initials or a truncated name so a
// newly added subject still prints something sensible rather than a blank box.
export const subjectCodes={
 'English Language':'ENG','French':'FREN','Mathematics':'MATHS','Additional Mathematics':'ADD. MATHS',
 'Biology':'BIO','Chemistry':'CHEM','Citizenship':'CITZ','Commerce':'COMM','Computer Science':'CSC',
 'Economics':'ECONS','Geography':'GEO','Geology':'GEOL','History':'HIS','Human Biology':'H.BIO',
 'Logic':'LOGIC','Physics':'PHY','Food and Nutrition':'F&N','Literature in English':'LIT',
 'Physical Education':'PE','Religious Studies':'RS','Manual Labour':'ML','Philosophy':'PHILO'};
const minorWord=w=>['and','of','in','the','for','to'].includes(w.toLowerCase());
export function subjectCode(name,subjects=[]){
 const clean=String(name??'').trim();if(!clean)return '';
 const own=subjects.find(s=>s.name===clean)?.code;
 if(own&&String(own).trim())return String(own).trim().toUpperCase();
 if(subjectCodes[clean])return subjectCodes[clean];
 const words=clean.split(/\s+/).filter(w=>!minorWord(w));
 return (words.length>1?words.map(w=>w[0]).join(''):clean.slice(0,5)).toUpperCase();
}// ---------------------------------------------------------------------------
// Timetable generation
// ---------------------------------------------------------------------------
// Two things matter beyond avoiding clashes, and both are for the teachers:
//
//   1. Periods should sit together. A teacher with four Form 5A lessons wants two
//      doubles, not four lessons scattered over four mornings. The generator
//      therefore places whole blocks: each assignment is split into doubles, with
//      one single left over when the weekly count is odd.
//   2. A teacher should come to school on as few days as possible, and on the days
//      they do come their lessons should run in one stretch rather than with free
//      periods in between.
//
// Hard rules are never traded away for either: no class and no teacher is ever in
// two places at once, and one class never meets the same subject twice in a day
// beyond a single double. The generator returns a complete timetable or throws —
// it never saves a partial one.
//
// Everything below works on period indices (0-9 of timetablePeriods) rather than
// clock times. The break sits between index 3 and 4, so two lessons either side of
// it count as a continuous stretch for the teacher — they stay at school — while a
// single block still never straddles it, because the printed sheet cannot draw a
// box across the break column.

// Split a weekly period count into teaching blocks, largest first.
// 4 -> [2,2]; 5 -> [2,2,1]; 3 -> [2,1]; 1 -> [1]. A subject taught once a week
// keeps its single period rather than being inflated into a double.
// pattern: 'auto' pairs where it can, 'single' never pairs, 'double' pairs and
// leaves one single only when the weekly count is odd (which is the same as auto,
// but stated explicitly so the principal can see the intent on the sheet).
export function lessonBlocks(periods,pattern='auto'){
 const n=+periods,out=[];
 if(pattern==='single'){for(let i=0;i<n;i++)out.push(1);return out;}
 for(let left=n;left>0;left-=2)out.push(left>=2?2:1);
 return out;
}

const periodIndex=start=>timetablePeriods.findIndex(p=>p.start===start);

// ---------------------------------------------------------------------------
// Generation preferences
// ---------------------------------------------------------------------------
// What the school decides before generating. Some are hard rules the generator
// must obey, some are preferences it works towards. Hard: the latest period of the
// day, how many periods of one subject a class may have in a day and in a week,
// how many periods a teacher may teach in a day, how many days a teacher comes in,
// which days a teacher cannot be given at all, and whether a subject is taught in
// singles or doubles. Soft: which subjects should fall in the morning.
//
// Whatever the browser sends is passed through normalizePreferences again on the
// server, so a hand-edited request cannot smuggle a value past the limits.
export const subjectPatterns=['auto','double','single'];
export function defaultPreferences(){
 // maxTeacherPerDay defaults to 8 because a Form 1 to 4 day is exactly 8 periods:
 // a teacher who is in school all day can be teaching all of it. Lowering it is a
 // real choice with a cost — it spreads a teacher over more days and leaves them
 // more free periods between lessons, which is the opposite of what grouping is for.
 return {form5End:880,lastPeriod:10,maxSubjectPerDay:2,maxSubjectPerWeek:10,maxTeacherPerDay:8,maxTeacherDays:5,subjects:{},teachers:{}};
}
const whole=(v,lo,hi,fallback)=>{const n=Math.round(Number(v));return Number.isFinite(n)?Math.min(hi,Math.max(lo,n)):fallback;};
const wholeOrNull=(v,lo,hi)=>{if(v===''||v===null||v===undefined)return null;const n=Math.round(Number(v));return Number.isFinite(n)?Math.min(hi,Math.max(lo,n)):null;};

export function normalizePreferences(raw={},{subjectNames=[],teacherIds=[]}={}){
 const d=defaultPreferences(),p=raw&&typeof raw==='object'?raw:{};
 const out={
  form5End:[880,960].includes(Math.round(Number(p.form5End)))?Math.round(Number(p.form5End)):d.form5End,
  lastPeriod:whole(p.lastPeriod,1,10,d.lastPeriod),
  maxSubjectPerDay:whole(p.maxSubjectPerDay,1,4,d.maxSubjectPerDay),
  maxSubjectPerWeek:whole(p.maxSubjectPerWeek,1,30,d.maxSubjectPerWeek),
  maxTeacherPerDay:whole(p.maxTeacherPerDay,1,10,d.maxTeacherPerDay),
  maxTeacherDays:whole(p.maxTeacherDays,1,5,d.maxTeacherDays),
  subjects:{},teachers:{}};
 const known=new Set(subjectNames);
 for(const [name,v] of Object.entries(p.subjects||{})){
  if(known.size&&!known.has(name))continue;
  const s=v&&typeof v==='object'?v:{};
  const entry={pattern:subjectPatterns.includes(s.pattern)?s.pattern:'auto',morning:s.morning===true||s.morning==='true',maxPerDay:wholeOrNull(s.maxPerDay,1,4)};
  if(entry.pattern!=='auto'||entry.morning||entry.maxPerDay!==null)out.subjects[name]=entry;
 }
 const knownStaff=new Set(teacherIds);
 for(const [id,v] of Object.entries(p.teachers||{})){
  if(knownStaff.size&&!knownStaff.has(id))continue;
  const s=v&&typeof v==='object'?v:{};
  const off=[...new Set((Array.isArray(s.off)?s.off:[]).filter(x=>timetableDays.includes(x)))];
  const entry={off,maxDays:wholeOrNull(s.maxDays,1,5),maxPerDay:wholeOrNull(s.maxPerDay,1,10)};
  if(off.length||entry.maxDays!==null||entry.maxPerDay!==null)out.teachers[id]=entry;
 }
 return out;
}
// The daily cap and the block pattern are two ways of saying the same thing, so they
// are resolved together. "Singles only" means one period of that subject a day —
// otherwise two singles could land back to back and be a double in all but name.
// A daily cap of 1 likewise forces singles, since a double could never satisfy it.
function subjectPref(prefs,name){
 const raw=prefs.subjects[name]||{pattern:'auto',morning:false,maxPerDay:null};
 const cap=Math.min(raw.maxPerDay??prefs.maxSubjectPerDay,raw.pattern==='single'?1:4);
 return {...raw,maxPerDay:cap,pattern:cap<2?'single':raw.pattern};
}
const teacherPref=(prefs,id)=>prefs.teachers[id]||{off:[],maxDays:null,maxPerDay:null};

// Every way a block of `size` consecutive periods fits into one class's day.
// Consecutive means the periods actually touch, so nothing crosses the break.
function runsFor(cls,day,form5End,size,lastPeriod=10){
 const slots=slotsFor(cls,day,form5End,lastPeriod),out=[];
 for(let i=0;i+size<=slots.length;i++){
  const run=slots.slice(i,i+size);
  let joined=true;
  for(let k=1;k<run.length;k++)if(run[k].start!==run[k-1].end)joined=false;
  if(joined&&run.every(s=>periodIndex(s.start)>=0))out.push(run.map(s=>({...s,i:periodIndex(s.start)})));
 }
 return out;
}

// A teacher's or class's week as a flat grid: day * 10 + period index.
const CELLS=timetableDays.length*10;
const at=(d,i)=>d*10+i;

// What a placement would cost the teacher. Lower is better. The class is in school
// all day whatever happens, so most terms here are about the teacher's week.
function cost(busy,classBusy,d,run,classDayLoad,morning){
 const first=run[0].i,last=run[run.length-1].i;
 let dayCount=0,onThisDay=0;
 for(let day=0;day<timetableDays.length;day++){
  let any=false;
  for(let i=0;i<10;i++)if(busy[at(day,i)]){any=true;if(day===d)onThisDay++;}
  if(any)dayCount++;
 }
 let c=0;
 if(!onThisDay){
  // A new working day is the expensive thing. This is what pulls a teacher's week
  // down to three or four days instead of five.
  c+=100+dayCount*4; // and the more days they already have, the worse another is
 }else{
  // Already in school today: reward a block that carries on from an existing
  // lesson, and charge for the free periods a gap would leave them sitting through.
  if((first>0&&busy[at(d,first-1)])||(last<9&&busy[at(d,last+1)]))c-=30;
  let lo=first,hi=last,taught=run.length;
  for(let i=0;i<10;i++)if(busy[at(d,i)]){if(i<lo)lo=i;if(i>hi)hi=i;taught++;}
  c+=((hi-lo+1)-taught)*5;
 }
 // Keep a class's own week even, and keep its mornings from filling while its
 // afternoons stay empty.
 c+=classDayLoad*0.6;
 c+=first*0.12;
 // A subject marked for the morning pays to sit after the break. It is a
 // preference, not a rule: a full week still places it rather than failing.
 if(morning&&first>=breakColumnIndex)c+=60+(first-breakColumnIndex)*4;
 return c;
}

// A school week runs at about ninety per cent of capacity, which is exactly the
// shape of problem where plain backtracking stalls: almost every arrangement is
// nearly right and a single bad early choice is only discovered thousands of steps
// later. So there are two solvers. The first is a straightforward most-constrained
// -first search, which settles an easy week in milliseconds. When that runs out of
// budget the second takes over: place everything immediately, clashes and all, then
// repeatedly pick a clashing block and move it wherever it clashes least. That is
// the standard repair approach for timetables and it copes with a full week.
//
// Both are deterministic. The same assignments always produce the same timetable,
// so regenerating does not reshuffle the whole school for no reason.
const mulberry32=a=>()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};

export function generateTimetable(assignments,form5End,allowedClasses=classes,{deadlineMs=20000,seed=20262027,preferences,compact=true}={}){
 const prefs=normalizePreferences({...(preferences||{}),form5End:preferences?.form5End??form5End},
  {subjectNames:[...new Set(assignments.map(a=>a.subject))],teacherIds:[...new Set(assignments.map(a=>a.teacherId))]});
 const close=prefs.form5End,last=prefs.lastPeriod;
 const jobs=[];
 for(const a of assignments){
  if(!allowedClasses.includes(a.class)||!a.teacherId||!a.subject||!Number.isInteger(+a.periods)||+a.periods<1||+a.periods>30)throw Error('Each assignment needs a class, teacher, subject and 1–30 periods.');
  if(+a.periods>prefs.maxSubjectPerWeek)throw Error(`${a.class} is assigned ${a.periods} periods of ${a.subject} a week, above the limit of ${prefs.maxSubjectPerWeek} set in the preferences. Raise the limit or reduce the assignment.`);
  for(const size of lessonBlocks(a.periods,subjectPref(prefs,a.subject).pattern))jobs.push({class:a.class,subject:a.subject,teacherId:a.teacherId,department:a.department,size});
 }
 if(!jobs.length)return [];

 // Refuse the impossible before searching for it, and name what caused it, so the
 // principal can correct the register or the preferences instead of guessing.
 const capacity=cls=>timetableDays.reduce((n,day)=>n+slotsFor(cls,day,close,last).length,0);
 for(const cls of new Set(jobs.map(j=>j.class))){
  const want=jobs.filter(j=>j.class===cls).reduce((n,j)=>n+j.size,0);
  if(want>capacity(cls))throw Error(`${cls} is assigned ${want} periods a week but its week only has ${capacity(cls)}${last<10?` once lessons stop after period ${last}`:''}. Reduce that class's assignments, or allow later periods.`);
 }
 for(const a of assignments){
  const cap=subjectPref(prefs,a.subject).maxPerDay;
  const daysNeeded=Math.ceil(+a.periods/cap);
  if(daysNeeded>timetableDays.length)throw Error(`${a.class} cannot fit ${a.periods} periods of ${a.subject} into a week at no more than ${cap} a day. Raise that subject's daily limit or reduce its periods.`);
 }
 for(const id of new Set(jobs.map(j=>j.teacherId))){
  const tp=teacherPref(prefs,id);
  const mine=jobs.filter(j=>j.teacherId===id);
  const want=mine.reduce((n,j)=>n+j.size,0);
  const perDay=tp.maxPerDay??prefs.maxTeacherPerDay;
  const theirClasses=[...new Set(mine.map(j=>j.class))];
  const open=timetableDays.filter(d=>!tp.off.includes(d));
  if(!open.length)throw Error('A teacher has been marked unavailable on every day but still has lessons assigned. Free up a day or move those classes to another teacher.');
  const room=open.map(day=>Math.min(perDay,Math.max(...theirClasses.map(c=>slotsFor(c,day,close,last).length))));
  const allowedDays=Math.min(tp.maxDays??prefs.maxTeacherDays,open.length);
  const best=room.sort((a,b)=>b-a).slice(0,allowedDays).reduce((n,x)=>n+x,0);
  if(want>best)throw Error(`One teacher is assigned ${want} periods a week, but the preferences leave room for only ${best} (${allowedDays} day${allowedDays===1?'':'s'} at up to ${perDay} periods). Share that workload, allow more days, or raise the daily limit.`);
 }

 // Every placement a block could take, as flat cell indices. Built once.
 const runCache=new Map();
 const runsOn=(cls,d,size)=>{
  const k=cls+'\u0001'+d+'\u0001'+size;
  if(!runCache.has(k))runCache.set(k,runsFor(cls,timetableDays[d],close,size,last));
  return runCache.get(k);
 };
 for(const j of jobs){
  j.cands=[];
  const off=teacherPref(prefs,j.teacherId).off;
  for(let d=0;d<timetableDays.length;d++){
   if(off.includes(timetableDays[d]))continue;   // the teacher is not in that day at all
   for(const run of runsOn(j.class,d,j.size))j.cands.push({d,run,cells:run.map(s=>at(d,s.i))});
  }
  if(!j.cands.length)throw Error(`${j.class} has no room for a ${j.size===2?'double':'single'} period of ${j.subject} on any day its teacher is available. Check the closing time, the latest period, and that teacher's free days.`);
 }

 const classCnt=new Map(),teachCnt=new Map(),subjDay=new Map(),teachDay=new Map();
 const sKey=j=>j.class+'\u0001'+j.subject;
 for(const j of jobs){
  if(!classCnt.has(j.class))classCnt.set(j.class,new Int16Array(CELLS));
  if(!teachCnt.has(j.teacherId))teachCnt.set(j.teacherId,new Int16Array(CELLS));
  if(!teachDay.has(j.teacherId))teachDay.set(j.teacherId,new Int16Array(timetableDays.length));
  if(!subjDay.has(sKey(j)))subjDay.set(sKey(j),new Int16Array(timetableDays.length));
 }
 // Periods, not blocks, so the daily limits read the way the principal set them.
 const apply=(j,ci,delta)=>{
  const c=j.cands[ci],cc=classCnt.get(j.class),tc=teachCnt.get(j.teacherId),sd=subjDay.get(sKey(j)),td=teachDay.get(j.teacherId);
  for(const cell of c.cells){cc[cell]+=delta;tc[cell]+=delta;}
  sd[c.d]+=delta*c.cells.length;
  td[c.d]+=delta*c.cells.length;
 };
 // How many rules this placement would break, counting the block as not placed.
 // Double bookings are physical impossibilities; the daily limits the school set are
 // counted here too, so the repair solver drives them to zero before accepting a
 // timetable rather than treating them as advice.
 const limits=new Map();
 for(const j of jobs)limits.set(j,{subject:subjectPref(prefs,j.subject).maxPerDay,
                                   teacher:teacherPref(prefs,j.teacherId).maxPerDay??prefs.maxTeacherPerDay,
                                   days:Math.min(teacherPref(prefs,j.teacherId).maxDays??prefs.maxTeacherDays,timetableDays.length-teacherPref(prefs,j.teacherId).off.length),
                                   morning:subjectPref(prefs,j.subject).morning});
 const clashes=(j,ci)=>{
  const c=j.cands[ci],size=c.cells.length,lim=limits.get(j);
  const cc=classCnt.get(j.class),tc=teachCnt.get(j.teacherId),sd=subjDay.get(sKey(j)),td=teachDay.get(j.teacherId);
  let n=0;
  for(const cell of c.cells)n+=cc[cell]+tc[cell];
  const overSubject=sd[c.d]+size-lim.subject;        if(overSubject>0)n+=overSubject*2;
  const overTeacher=td[c.d]+size-lim.teacher;        if(overTeacher>0)n+=overTeacher*2;
  if(!td[c.d]){
   let used=0;for(let d=0;d<timetableDays.length;d++)if(td[d])used++;
   if(used>=lim.days)n+=3;                           // a day beyond the teacher's allowance
  }
  return n;
 };
 const assign=new Int32Array(jobs.length).fill(-1);
 const teacherCostOf=(j,ci)=>{
  const c=j.cands[ci],tb=teachCnt.get(j.teacherId),cb=classCnt.get(j.class);
  let load=0;for(let i=0;i<10;i++)if(cb[at(c.d,i)])load++;
  return cost(tb,cb,c.d,c.run,load,limits.get(j).morning);
 };

 const stop=Date.now()+deadlineMs;
 const rand=mulberry32(seed);

 // --- fast path: most-constrained-first search, short budget -----------------
 const fastStop=Math.min(stop,Date.now()+Math.max(1500,deadlineMs*0.25));
 const done=new Array(jobs.length).fill(false);
 let left=jobs.length;
 const search=()=>{
  if(!left)return true;
  if(Date.now()>fastStop)return false;
  let pick=-1,fewest=Infinity;
  for(let n=0;n<jobs.length;n++){
   if(done[n])continue;
   let free=0;
   for(let ci=0;ci<jobs[n].cands.length;ci++)if(clashes(jobs[n],ci)===0)free++;
   if(!free)return false;
   if(free<fewest){fewest=free;pick=n;if(free===1)break;}
  }
  const j=jobs[pick],open=[];
  for(let ci=0;ci<j.cands.length;ci++)if(clashes(j,ci)===0)open.push(ci);
  open.sort((a,b)=>teacherCostOf(j,a)-teacherCostOf(j,b)||a-b);
  done[pick]=true;left--;
  for(const ci of open){
   apply(j,ci,1);assign[pick]=ci;
   if(search())return true;
   apply(j,ci,-1);assign[pick]=-1;
   if(Date.now()>fastStop)break;
  }
  done[pick]=false;left++;
  return false;
 };
 let solved=search();

 // --- repair path: place everything, then move whatever breaks a rule --------
 if(!solved){
  for(let n=0;n<jobs.length;n++)if(assign[n]>=0){apply(jobs[n],assign[n],-1);assign[n]=-1;}
  const order=[...jobs.keys()].sort((a,b)=>jobs[a].cands.length-jobs[b].cands.length||a-b);
  for(const n of order){
   const j=jobs[n];let best=0,bestScore=Infinity;
   for(let ci=0;ci<j.cands.length;ci++){
    const s=clashes(j,ci)*1000+teacherCostOf(j,ci);
    if(s<bestScore){bestScore=s;best=ci;}
   }
   apply(j,best,1);assign[n]=best;
  }
  let sinceGain=0,fewestBad=Infinity;
  while(Date.now()<stop){
   const bad=[];
   for(let n=0;n<jobs.length;n++){
    apply(jobs[n],assign[n],-1);
    if(clashes(jobs[n],assign[n]))bad.push(n);
    apply(jobs[n],assign[n],1);
   }
   if(!bad.length){solved=true;break;}
   if(bad.length<fewestBad){fewestBad=bad.length;sinceGain=0;}else sinceGain++;
   const n=bad[Math.floor(rand()*bad.length)],j=jobs[n];
   apply(j,assign[n],-1);
   let choice;
   if(sinceGain>600&&rand()<0.25){
    choice=Math.floor(rand()*j.cands.length);       // shake loose
   }else{
    let bestScore=Infinity,pool=[];
    for(let ci=0;ci<j.cands.length;ci++){
     const s=clashes(j,ci);
     if(s<bestScore){bestScore=s;pool=[ci];}else if(s===bestScore)pool.push(ci);
    }
    pool.sort((a,b)=>teacherCostOf(j,a)-teacherCostOf(j,b)||a-b);
    choice=pool[rand()<0.1?Math.floor(rand()*pool.length):0];
   }
   apply(j,choice,1);assign[n]=choice;
   if(sinceGain>600)sinceGain=0;
  }
 }
 if(!solved)throw Error('No timetable was found that keeps every preference in the time available. Relax a limit — more days for a teacher, more periods a day, or a later closing period — and generate again; no partial timetable was saved.');

 const entries=[];
 jobs.forEach((j,n)=>{
  for(const s of j.cands[assign[n]].run)entries.push({class:j.class,subject:j.subject,teacherId:j.teacherId,department:j.department,day:timetableDays[j.cands[assign[n]].d],start:s.start,end:s.end});
 });
 return compact?compactTeacherWeeks(entries,close,{preferences:prefs}):entries;
}
// How scattered one teacher's week is: days in school, plus the free periods they
// sit through between their first and last lesson each day. The break is not a gap.
export function teacherWeekCost(entries,teacherId){
 const mine=entries.filter(e=>e.teacherId===teacherId);
 const byDay=new Map();
 for(const e of mine){const i=periodIndex(e.start);if(i<0)continue;if(!byDay.has(e.day))byDay.set(e.day,[]);byDay.get(e.day).push(i);}
 let gaps=0;
 for(const list of byDay.values())gaps+=(Math.max(...list)-Math.min(...list)+1)-list.length;
 return {days:byDay.size,gaps,score:byDay.size*10+gaps};
}

// A second pass over a finished timetable. It moves one whole block at a time to a
// better place for its teacher, taking the move only when the result still obeys
// every rule the school set and that teacher's week gets cheaper. Every
// intermediate state is a complete, valid timetable, so the worst case is simply
// that nothing improves.
export function compactTeacherWeeks(entries,form5End,options={}){
 const {rounds=8,preferences}=typeof options==='number'?{rounds:options}:options;
 const prefs=normalizePreferences(preferences||{form5End});
 const last=prefs.lastPeriod;
 let current=entries.map(e=>({...e}));
 const key=e=>[e.class,e.subject,e.teacherId,e.day].join('\u0001');
 // Would this arrangement break one of the school's limits for the block's teacher
 // or class? Checked against the whole week, not just the day being changed.
 const allowed=(rest,moved)=>{
  const who=moved[0].teacherId,cls=moved[0].class,subject=moved[0].subject,day=moved[0].day;
  const tp=prefs.teachers[who]||{off:[],maxDays:null,maxPerDay:null};
  if(tp.off.includes(day))return false;
  const all=[...rest,...moved];
  const mine=all.filter(e=>e.teacherId===who);
  const days=new Set(mine.map(e=>e.day));
  if(days.size>Math.min(tp.maxDays??prefs.maxTeacherDays,timetableDays.length-tp.off.length))return false;
  if(mine.filter(e=>e.day===day).length>(tp.maxPerDay??prefs.maxTeacherPerDay))return false;
  const cap=subjectPref(prefs,subject).maxPerDay;
  if(all.filter(e=>e.class===cls&&e.subject===subject&&e.day===day).length>cap)return false;
  if(subjectPref(prefs,subject).pattern==='single'){
   const same=all.filter(e=>e.class===cls&&e.subject===subject&&e.day===day).sort((a,b)=>a.start-b.start);
   for(let i=1;i<same.length;i++)if(same[i].start===same[i-1].end)return false;
  }
  return true;
 };
 // Moving a block is judged on the teacher's week plus whether it keeps a
 // morning subject in the morning, so compaction cannot quietly undo that choice.
 const morningCost=list=>list.reduce((n,e)=>n+(subjectPref(prefs,e.subject).morning&&e.start>=timetableBreak.end?12:0),0);
 for(let round=0;round<rounds;round++){
  let improved=false;
  const blocks=new Map();
  for(const e of current){if(!blocks.has(key(e)))blocks.set(key(e),[]);blocks.get(key(e)).push(e);}
  // Deterministic order, so the same assignments always produce the same sheet.
  for(const [,block] of [...blocks].sort((a,b)=>a[0]<b[0]?-1:a[0]>b[0]?1:0)){
   block.sort((a,b)=>a.start-b.start);
   const sample=block[0];
   const rest=current.filter(e=>!block.includes(e));
   const before=teacherWeekCost(current,sample.teacherId).score+morningCost(block);
   let best=null;
   for(const day of timetableDays){
    for(const run of runsFor(sample.class,day,prefs.form5End||form5End,block.length,last)){
     if(rest.some(r=>r.day===day&&(r.class===sample.class||r.teacherId===sample.teacherId)&&run.some(s=>s.start<r.end&&r.start<s.end)))continue;
     const moved=run.map((s,i)=>({...block[i],day,start:s.start,end:s.end}));
     if(!allowed(rest,moved))continue;
     const after=teacherWeekCost([...rest,...moved],sample.teacherId).score+morningCost(moved);
     if(after<before-1e-9&&(!best||after<best.score))best={score:after,moved};
    }
   }
   if(best){current=[...rest,...best.moved];improved=true;}
  }
  if(!improved)break;
 }
 return current;
}
export function reportSummary(marks){const valid=marks.filter(m=>m.mark!==''&&m.mark!==null&&m.mark!==undefined&&Number.isFinite(+m.mark)&&+m.coefficient>0);if(valid.some(m=>+m.mark<0||+m.mark>20))throw Error('Marks must be between 0 and 20.');const coefficients=valid.reduce((s,m)=>s+(+m.coefficient),0),total=valid.reduce((s,m)=>s+(+m.mark)*(+m.coefficient),0);return {coefficients,total,average:coefficients?total/coefficients:null};}
export function attestationText(d){if(d.issuedBody)return d.issuedBody;const verb=d.kind==='assumption'?'assumed':d.kind==='resumption'?'resumed':d.action;if(!['assumed','resumed'].includes(verb))throw Error('Select assumed or resumed.');return `I, the undersigned, ${d.principal}, Principal of Government High School Mbonjo Limbe, certify that ${d.name} ${verb} duty on ${d.dutyDate}.\n\nMatricule: ${d.matricule}. Rank: ${d.rank}. Salary index: ${d.salaryIndex}. Appointment or transfer decision: ${d.decision}.\n\n${d.name} is effectively serving as ${d.position} in this institution.\n\nIn testimony whereof, this attestation is issued to serve the purpose for which it is intended.`;}
export function validateRecord(kind,d,allowedClasses=classes){
 const required={dept_document:['department','category','title','body'],dept_item:['department','name','category'],message:['body','scope'],progression:['department','subject','class','year'],classroom:['name','stream'],subject:['name','department','coefficient'],exam_attempt:['studentId','resourceId'],document_request:['requestType','purpose'],student:['name','matricule','class','gender'],profile:['name'],assignment:['teacherId','class','subject','department','periods'],resource:['title','class','subject','department','type','submissionMode'],event:['title','date','body'],post:['title','category','body'],gallery:['title','department','image'],textbook:['title','class','subject'],attendance:['studentId','class','date','status','assignmentId'],mark:['studentId','class','subject','assessment','year','mark','coefficient'],submission:['resourceId','body'],document:['name','matricule','kind','principal','rank','salaryIndex','decision','dutyDate','issueDate','reference','position']};
 if(!required[kind]&& !['timetable'].includes(kind))throw Error('Unknown record type.');
 for(const k of (kind==='document'&&d.kind==='letter'?['title','body','principal','issueDate','reference']:required[kind])||[])if(!(kind==='event'&&k==='date'&&d.status==='draft')&&(d[k]===undefined||d[k]===null||String(d[k]).trim()===''))throw Error(`${k} is required.`);
 // A progression sheet belongs to a syllabus level — "Form 1", "Lower Sixth" —
 // which is not one of the registered teaching classes (Form 1A, Form 1B), so the
 // class list does not apply to it.
 if(d.class&&kind!=='progression'&&!allowedClasses.includes(d.class))throw Error('Invalid class.');
 if(kind==='progression'){
  if(!Array.isArray(d.lessons)||!d.lessons.length)throw Error('A progression sheet needs at least one lesson.');
  if(d.lessons.length>2000)throw Error('That sheet has more than 2,000 lessons. Check the file.');
  const w=d.currentWeek;
  if(w!==null&&w!==undefined&&w!==''&&(!Number.isInteger(+w)||+w<1||+w>40))throw Error('The current week must be between 1 and 40.');
  if(!/^\d{4}\/\d{4}$/.test(String(d.year||'')))throw Error('Use an academic year such as 2026/2027.');
 }
 if(kind==='student'){d.matricule=normalizeMatricule(d.matricule);if(d.birthDate&&(!/^\d{4}-\d{2}-\d{2}$/.test(d.birthDate)||!Number.isFinite(Date.parse(d.birthDate))))throw Error('Use YYYY-MM-DD for date of birth.');}
 if(kind==='resource'&&!d.body&&!d.attachment&&!d.questions?.length)throw Error('Enter notes, upload a file or add assessment questions.');
 if(kind==='subject'&&(!Number.isFinite(+d.coefficient)||+d.coefficient<=0))throw Error('Coefficient must be positive.');
 if(kind==='classroom'&&!/^(Form [1-5][A-Z]|(?:Lower|Upper) Sixth (?:Arts|Science)(?: [A-Z])?)$/.test(d.name))throw Error('Use a class name such as Form 2A or Lower Sixth Arts.');
 if(kind==='attendance'&&!['present','absent','late','excused'].includes(d.status))throw Error('Invalid attendance status.');
 if(kind==='dept_document'){
  if(!documentCategories.includes(d.category))throw Error('Choose Report, Minutes, Letter or Note.');
  if(String(d.title).length>200)throw Error('Keep the title under 200 characters.');
  if(String(d.body).length>40000)throw Error('Keep the document under 40,000 characters.');
  d.transmitted=d.transmitted===true;
  if(!['draft','signed'].includes(d.status||'draft'))throw Error('A document is either a draft or signed.');
 }
 if(kind==='dept_item'){
  if(!itemCategories.includes(d.category))throw Error('Choose a valid equipment category.');
  const n=Number(d.quantity??1);
  if(!Number.isInteger(n)||n<1||n>9999)throw Error('Quantity must be a whole number between 1 and 9,999.');
  d.quantity=n;
  if(d.condition&&!itemConditions.includes(d.condition))throw Error('Choose a valid condition.');
 }
 if(kind==='message'){
  if(!['department','direct'].includes(d.scope))throw Error('A message is either to the department or to one colleague.');
  if(!String(d.body).trim())throw Error('Write a message first.');
  if(String(d.body).length>4000)throw Error('Keep a message under 4,000 characters.');
  if(d.scope==='direct'&&!d.toId)throw Error('Choose a colleague to write to.');
 }
 if(kind==='mark'){if(d.grade&&!['A','B','C','D','E','U'].includes(d.grade))throw Error('Choose a valid letter grade.');if(!/^Sequence [1-6]$/.test(d.assessment)&&d.assessment!=='Promotion exam')throw Error('Invalid assessment.');if(d.assessment==='Promotion exam'&&!promotionEligible(d.class))throw Error('Form 5 and Upper Sixth do not write promotion exams.');if(!Number.isFinite(+d.mark)||+d.mark<0||+d.mark>20||!Number.isFinite(+d.coefficient)||+d.coefficient<=0)throw Error('Invalid mark or coefficient.');}
 if(kind==='document'&&d.kind!=='letter')attestationText(d);
 if(kind==='document'&&d.kind==='letter'&&(d.title.length>160||d.body.length>12000))throw Error('Keep the subject under 160 characters and body under 12,000 characters.');
 if(kind==='document_request'&&!requestTypes.includes(d.requestType))throw Error('Choose a valid document type.');
 return d;
}
