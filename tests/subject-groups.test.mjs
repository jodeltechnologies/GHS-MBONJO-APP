import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {studentsInYear,enrolment} from '../src/academics.js';
import {studies} from '../src/domain.js';
import {subjectGroupRoster,subjectGroupChange} from '../src/subject-groups.js';
import {canRead} from '../src/access.js';
import {CONTROL_ID} from '../src/school-controls.js';
import handler from '../api/school.js';
const year='2025/2026',subject='Computer Science',cls='Form 1A';
const classroom={id:'10000000-0000-4000-8000-000000000001',kind:'classroom',version:2,data:{name:cls,stream:'Science',subjects:['Mathematics',subject]}};
const pupils=Array.from({length:52},(_,i)=>({id:`20000000-0000-4000-8000-${String(i).padStart(12,'0')}`,kind:'student',version:1,data:{name:'Student '+String(i+1).padStart(2,'0'),matricule:'SAMPLE-'+i,class:cls,academicYear:year,status:'active',subjects:[subject],enrolments:{[year]:{class:cls,status:'active'}}}}));
const ids=pupils.slice(0,12).map(r=>r.id);
const records=()=>structuredClone([classroom,...pupils]);
function selectedRows(){const rows=records();rows[0].data=subjectGroupChange(rows,rows[0],{year,subject,mode:'selected',studentIds:ids,actor:'vp'});return rows;}
test('a 52-student class can have exactly 12 CSC students, despite compulsory and extra subject defaults',()=>{
 const rows=selectedRows(),list=subjectGroupRoster(rows,{year,cls,subject});assert.equal(list.length,52);assert.equal(list.filter(r=>r.selected).length,12);
 const selected=studentsInYear(rows,year).filter(r=>studies(r.data,subject));assert.deepEqual(selected.map(r=>r.id),ids);
 assert.ok(studentsInYear(rows,year).every(r=>studies(r.data,'Mathematics')));
 const resource={kind:'resource',data:{class:cls,subject,status:'published'}};
 for(const pupil of studentsInYear(rows,year))assert.equal(canRead({...pupil.data,id:pupil.id,role:'student'},resource,rows),ids.includes(pupil.id));
});
test('all mode restores everyone, zero selected is explicit and new students do not join a selected group',()=>{
 const rows=selectedRows();rows.push({...pupils[0],id:'new',data:{...pupils[0].data,name:'New student'}});
 assert.equal(subjectGroupRoster(rows,{year,cls,subject}).filter(r=>r.selected).length,12);
 rows[0].data=subjectGroupChange(rows,rows[0],{year,subject,mode:'all',studentIds:[],actor:'principal'});
 assert.equal(subjectGroupRoster(rows,{year,cls,subject}).filter(r=>r.selected).length,53);
 rows[0].data=subjectGroupChange(rows,rows[0],{year,subject,mode:'selected',studentIds:[],actor:'principal'});
 assert.equal(subjectGroupRoster(rows,{year,cls,subject}).filter(r=>r.selected).length,0);
});
test('groups are scoped to the class and academic year and can add an optional subject',()=>{
 const rows=selectedRows();rows[0].data.subjectGroups['2026/2027']={[subject]:{mode:'selected',studentIds:[pupils[20].id]}};
 assert.ok(studies(enrolment(pupils[0].data,rows,year,pupils[0].id),subject));
 assert.equal(studies(enrolment(pupils[0].data,rows,'2026/2027',pupils[0].id),subject),false);
 assert.ok(studies(enrolment(pupils[20].data,rows,'2026/2027',pupils[20].id),subject));
 rows[0].data=subjectGroupChange(rows,rows[0],{year,subject:'Food and Nutrition',mode:'selected',studentIds:[pupils[0].id],actor:'vp'});
 assert.ok(studies(enrolment(pupils[0].data,rows,year,pupils[0].id),'Food and Nutrition'));
 assert.equal(studies(enrolment(pupils[1].data,rows,year,pupils[1].id),'Food and Nutrition'),false);
 const other={...pupils[0].data,class:'Form 1B'};assert.ok(studies(enrolment(other,rows,year,pupils[0].id),subject));
});
test('invalid subjects, stale class membership and inactive students are rejected, duplicate selections count once',()=>{
 const rows=records();assert.throws(()=>subjectGroupChange(rows,rows[0],{year,subject,mode:'selected',studentIds:['outsider']}),/no longer active/);
 rows[1].data.status='dismissed';assert.throws(()=>subjectGroupChange(rows,rows[0],{year,subject,mode:'selected',studentIds:[rows[1].id]}),/no longer active/);
 assert.throws(()=>subjectGroupChange(rows,rows[0],{year,subject:'Fake subject',mode:'all',studentIds:[]}),/valid subject/);
 const data=subjectGroupChange(rows,rows[0],{year,subject,mode:'selected',studentIds:[ids[1],ids[1]],actor:'vp'});assert.deepEqual(data.subjectGroups[year][subject].studentIds,[ids[1]]);
});
process.env.SUPABASE_URL='https://database.test';process.env.SUPABASE_SERVICE_ROLE_KEY='test-key';process.env.SESSION_SECRET='subject-test-secret-of-at-least-32-characters';process.env.APP_ORIGIN='https://school.test';
function apiFixture(){
 const core=records();core.push({id:'actor',kind:'profile',version:1,data:{name:'School leader',authId:'owner',role:'principal',active:true}}, {id:CONTROL_ID,kind:'school_control',version:1,data:{activeYear:year,markWindows:{[year]:{status:'open',assessment:'all'}}}}, {id:'30000000-0000-4000-8000-000000000001',kind:'assignment',data:{class:cls,subject,teacherId:'actor',year}});
 const marks=pupils.slice(0,13).flatMap((p,i)=>[{id:'math-'+i,kind:'mark',data:{studentId:p.id,class:cls,year,subject:'Mathematics',assessment:'Sequence 1',mark:10,coefficient:1,status:'published'}},{id:'csc-'+i,kind:'mark',data:{studentId:p.id,class:cls,year,subject,assessment:'Sequence 1',mark:i===12?0:14,coefficient:1,status:'published'}}]);
 const resources=[{id:'resource',kind:'resource',data:{class:cls,subject,status:'published',title:'CSC lesson'}}];
 let writes=[];
 async function call(role,body,{studentId}={}){
  core.find(r=>r.id==='actor').data.role=role;
  globalThis.fetch=async(url,options={})=>{
   let result=[];
   if(url.includes('/auth/v1/user'))result={id:'owner'};
   else if(url.includes('/rpc/school_save_record')){const b=JSON.parse(options.body);writes.push(b);const old=core.find(r=>r.id===b.record_id);if(old){old.data=structuredClone(b.record_data);old.version++;result=[structuredClone(old)];}else result=[{id:'new-record',kind:b.record_kind,data:b.record_data}];}
   else if(url.includes('kind=in.(profile'))result=structuredClone(core);
   else if(url.includes('kind=in.(resource'))result=structuredClone(resources);
   else if(url.includes('kind=eq.mark'))result=structuredClone(marks);
   return {ok:true,status:200,json:async()=>result};
  };
  const payload=studentId?{studentId,exp:Date.now()+100000}:{authId:'owner',accessToken:'access',exp:Date.now()+100000};
  const v=Buffer.from(JSON.stringify(payload)).toString('base64url'),cookie=v+'.'+crypto.createHmac('sha256',process.env.SESSION_SECRET).update(v).digest('base64url');
  const res={statusCode:200,setHeader(){},status(n){this.statusCode=n;return this;},json(value){this.body=value;return this;}};
  await handler({method:'POST',headers:{origin:process.env.APP_ORIGIN,cookie:'school_session='+cookie},body},res);return res;
 }
 return {call,core,marks,writes};
}
test('principal and VP save the subject group once, with role, academic-year, version and roster guards',async()=>{
 const f=apiFixture(),query={op:'subject-roster',year,class:cls,subject};
 for(const role of ['teacher','hod','discipline','parent'])assert.equal((await f.call(role,query)).statusCode,403);
 const roster=await f.call('vp',query);assert.equal(roster.statusCode,200);assert.equal(roster.body.students.length,52);
 const body={op:'subject-group',year,class:cls,subject,mode:'selected',studentIds:ids,version:roster.body.version,token:roster.body.token};
 assert.equal((await f.call('vp',{...body,version:0})).statusCode,409);
 assert.equal((await f.call('vp',{...body,year:'2026/2027'})).statusCode,409);
 assert.equal((await f.call('vp',{...body,studentIds:['outsider']})).statusCode,400);
 const saved=await f.call('vp',body);assert.equal(saved.statusCode,200);assert.equal(saved.body.selected,12);assert.equal(saved.body.total,52);assert.equal(f.writes.length,1);assert.equal(f.writes[0].expected_version,2);
 assert.equal((await f.call('principal',body)).statusCode,409);
});
test('roster changes block stale saves and invalid modes do not reach the database',async()=>{
 const f=apiFixture(),query={op:'subject-roster',year,class:cls,subject},roster=await f.call('principal',query);
 const body={op:'subject-group',year,class:cls,subject,mode:'selected',studentIds:ids,version:roster.body.version,token:roster.body.token};
 f.core.find(r=>r.id===pupils[20].id).version++;
 assert.equal((await f.call('principal',body)).statusCode,409);assert.equal(f.writes.length,0);
});
test('report calculations exclude leftover CSC marks for non-participants without deleting stored marks',async()=>{
 const f=apiFixture();f.core[0].data=subjectGroupChange(f.core,f.core[0],{year,subject,mode:'selected',studentIds:ids,actor:'principal'});
 const report=await f.call('principal',{op:'reports',year,class:cls,assessment:'Sequence 1'});assert.equal(report.statusCode,200);
 const selected=report.body.report.sheets.find(s=>s.student.id===pupils[0].id),excluded=report.body.report.sheets.find(s=>s.student.id===pupils[12].id);
 assert.equal(selected.totals.average,12);assert.equal(excluded.totals.average,10);assert.equal(excluded.rows.some(r=>r.subject===subject),false);assert.equal(report.body.report.subjects[subject].sat,12);
 assert.equal(f.marks.length,26);assert.equal(f.writes.length,0);
});
test('server prevents marks and attendance for excluded students and resources are visible only to selected students',async()=>{
 const f=apiFixture();f.core[0].data=subjectGroupChange(f.core,f.core[0],{year,subject,mode:'selected',studentIds:ids,actor:'principal'});
 const mark={studentId:pupils[12].id,class:cls,subject,assessment:'Sequence 1',year,mark:15,coefficient:1,status:'draft'};
 const denied=await f.call('principal',{op:'save',kind:'mark',data:mark});assert.equal(denied.statusCode,400);assert.match(denied.body.error,/not enrolled/);
 const attendance=await f.call('principal',{op:'save',kind:'attendance',data:{studentId:pupils[12].id,class:cls,assignmentId:'30000000-0000-4000-8000-000000000001',date:'2026-10-13',status:'present'}});assert.equal(attendance.statusCode,400);assert.match(attendance.body.error,/not enrolled/);
 const included=await f.call('student',{op:'state'},{studentId:pupils[0].id});assert.equal(included.statusCode,200);assert.ok(included.body.rows.some(r=>r.kind==='resource'));
 const excluded=await f.call('student',{op:'state'},{studentId:pupils[12].id});assert.equal(excluded.statusCode,200);assert.ok(!excluded.body.rows.some(r=>r.kind==='resource'));assert.equal(f.writes.length,0);
});
test('marks and attendance requests refresh subject groups and student accounts receive only their own membership IDs',async()=>{
 const f=apiFixture();f.core[0].data=subjectGroupChange(f.core,f.core[0],{year,subject,mode:'selected',studentIds:ids,actor:'principal'});
 const marks=await f.call('teacher',{op:'marks',year,class:cls});assert.equal(marks.statusCode,200);assert.equal(marks.body.contextRows.filter(r=>r.kind==='student').length,52);assert.ok(marks.body.contextRows.some(r=>r.kind==='classroom'&&r.data.subjectGroups[year][subject].studentIds.length===12));
 const attendance=await f.call('teacher',{op:'attendance-register',assignmentId:'30000000-0000-4000-8000-000000000001',date:'2026-10-13'});assert.equal(attendance.statusCode,200);assert.ok(attendance.body.contextRows.some(r=>r.kind==='classroom'));
 const state=await f.call('student',{op:'state'},{studentId:ids[0]});const group=state.body.rows.find(r=>r.kind==='classroom').data.subjectGroups[year][subject];assert.deepEqual(group.studentIds,[ids[0]]);
});
test('ordinary class edits preserve validated subject groups rather than accepting forged membership',async()=>{
 const f=apiFixture();f.core[0].data=subjectGroupChange(f.core,f.core[0],{year,subject,mode:'selected',studentIds:ids,actor:'principal'});
 const forged={...f.core[0].data,subjectGroups:{[year]:{[subject]:{mode:'all',studentIds:[]}}}};
 const edited=await f.call('principal',{op:'save',kind:'classroom',id:f.core[0].id,version:2,data:forged});assert.equal(edited.statusCode,200);assert.deepEqual(edited.body.row.data.subjectGroups[year][subject].studentIds,ids);
});
