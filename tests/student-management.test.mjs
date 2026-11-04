import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {changeStudent} from '../src/student-management.js';
import {studentsInYear} from '../src/academics.js';
import {studentManagementTable} from '../src/student-actions-ui.js';
import {classMarkSheet} from '../src/class-mark-sheet.js';
import handler from '../api/school.js';
import {CONTROL_ID} from '../src/school-controls.js';
const year='2026/2027';
const pupil=id=>({id,kind:'student',version:3,data:{name:'TEST '+id,matricule:'MBO'+id,class:'Form 2A',status:'active',academicYear:year,authEpoch:1,enrolments:{'2025/2026':{class:'Form 1A',status:'active'},[year]:{class:'Form 2A',status:'active',source:'rollover'}},classHistory:[]}});
const rooms=['Form 1A','Form 2A','Form 2B','Form 3A','Upper Sixth Arts'].map(name=>({kind:'classroom',data:{name}}));
const input={action:'promote',year,cls:'Form 3A',reason:'Promotion correction',actor:'principal',at:'2026-11-04T14:00:00Z'};
test('promotion, demotion and transfer preserve previous-year enrolments and audit the action',()=>{
 for(const [action,cls,status] of [['promote','Form 3A','promoted'],['demote','Form 1A','demoted'],['transfer','Form 2B','active']]){
  const old=pupil('one'),copy=structuredClone(old),d=changeStudent(old,{...input,action,cls},rooms);
  assert.deepEqual(old,copy);assert.equal(d.class,cls);assert.equal(d.status,status);assert.deepEqual(d.enrolments['2025/2026'],old.data.enrolments['2025/2026']);assert.equal(d.enrolments[year].source,'rollover');assert.equal(d.classHistory[0].actor,'principal');assert.equal(d.classHistory[0].action,action);
 }
});
test('invalid direction, destination, year and empty reason are rejected',()=>{
 for(const patch of [{action:'promote',cls:'Form 1A'},{action:'demote',cls:'Form 3A'},{action:'promote',cls:'Form 2B'},{cls:'Unknown'},{reason:' '},{year:'2027/2028'},{action:'purge'}])assert.throws(()=>changeStudent(pupil('one'),{...input,...patch},rooms));
});
test('deletion disables access, keeps history and excludes every normal year roster',()=>{
 const old=pupil('one'),data=changeStudent(old,{...input,action:'delete'},rooms),r={...old,data};
 assert.equal(data.deleted,true);assert.equal(data.active,false);assert.equal(data.authEpoch,2);assert.equal(data.deletedBy,'principal');assert.deepEqual(data.enrolments['2025/2026'],old.data.enrolments['2025/2026']);assert.equal(studentsInYear([r],year).length,0);assert.equal(studentsInYear([r],'2025/2026').length,0);assert.throws(()=>changeStudent(r,input,rooms));
});
process.env.SUPABASE_URL='https://school-fixture.test';process.env.SUPABASE_SERVICE_ROLE_KEY='fixture-only';process.env.SESSION_SECRET='fixture-only-secret-for-student-management-tests';process.env.APP_ORIGIN='https://qa-school.test';
async function request({role='principal',students=[{id:'one',version:3},{id:'two',version:3}],action='promote',extra={},failId='',deletedSession=false,op='student-actions'}={}){
 const base=[{id:'actor',kind:'profile',data:{name:'TEST ADMIN',role,authId:'auth',active:true}},pupil('one'),pupil('two'),...rooms,{id:CONTROL_ID,kind:'school_control',data:{activeYear:year}}];
 if(deletedSession)base[1].data={...base[1].data,deleted:true,active:false,status:'deleted'};
 const fetch=globalThis.fetch,writes=[];globalThis.fetch=async(url,options={})=>{
  if(url.includes('/auth/v1/user'))return Response.json({id:'auth'});
  if(url.includes('/rpc/school_save_record')){const b=JSON.parse(options.body);writes.push(b);if(b.record_id===failId)return Response.json({code:'40001'},{status:409});return Response.json([{id:b.record_id,kind:'student',version:4,data:b.record_data}]);}
  if(url.includes('kind=in.(profile'))return Response.json(structuredClone(base));
  return Response.json([]);
 };
 const payload=deletedSession?{studentId:'one'}:{authId:'auth',accessToken:'fixture'};
 const raw=Buffer.from(JSON.stringify({...payload,exp:Date.now()+3600000})).toString('base64url'),cookie='school_session='+raw+'.'+crypto.createHmac('sha256',process.env.SESSION_SECRET).update(raw).digest('base64url');let status=200,body;
 try{await handler({method:'POST',headers:{origin:process.env.APP_ORIGIN,cookie},body:{op,year,action,class:'Form 3A',reason:'School register correction',students,...extra}},{setHeader(){},status(n){status=n;return this;},json(v){body=v;return this;}});}finally{globalThis.fetch=fetch;}
 return {status,body,writes};
}
test('principal and VP can apply one reviewed action to multiple versioned students',async()=>{
 for(const role of ['principal','vp']){const r=await request({role});assert.equal(r.status,200,JSON.stringify(r.body));assert.equal(r.body.results.length,2);assert.ok(r.body.results.every(x=>x.ok));assert.equal(r.writes.length,2);assert.ok(r.writes.every(b=>b.expected_version===3&&b.record_data.class==='Form 3A'));}
});
test('teacher, HOD, parent and ordinary staff cannot manage students',async()=>{
 for(const role of ['teacher','hod','parent','staff','discipline']){const r=await request({role});assert.equal(r.status,403,role);assert.equal(r.writes.length,0);}
});
test('invalid or stale batches fail before any write, and deletion requires explicit confirmation',async()=>{
 for(const patch of [{students:[]},{students:[{id:'missing',version:3}]},{students:[{id:'one',version:3},{id:'two',version:2}]},{students:[{id:'one',version:3},{id:'one',version:3}]},{action:'demote'},{action:'delete'},{extra:{year:'2027/2028'}},{extra:{reason:''}}]){const r=await request(patch);assert.ok(r.status>=400,JSON.stringify(patch));assert.equal(r.writes.length,0);}
 const r=await request({action:'delete',extra:{confirmDelete:true}});assert.equal(r.status,200);assert.ok(r.writes.every(b=>b.record_data.deleted&&b.record_data.active===false));
});
test('concurrent write failure is reported per student without hiding successful updates',async()=>{
 const r=await request({failId:'two'});assert.equal(r.status,200);assert.equal(r.body.results[0].ok,true);assert.equal(r.body.results[1].ok,false);assert.match(r.body.results[1].error,/changed/i);
});
test('deleted students cannot restore an existing matricule session and disappear from state',async()=>{
 assert.equal((await request({deletedSession:true,op:'state'})).status,401);
});
test('student controls include per-row and select-all checkboxes and escape names',()=>{
 const old=pupil('one');old.data.name='<script>alert(1)</script>';const html=studentManagementTable([old],{selected:new Set(['one'])});
 assert.match(html,/data-student-select-all/);assert.match(html,/data-student-check[^>]*checked/);for(const action of ['promote','demote','transfer','delete'])assert.match(html,new RegExp('data-movement="'+action+'"'));assert.ok(!html.includes('<script>'));assert.match(html,/&lt;script&gt;/);assert.ok(html.startsWith('<div class="table-scroll record-list'));
});
test('manual sheets have six blank mark columns, numbered rows, repeated headings and separate class pages',()=>{
 const roll=Array.from({length:52},(_,i)=>({...pupil(String(i)),data:{...pupil(String(i)).data,name:'STUDENT '+String(i).padStart(2,'0')}}));roll.push({...pupil('other'),data:{...pupil('other').data,class:'Form 3A'}});
 const copy=structuredClone(roll),html=classMarkSheet(roll,{year,subject:'Computer Science',teacher:'TEST TEACHER'});
 assert.equal((html.match(/class="print-page class-mark-sheet"/g)||[]).length,3);assert.equal((html.match(/class="manual-mark"><\/td>/g)||[]).length,53*6);for(let i=1;i<=6;i++)assert.equal((html.match(new RegExp('Seq\\. '+i+'<br>/20','g'))||[]).length,3);assert.match(html,/<td>52<\/td>/);assert.match(html,/Page 2\/2/);assert.match(html,/Computer Science/);assert.deepEqual(roll,copy);assert.ok(!html.includes('data-action='));
});

