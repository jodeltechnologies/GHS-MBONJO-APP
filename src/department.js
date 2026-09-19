// ---------------------------------------------------------------------------
// Department office
// ---------------------------------------------------------------------------
// The head of department's own working data: the paper they write, the equipment
// they answer for, and how far through the progression sheet their subject has
// actually got. Pure functions only — the caller has already applied the access
// rules, so nothing here decides who may see what.

import {documentCategories,itemCategories,itemConditions} from './domain.js';

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------
export const categoryLabels={report:'Reports',minutes:'Minutes',letter:'Letters',note:'Notes'};

// The library, grouped the way a filing cabinet is: one drawer per category,
// newest first inside each. Empty drawers are kept so the shape of the cabinet
// does not change as papers come and go.
export function documentLibrary(records){
 const byCategory=Object.fromEntries(documentCategories.map(c=>[c,[]]));
 for(const r of records){
  const c=documentCategories.includes(r.data?.category)?r.data.category:'note';
  byCategory[c].push(r);
 }
 for(const c of documentCategories)byCategory[c].sort((a,b)=>String(b.data.date||b.created_at||'').localeCompare(String(a.data.date||a.created_at||'')));
 return {
  byCategory,
  total:records.length,
  signed:records.filter(r=>r.data?.status==='signed').length,
  transmitted:records.filter(r=>r.data?.transmitted===true).length,
  drafts:records.filter(r=>r.data?.status!=='signed').length};
}

// A document is ready to go to the administration once it is signed. Transmitting
// an unsigned draft would send the administration something nobody has stood behind.
export const canTransmit=d=>d?.status==='signed'&&d?.transmitted!==true;

// ---------------------------------------------------------------------------
// Equipment
// ---------------------------------------------------------------------------
// What the department answers for. Counts are of items, not rows, because one row
// can record twenty chairs.
export function inventorySummary(records){
 const items=records.map(r=>r.data).filter(Boolean);
 const count=list=>list.reduce((n,i)=>n+(Number(i.quantity)||1),0);
 const byCategory=itemCategories
  .map(key=>({key,rows:items.filter(i=>i.category===key).length,items:count(items.filter(i=>i.category===key))}))
  .filter(x=>x.rows);
 const byCondition=itemConditions
  .map(key=>({key,items:count(items.filter(i=>(i.condition||'working')===key))}))
  .filter(x=>x.items);
 return {
  rows:items.length,
  items:count(items),
  working:count(items.filter(i=>(i.condition||'working')==='working')),
  faulty:count(items.filter(i=>i.condition==='needs repair')),
  dead:count(items.filter(i=>i.condition==='out of service')),
  byCategory,byCondition};
}

// ---------------------------------------------------------------------------
// Progression and coverage
// ---------------------------------------------------------------------------
// A lesson's identity inside a sheet. Position is part of it: two sheets can both
// have a "Lesson 1: Introduction" and a sheet can repeat a title across terms.
export const lessonKey=(lesson,index)=>[index,lesson?.term||'',lesson?.week??'',lesson?.number??'',String(lesson?.title||'').slice(0,60)].join('\u0001');

export const TERMS=['First Term','Second Term','Third Term'];
// Every supplied sheet runs weeks 1-12, 13-24 and 25 onwards.
// An absent week has no term. Number('') and Number(null) are both 0, which is a
// finite number below 13, so a blank would otherwise be filed under First Term.
export const termOfWeek=week=>{
 if(week===''||week===null||week===undefined)return '';
 const n=Number(week);
 return !Number.isFinite(n)||n<1?'':n<=12?TERMS[0]:n<=24?TERMS[1]:TERMS[2];
};

// How far through the sheet the class should be by now, and how far it actually is.
// `taught` maps a lesson key to {date, by}. `currentWeek` is the school week the
// department says it is in; without one there is no expectation to compare against
// and coverage is reported without a verdict rather than with a guessed one.
export function coverage(lessons=[],taught={},{currentWeek=null}={}){
 const marked=k=>Boolean(taught&&taught[k]);
 const rows=lessons.map((lesson,i)=>({...lesson,key:lessonKey(lesson,i),index:i,
  taught:marked(lessonKey(lesson,i)),
  record:taught?.[lessonKey(lesson,i)]||null}));
 const done=rows.filter(r=>r.taught);
 const total=rows.length;

 const byTerm=TERMS.map(term=>{
  const list=rows.filter(r=>(r.term||termOfWeek(r.week))===term);
  return {key:term,total:list.length,taught:list.filter(r=>r.taught).length,
          rate:list.length?Math.round(list.filter(r=>r.taught).length/list.length*1000)/10:null};
 }).filter(t=>t.total);

 const weeks=[...new Set(rows.map(r=>+r.week).filter(Number.isFinite))].sort((a,b)=>a-b);
 const byWeek=weeks.map(week=>{
  const list=rows.filter(r=>+r.week===week);
  return {key:week,total:list.length,taught:list.filter(r=>r.taught).length,
          rate:Math.round(list.filter(r=>r.taught).length/list.length*1000)/10};
 });

 // Expected position: every lesson the sheet places on or before the current week.
 const expected=currentWeek?rows.filter(r=>Number.isFinite(+r.week)&&+r.week<=+currentWeek).length:null;
 const behind=expected===null?null:Math.max(0,expected-done.length);
 // Lessons the sheet says should already have been taught and which have not been.
 const outstanding=currentWeek
  ?rows.filter(r=>!r.taught&&Number.isFinite(+r.week)&&+r.week<=+currentWeek)
  :[];
 const next=rows.find(r=>!r.taught)||null;

 return {
  rows,total,taught:done.length,
  rate:total?Math.round(done.length/total*1000)/10:null,
  expected,behind,
  expectedRate:expected===null||!total?null:Math.round(expected/total*1000)/10,
  onTrack:expected===null?null:done.length>=expected,
  outstanding,next,byTerm,byWeek,
  currentWeek:currentWeek?+currentWeek:null,
  lastTaught:done.map(r=>r.record?.date).filter(Boolean).sort().at(-1)||''};
}

