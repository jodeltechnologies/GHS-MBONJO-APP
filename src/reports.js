// ---------------------------------------------------------------------------
// Report cards and the master result sheet
// ---------------------------------------------------------------------------
// The arithmetic behind the two printed sheets the school issues, kept away from
// the markup so it can be checked against the school's own figures. Everything
// here is a pure function of the marks it is handed; nothing decides who may see
// what, and no mark is invented.
//
// The rules come from the school's own documents and from what the head of
// department confirmed:
//   * a term is two sequences, and a term report's final mark is their average;
//   * a subject's contribution is the final mark times its coefficient, and a
//     student's average is the sum of those over the sum of the coefficients;
//   * positions, class averages, subject averages and subject positions are all
//     worked out inside the class, not across the level;
//   * a student passes on average with 10 or more, and passes on papers when at
//     least half the papers they sat were 10 or more.
//
// A blank mark is not a zero. It is left out of every count, every average and
// every ranking, and prints as a dash. That rule runs through the whole file.

import {subjectCatalogue} from './academics.js';

export const TERMS=['First Term','Second Term','Third Term'];
// Subjects print in the order the school lists them — languages, then
// mathematics, then the sciences — not alphabetically, which is how both of the
// school's own sheets are laid out. Anything not in the catalogue follows, in
// alphabetical order, rather than being dropped.
const CATALOGUE=subjectCatalogue.map(s=>s.name);
export const orderSubjects=names=>[...new Set(names)].sort((a,b)=>{
 const i=CATALOGUE.indexOf(a),j=CATALOGUE.indexOf(b);
 if(i<0&&j<0)return String(a).localeCompare(String(b));
 if(i<0)return 1;
 if(j<0)return -1;
 return i-j;
});
export const sequences=['Sequence 1','Sequence 2','Sequence 3','Sequence 4','Sequence 5','Sequence 6'];
// Two sequences to a term, in order.
export const termSequences=term=>{
 const i=TERMS.indexOf(term);
 return i<0?[]:[sequences[i*2],sequences[i*2+1]];
};
export const termOfAssessment=a=>{
 const i=sequences.indexOf(a);
 return i<0?'':TERMS[Math.floor(i/2)];
};
// What a request for "First Term" or for "Sequence 3" actually needs from the
// database. A promotion exam stands on its own.
export const assessmentsIn=choice=>TERMS.includes(choice)?termSequences(choice):[choice];

// ---------------------------------------------------------------------------
// Grading
// ---------------------------------------------------------------------------
// The competence bands are the REFERENCE table printed at the foot of the school's
// own report card, and the remark column follows them exactly.
export const competenceScale=[
 {from:18,to:20,abbr:'A+/E', en:'Acquis Expert / Competences Well Acquired',              fr:'Acquis Expert'},
 {from:15,to:17,abbr:'CA',   en:'Competences Acquises / Competences Acquired',            fr:'Compétences acquises'},
 {from:11,to:14,abbr:'CECA', en:'Competences en cours d’Acquisition / Competences being Acquired',fr:'Compétences en cours d’acquisition'},
 {from:0, to:10,abbr:'CNA',  en:'Competences Non Acquises / Competences not Acquired',    fr:'Compétences non acquises'}];

// The letter grade is the school's own A-to-U scale. It is not printed on the
// card, so these boundaries are set from the four marks the sample card shows —
// 14 is a B, 11 a C, and both 7 and 4 are U. Change the numbers here and both
// sheets follow; nothing else in the app hard-codes a boundary.
export const letterScale=[
 {from:16,to:20,letter:'A'},
 {from:14,to:15,letter:'B'},
 {from:11,to:13,letter:'C'},
 {from:9, to:10,letter:'D'},
 {from:8, to:8, letter:'E'},
 {from:0, to:7, letter:'U'}];

const scored=v=>v!==''&&v!==null&&v!==undefined&&Number.isFinite(Number(v));
const band=(scale,mark)=>{
 if(!scored(mark))return null;
 const n=Number(mark);
 return scale.find(b=>n>=b.from&&n<b.to+1)||scale[scale.length-1];
};
export const competence=mark=>band(competenceScale,mark);
export const letterGrade=mark=>band(letterScale,mark)?.letter||'';
// A mark below ten is printed in red on the school's sheets, and so is anything
// derived from it: the weighted total, the averages, the subject average.
export const belowPass=v=>scored(v)&&Number(v)<10;
export const PASS=10;

