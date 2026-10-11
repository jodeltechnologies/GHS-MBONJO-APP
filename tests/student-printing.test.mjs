import test from 'node:test';
import assert from 'node:assert/strict';
import {classReport} from '../src/reports.js';
import {blankReport,studentIdCardsHTML} from '../src/student-printing.js';
import {reportCardHTML,masterSheetHTML} from '../src/report-layout.js';
const students=Array.from({length:9},(_,i)=>({id:String(i),kind:'student',data:{name:`STUDENT <TEST> ${i}`,matricule:`MB${i}`,class:'Form 1A'}}));
test('blank samples strip even published results and discipline without changing originals',()=>{
 const report=classReport({students,marks:[{studentId:'0',subject:'Mathematics',assessment:'Sequence 1',mark:18,coefficient:3}],choice:'First Term',subjectsFor:()=>['Mathematics','French']});report.sheets[0].details={guardianName:'PARENT TEST',classMasterName:'MASTER TEST',disciplineObservation:'PRIVATE DISCIPLINE',performanceObservation:'EXCELLENT',lateCount:8};
 const blank=blankReport(report);assert.equal(report.sheets[0].totals.average,18);assert.equal(blank.sheets[0].totals.average,null);assert.equal(blank.sheets[0].rows[0].perAssessment[0].mark,null);assert.equal(blank.onRoll,9);
 for(const html of [reportCardHTML(blank.sheets[0],blank,{cls:'Form 1A',assessment:'First Term'}),masterSheetHTML(blank,{cls:'Form 1A'})]){assert.match(html,/BLANK SAMPLE/);assert.ok(!html.includes('PRIVATE DISCIPLINE'));assert.ok(!html.includes('18.00'));assert.ok(!html.includes('>null<'));assert.ok(!html.includes('>--<'));assert.match(html,/MATHEMATICS/);assert.match(html,/STUDENT &lt;TEST&gt; 0/);}
 assert.equal(blank.sheets[0].details.guardianName,'PARENT TEST');
});
test('ID cards support individual and batch printing without exposing login details',()=>{
 const input=students.map(s=>({...s,data:{...s.data,password:'PASSWORD-NOT-PRINTED',birthDate:'2008-01-01'}}));
 assert.equal((studentIdCardsHTML(input,{year:'2025/2026'}).match(/<article class="student-id-card">/g)||[]).length,9);
 assert.equal((studentIdCardsHTML(input,{year:'2025/2026'}).match(/<section class="print-page student-id-sheet">/g)||[]).length,2);
 const single=studentIdCardsHTML(input.slice(0,1),{year:'2025/2026'});assert.match(single,/MB0/);assert.match(single,/2025\/2026/);assert.ok(!single.includes('PASSWORD-NOT-PRINTED'));assert.ok(!single.includes('2008-01-01'));assert.match(single,/STUDENT &lt;TEST&gt; 0/);assert.throws(()=>studentIdCardsHTML([]));
});
