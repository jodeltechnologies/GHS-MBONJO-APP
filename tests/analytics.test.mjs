import test from 'node:test';import assert from 'node:assert/strict';
import {attendanceReport,resultsReport,coverageReport,schoolAnalytics,weekStart,inRange,PASS_MARK} from '../src/analytics.js';
import {barChart,columnChart,lineChart,statTile,figureTable} from '../src/charts.js';

const att=(studentId,date,status,extra={})=>({studentId,date,status,class:'Form 1A',subject:'Mathematics',assignmentId:'a1',...extra});
const student=(id,name,cls='Form 1A',gender='Female')=>({id,data:{name,class:cls,gender}});

// ---------------------------------------------------------------------------
// Attendance
// ---------------------------------------------------------------------------
test('the rate counts late as attended and leaves excused out entirely',()=>{
 // 4 present, 1 late, 3 absent, 2 excused -> 5 of 8 counted = 62.5%
 const rows=[...Array(4)].map((_,i)=>att('s1','2026-09-07','present'))
  .concat(att('s1','2026-09-08','late'))
  .concat([...Array(3)].map(()=>att('s1','2026-09-09','absent')))
  .concat([...Array(2)].map(()=>att('s1','2026-09-10','excused')));
 const r=attendanceReport(rows);
 assert.equal(r.overall.total,10);
 assert.equal(r.overall.counted,8,'excused absences are not counted either way');
 assert.equal(r.overall.rate,62.5);
 assert.equal(r.overall.excused,2);
});

test('a class with no records has no rate, not a rate of zero',()=>{
 const r=attendanceReport([]);
 assert.equal(r.overall.rate,null,'no data must never read as 0%');
 assert.equal(r.overall.counted,0);
 assert.deepEqual(r.byClass,[]);
 assert.deepEqual(r.watchlist,[]);
});

test('an unknown status is ignored rather than counted',()=>{
 const r=attendanceReport([att('s1','2026-09-07','present'),att('s1','2026-09-08','on strike'),att('s1','2026-09-09','absent')]);
 assert.equal(r.overall.total,2);
 assert.equal(r.overall.rate,50);
});

test('only dates inside the range are counted',()=>{
 const rows=[att('s1','2026-09-01','absent'),att('s1','2026-09-15','present'),att('s1','2026-10-01','absent')];
 const r=attendanceReport(rows,{from:'2026-09-10',to:'2026-09-20'});
 assert.equal(r.overall.counted,1);
 assert.equal(r.overall.rate,100);
});

test('the week of a date is its Monday, whatever day it falls on',()=>{
 assert.equal(weekStart('2026-09-07'),'2026-09-07');  // a Monday
 assert.equal(weekStart('2026-09-11'),'2026-09-07');  // the Friday of that week
 assert.equal(weekStart('2026-09-13'),'2026-09-07');  // the Sunday
 assert.equal(weekStart('2026-09-14'),'2026-09-14');  // the next Monday
 assert.equal(weekStart('not a date'),null);
 assert.ok(inRange('2026-09-12','2026-09-01','2026-09-30'));
 assert.ok(!inRange('2026-10-01','2026-09-01','2026-09-30'));
 assert.ok(inRange('2026-10-01','',''));
});

test('attendance splits by class, weekday and gender',()=>{
 const rows=[
  att('s1','2026-09-07','present'),att('s2','2026-09-07','absent'),                     // Monday, Form 1A
  att('s3','2026-09-08','present',{class:'Form 1B'}),att('s3','2026-09-08','present',{class:'Form 1B'})]; // Tuesday, Form 1B
 const students=[student('s1','Ada'),student('s2','Bob','Form 1A','Male'),student('s3','Cara','Form 1B')];
 const r=attendanceReport(rows,{students});
 assert.deepEqual(r.byClass.map(x=>[x.key,x.rate]),[['Form 1A',50],['Form 1B',100]]);
 const monday=r.byWeekday.find(d=>d.key==='Monday'),tuesday=r.byWeekday.find(d=>d.key==='Tuesday');
 assert.equal(monday.rate,50);
 assert.equal(tuesday.rate,100);
 assert.equal(r.byWeekday.find(d=>d.key==='Friday').rate,null,'a day with no lessons has no rate');
 assert.deepEqual(r.byGender.map(x=>[x.key,x.rate]),[['Female',100],['Male',0]]);
});