// ---------------------------------------------------------------------------
// One student's sheet
// ---------------------------------------------------------------------------
// `marks` are that student's mark records for the assessments being reported.
// `subjects` is every subject the sheet should list — the ones the student takes,
// so a subject with no mark still prints with dashes rather than disappearing.
export function studentRows(marks,subjects,assessments,{coefficients={}}={}){
 const names=orderSubjects([...subjects,...marks.map(m=>m.subject)]);
 return names.map(subject=>{
  const mine=marks.filter(m=>m.subject===subject);
  const perAssessment=assessments.map(a=>{
   const found=mine.find(m=>m.assessment===a);
   return {assessment:a,mark:found&&scored(found.mark)?Number(found.mark):null};
  });
  const got=perAssessment.filter(x=>x.mark!==null).map(x=>x.mark);
  // The final mark is the average of the sequences that were actually sat. A
  // missing sequence is not a zero, so a student assessed once is judged on that
  // one mark rather than on half of it.
  const finalMark=got.length?got.reduce((a,b)=>a+b,0)/got.length:null;
  const coefficient=Number(mine.find(m=>scored(m.coefficient))?.coefficient??coefficients[subject]??0)||null;
  return {subject,perAssessment,finalMark,coefficient,
          total:finalMark===null||!coefficient?null:finalMark*coefficient,
          grade:finalMark===null?'':letterGrade(finalMark),
          remark:finalMark===null?'':competence(finalMark)?.abbr||''};
 });
}
// The totals row and the average beneath it. Only subjects with a final mark
// count towards either, which is why the coefficient total on a sheet with
// missing marks is smaller than the class's full load.
export function studentTotals(rows){
 const counted=rows.filter(r=>r.finalMark!==null&&r.coefficient);
 const coefficients=counted.reduce((n,r)=>n+r.coefficient,0);
 const total=counted.reduce((n,r)=>n+r.total,0);
 return {coefficients,total,average:coefficients?total/coefficients:null,
         subjectsSat:counted.length,
         subjectsPassed:counted.filter(r=>r.finalMark>=PASS).length};
}

// ---------------------------------------------------------------------------
// The class
// ---------------------------------------------------------------------------
// One call builds both printed sheets: every student's rows and totals, the class
// figures they are measured against, and the counts at the head of the master
// sheet. `stream` is the same marks for the whole level, used only for the stream
// average line — everything else is the class alone.
export function classReport({students=[],marks=[],choice='',subjectsFor=()=>[],coefficients={},stream=null}={}){
 const assessments=assessmentsIn(choice).filter(Boolean);
 const mine=id=>marks.filter(m=>m.studentId===id&&assessments.includes(m.assessment));
 const sheets=students.map(s=>{
  const rows=studentRows(mine(s.id),subjectsFor(s),assessments,{coefficients});
  return {student:s,rows,totals:studentTotals(rows)};
 });

 // Positions are worked out once, over the students who have an average at all.
 const ranked=sheets.filter(x=>x.totals.average!==null);
 const position=avg=>1+ranked.filter(x=>x.totals.average>avg).length;
 const averages=ranked.map(x=>x.totals.average);

 // A subject's average and the positions inside it, over the students of this
 // class who have a final mark in it.
 const subjectNames=orderSubjects(sheets.flatMap(x=>x.rows.map(r=>r.subject)));
 const subjects={};
 for(const subject of subjectNames){
  const got=sheets.map(x=>({id:x.student.id,mark:x.rows.find(r=>r.subject===subject)?.finalMark}))
                  .filter(x=>x.mark!==null&&x.mark!==undefined);
  subjects[subject]={
   sat:got.length,
   passed:got.filter(x=>x.mark>=PASS).length,
   average:got.length?got.reduce((n,x)=>n+x.mark,0)/got.length:null,
   rankOf:id=>{const own=got.find(x=>x.id===id);return own?1+got.filter(x=>x.mark>own.mark).length:null;}};
 }

 for(const sheet of sheets){
  sheet.position=sheet.totals.average===null?null:position(sheet.totals.average);
  for(const row of sheet.rows){
   row.subjectAverage=subjects[row.subject]?.average??null;
   row.rank=row.finalMark===null?null:subjects[row.subject]?.rankOf(sheet.student.id)??null;
  }
 }

 // The head of the master sheet. Passing is counted two ways because the school
 // counts it two ways: by the student's average, and by whether they passed at
 // least half the papers they sat.
 const assessed=sheets.filter(x=>x.totals.subjectsSat>0);
 const passedAvg=assessed.filter(x=>x.totals.average>=PASS).length;
 const passedPapers=assessed.filter(x=>x.totals.subjectsPassed*2>=x.totals.subjectsSat).length;
 const share=(n,of)=>of?Math.round(n/of*10000)/100:null;

 return {
  assessments,sheets,subjects,subjectNames,
  onRoll:students.length,
  assessed:assessed.length,
  passedAvg,passedPapers,
  failedAvg:assessed.length-passedAvg,
  failedPapers:assessed.length-passedPapers,
  percentPassedAvg:share(passedAvg,assessed.length),
  percentPassedPapers:share(passedPapers,assessed.length),
  percentFailedAvg:share(assessed.length-passedAvg,assessed.length),
  percentFailedPapers:share(assessed.length-passedPapers,assessed.length),
  classAverage:averages.length?averages.reduce((a,b)=>a+b,0)/averages.length:null,
  highest:averages.length?Math.max(...averages):null,
  lowest:averages.length?Math.min(...averages):null,
  ranked:ranked.length,
  streamAverage:stream===null?null:stream};
}

// The average across a whole level — Form 4A and Form 4B together — which the
// master sheet prints beside the class average. Every student who has an average
// counts once, whichever class they are in.
export function streamAverage(perClassAverages=[]){
 // `scored` and not a bare Number.isFinite: Number('') is 0, which is finite, and
 // a class with no marks would drag the whole level's average towards zero.
 const all=perClassAverages.flat().filter(scored);
 return all.length?all.reduce((a,b)=>a+Number(b),0)/all.length:null;
}
