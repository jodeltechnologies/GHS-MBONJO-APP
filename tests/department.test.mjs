import test from 'node:test';import assert from 'node:assert/strict';
import {canRead,canWrite,sameDepartment,inThread,staff} from '../src/access.js';
import {documentLibrary,canTransmit,inventorySummary,coverage,lessonKey,termOfWeek,weekInHand,
        coveragePrompt,parseProgressionRows,categoryLabels} from '../src/department.js';
import {validateRecord,documentCategories,itemCategories,classes} from '../src/domain.js';
import sheets from '../api/data/progression.json' with {type:'json'};

const P={
 principal:{id:'p1',role:'principal',name:'Principal'},
 vp:{id:'v1',role:'vp',name:'VP'},
 hodCS:{id:'h1',role:'hod',department:'Computer Science',name:'CS HOD'},
 teacherCS:{id:'t1',role:'teacher',department:'Computer Science',name:'CS Teacher'},
 hodMaths:{id:'h2',role:'hod',department:'Mathematics',name:'Maths HOD'},
 teacherMaths:{id:'t2',role:'teacher',department:'Mathematics',name:'Maths Teacher'},
 student:{id:'s1',role:'student',class:'Form 1A'},
 parent:{id:'r1',role:'parent',children:['s1']}};
const rec=(kind,data,id='x')=>({id,kind,data,version:1});

// ---------------------------------------------------------------------------
// Who may read what
// ---------------------------------------------------------------------------
test('a department document stays inside its department until it is transmitted',()=>{
 const draft=rec('dept_document',{department:'Computer Science',category:'minutes',title:'M',body:'b',status:'draft',transmitted:false});
 assert.equal(canRead(P.hodCS,draft,[]),true);
 assert.equal(canRead(P.teacherCS,draft,[]),true);
 assert.equal(canRead(P.principal,draft,[]),false,'the principal does not see an untransmitted department paper');
 assert.equal(canRead(P.vp,draft,[]),false);
 assert.equal(canRead(P.hodMaths,draft,[]),false,'another department never sees it');
 assert.equal(canRead(P.student,draft,[]),false);
 assert.equal(canRead(P.parent,draft,[]),false);
});

test('transmitting a document opens it to the administration and nobody else',()=>{
 const sent=rec('dept_document',{department:'Computer Science',category:'report',title:'R',body:'b',status:'signed',transmitted:true});
 assert.equal(canRead(P.principal,sent,[]),true);
 assert.equal(canRead(P.vp,sent,[]),true);
 assert.equal(canRead(P.hodCS,sent,[]),true);
 assert.equal(canRead(P.hodMaths,sent,[]),false,'another department still cannot read it');
 assert.equal(canRead(P.student,sent,[]),false);
});

test('a message is readable only by the people in it',()=>{
 const direct=rec('message',{scope:'direct',fromId:'t1',toId:'h1',body:'hello'});
 assert.equal(canRead(P.teacherCS,direct,[]),true);
 assert.equal(canRead(P.hodCS,direct,[]),true);
 assert.equal(canRead(P.principal,direct,[]),false,'the principal is not a party to a colleague note');
 assert.equal(canRead(P.vp,direct,[]),false);
 assert.equal(canRead(P.teacherMaths,direct,[]),false);

 const group=rec('message',{scope:'department',department:'Computer Science',fromId:'t1',body:'team'});
 assert.equal(canRead(P.teacherCS,group,[]),true);
 assert.equal(canRead(P.hodCS,group,[]),true);
 assert.equal(canRead(P.principal,group,[]),false);
 assert.equal(canRead(P.hodMaths,group,[]),false);
 assert.equal(canRead(P.student,group,[]),false);
 assert.equal(canRead(P.parent,group,[]),false);
});

test('a principal with a department of their own still cannot read another department',()=>{
 const withDept={...P.principal,department:'Mathematics'};
 const csDoc=rec('dept_document',{department:'Computer Science',category:'note',title:'n',body:'b',transmitted:false});
 const csChat=rec('message',{scope:'department',department:'Computer Science',fromId:'t1',body:'x'});
 assert.equal(canRead(withDept,csDoc,[]),false);
 assert.equal(canRead(withDept,csChat,[]),false);
 // their own department's chat is theirs, because they are in it
 const mathsChat=rec('message',{scope:'department',department:'Mathematics',fromId:'t2',body:'x'});
 assert.equal(canRead(withDept,mathsChat,[]),true);
});

