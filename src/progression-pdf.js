// ---------------------------------------------------------------------------
// Reading a progression sheet out of its PDF
// ---------------------------------------------------------------------------
// The national and departmental sheets are all the same table: Term, Week,
// Module, Category of action, sometimes a Competency statement, then Lesson
// title, Objectives, Resources and the Th/Prac/Dig ticks. Departments hold these
// as PDFs, not spreadsheets, so the app reads the PDF rather than asking every
// head of department to retype their scheme.
//
// This file is the reading itself and nothing else: positioned text in, lessons
// out. The PDF library that produces that text is loaded in the browser and the
// text handed here, so this logic runs — and is tested — without it.
//
// Finding the columns. Not from the header: header cells are centred over their
// column while the contents are left-aligned, so a boundary drawn from the header
// lands in the wrong place, and "WEEKLY WORKLOAD: 3 periods" in the page
// furniture reads as a "Week" heading. Two things in the body of the table do
// hold still, and everything is measured from them:
//
//   * the lesson marker — "Lesson 6:" set as its own run of text, or a bare
//     number in a Lesson-no column on the Sixth Form sheets;
//   * the bullet in front of every objective.
//
// Finding the rows. The marker is the row: everything from one marker to the next
// belongs to that lesson — its wrapped title and its bullets — and any text above
// the first marker is a row in its own right, which is how "Diagnostic
// evaluation" survives.

import {termOfWeek} from './department.js';

const clean=s=>String(s||'').replace(/\s+/g,' ').trim();
const LESSON_MARK=/^lesson\s*(\d+)\s*:?$/i;
const LESSON_INLINE=/^lesson\s*(\d+)\s*:\s*(.+)$/i;
const BULLET=/^[•●▪‣]$/;
// On some sheets the bullet is its own run; on others it opens the run that
// carries the text. Both mark the left edge of the objectives column.
const STARTS_BULLET=/^[•●▪‣]/;
const isMarkerText=t=>LESSON_MARK.test(t)||LESSON_INLINE.test(t);
// These sheets carry rows that have no lesson number: the diagnostic test at the
// start, the integration activity that closes a module, and the evaluation and
// remediation weeks. They are rows in the printed sheet and are worth tracking,
// so they are recognised by name — the only place in this file where a lesson is
// identified by what it says rather than where it sits.
const UNNUMBERED=/^(diagnostic\s+evaluation|integration\s+activit|evaluation(\s+and\s+remediation)?|remediation|revision|end[-\s]of[-\s]term|assessment)\b/i;

// Text belonging to the page rather than the table: the ministry heading above
// it, the key and the page number below it.
const FURNITURE=/republic|république|minist|inspector|inspection|peace\s*[–-]\s*work|paix\s*[–-]\s*travail|progression sheet|school year|weekly workload|theory;|practical;|digitalis|^-+$|^…+$/i;

const median=xs=>{if(!xs.length)return null;const a=xs.slice().sort((p,q)=>p-q);return a[Math.floor(a.length/2)];};

// Group runs into visual lines. PDF text arrives run by run, not line by line, so
// runs whose baselines are within a couple of points are one line.
export function toLines(items,tolerance=2.5){
 const sorted=items.slice().sort((a,b)=>b.y-a.y||a.x-b.x);
 const lines=[];
 for(const it of sorted){
  const last=lines[lines.length-1];
  if(last&&Math.abs(last.y-it.y)<=tolerance)last.items.push(it);
  else lines.push({y:it.y,items:[it]});
 }
 for(const l of lines)l.items.sort((a,b)=>a.x-b.x);
 return lines;
}

