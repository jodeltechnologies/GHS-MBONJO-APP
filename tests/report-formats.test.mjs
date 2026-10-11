import test from 'node:test';
import assert from 'node:assert/strict';
import {classReport,cbaResult,assessmentsIn,studentRows} from '../src/reports.js';
import {reportCardHTML,masterSheetHTML} from '../src/report-layout.js';
import {reportInformation,reportTeacherNames} from '../src/report-information.js';

const student={id:'one',kind:'student',data:{name:'SAMPLE STUDENT',class:'Form 1A',matricule:'SAMPLE-01',birthDate:'2014-09-10',birthPlace:'LIMBE'}};
const marks=[{studentId:'one',subject:'English Language',assessment:'Sequence 1',mark:14,coefficient:4,competencies:'Read <clearly> and explain a passage'},{studentId:'one',subject:'English Language',assessment:'Sequence 2',mark:20,coefficient:4}];
const report=()=>classReport({students:[student],marks,choice:'First Term',subjectsFor:()=>['English Language','Mathematics'],coefficients:{Mathematics:4}});

test('CBA grades and remarks match observed old-system results, including boundaries',()=>{
 for(const [mark,grade] of [[20,'A+'],[18,'A+'],[17.5,'A'],[16,'A'],[15.5,'B+'],[15,'B+'],[14.5,'B'],[14,'B'],[13.5,'C+'],[12,'C+'],[11.5,'C'],[10,'C'],[9.5,'D'],[0,'D']])assert.equal(cbaResult(mark).letter,grade);
 assert.equal(cbaResult(null),null);assert.equal(cbaResult(''),null);
});

test('annual reports average available term averages without treating missing sequences as zero',()=>{
 assert.equal(assessmentsIn('Annual Report').length,6);
 const records=[0,20,18,null,12,12].map((mark,i)=>({subject:'English Language',assessment:`Sequence ${i+1}`,mark,coefficient:4}));
 const row=studentRows(records,['English Language'],assessmentsIn('Annual Report'))[0];
 assert.deepEqual(row.termAverages.map(x=>x.mark),[10,18,12]);
 assert.equal(row.finalMark,40/3);
});

test('report information uses the selected year and term and only the linked parent',()=>{
 const pupil={...student,data:{...student.data,reportDetails:{'2025/2026':{'First Term':{unjustifiedAbsenceHours:3}},'2026/2027':{'First Term':{unjustifiedAbsenceHours:9}}}}};
 const rows=[pupil,{kind:'profile',data:{name:'LINKED PARENT',phone:'SAMPLE-PHONE',role:'parent',children:['one']}},{kind:'profile',data:{name:'OTHER PARENT',phone:'PRIVATE',role:'parent',children:['two']}}];
 const notes=reportInformation(rows,pupil,{year:'2025/2026',assessment:'First Term',cls:'Form 1A'});
 assert.equal(notes.unjustifiedAbsenceHours,3);assert.equal(notes.guardianName,'LINKED PARENT');assert.equal(notes.guardianPhone,'SAMPLE-PHONE');
 assert.equal(reportInformation(rows,pupil,{year:'2025/2026',assessment:'Second Term',cls:'Form 1A'}).unjustifiedAbsenceHours,undefined);
});

test('teacher names come from selected-year assignments and do not return account details',()=>{
 const rows=[{id:'old',kind:'profile',data:{name:'PREVIOUS TEACHER',active:false,authId:'PRIVATE'}},{id:'new',kind:'profile',data:{name:'CURRENT TEACHER'}},{kind:'assignment',data:{class:'Form 1A',subject:'English Language',teacherId:'old',year:'2025/2026'}},{kind:'assignment',data:{class:'Form 1A',subject:'English Language',teacherId:'new',year:'2026/2027'}}];
 assert.deepEqual(reportTeacherNames(rows,{year:'2025/2026',cls:'Form 1A'}),{'English Language':'PREVIOUS TEACHER'});
});

test('CBA card retains identity, competencies, mark ranges and discipline without inventing data',()=>{
 const r=report(),sheet=r.sheets[0];sheet.details={guardianName:'SAMPLE GUARDIAN',guardianPhone:'SAMPLE-PHONE',classMasterName:'SAMPLE TEACHER',unjustifiedAbsenceHours:0};
 const html=reportCardHTML(sheet,r,{year:'2025/2026',assessment:'First Term',cls:'Form 1A',format:'cba'});
 for(const value of ['LIMBE','SAMPLE-01','SAMPLE GUARDIAN','SAMPLE TEACHER','SAMPLE-PHONE','Read &lt;clearly&gt;','Competences very well acquired','Min–Max','Class attendance','Reprimand','Suspension','Success rate'])assert.ok(html.includes(value),value);
 assert.match(html,/Unjustified absence[^]*?<td>0<\/td>/);
 assert.match(html,/Justified absence[^]*?<td>--<\/td>/);
 assert.equal(r.subjects['English Language'].minimum,17);assert.equal(r.subjects['English Language'].maximum,17);
 const sba=reportCardHTML(sheet,r,{format:'sba'});assert.ok(!sba.includes('Read &lt;clearly&gt;'));
});

test('master sheet preserves summary, all subjects, missing marks and student identifiers',()=>{
 const r=report(),html=masterSheetHTML(r,{format:'cba',cls:'Form 1A',assessment:'First Term',year:'2025/2026'});
 for(const value of ['Per average','Per papers','Number on roll','Number assessed','Stream average','MATHEMATICS','SAMPLE-01','Subjects sat','Subject average','<td>--</td>'])assert.ok(html.includes(value),value);
 assert.ok(html.includes('<td>A</td>'));
 assert.ok(masterSheetHTML(r,{format:'cba',showMarks:true}).includes('17.00'));
});