test('equipment is always visible to the administration, unlike the documents',()=>{
 const item=rec('dept_item',{department:'Computer Science',name:'Desktop',category:'computer',quantity:12});
 assert.equal(canRead(P.principal,item,[]),true);
 assert.equal(canRead(P.vp,item,[]),true);
 assert.equal(canRead(P.hodCS,item,[]),true);
 assert.equal(canRead(P.teacherCS,item,[]),true);
 assert.equal(canRead(P.hodMaths,item,[]),false);
 assert.equal(canRead(P.student,item,[]),false);
});

test('progression is departmental, and visible to the administration',()=>{
 const p=rec('progression',{department:'Computer Science',subject:'Computer Science',class:'Form 1A',year:'2026/2027'});
 assert.equal(canRead(P.hodCS,p,[]),true);
 assert.equal(canRead(P.teacherCS,p,[]),true);
 assert.equal(canRead(P.principal,p,[]),true);
 assert.equal(canRead(P.hodMaths,p,[]),false);
 assert.equal(canRead(P.student,p,[]),false);
});

// ---------------------------------------------------------------------------
// Who may write what
// ---------------------------------------------------------------------------
test('only the head of department signs or transmits',()=>{
 const draft=rec('dept_document',{department:'Computer Science',category:'report',title:'R',body:'b',status:'draft',transmitted:false});
 const signed={...draft.data,status:'signed'};
 const sent={...draft.data,transmitted:true};
 assert.equal(canWrite(P.teacherCS,'dept_document',{...draft.data},draft,[]),true,'a member may edit a draft');
 assert.equal(canWrite(P.teacherCS,'dept_document',signed,draft,[]),false,'a member may not sign');
 assert.equal(canWrite(P.teacherCS,'dept_document',sent,draft,[]),false,'a member may not transmit');
 assert.equal(canWrite(P.hodCS,'dept_document',signed,draft,[]),true);
 assert.equal(canWrite(P.hodCS,'dept_document',sent,draft,[]),true);
 assert.equal(canWrite(P.hodMaths,'dept_document',signed,draft,[]),false);
});

test('the principal cannot write a department document or somebody else’s message',()=>{
 const doc={department:'Computer Science',category:'minutes',title:'M',body:'b'};
 assert.equal(canWrite(P.principal,'dept_document',doc,null,[]),false,'writing a department’s minutes would be a forgery');
 assert.equal(canWrite(P.principal,'message',{scope:'direct',fromId:'t1',toId:'h1',body:'x'},null,[]),false);
 // and cannot impersonate: a message must come from the person sending it
 assert.equal(canWrite(P.hodCS,'message',{scope:'direct',fromId:'t1',toId:'h2',body:'x'},null,[]),false);
 assert.equal(canWrite(P.hodCS,'message',{scope:'direct',fromId:'h1',toId:'t1',body:'x'},null,[]),true);
});

test('a message cannot be edited after it is sent',()=>{
 const sent=rec('message',{scope:'direct',fromId:'h1',toId:'t1',body:'original'});
 assert.equal(canWrite(P.hodCS,'message',{...sent.data,body:'rewritten'},sent,[]),false);
});

test('a department group message must be to the sender’s own department',()=>{
 assert.equal(canWrite(P.hodCS,'message',{scope:'department',department:'Computer Science',fromId:'h1',body:'x'},null,[]),true);
 assert.equal(canWrite(P.hodCS,'message',{scope:'department',department:'Mathematics',fromId:'h1',body:'x'},null,[]),false);
});

test('only the head of department keeps the equipment list',()=>{
 const item={department:'Computer Science',name:'Printer',category:'printer',quantity:1};
 assert.equal(canWrite(P.hodCS,'dept_item',item,null,[]),true);
 assert.equal(canWrite(P.teacherCS,'dept_item',item,null,[]),false);
 assert.equal(canWrite(P.hodMaths,'dept_item',item,null,[]),false);
});

