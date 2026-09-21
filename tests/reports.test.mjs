import test from 'node:test';import assert from 'node:assert/strict';
import {classReport,studentRows,studentTotals,competence,letterGrade,belowPass,
        termSequences,termOfAssessment,assessmentsIn,streamAverage,competenceScale,letterScale,TERMS} from '../src/reports.js';

// The figures below are taken from the school's own printed sheets: one Form 5A
// report card and the Form 4A / Form 4B master sheets. Where the arithmetic can be
// checked against paper, it is.

const mark=(studentId,subject,assessment,m,coefficient)=>({studentId,subject,assessment,mark:m,coefficient,class:'Form 5A',year:'2025/2026'});

test('a term is two sequences and a sequence knows its term',()=>{
 assert.deepEqual(termSequences('First Term'),['Sequence 1','Sequence 2']);
 assert.deepEqual(termSequences('Second Term'),['Sequence 3','Sequence 4']);
 assert.deepEqual(termSequences('Third Term'),['Sequence 5','Sequence 6']);
 assert.equal(termOfAssessment('Sequence 4'),'Second Term');
 assert.equal(termOfAssessment('Promotion exam'),'');
 assert.deepEqual(assessmentsIn('First Term'),['Sequence 1','Sequence 2']);
 assert.deepEqual(assessmentsIn('Sequence 5'),['Sequence 5'],'one sequence reports on its own');
 assert.deepEqual(assessmentsIn('Promotion exam'),['Promotion exam']);
});

test('the competence bands are the ones printed on the card',()=>{
 // REFERENCE table, foot of the report card: 18-20 A+/E, 15-17 CA, 11-14 CECA, 00-10 CNA.
 assert.equal(competence(20).abbr,'A+/E');
 assert.equal(competence(18).abbr,'A+/E');
 assert.equal(competence(17.9).abbr,'CA');
 assert.equal(competence(15).abbr,'CA');
 assert.equal(competence(14).abbr,'CECA');
 assert.equal(competence(11).abbr,'CECA');
 assert.equal(competence(10.5).abbr,'CNA');
 assert.equal(competence(0).abbr,'CNA');
 assert.equal(competence(''),null,'a blank mark has no band');
 assert.equal(competence(null),null);
 assert.equal(competenceScale.length,4);
});

test('the letter grades match the marks printed on the card',()=>{
 // The sample card: Physics 14 is B, Biology 11 is C, Mathematics 7 and Chemistry 4 are U.
 assert.equal(letterGrade(14),'B');
 assert.equal(letterGrade(11),'C');
 assert.equal(letterGrade(7),'U');
 assert.equal(letterGrade(4),'U');
 assert.equal(letterGrade(20),'A');
 assert.equal(letterGrade(''),'');
 // Every mark from 0 to 20 must land on exactly one letter, with no gap.
 for(let m=0;m<=20;m+=0.5)assert.ok(letterGrade(m),`no grade for ${m}`);
 assert.deepEqual([...new Set(letterScale.map(b=>b.letter))].length,letterScale.length,'a letter is defined once');
});

test('below ten is what prints in red',()=>{
 assert.equal(belowPass(9.99),true);
 assert.equal(belowPass(10),false);
 assert.equal(belowPass(''),false,'a blank mark is not a failure');
 assert.equal(belowPass(null),false);
});

// ---------------------------------------------------------------------------
// The Form 5A card, reproduced
// ---------------------------------------------------------------------------
// Four subjects carried a mark: Mathematics 7 (coeff 4), Biology 11 (3),
// Chemistry 4 (3), Physics 14 (3). The card prints coefficients 13, total 115,
// student average 08.85.
const CARD=[['Mathematics',7,4],['Biology',11,3],['Chemistry',4,3],['Physics',14,3]];
const cardMarks=CARD.map(([s,m,c])=>mark('s1',s,'Sequence 2',m,c));
const cardSubjects=['English Language','French','Mathematics','Biology','Chemistry','Physics','Citizenship'];

