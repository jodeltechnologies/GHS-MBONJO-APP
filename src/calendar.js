// ---------------------------------------------------------------------------
// The official school calendar
// ---------------------------------------------------------------------------
// Cameroon fixes the school year by joint order of MINEDUB and MINESEC. The
// 2026/2027 year is set by Joint Order N° 002/26/JO/MINEDUB/MINESEC of
// 14 August 2026: the year opens on Monday 7 September 2026 at 7:30 a.m. and
// closes on Friday 30 July 2027, and Article 8 fixes it at 36 working weeks.
//
// The year does not run straight through. It is taught in five blocks with two
// holidays in between, so the school week cannot be worked out by dividing days
// since September by seven — that counts the Christmas and Easter holidays as
// teaching weeks and puts every subject three weeks further behind than it is.
// The blocks below are the dates printed in the order; the number of weeks in
// each is counted from those dates rather than typed in, and they add up to the
// 36 weeks Article 8 requires.
//
// Weeks are numbered continuously across the year (1-36) because that is how a
// progression sheet numbers them: weeks 1-12 are the First Term, 13-24 the
// Second and 25-36 the Third.

export const YEARS={
 '2026/2027':{
  order:'Joint Order N° 002/26/JO/MINEDUB/MINESEC of 14 August 2026',
  opens:'2026-09-07',closes:'2027-07-30',
  blocks:[
   {term:'First Term', from:'2026-09-07',to:'2026-11-27'},
   {term:'Second Term',from:'2026-11-30',to:'2026-12-18'},
   {term:'Second Term',from:'2027-01-04',to:'2027-03-05'},
   {term:'Third Term', from:'2027-03-08',to:'2027-03-25'},
   {term:'Third Term', from:'2027-04-12',to:'2027-06-11'}]}};

export const defaultYear='2026/2027';
const DAY=86400000,WEEK=7*DAY;
const stamp=iso=>Date.parse(String(iso||'')+'T00:00:00Z');
const iso=ms=>new Date(ms).toISOString().slice(0,10);

// The year with its week numbers worked out. Each block knows which school week
// it starts and ends on, so a date only has to be placed inside a block.
export function calendar(year=defaultYear){
 const y=YEARS[year];
 if(!y)return null;
 let before=0;
 const blocks=y.blocks.map((b,i)=>{
  const weeks=Math.floor((stamp(b.to)-stamp(b.from))/WEEK)+1;
  const out={...b,index:i,weeks,firstWeek:before+1,lastWeek:before+weeks};
  before+=weeks;
  return out;
 });
 // The holidays: the gaps between the blocks. A block that ends on a Friday and
 // is followed by one starting on the Monday is not a holiday — that is only the
 // weekend, and it is where a term changes without the school closing.
 const breaks=blocks.slice(1)
  .map((b,i)=>({from:blocks[i].to,to:b.from,afterWeek:blocks[i].lastWeek}))
  .filter(g=>stamp(g.to)-stamp(g.from)>3*DAY);
 return {...y,year,blocks,breaks,weeks:before};
}

export const knownYear=year=>Object.prototype.hasOwnProperty.call(YEARS,year||'');

// Where a date falls in the year. A date inside a block is a teaching week; one
// in a holiday is reported as a holiday with the week the school will come back
// to, rather than being given a week number it does not have.
export function schoolWeek(date,year=defaultYear){
 const c=calendar(year);
 if(!c)return null;
 const d=stamp(date);
 if(!Number.isFinite(d))return null;
 if(d<stamp(c.blocks[0].from))
  return {status:'before',year,week:null,term:'',lastWeek:null,nextWeek:1,resumesOn:c.blocks[0].from,weeks:c.weeks};
 for(const b of c.blocks){
  if(d<stamp(b.from))
   return {status:'holiday',year,week:null,term:'',lastWeek:b.firstWeek-1,nextWeek:b.firstWeek,resumesOn:b.from,weeks:c.weeks};
  // A block runs Monday to Friday; the weekend after it still belongs to that
  // week, and the next block never starts before the following Monday.
  if(d<=stamp(b.to)+2*DAY){
   const week=Math.min(b.lastWeek,b.firstWeek+Math.floor((d-stamp(b.from))/WEEK));
   return {status:'teaching',year,week,term:b.term,lastWeek:week,nextWeek:week,resumesOn:'',weeks:c.weeks};
  }
 }
 return {status:'after',year,week:null,term:'',lastWeek:c.weeks,nextWeek:null,resumesOn:'',weeks:c.weeks};
}

// The week to measure coverage against today. In a holiday that is the last week
// taught, not the week the school will return to: nothing is late yet for a week
// that has not started. Before the year opens there is no expectation at all.
export function currentWeek(date,year=defaultYear){
 const s=schoolWeek(date,year);
 return s&&s.status!=='before'?s.lastWeek:null;
}

// The Monday-to-Friday dates of a numbered school week, so a week can be shown
// as dates rather than as a number the head of department has to place.
export function weekRange(week,year=defaultYear){
 const c=calendar(year),n=Number(week);
 if(!c||!Number.isFinite(n)||n<1||n>c.weeks)return null;
 const b=c.blocks.find(x=>n>=x.firstWeek&&n<=x.lastWeek);
 const from=stamp(b.from)+(n-b.firstWeek)*WEEK;
 // The last week of a block can be short: the block's own end date wins.
 const to=Math.min(from+4*DAY,stamp(b.to));
 return {week:n,term:b.term,from:iso(from),to:iso(to)};
}

// The first and last week of each term, for a progression sheet that files its
// lessons by term rather than by week.
export function termWeeks(year=defaultYear){
 const c=calendar(year);
 if(!c)return [];
 const out=[];
 for(const b of c.blocks){
  const found=out.find(x=>x.term===b.term);
  if(found){found.lastWeek=b.lastWeek;found.weeks+=b.weeks;}
  else out.push({term:b.term,firstWeek:b.firstWeek,lastWeek:b.lastWeek,weeks:b.weeks});
 }
 return out;
}