test('a record cannot be moved into another department by editing it',()=>{
 const mine=rec('dept_document',{department:'Computer Science',category:'note',title:'n',body:'b'});
 assert.equal(canWrite(P.hodCS,'dept_document',{...mine.data,department:'Mathematics'},mine,[]),false);
 const item=rec('dept_item',{department:'Computer Science',name:'X',category:'other'});
 assert.equal(canWrite(P.hodCS,'dept_item',{...item.data,department:'Mathematics'},item,[]),false);
});

test('sameDepartment and inThread do not treat a missing department as a match',()=>{
 assert.equal(sameDepartment({department:''},{department:''}),false);
 assert.equal(sameDepartment({department:'Physics'},{}),false);
 assert.equal(inThread({id:'a'},{scope:'department',department:''}),false);
 assert.equal(staff(P.student),false);
 assert.equal(staff(P.parent),false);
 assert.equal(staff(P.hodCS),true);
});

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------
test('department records are validated before they are stored',()=>{
 assert.throws(()=>validateRecord('dept_document',{department:'CS',category:'poem',title:'t',body:'b'}),/Report, Minutes, Letter or Note/);
 assert.throws(()=>validateRecord('dept_item',{department:'CS',name:'PC',category:'spaceship'}),/valid equipment category/);
 assert.throws(()=>validateRecord('dept_item',{department:'CS',name:'PC',category:'computer',quantity:0}),/between 1 and 9,999/);
 assert.throws(()=>validateRecord('message',{scope:'direct',fromId:'a',body:'hi'}),/Choose a colleague/);
 assert.throws(()=>validateRecord('message',{scope:'shout',fromId:'a',body:'hi'}),/department or to one colleague/);
 assert.throws(()=>validateRecord('message',{scope:'department',fromId:'a',body:'   '}),/body is required|Write a message first/);
 const ok=validateRecord('dept_item',{department:'CS',name:'PC',category:'computer',quantity:'12'});
 assert.equal(ok.quantity,12,'a quantity typed as text is stored as a number');
});

// ---------------------------------------------------------------------------
// The document library
// ---------------------------------------------------------------------------
test('the library groups by category, newest first, and keeps empty drawers',()=>{
 const docs=[
  rec('dept_document',{category:'minutes',title:'Old',date:'2026-01-05'},'1'),
  rec('dept_document',{category:'minutes',title:'New',date:'2026-09-05'},'2'),
  rec('dept_document',{category:'report',title:'R',date:'2026-05-05',status:'signed',transmitted:true},'3')];
 const lib=documentLibrary(docs);
 assert.deepEqual(Object.keys(lib.byCategory),documentCategories);
 assert.deepEqual(lib.byCategory.minutes.map(d=>d.data.title),['New','Old']);
 assert.deepEqual(lib.byCategory.letter,[]);
 assert.equal(lib.total,3);assert.equal(lib.signed,1);assert.equal(lib.transmitted,1);assert.equal(lib.drafts,2);
 assert.equal(categoryLabels.minutes,'Minutes');
});

test('only a signed document may be transmitted',()=>{
 assert.equal(canTransmit({status:'draft'}),false);
 assert.equal(canTransmit({status:'signed'}),true);
 assert.equal(canTransmit({status:'signed',transmitted:true}),false,'once sent, it is not sent again');
});

// ---------------------------------------------------------------------------
// Equipment
// ---------------------------------------------------------------------------
test('the inventory counts items, not rows',()=>{
 const items=[
  rec('dept_item',{name:'Desktop',category:'computer',quantity:20,condition:'working'}),
  rec('dept_item',{name:'Old desktop',category:'computer',quantity:5,condition:'needs repair'}),
  rec('dept_item',{name:'Printer',category:'printer',quantity:2,condition:'out of service'}),
  rec('dept_item',{name:'Router',category:'network'})];
 const s=inventorySummary(items);
 assert.equal(s.rows,4);
 assert.equal(s.items,28,'20 + 5 + 2 + one router with no quantity');
 assert.equal(s.working,21,'a row with no condition counts as working');
 assert.equal(s.faulty,5);
 assert.equal(s.dead,2);
 assert.deepEqual(s.byCategory.map(c=>[c.key,c.items]),[['computer',25],['printer',2],['network',1]]);
});

// ---------------------------------------------------------------------------
// Coverage
// ---------------------------------------------------------------------------
const lessons=[
 {term:'First Term',week:1,number:1,title:'Intro'},
 {term:'First Term',week:2,number:2,title:'Hardware'},
 {term:'First Term',week:3,number:3,title:'Software'},
 {term:'Second Term',week:13,number:4,title:'Networks'},
 {term:'Third Term',week:25,number:5,title:'Revision'}];