test('the watchlist names the worst first and ignores students with too few lessons',()=>{
 const rows=[];
 for(let i=0;i<10;i++)rows.push(att('low','2026-09-'+String(7+i).padStart(2,'0'),i<3?'present':'absent'));  // 30%
 for(let i=0;i<10;i++)rows.push(att('mid','2026-09-'+String(7+i).padStart(2,'0'),i<7?'present':'absent'));  // 70%
 for(let i=0;i<10;i++)rows.push(att('ok','2026-09-'+String(7+i).padStart(2,'0'),'present'));                // 100%
 rows.push(att('new','2026-09-07','absent'));                                                               // 1 lesson only
 const students=[student('low','Low One'),student('mid','Mid One'),student('ok','Fine One'),student('new','New One')];
 const r=attendanceReport(rows,{students,watchBelow:80,minLessons:5});
 assert.deepEqual(r.watchlist.map(s=>s.name),['Low One','Mid One']);
 assert.equal(r.watchlist[0].rate,30);
 assert.equal(r.watchlist[0].absent,7);
 assert.equal(r.watchlist[0].class,'Form 1A');
 assert.ok(!r.watchlist.some(s=>s.name==='New One'),'one lesson is not evidence of anything');
});

test('the period of a lesson is read from the timetable, and never guessed',()=>{
 const timetableEntries=[
  {class:'Form 1A',subject:'Mathematics',day:'Monday',start:450,end:500,teacherId:'t1'},
  {class:'Form 1A',subject:'Biology',day:'Monday',start:830,end:880,teacherId:'t2'},
  // Chemistry sits twice on the same Monday, so its attendance cannot be pinned to one period
  {class:'Form 1A',subject:'Chemistry',day:'Monday',start:500,end:550,teacherId:'t3'},
  {class:'Form 1A',subject:'Chemistry',day:'Monday',start:730,end:780,teacherId:'t3'}];
 const rows=[
  att('s1','2026-09-07','present'),                                      // Maths, period 1
  att('s1','2026-09-07','absent',{subject:'Biology'}),                   // period 8
  att('s1','2026-09-07','absent',{subject:'Chemistry'})];                // ambiguous
 const r=attendanceReport(rows,{timetableEntries});
 const p1=r.byPeriod.find(x=>x.key===1),p8=r.byPeriod.find(x=>x.key===8);
 assert.equal(p1.rate,100);
 assert.equal(p8.rate,0);
 assert.equal(r.byPeriod.reduce((n,x)=>n+x.counted,0),2,'the ambiguous lesson is left out');
});

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------
const mark=(studentId,subject,value,extra={})=>({studentId,subject,mark:value,class:'Form 1A',year:'2026/2027',assessment:'Sequence 1',status:'published',coefficient:1,...extra});

test('only published marks are summarised',()=>{
 const r=resultsReport([mark('s1','Mathematics',16),mark('s2','Mathematics',2,{status:'draft'})]);
 assert.equal(r.overall.count,1);
 assert.equal(r.overall.average,16);
});

test('average, pass rate and extremes are computed over valid marks only',()=>{
 const marks=[mark('s1','Mathematics',10),mark('s2','Mathematics',15),mark('s3','Mathematics',5),
              mark('s4','Mathematics',''),mark('s5','Mathematics',99)];
 const r=resultsReport(marks);
 assert.equal(r.overall.count,3,'blank and out-of-range marks are dropped, not zeroed');
 assert.equal(r.overall.average,10);
 assert.equal(r.overall.passRate,66.7);   // 10 and 15 pass, 5 does not
 assert.equal(r.overall.highest,15);
 assert.equal(r.overall.lowest,5);
 assert.equal(PASS_MARK,10);
});