import fs from 'node:fs';
import vm from 'node:vm';
const appSource=fs.readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
test('bulk select-all changes only displayed rows and individual checkboxes toggle membership',()=>{
 const checks=[{value:'one'},{value:'two'},{value:'hidden'}],trs=checks.map((input,i)=>({hidden:i===2,querySelector:()=>input}));
 const c={selectedStudents:new Set(['hidden']),document:{querySelectorAll:()=>trs},updateStudentSelection(){},e:{target:{checked:true,matches:selector=>selector==='[data-student-select-all]'}}};vm.createContext(c);
 const start=appSource.indexOf(" if(e.target.matches('[data-student-check]'))"),end=appSource.indexOf("if(e.target.form",start);
 const snippet='(function(){'+appSource.slice(start,end)+'})()';vm.runInContext(snippet,c);assert.deepEqual([...c.selectedStudents].sort(),['hidden','one','two']);
 c.e.target.checked=false;vm.runInContext(snippet,c);assert.deepEqual([...c.selectedStudents],['hidden']);
 c.e.target={checked:true,value:'two',matches:selector=>selector==='[data-student-check]'};vm.runInContext(snippet,c);assert.ok(c.selectedStudents.has('two'));
});
test('selection count, select-all mixed state and bulk-button availability track selected students',()=>{
 const checks=[{value:'one',closest:()=>({hidden:false})},{value:'two',closest:()=>({hidden:false})}],all={},count={},button={};
 const c={selectedStudents:new Set(['one']),t:en=>en,document:{querySelectorAll:s=>s==='[data-student-check]'?checks:[button],querySelector:s=>s==='[data-student-select-all]'?all:count}};vm.createContext(c);
 vm.runInContext(appSource.slice(appSource.indexOf('function updateStudentSelection(){'),appSource.indexOf('function openStudentAction(')),c);c.updateStudentSelection();assert.equal(all.indeterminate,true);assert.equal(all.checked,false);assert.equal(count.textContent,'1 students selected');assert.equal(button.disabled,false);
 c.selectedStudents.clear();c.updateStudentSelection();assert.equal(button.disabled,true);assert.equal(all.indeterminate,false);
});
test('partial batch retry sends only failed records and keeps successful versions locally',async()=>{
 const original=pupil('one'),failed=pupil('two'),calls=[],form={elements:{},querySelector:s=>s==='[data-student-action-result]'?{}:{}};
 const c={portalYear:year,studentActionDraft:[original,failed],selectedStudents:new Set(['one','two']),rows:[original,failed],t:en=>en,esc:String,byId:id=>c.rows.find(r=>r.id===id),updateStudentSelection(){},api:async(op,body)=>{calls.push({op,body});return {results:[{id:'one',ok:true,row:{...original,version:4}},{id:'two',ok:false,error:'Record changed'}]};}};vm.createContext(c);
 vm.runInContext(appSource.slice(appSource.indexOf('async function submitStudentAction('),appSource.indexOf('function studentListRoster(')),c);
 await assert.rejects(c.submitStudentAction(form,{action:'promote',class:'Form 3A',reason:'Correction'}),/Some students/);
 assert.equal(c.rows[0].version,4);assert.equal(c.selectedStudents.has('one'),false);assert.equal(c.studentActionDraft.length,1);assert.equal(c.studentActionDraft[0].id,'two');assert.equal(calls[0].body.students.length,2);
});