const keyAt=i=>lessonKey(lessons[i],i);

test('coverage counts what is marked and compares it with the week',()=>{
 const taught={[keyAt(0)]:{date:'2026-09-10',by:'t1'},[keyAt(1)]:{date:'2026-09-17',by:'t1'}};
 const c=coverage(lessons,taught,{currentWeek:3});
 assert.equal(c.total,5);
 assert.equal(c.taught,2);
 assert.equal(c.rate,40);
 assert.equal(c.expected,3,'weeks 1, 2 and 3 are due by week 3');
 assert.equal(c.behind,1);
 assert.equal(c.onTrack,false);
 assert.deepEqual(c.outstanding.map(r=>r.title),['Software']);
 assert.equal(c.next.title,'Software');
 assert.equal(c.lastTaught,'2026-09-17');
});

test('with no current week there is no verdict rather than a guessed one',()=>{
 const c=coverage(lessons,{},{});
 assert.equal(c.expected,null);
 assert.equal(c.behind,null);
 assert.equal(c.onTrack,null);
 assert.deepEqual(c.outstanding,[]);
});

test('a department ahead of the sheet is reported as on track',()=>{
 const taught=Object.fromEntries([0,1,2,3].map(i=>[keyAt(i),{date:'2026-10-01'}]));
 const c=coverage(lessons,taught,{currentWeek:3});
 assert.equal(c.behind,0);
 assert.equal(c.onTrack,true);
});

test('coverage splits by term and by week',()=>{
 const c=coverage(lessons,{[keyAt(0)]:{date:'2026-09-10'}},{currentWeek:1});
 assert.deepEqual(c.byTerm.map(t=>[t.key,t.taught,t.total]),
  [['First Term',1,3],['Second Term',0,1],['Third Term',0,1]]);
 assert.equal(c.byWeek[0].rate,100);
 assert.equal(c.byWeek[1].rate,0);
});

test('a lesson key survives two lessons sharing a title',()=>{
 const same=[{week:1,title:'Revision'},{week:20,title:'Revision'}];
 assert.notEqual(lessonKey(same[0],0),lessonKey(same[1],1));
 const c=coverage(same,{[lessonKey(same[0],0)]:{date:'2026-09-10'}},{});
 assert.equal(c.rows[0].taught,true);
 assert.equal(c.rows[1].taught,false,'marking one must not mark the other');
});

test('terms follow the week, as every supplied sheet does',()=>{
 assert.equal(termOfWeek(1),'First Term');
 assert.equal(termOfWeek(12),'First Term');
 assert.equal(termOfWeek(13),'Second Term');
 assert.equal(termOfWeek(24),'Second Term');
 assert.equal(termOfWeek(25),'Third Term');
 assert.equal(termOfWeek(''),'','a blank week has no term — Number(\'\') is 0, which would otherwise read as First Term');
 assert.equal(termOfWeek(null),'');
 assert.equal(termOfWeek(0),'');
 assert.equal(termOfWeek('7'),'First Term');
 });

test('the week a scheme is measured against comes from the ministry calendar',()=>{
 // The year opens on 7 September 2026, so the third week of teaching is week 3.
 assert.equal(weekInHand({year:'2026/2027'},'2026-09-21'),3);
 assert.equal(weekInHand({year:'2026/2027'},'2026-09-07'),1);
 // Counting days since September would make 11 January week 19. The calendar
 // knows about the three weeks of Christmas holiday: it is week 17.
 assert.equal(weekInHand({year:'2026/2027'},'2027-01-11'),17);
 // Nothing is due before the year opens.
 assert.equal(weekInHand({year:'2026/2027'},'2026-08-31'),null);
 // A year the calendar does not carry falls back to what was typed in.
 assert.equal(weekInHand({year:'2030/2031',currentWeek:9},'2026-09-21'),9);
 assert.equal(weekInHand({year:'2030/2031'},'2026-09-21'),null);
 // A week entered by hand wins over the calendar, for a department reviewing
 // an earlier week.
 assert.equal(weekInHand({year:'2026/2027',weekOverride:5},'2026-09-21'),5);
 assert.equal(weekInHand({year:'2026/2027',weekOverride:''},'2026-09-21'),3,'a blank override is not week zero');
});