test('the card totals come out as the school printed them',()=>{
 const rows=studentRows(cardMarks,cardSubjects,['Sequence 2']);
 const maths=rows.find(r=>r.subject==='Mathematics');
 assert.equal(maths.finalMark,7);
 assert.equal(maths.total,28,'7 x 4');
 assert.equal(maths.grade,'U');
 assert.equal(maths.remark,'CNA');
 const totals=studentTotals(rows);
 assert.equal(totals.coefficients,13);
 assert.equal(totals.total,115);
 assert.equal(totals.average.toFixed(2),'8.85');
 assert.equal(totals.subjectsSat,4);
 assert.equal(totals.subjectsPassed,2,'Biology and Physics');
 // A subject with no mark is still listed, with nothing in it.
 const english=rows.find(r=>r.subject==='English Language');
 assert.equal(english.finalMark,null);
 assert.equal(english.total,null);
 assert.equal(english.grade,'');
 assert.equal(english.remark,'');
});

test('a term averages its two sequences, and a missing one is not a zero',()=>{
 const marks=[mark('s1','Mathematics','Sequence 1',12,4),mark('s1','Mathematics','Sequence 2',8,4),
              mark('s1','Biology','Sequence 1',15,3)];
 const rows=studentRows(marks,['Mathematics','Biology'],['Sequence 1','Sequence 2']);
 const maths=rows.find(r=>r.subject==='Mathematics');
 assert.equal(maths.finalMark,10,'(12 + 8) / 2');
 assert.deepEqual(maths.perAssessment.map(x=>x.mark),[12,8]);
 const bio=rows.find(r=>r.subject==='Biology');
 assert.equal(bio.finalMark,15,'one sequence sat, judged on that sequence');
 assert.deepEqual(bio.perAssessment.map(x=>x.mark),[15,null]);
 assert.equal(studentTotals(rows).total,10*4+15*3);
});

// ---------------------------------------------------------------------------
// The class
// ---------------------------------------------------------------------------
const student=(id,name)=>({id,data:{name,class:'Form 5A'}});
function classOf(rows){
 // rows: [id, name, [[subject, mark, coeff], ...]]
 const students=rows.map(([id,name])=>student(id,name));
 const marks=rows.flatMap(([id,,list])=>list.map(([s,m,c])=>mark(id,s,'Sequence 2',m,c)));
 return classReport({students,marks,choice:'Sequence 2',
  subjectsFor:()=>['Mathematics','Biology'],coefficients:{Mathematics:4,Biology:3}});
}

test('position, class average and subject figures are worked out inside the class',()=>{
 const r=classOf([
  ['a','Ada',[['Mathematics',16,4],['Biology',12,3]]],    // avg (64+36)/7 = 14.29
  ['b','Bih',[['Mathematics',8,4],['Biology',10,3]]],     // avg (32+30)/7 =  8.86
  ['c','Che',[['Mathematics',12,4],['Biology',14,3]]],    // avg (48+42)/7 = 12.86
  ['d','Dia',[]]]);                                       // no marks at all
 const by=n=>r.sheets.find(s=>s.student.data.name===n);
 assert.equal(by('Ada').position,1);
 assert.equal(by('Che').position,2);
 assert.equal(by('Bih').position,3);
 assert.equal(by('Dia').position,null,'a student with no marks is not ranked');
 assert.equal(r.ranked,3);
 assert.equal(r.onRoll,4);
 assert.equal(r.assessed,3);
 assert.equal(r.classAverage.toFixed(2),((14.285714+8.857142+12.857142)/3).toFixed(2));
 assert.equal(r.highest.toFixed(2),'14.29');
 assert.equal(r.lowest.toFixed(2),'8.86');
 // Subject average and subject position, over the class.
 assert.equal(r.subjects.Mathematics.average,12,'(16 + 8 + 12) / 3');
 assert.equal(by('Ada').rows.find(x=>x.subject==='Mathematics').rank,1);
 assert.equal(by('Che').rows.find(x=>x.subject==='Mathematics').rank,2);
 assert.equal(by('Bih').rows.find(x=>x.subject==='Mathematics').rank,3);
 assert.equal(by('Dia').rows.find(x=>x.subject==='Mathematics').rank,null);
 // Every sheet carries the subject average, including the student who sat nothing.
 assert.equal(by('Dia').rows.find(x=>x.subject==='Mathematics').subjectAverage,12);
});