test('subjects are ranked and the distribution bands add up',()=>{
 const marks=[mark('s1','Mathematics',4),mark('s2','Mathematics',6),
              mark('s3','Biology',18),mark('s4','Biology',14)];
 const r=resultsReport(marks);
 assert.deepEqual(r.bySubject.map(s=>[s.key,s.average]),[['Biology',16],['Mathematics',5]]);
 assert.equal(r.bySubject.find(s=>s.key==='Mathematics').passRate,0);
 assert.equal(r.distribution.reduce((n,b)=>n+b.count,0),4);
 assert.equal(r.distribution.find(b=>b.key==='0–5').count,1);
 assert.equal(r.distribution.find(b=>b.key==='16–20').count,1);
});

test('a mark of exactly 20 lands in the top band rather than nowhere',()=>{
 const r=resultsReport([mark('s1','Mathematics',20)]);
 assert.equal(r.distribution.reduce((n,b)=>n+b.count,0),1);
 assert.equal(r.distribution.at(-1).count,1);
});

test('sequences are reported in order so progress can be read',()=>{
 const marks=[mark('s1','Mathematics',8,{assessment:'Sequence 1'}),
              mark('s1','Mathematics',12,{assessment:'Sequence 2'}),
              mark('s1','Mathematics',16,{assessment:'Sequence 10'})];
 const r=resultsReport(marks,{year:'2026/2027'});
 assert.deepEqual(r.sequences.map(s=>[s.key,s.average]),
  [['Sequence 1',8],['Sequence 2',12],['Sequence 10',16]]);
});

test('no published marks gives empty figures, not zeros',()=>{
 const r=resultsReport([]);
 assert.equal(r.overall.count,0);
 assert.equal(r.overall.average,null);
 assert.equal(r.overall.passRate,null);
});

// ---------------------------------------------------------------------------
// Roll-call coverage
// ---------------------------------------------------------------------------
test('coverage counts only the days the school actually recorded something',()=>{
 const timetableEntries=[
  {class:'Form 1A',subject:'Mathematics',day:'Monday',start:450,end:500,teacherId:'t1'},
  {class:'Form 1A',subject:'Biology',day:'Monday',start:830,end:880,teacherId:'t2'}];
 // Monday 7 and Monday 14 September. On the 7th only Maths was taken; the 14th
 // has a Biology roll call. Monday 21 has nothing at all, so it is not a school day.
 const attendance=[
  {class:'Form 1A',subject:'Mathematics',date:'2026-09-07',status:'present',studentId:'s1',assignmentId:'a1'},
  {class:'Form 1A',subject:'Biology',date:'2026-09-14',status:'present',studentId:'s1',assignmentId:'a2'}];
 const c=coverageReport(attendance,timetableEntries,{from:'2026-09-01',to:'2026-09-30',
  assignments:[{id:'a1',data:{subject:'Mathematics'}},{id:'a2',data:{subject:'Biology'}}],
  nameFor:id=>({t1:'Ada Teacher',t2:'Bob Teacher'}[id]||'')});
 assert.equal(c.schoolDays,2,'only the two days with records count as school days');
 assert.equal(c.expected,4,'two lessons on each of the two Mondays');
 assert.equal(c.taken,2);
 assert.equal(c.missed,2);
 assert.equal(c.rate,50);
 assert.deepEqual(c.byTeacher.map(x=>[x.name,x.taken,x.expected]).sort(),
  [['Ada Teacher',1,2],['Bob Teacher',1,2]]);
});

test('a double period is one roll call, not two missed ones',()=>{
 const timetableEntries=[
  {class:'Form 1A',subject:'Mathematics',day:'Monday',start:450,end:500,teacherId:'t1'},
  {class:'Form 1A',subject:'Mathematics',day:'Monday',start:500,end:550,teacherId:'t1'}];
 const attendance=[{class:'Form 1A',subject:'Mathematics',date:'2026-09-07',status:'present',studentId:'s1',assignmentId:'a1'}];
 const c=coverageReport(attendance,timetableEntries,{assignments:[{id:'a1',data:{subject:'Mathematics'}}]});
 assert.equal(c.expected,1);
 assert.equal(c.taken,1);
 assert.equal(c.rate,100);
});