// The school week a date falls in, counting from the first day of the year's
// first term. Used to offer the department a sensible default rather than making
// them count weeks on a calendar.
export function schoolWeek(date,termStart){
 if(!date||!termStart)return null;
 const a=Date.parse(termStart+'T00:00:00Z'),b=Date.parse(date+'T00:00:00Z');
 if(!Number.isFinite(a)||!Number.isFinite(b)||b<a)return null;
 return Math.floor((b-a)/(7*86400000))+1;
}

// What the AI is asked to comment on. Built here rather than in the browser so the
// prompt is testable and never carries a student's name or any personal data —
// only lesson titles, weeks and counts.
export function coveragePrompt(report,{subject='',cls='',year=''}={}){
 const c=report;
 const lines=[
  `Progression review for ${subject} ${cls}, ${year}.`,
  `The scheme has ${c.total} lessons. ${c.taught} are marked taught (${c.rate ?? 0}%).`];
 if(c.currentWeek)lines.push(`The department says it is in week ${c.currentWeek}, by which the sheet expects ${c.expected} lessons to be done. That is ${c.behind?`${c.behind} behind`:'on or ahead of schedule'}.`);
 if(c.byTerm.length)lines.push('By term: '+c.byTerm.map(t=>`${t.key} ${t.taught}/${t.total}`).join('; ')+'.');
 if(c.outstanding.length){
  lines.push(`Lessons already due but not taught (${c.outstanding.length}):`);
  for(const r of c.outstanding.slice(0,25))lines.push(`- week ${r.week}${r.number?`, lesson ${r.number}`:''}: ${r.title}`);
  if(c.outstanding.length>25)lines.push(`- and ${c.outstanding.length-25} more.`);
 }
 if(c.next)lines.push(`The next untaught lesson is week ${c.next.week}${c.next.number?`, lesson ${c.next.number}`:''}: ${c.next.title}.`);
 lines.push('',
  'Write a short note for the head of department: where the subject stands, which lessons to prioritise to catch up, and anything that can reasonably be combined or taught together. Be specific about lesson titles. Do not invent lessons that are not listed above.');
 return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Importing a progression sheet the school supplies itself
// ---------------------------------------------------------------------------
// Departments whose sheet is not bundled paste or upload a table with these
// headings. Everything except the lesson title is optional, and a row without a
// title is skipped rather than imported as a blank lesson.
export const progressionColumns=['term','week','module','category','number','title','objectives'];
const alias={'lesson title':'title','lesson':'title','lesson no':'number','lesson number':'number',
             'category of action':'category','competency statement':'competency','objective':'objectives',
             'weeks':'week','terms':'term'};

export function parseProgressionRows(matrix){
 if(!Array.isArray(matrix)||!matrix.length)throw Error('The sheet is empty.');
 const headerAt=matrix.findIndex(row=>row.some(c=>/lesson\s*title|^title$/i.test(String(c||'').trim())));
 if(headerAt<0)throw Error('Add a heading row with at least a "Lesson title" column.');
 const heads=matrix[headerAt].map(c=>{
  const k=String(c||'').trim().toLowerCase();
  return alias[k]||k;
 });
 const lessons=[];
 for(const row of matrix.slice(headerAt+1)){
  if(!row.some(c=>String(c??'').trim()))continue;
  const d={};
  heads.forEach((h,i)=>{if(h)d[h]=String(row[i]??'').trim();});
  if(!d.title)continue;
  const week=Number(String(d.week||'').replace(/[^0-9]/g,''));
  lessons.push({
   term:d.term||termOfWeek(week),
   week:Number.isFinite(week)&&week>0?week:'',
   module:d.module||'',category:d.category||'',competency:d.competency||'',
   number:Number.isFinite(Number(d.number))&&d.number!==''?Number(d.number):null,
   title:d.title,
   objectives:String(d.objectives||'').split(/[\n;•]/).map(s=>s.trim()).filter(s=>s.length>4).slice(0,8)});
 }
 if(!lessons.length)throw Error('No lessons were found. Check that the rows below the heading have a lesson title.');
 return lessons;
}
