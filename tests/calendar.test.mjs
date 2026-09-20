import test from 'node:test';import assert from 'node:assert/strict';
import {calendar,schoolWeek,currentWeek,weekRange,termWeeks,knownYear,YEARS} from '../src/calendar.js';
import {termOfWeek} from '../src/department.js';

// The 2026/2027 year as the joint order sets it out. These are the facts the
// whole progression section rests on, so they are checked against the order
// rather than against the code that reads them.

test('the year opens on Monday 7 September 2026 and runs 36 weeks',()=>{
 const c=calendar('2026/2027');
 assert.equal(c.opens,'2026-09-07');
 assert.equal(c.closes,'2027-07-30');
 assert.equal(c.weeks,36,'Article 8 fixes the year at 36 working weeks');
 assert.equal(new Date(c.opens+'T00:00:00Z').getUTCDay(),1,'the year opens on a Monday');
 for(const b of c.blocks){
  assert.equal(new Date(b.from+'T00:00:00Z').getUTCDay(),1,`${b.from} should be a Monday`);
  assert.ok(b.weeks>0);
 }
});

test('the three terms are twelve weeks each, as the sheets assume',()=>{
 const terms=termWeeks('2026/2027');
 assert.deepEqual(terms.map(x=>x.term),['First Term','Second Term','Third Term']);
 for(const x of terms)assert.equal(x.weeks,12,`${x.term} is ${x.weeks} weeks`);
 assert.deepEqual(terms.map(x=>[x.firstWeek,x.lastWeek]),[[1,12],[13,24],[25,36]]);
 // The sheets file lessons by week number; the two must agree or a lesson lands
 // in the wrong term.
 for(const x of terms){
  assert.equal(termOfWeek(x.firstWeek),x.term);
  assert.equal(termOfWeek(x.lastWeek),x.term);
 }
});

test('a date is placed in the week the school is actually in',()=>{
 assert.equal(schoolWeek('2026-09-07').week,1);
 assert.equal(schoolWeek('2026-09-11').week,1,'Friday of the first week');
 assert.equal(schoolWeek('2026-09-14').week,2);
 assert.equal(schoolWeek('2026-11-27').week,12,'the last day of the First Term');
 assert.equal(schoolWeek('2026-11-30').week,13,'the Second Term opens the following Monday');
 assert.equal(schoolWeek('2026-11-30').term,'Second Term');
});

test('the Christmas and Easter holidays are not counted as teaching weeks',()=>{
 // Three weeks of holiday sit between 18 December and 4 January. Counting days
 // since September would call 11 January week 19; it is week 16.
 assert.equal(schoolWeek('2027-01-04').week,16);
 assert.equal(schoolWeek('2027-01-11').week,17);
 // Likewise after the second holiday: teaching resumes on 12 April at week 28.
 assert.equal(schoolWeek('2027-04-12').week,28);
 assert.equal(schoolWeek('2027-06-11').week,36,'the last taught week of the year');
});

test('a holiday is reported as a holiday, not given a week number',()=>{
 const s=schoolWeek('2026-12-28');
 assert.equal(s.status,'holiday');
 assert.equal(s.week,null);
 assert.equal(s.lastWeek,15,'week 15 was the last one taught');
 assert.equal(s.nextWeek,16);
 assert.equal(s.resumesOn,'2027-01-04');
});

test('nothing is behind before the year opens',()=>{
 assert.equal(schoolWeek('2026-08-30').status,'before');
 assert.equal(currentWeek('2026-08-30'),null);
 // In a holiday the school is measured against the last week taught: a week that
 // has not started cannot already be late.
 assert.equal(currentWeek('2026-12-28'),15);
 assert.equal(currentWeek('2026-09-08'),1);
 assert.equal(currentWeek('2027-08-01'),36,'after the year closes the whole sheet is due');
});

test('a week number can be turned back into its dates',()=>{
 assert.deepEqual(weekRange(1),{week:1,term:'First Term',from:'2026-09-07',to:'2026-09-11'});
 assert.deepEqual(weekRange(16),{week:16,term:'Second Term',from:'2027-01-04',to:'2027-01-08'});
 // Week 27 is the short one that ends on Thursday 25 March, when the order
 // closes that block.
 assert.deepEqual(weekRange(27),{week:27,term:'Third Term',from:'2027-03-22',to:'2027-03-25'});
 assert.equal(weekRange(37),null);
 assert.equal(weekRange(0),null);
 // Every week must map to dates, and back to the same week.
 for(let w=1;w<=36;w++){
  const r=weekRange(w);
  assert.ok(r,`week ${w} has no dates`);
  assert.equal(schoolWeek(r.from).week,w);
  assert.equal(schoolWeek(r.to).week,w);
  assert.equal(r.term,termOfWeek(w));
 }
});

test('an unknown year is refused rather than guessed at',()=>{
 assert.equal(calendar('2030/2031'),null);
 assert.equal(schoolWeek('2026-09-07','2030/2031'),null);
 assert.equal(currentWeek('2026-09-07','2030/2031'),null);
 assert.equal(knownYear('2026/2027'),true);
 assert.equal(knownYear('2030/2031'),false);
 assert.equal(knownYear(''),false);
 assert.equal(schoolWeek('not a date'),null);
 assert.equal(schoolWeek(''),null);
});

test('the blocks are continuous and never overlap',()=>{
 const b=YEARS['2026/2027'].blocks;
 for(let i=1;i<b.length;i++)
  assert.ok(Date.parse(b[i].from)>Date.parse(b[i-1].to),`block ${i} starts before block ${i-1} ends`);
 const c=calendar('2026/2027');
 assert.equal(c.breaks.length,2,'the order sets two holidays inside the year');
 assert.deepEqual(c.breaks.map(x=>[x.from,x.to]),[['2026-12-18','2027-01-04'],['2027-03-25','2027-04-12']]);
});