test('coverage with no timetable reports nothing rather than a false zero',()=>{
 const c=coverageReport([{class:'Form 1A',date:'2026-09-07',status:'present',studentId:'s1'}],[],{});
 assert.equal(c.expected,0);
 assert.equal(c.rate,null);
 assert.deepEqual(c.byTeacher,[]);
});

// ---------------------------------------------------------------------------
// The whole report, and the scoping it depends on
// ---------------------------------------------------------------------------
test('schoolAnalytics returns all three sections from one call',()=>{
 const report=schoolAnalytics({
  attendance:[att('s1','2026-09-07','present'),att('s1','2026-09-08','absent')],
  marks:[mark('s1','Mathematics',14)],
  students:[student('s1','Ada')],
  timetableEntries:[{class:'Form 1A',subject:'Mathematics',day:'Monday',start:450,end:500,teacherId:'t1'}],
  from:'2026-09-01',to:'2026-09-30',year:'2026/2027'});
 assert.equal(report.attendance.overall.rate,50);
 assert.equal(report.results.overall.average,14);
 assert.equal(report.coverage.schoolDays,2);
 assert.deepEqual(report.range,{from:'2026-09-01',to:'2026-09-30',year:'2026/2027',assessment:''});
});

test('figures are built only from the rows handed in, so a filtered caller gets a filtered report',()=>{
 // This is how a teacher's scope works: the API filters rows through canRead and
 // the aggregation never sees another class at all.
 const all=[att('s1','2026-09-07','present'),att('s2','2026-09-07','absent',{class:'Form 5B'})];
 const mine=all.filter(r=>r.class==='Form 1A');
 const r=attendanceReport(mine,{students:[student('s1','Ada')]});
 assert.deepEqual(r.byClass.map(x=>x.key),['Form 1A']);
 assert.equal(r.overall.rate,100);
});

// ---------------------------------------------------------------------------
// Charts
// ---------------------------------------------------------------------------
test('charts render valid shapes and mark values below the target',()=>{
 const svg=barChart([{key:'Form 1A',value:95},{key:'Form 1B',value:60}],{target:80});
 assert.ok(svg.startsWith('<svg')&&svg.endsWith('</svg>'));
 assert.ok(svg.includes('#0a7a55'),'the passing bar uses the data hue');
 assert.ok(svg.includes('#d03b3b'),'the failing bar is marked');
 assert.ok(svg.includes('>95%<')&&svg.includes('>60%<'),'every bar carries its figure, so colour never has to carry it alone');
 assert.ok(svg.includes('<title>'),'each bar has a hover label');
});

test('charts say so instead of drawing an empty frame',()=>{
 assert.ok(barChart([],{}).includes('chart-empty'));
 assert.ok(columnChart([],{}).includes('chart-empty'));
 assert.ok(lineChart([{key:'a',value:1}],{}).includes('chart-empty'),'one point is not a trend');
 assert.ok(barChart([{key:'x',value:null}],{}).includes('chart-empty'),'a missing value is not a zero bar');
});

test('chart labels and values are escaped, not injected',()=>{
 const svg=barChart([{key:'<script>alert(1)</script>',value:50}],{});
 assert.ok(!svg.includes('<script>'));
 assert.ok(svg.includes('&lt;script'));
});

test('a stat tile shows a dash when there is nothing to show',()=>{
 assert.ok(statTile('Attendance',null,{unit:'%'}).includes('—'));
 assert.ok(statTile('Attendance',91.4,{unit:'%'}).includes('91.4%'));
 assert.equal(figureTable([]),'','an empty table is not rendered at all');
});

test('the line chart labels only the ends and the worst point',()=>{
 const rows=[{key:'w1',value:90},{key:'w2',value:60},{key:'w3',value:85},{key:'w4',value:88}];
 const svg=lineChart(rows,{});
 const labelled=(svg.match(/class="c-value"/g)||[]).length;
 assert.equal(labelled,3,'first, last and worst — not a number on every point');
 assert.ok(svg.includes('stroke-width="2"'),'2px line');
});