test('passes are counted twice: on the average, and on the papers',()=>{
 const r=classOf([
  ['a','Ada',[['Mathematics',16,4],['Biology',12,3]]],   // avg 14.29 pass · 2 of 2 papers
  ['b','Bih',[['Mathematics',8,4],['Biology',14,3]]],    // avg 10.57 pass · 1 of 2 papers
  ['c','Che',[['Mathematics',8,4],['Biology',9,3]]],     // avg  8.43 fail · 0 of 2 papers
  ['d','Dia',[['Mathematics',4,4],['Biology',18,3]]]]);  // avg 10.00 pass · 1 of 2 papers
 assert.equal(r.assessed,4);
 assert.equal(r.passedAvg,3,'ten exactly is a pass');
 assert.equal(r.failedAvg,1);
 assert.equal(r.passedPapers,3,'half the papers sat is enough');
 assert.equal(r.failedPapers,1);
 assert.equal(r.percentPassedAvg,75);
 assert.equal(r.percentFailedAvg,25);
 // The school's own Form 4A figures: 41 of 56 on average is 73.21%, 49 of 56 on
 // papers is 87.5%. The same rounding must come out.
 const share=(n,of)=>Math.round(n/of*10000)/100;
 assert.equal(share(41,56),73.21);
 assert.equal(share(49,56),87.5);
 assert.equal(share(17,36),47.22,'Form 4B');
});

test('an empty class does not produce zeros that look like results',()=>{
 const r=classReport({students:[student('a','Ada')],marks:[],choice:'Sequence 1',subjectsFor:()=>['Mathematics']});
 assert.equal(r.classAverage,null);
 assert.equal(r.highest,null);
 assert.equal(r.lowest,null);
 assert.equal(r.percentPassedAvg,null);
 assert.equal(r.assessed,0);
 assert.equal(r.sheets[0].totals.average,null);
 assert.equal(r.sheets[0].position,null);
 assert.equal(r.subjects.Mathematics.average,null);
});

test('the stream average covers the level, not the class',()=>{
 // Form 4A averaged 11.61 over 56 students and Form 4B 10.07 over 36; the sheets
 // print a stream average of 11.02 for both.
 const a=Array.from({length:56},()=>11.61),b=Array.from({length:36},()=>10.07);
 assert.equal(streamAverage([a,b]).toFixed(2),'11.01');
 assert.equal(streamAverage([]),null);
 assert.equal(streamAverage([[null,undefined,'']]),null,'nothing to average is not zero');
});

test('a blank mark never becomes a zero anywhere',()=>{
 const marks=[mark('a','Mathematics','Sequence 2','',4),mark('a','Biology','Sequence 2',12,3)];
 const r=classReport({students:[student('a','Ada')],marks,choice:'Sequence 2',
  subjectsFor:()=>['Mathematics','Biology'],coefficients:{Mathematics:4,Biology:3}});
 const sheet=r.sheets[0];
 assert.equal(sheet.rows.find(x=>x.subject==='Mathematics').finalMark,null);
 assert.equal(sheet.totals.coefficients,3,'the blank subject carries no coefficient');
 assert.equal(sheet.totals.total,36);
 assert.equal(sheet.totals.average,12);
 assert.equal(r.subjects.Mathematics.sat,0);
 assert.equal(r.subjects.Mathematics.average,null);
});
