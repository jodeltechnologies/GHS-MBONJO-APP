import test from 'node:test';import assert from 'node:assert/strict';
import {lessonsFromPages,findAnchors,sheetHeading,describeImport,toLines} from '../src/progression-pdf.js';
import {termOfWeek} from '../src/department.js';
import fixture from './fixtures/progression-pages.json' with {type:'json'};
import sheets from '../api/data/progression.json' with {type:'json'};

// The fixture is the real positioned text from two pages of each of the two
// layouts these sheets come in: the national Form 1-5 sheet, whose rows are
// marked "Lesson 6:" inside the title column, and the Sixth Form sheet, which
// has a column of bare lesson numbers instead.

test('a national sheet is read from its lesson markers',()=>{
 const a=findAnchors(fixture.national);
 assert.ok(a.markers>5,`expected lesson markers, found ${a.markers}`);
 assert.equal(a.lessonNoX,null,'this layout has no lesson-number column');
 assert.ok(a.objectivesX>a.titleX,'objectives sit to the right of the titles');
});

test('a Sixth Form sheet is read from its lesson-number column',()=>{
 const a=findAnchors(fixture.sixth);
 assert.equal(a.markers,0,'this layout carries no "Lesson N:" text');
 assert.ok(Number.isFinite(a.lessonNoX),'the number column must be located');
 assert.ok(a.titleX>a.lessonNoX,'titles sit to the right of the numbers');
 assert.ok(a.objectivesX>a.titleX);
});

test('both layouts yield numbered lessons with titles and objectives',()=>{
 for(const [label,pages] of [['national',fixture.national],['sixth',fixture.sixth]]){
  const lessons=lessonsFromPages(pages);
  assert.ok(lessons.length>=5,`${label}: only ${lessons.length} lessons read`);
  assert.ok(lessons.every(l=>l.title&&l.title.length>2),`${label}: a lesson came back without a title`);
  assert.ok(lessons.some(l=>Number.isFinite(l.number)),`${label}: no lesson numbers`);
  assert.ok(lessons.some(l=>l.objectives.length),`${label}: no objectives`);
  // Lesson numbers must not go backwards: that is what a mis-read column looks like.
  const nums=lessons.map(l=>l.number).filter(Number.isFinite);
  assert.deepEqual(nums,nums.slice().sort((a,b)=>a-b),`${label}: lesson numbers out of order`);
 }
});

test('the header row and the ministry heading never become a lesson',()=>{
 for(const pages of [fixture.national,fixture.sixth]){
  for(const l of lessonsFromPages(pages)){
   assert.ok(!/republic|ministry|inspector|progression sheet|school year|weekly workload/i.test(l.title),
    `page furniture leaked into a lesson title: ${l.title}`);
   assert.ok(!/^(lesson title|objectives|resources|nature of lesson)$/i.test(l.title),
    `the header row became a lesson: ${l.title}`);
  }
 }
});

test('a lesson number is never mistaken for a week',()=>{
 // On the Sixth Form layout the number column sits left of the titles, where the
 // week also lives. Reading a lesson number as a week would push the term past
 // the end of the year.
 for(const l of lessonsFromPages(fixture.sixth)){
  if(l.week==='')continue;
  assert.ok(Number(l.week)>=1&&Number(l.week)<=45,`week ${l.week} is not a school week`);
  assert.equal(l.term,termOfWeek(l.week),'the term must follow the week');
 }
});

test('the sheet heading gives the title and the weekly workload',()=>{
 const h=sheetHeading(fixture.national[0]);
 assert.match(h.title,/PROGRESSION SHEET/i);
 assert.equal(h.weeklyPeriods,3,'Form 5 Computer Science is 3 periods a week');
 assert.equal(sheetHeading([]).title,'');
});

test('a file that is not a progression sheet is refused, not guessed at',()=>{
 assert.throws(()=>lessonsFromPages([[{str:'Dear parents',x:50,y:500,width:60,rotated:false},
                                      {str:'The school will close on Friday.',x:50,y:480,width:160,rotated:false}]]),
  /does not look like a progression sheet/);
 assert.throws(()=>lessonsFromPages([[]]),/does not look like a progression sheet/);
});

test('runs are grouped into lines by their baseline',()=>{
 const lines=toLines([
  {str:'b',x:200,y:500.0},{str:'a',x:100,y:500.4},{str:'c',x:50,y:480}]);
 assert.equal(lines.length,2);
 assert.deepEqual(lines[0].items.map(i=>i.str),['a','b'],'same line, left to right');
 assert.equal(lines[1].items[0].str,'c');
});

test('the import summary reports what a head of department needs to check',()=>{
 const d=describeImport(lessonsFromPages(fixture.national));
 assert.ok(d.lessons>0);
 assert.ok(d.numbered>0);
 assert.ok(d.withObjectives>0);
 assert.ok(d.firstWeek>=1);
 assert.deepEqual(describeImport([]),{lessons:0,numbered:0,withObjectives:0,terms:0,firstWeek:null,lastWeek:null});
});

// ---------------------------------------------------------------------------
// The sheets that ship with the app, read by this same parser
// ---------------------------------------------------------------------------
test('nine sheets ship, including Form 5',()=>{
 assert.equal(sheets.length,9);
 for(const cls of ['Form 1','Form 2','Form 3','Form 4','Form 5','Lower Sixth','Upper Sixth'])
  assert.ok(sheets.some(s=>s.subject==='Computer Science'&&s.class===cls),`Computer Science ${cls} is missing`);
 assert.ok(sheets.some(s=>s.subject==='ICT'&&s.class==='Lower Sixth'));
 assert.ok(sheets.some(s=>s.subject==='ICT'&&s.class==='Upper Sixth'));
});

test('every bundled sheet numbers its lessons from 1 without gaps or repeats',()=>{
 for(const s of sheets){
  const nums=s.lessons.map(l=>l.number).filter(Number.isFinite);
  const label=`${s.subject} ${s.class}`;
  assert.ok(nums.length>40,`${label}: only ${nums.length} numbered lessons`);
  assert.equal(nums[0],1,`${label}: numbering starts at ${nums[0]}`);
  assert.deepEqual(nums,nums.slice().sort((a,b)=>a-b),`${label}: numbering is not in order`);
  const max=Math.max(...nums),unique=new Set(nums);
  assert.ok(unique.size>=max-2,`${label}: ${max-unique.size} numbers repeat or are missing`);
 }
});

test('every bundled lesson has a term that matches its week',()=>{
 for(const s of sheets){
  assert.ok(s.weeklyPeriods>0,`${s.subject} ${s.class} has no weekly workload`);
  const terms=new Set(s.lessons.map(l=>l.term).filter(Boolean));
  assert.equal(terms.size,3,`${s.subject} ${s.class} covers ${terms.size} terms`);
  for(const l of s.lessons){
   assert.ok(l.title&&l.title.length>2);
   if(l.week!=='')assert.equal(l.term,termOfWeek(l.week),`${s.subject} ${s.class}: week ${l.week} filed as ${l.term}`);
  }
  const weeks=s.lessons.map(l=>Number(l.week)).filter(Number.isFinite);
  assert.deepEqual(weeks,weeks.slice().sort((a,b)=>a-b),`${s.subject} ${s.class}: weeks are not in order`);
  assert.ok(Math.max(...weeks)<=40);
 }
});
