import test from 'node:test';import assert from 'node:assert/strict';
import {alumniRoster,renderAlumniPanel,filterAlumniPanel} from '../src/alumni.js';
import {schoolReadiness,renderReadinessPanel} from '../src/school-readiness.js';
const records=[{id:'old',kind:'student',data:{name:'ÉTOH TEST <script>',matricule:'A01',class:'Upper Sixth Arts',status:'graduated',exitYear:'2025/2026',exitDate:'2026-10-20',enrolments:{'2025/2026':{class:'Upper Sixth Arts',status:'completed'}}}},{id:'other',kind:'student',data:{name:'SECOND TEST',class:'Upper Sixth Science',status:'graduated',enrolments:{'2024/2025':{class:'Upper Sixth Science',status:'completed'}}}},{id:'active',kind:'student',data:{name:'CURRENT',matricule:'A03',class:'Form 2A',status:'active',academicYear:'2026/2027',alumni:true}},{id:'left',kind:'student',data:{name:'TRANSFERRED',status:'transferred out'}},{id:'staff',kind:'profile',data:{name:'TEACHER',role:'teacher',active:true}}];
test('alumni list includes graduates across exit years and never reclassifies active or transferred students',()=>{
 const before=JSON.stringify(records),all=alumniRoster(records);assert.equal(all.length,2);assert.equal(all[1].data.exitYear,'2024/2025');assert.equal(JSON.stringify(records),before);
 assert.equal(alumniRoster(records,{year:'2025/2026'}).length,1);assert.equal(alumniRoster(records,{cls:'Upper Sixth Science'})[0].id,'other');assert.equal(alumniRoster(records,{query:'etoh'})[0].id,'old');assert.equal(alumniRoster(records,{query:'A01'}).length,1);
});
test('alumni rendering escapes names, supports French and empty filters, and provides no account-changing controls',()=>{
 const html=renderAlumniPanel(records,{lang:'fr'});assert.ok(!html.includes('<script>'));assert.match(html,/&lt;script&gt;/);assert.match(html,/Anciens élèves/);assert.match(html,/data-alumni-year/);assert.match(html,/data-alumni-class/);assert.ok(!html.includes('data-action="edit"'));assert.match(renderAlumniPanel(records,{year:'2030/2031'}),/No alumni match/);
});
test('alumni search filters existing rows and updates the visible count',()=>{
 const rows=[{dataset:{search:'etoh test a01'},hidden:false},{dataset:{search:'second test a02'},hidden:false}],count={};
 filterAlumniPanel({querySelectorAll:()=>rows,querySelector:()=>count},'Étoh');assert.equal(rows[0].hidden,false);assert.equal(rows[1].hidden,true);assert.equal(count.textContent,'1 alumni');
});
test('readiness identifies current unassigned staff and missing DOBs without inventing data',()=>{
 const before=JSON.stringify(records),r=schoolReadiness(records,'2026/2027');assert.equal(r.unassignedTeachers.length,1);assert.equal(r.missingBirthDates.length,1);assert.equal(r.duplicateNames.length,0);assert.equal(JSON.stringify(records),before);
 const withAssignment=[...records,{kind:'assignment',data:{teacherId:'staff',year:'2025/2026'}}];assert.equal(schoolReadiness(withAssignment,'2026/2027').unassignedTeachers.length,1);
 withAssignment.push({kind:'assignment',data:{teacherId:'staff',year:'2026/2027'}});assert.equal(schoolReadiness(withAssignment,'2026/2027').unassignedTeachers.length,0);
});
test('readiness notices are restricted to administration and duplicate names are only flagged',()=>{
 const rows=[...records,{id:'duplicate',kind:'profile',data:{name:'teacher',role:'teacher'}}];assert.equal(schoolReadiness(rows,'2026/2027').duplicateNames.length,1);
 for(const role of ['student','parent','teacher','staff','content_creator'])assert.equal(renderReadinessPanel(rows,'2026/2027',{role}),'');
 assert.match(renderReadinessPanel(rows,'2026/2027',{role:'principal'}),/Check the register/);assert.match(renderReadinessPanel(rows,'2026/2027',{role:'vp',lang:'fr'}),/Dossiers scolaires/);
});