// The horizontal positions everything else is measured from.
export function findAnchors(pages){
 const markerX=[],bulletX=[],numberish=[];
 let headerLessonNo=null,headerTitle=null;
 for(const items of pages||[]){
  for(const it of items||[]){
   if(!it||it.rotated)continue;
   const text=clean(it.str);
   if(!text)continue;
   if(headerLessonNo===null&&/^lesson\s*(no|n°|number)/i.test(text))headerLessonNo=it.x;
   if(headerTitle===null&&/^lesson\s*title/i.test(text))headerTitle=it.x;
   if(isMarkerText(text))markerX.push(it.x);
   else if(STARTS_BULLET.test(text))bulletX.push(it.x);
   else if(/^\d{1,3}$/.test(text))numberish.push(it);
  }
 }
 // Sheets that give the lesson number a column of its own carry no "Lesson N:"
 // text at all. That column is found from the digits rather than the heading,
 // because the heading itself is often split into two runs ("Lesson" / "no"):
 // cluster the bare integers by position, drop the week column (its numbers stop
 // in the thirties and repeat), and take the cluster nearest the lesson titles.
 let lessonNoX=null;
 if(markerX.length<5){
  const clusters=new Map();
  for(const it of numberish){
   const k=Math.round(it.x/6)*6;
   if(!clusters.has(k))clusters.set(k,[]);
   clusters.get(k).push(Number(clean(it.str)));
  }
  // The week column and the lesson-number column both hold small ascending
  // integers, so size alone cannot separate them — and a threshold tuned to a
  // whole sheet would fail on a short one. What does separate them is that weeks
  // repeat across their lessons while lesson numbers do not, so the column with
  // the most distinct values is the lesson number.
  const titleGuess=headerTitle??Infinity;
  const candidates=[...clusters]
   .map(([x,vals])=>({x,vals,distinct:new Set(vals).size}))
   .filter(c=>c.x<titleGuess&&c.distinct>=5&&c.vals.every((v,i)=>i===0||v>=c.vals[i-1]));
  if(candidates.length){
   candidates.sort((p,q)=>q.distinct-p.distinct||q.x-p.x);
   lessonNoX=candidates[0].x;
  }else if(headerLessonNo!==null)lessonNoX=headerLessonNo;
 }
 const objectivesX=median(bulletX);
 // With "Lesson N:" markers the title column is wherever those markers are. With
 // a Lesson-no column instead there are no markers, and the "Lesson title" header
 // cannot be used either: it is centred over its column while the titles below it
 // are left-aligned, which on the Sixth Form sheets puts the header thirty points
 // to the right of the text. So the column is measured from the text that sits
 // between the number column and the bullets.
 let titleX=median(markerX);
 if(titleX===null&&lessonNoX!==null&&objectivesX!==null){
  const between=[];
  for(const items of pages||[])for(const it of items||[]){
   if(!it||it.rotated)continue;
   const t=clean(it.str);
   if(!t||t.length<3)continue;
   if(it.x>lessonNoX+12&&it.x<objectivesX-12)between.push(it.x);
  }
  if(between.length>10)titleX=Math.min(...between);
 }
 return {titleX:titleX??headerTitle,objectivesX,lessonNoX,
         markers:markerX.length,bullets:bulletX.length};
}