test('the AI prompt carries counts and lesson titles, and no personal data',()=>{
 const c=coverage(lessons,{[keyAt(0)]:{date:'2026-09-10',by:'t1'}},{currentWeek:13});
 const prompt=coveragePrompt(c,{subject:'Computer Science',cls:'Form 1A',year:'2026/2027'});
 assert.match(prompt,/Computer Science Form 1A/);
 assert.match(prompt,/1 are marked taught/);
 assert.match(prompt,/Hardware/);
 assert.match(prompt,/Do not invent lessons/);
 assert.ok(!prompt.includes('t1'),'the teacher id is not sent to the AI provider');
});

// ---------------------------------------------------------------------------
// Importing a sheet
// ---------------------------------------------------------------------------
test('an imported sheet is read from its headings, in any order',()=>{
 const matrix=[
  ['2026-2027 progression'],
  ['Week','Lesson no','Lesson title','Objectives','Category of action'],
  ['1','1','Introduction','Define terms; List examples','Exploring'],
  ['','','',''],
  ['13','2','Networks','Explain topologies','Connecting']];
 const out=parseProgressionRows(matrix);
 assert.equal(out.length,2,'the blank row is skipped');
 assert.equal(out[0].title,'Introduction');
 assert.equal(out[0].number,1);
 assert.equal(out[0].term,'First Term','the term is derived from the week');
 assert.deepEqual(out[0].objectives,['Define terms','List examples']);
 assert.equal(out[1].term,'Second Term');
});

test('an import without a lesson title column is refused with a reason',()=>{
 assert.throws(()=>parseProgressionRows([['Week','Topic'],['1','Something']]),/Lesson title/);
 assert.throws(()=>parseProgressionRows([]),/empty/);
 assert.throws(()=>parseProgressionRows([['Lesson title'],['']]),/No lessons were found/);
});

// ---------------------------------------------------------------------------
// The bundled sheets
// ---------------------------------------------------------------------------
test('the supplied progression sheets are usable as shipped',()=>{
 assert.equal(sheets.length,9,'Form 5 was added alongside the original eight');
 for(const s of sheets){
  assert.ok(s.subject&&s.class,'every sheet names its subject and class');
  assert.ok(s.lessons.length>50,`${s.subject} ${s.class} has only ${s.lessons.length} lessons`);
  assert.ok(s.lessons.every(l=>l.title&&l.title.length>2),'every lesson has a title');
  const terms=new Set(s.lessons.map(l=>l.term).filter(Boolean));
  assert.equal(terms.size,3,`${s.subject} ${s.class} should cover three terms`);
  // A lesson printed above the first week number on the sheet has no week, and
  // so no term. That is honest, but it should be a handful at most.
  const undated=s.lessons.filter(l=>!l.term).length;
  assert.ok(undated<=3,`${s.subject} ${s.class}: ${undated} lessons have no week`);
  const weeks=s.lessons.map(l=>l.week).filter(Number.isFinite);
  assert.ok(Math.min(...weeks)>=1&&Math.max(...weeks)<=40);
  // the term always agrees with the week
  for(const l of s.lessons)if(Number.isFinite(l.week))assert.equal(l.term,termOfWeek(l.week));
 }
 assert.ok(sheets.some(s=>s.subject==='ICT'));
 assert.ok(sheets.some(s=>s.subject==='Computer Science'&&s.class==='Form 1'));
 assert.ok(sheets.some(s=>s.subject==='Computer Science'&&s.class==='Form 5'));
});

test('a bundled sheet can be tracked and marked end to end',()=>{
 const sheet=sheets.find(s=>s.subject==='Computer Science'&&s.class==='Form 1');
 const taught={};
 sheet.lessons.slice(0,10).forEach((l,i)=>{taught[lessonKey(l,i)]={date:'2026-10-01',by:'h1'};});
 const c=coverage(sheet.lessons,taught,{currentWeek:12});
 assert.equal(c.taught,10);
 assert.ok(c.total>=60);
 assert.ok(c.expected>10,'by week 12 more than ten lessons are due');
 assert.ok(c.behind>0);
 assert.ok(c.outstanding.length>0);
 assert.ok(c.next&&c.next.title);
});