// One sheet, as the pages of positioned text the PDF library produced.
// `pages` is an array of arrays of {str, x, y, width, rotated}.
export function lessonsFromPages(pages){
 const a=findAnchors(pages);
 if(a.titleX===null&&a.lessonNoX===null)
  throw Error('This does not look like a progression sheet: no lesson numbers were found in it.');
 const titleX=a.titleX??(a.lessonNoX+40);
 // Where the objectives start. With no bullets at all, everything right of the
 // title is treated as title text rather than invented as objectives.
 const objEdge=a.objectivesX!==null&&a.objectivesX>titleX?a.objectivesX-8:Infinity;
 const titleEdge=titleX-10;
 const columnOf=x=>x>=objEdge?'objectives':x>=titleEdge?'title':'left';
 const isLessonNumber=it=>a.lessonNoX!==null&&/^\d{1,3}$/.test(clean(it.str))&&Math.abs(it.x-a.lessonNoX)<30;

 const lessons=[];
 let current=null,week='',module_='';

 const flush=()=>{
  if(!current)return;
  const title=clean(current.titleParts.join(' '));
  if(title&&title.length>2&&!FURNITURE.test(title))
   lessons.push({term:termOfWeek(current.week),week:current.week,module:clean(current.module),
                 number:Number.isFinite(current.number)?current.number:null,
                 title,objectives:splitObjectives(current.objectiveParts)});
  current=null;
 };

 for(const items of pages){
  // Anything very low on the page is the footer key or the page number, and
  // anything at or above the "Lesson title" heading is the ministry block and the
  // header row itself. Both would otherwise arrive as the first lesson's title.
  const all=(items||[]).filter(i=>i&&clean(i.str)&&!i.rotated&&i.y>52);
  // The header row, and the ministry block above it, are skipped. A single word
  // is not enough to call a line the header — "Resources" and "Objectives" both
  // turn up inside lesson text — so a header line is one carrying two or more of
  // the column names. The table starts below the lowest such line.
  const lines=toLines(all);
  const isHeaderLine=l=>{
   const words=l.items.map(i=>clean(i.str));
   const hits=['lesson title','lesson no','objectives','resources','nature of lesson','competency','category of action','week','module','term']
    .filter(h=>words.some(w=>w.toLowerCase().startsWith(h)));
   return hits.length>=2;
  };
  let startAt=0;
  lines.forEach((l,i)=>{if(isHeaderLine(l))startAt=i+1;});
  for(const line of lines.slice(startAt)){
   const text=clean(line.items.map(i=>i.str).join(' '));
   if(FURNITURE.test(text)&&!line.items.some(isMarkerText_))continue;

   // Week and module carry down the page and on to the next, exactly as the
   // merged cells do in the printed sheet.
   for(const it of line.items){
    if(columnOf(it.x)!=='left')continue;
    const t=clean(it.str);
    // On the Sixth Form sheets the lesson number also sits left of the title, so
    // it has to be excluded here or it would be read as a week and send the term
    // off the end of the year.
    if(isLessonNumber(it))continue;
    if(/^\d{1,2}$/.test(t)){const n=Number(t);if(n>=1&&n<=45)week=n;}
    else if(t.length>3&&!FURNITURE.test(t))module_=t;
   }

   // Does a lesson begin on this line?
   let marker=null,inlineTitle='';
   for(const it of line.items){
    const t=clean(it.str);
    if(isLessonNumber(it)){marker=it;break;}
    if(isMarkerText(t)&&columnOf(it.x)!=='objectives'){
     marker=it;const m=LESSON_INLINE.exec(t);inlineTitle=m?m[2]:'';break;
    }
   }
   if(marker){
    flush();
    const t=clean(marker.str);
    const m=LESSON_MARK.exec(t)||LESSON_INLINE.exec(t);
    current={number:m?Number(m[1]):Number(t),week,module:module_,
             titleParts:inlineTitle?[inlineTitle]:[],objectiveParts:[]};
   }else{
    // An unnumbered row — a diagnostic, an integration activity, a remediation
    // week — starts where its name does, so it is not swallowed into the title
    // of the lesson printed above it.
    const named=line.items.find(it=>columnOf(it.x)==='title'&&UNNUMBERED.test(clean(it.str)));
    if(named&&!(current&&current.titleParts.length===0)){
     flush();
     current={number:null,week,module:module_,titleParts:[],objectiveParts:[]};
    }
   }

   for(const it of line.items){
    if(it===marker)continue;
    const t=clean(it.str);
    if(!t)continue;
    const col=columnOf(it.x);
    if(col==='objectives'){
     if(!current)continue;
     current.objectiveParts.push(BULLET.test(t)?'•':t);
    }else if(col==='title'){
     if(BULLET.test(t)||isMarkerText(t)||isLessonNumber(it))continue;
     if(!current)current={number:null,week,module:module_,titleParts:[],objectiveParts:[]};
     current.titleParts.push(t);
    }
   }
  }
 }
 flush();
 return lessons;
}
const isMarkerText_=it=>isMarkerText(clean(it.str));

// Objectives print as bullets, each wrapping over several lines. The bullet is
// its own run, so the parts rebuild into whole points.
function splitObjectives(parts){
 return parts.join(' ').split('•')
  .map(s=>clean(s).replace(/^[-–]\s*/,'').replace(/[.;]+$/,''))
  .filter(s=>s.length>4)
  .slice(0,8);
}

// The block above the table: what the sheet calls itself and its weekly load.
export function sheetHeading(items){
 let title='',weeklyPeriods=null;
 for(const l of toLines((items||[]).filter(i=>i&&clean(i.str)&&!i.rotated))){
  const text=clean(l.items.map(i=>i.str).join(' '));
  if(!title&&/progression sheet/i.test(text))title=text;
  const m=/weekly\s*workload[:\s]*([0-9]{1,2})/i.exec(text);
  if(m&&weeklyPeriods===null)weeklyPeriods=Number(m[1]);
 }
 return {title,weeklyPeriods};
}

// What the import screen reports back, so a head of department can see the sheet
// was read properly before saving it rather than discovering it afterwards.
export function describeImport(lessons){
 const weeks=(lessons||[]).map(l=>Number(l.week)).filter(w=>Number.isFinite(w)&&w>0);
 return {
  lessons:lessons.length,
  numbered:lessons.filter(l=>Number.isFinite(l.number)).length,
  withObjectives:lessons.filter(l=>l.objectives.length).length,
  terms:[...new Set(lessons.map(l=>l.term).filter(Boolean))].length,
  firstWeek:weeks.length?Math.min(...weeks):null,
  lastWeek:weeks.length?Math.max(...weeks):null};
}
