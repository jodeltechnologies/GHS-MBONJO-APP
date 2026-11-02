import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import handler from '../api/school.js';
import {CONTROL_ID} from '../src/school-controls.js';
process.env.SUPABASE_URL='https://qa-fixture.test';process.env.SUPABASE_SERVICE_ROLE_KEY='fixture-key';process.env.SESSION_SECRET='qa-only-signing-secret-never-used-in-production';process.env.APP_ORIGIN='https://qa-school.test';
const year='2026/2027',cls='Form 2A';
const pupil={id:'11111111-1111-4111-8111-111111111111',kind:'student',version:1,data:{name:'TEST STUDENT',class:cls,academicYear:year,status:'active',subjects:['Computer Science','Mathematics'],enrolments:{[year]:{class:cls,status:'active'}}}};
const lesson={id:'22222222-2222-4222-8222-222222222222',kind:'assignment',data:{teacherId:'teacher',class:cls,year,subject:'Computer Science'}};
const mark={id:'33333333-3333-4333-8333-333333333333',kind:'mark',version:1,data:{studentId:pupil.id,class:cls,year,subject:'Computer Science',assessment:'Sequence 1',mark:12,coefficient:1,status:'draft'}};
async function save({role='teacher',old=mark,data=mark.data,kind='mark',open=true}={}){
 const core=[{id:'teacher',kind:'profile',data:{name:'TEST TEACHER',role,department:'Computer Science',active:true,authId:'qa-auth'}},pupil,{id:'class',kind:'classroom',data:{name:cls,stream:'Science',subjects:['Computer Science','Mathematics']}},lesson,{id:CONTROL_ID,kind:'school_control',data:{activeYear:year,markWindows:{[year]:{assessment:'all',status:open?'open':'closed'}}}}];
 const original=globalThis.fetch,writes=[];
 globalThis.fetch=async(url,options={})=>{
  if(url.includes('/auth/v1/user'))return Response.json({id:'qa-auth'});
  if(url.includes('/rpc/school_save_record')){const b=JSON.parse(options.body);writes.push(b);return Response.json([{id:b.record_id||'created',kind:b.record_kind,data:b.record_data,version:2}]);}
  if(url.includes('kind=in.(profile'))return Response.json(structuredClone(core));
  if(old&&url.includes('id=eq.'+old.id))return Response.json([old]);
  return Response.json([]);
 };
 const raw=Buffer.from(JSON.stringify({authId:'qa-auth',accessToken:'qa-access',exp:Date.now()+3600000})).toString('base64url');
 const cookie='school_session='+raw+'.'+crypto.createHmac('sha256',process.env.SESSION_SECRET).update(raw).digest('base64url');let status=200,body;
 try{await handler({method:'POST',headers:{origin:process.env.APP_ORIGIN,cookie},body:{op:'save',kind,id:old?.id,version:old?.version,data}},{setHeader(){},status(n){status=n;return this;},json(v){body=v;return this;}});}finally{globalThis.fetch=original;}
 return {status,body,writes};
}
test('teacher and HOD cannot overwrite an unassigned original mark with assigned subject data',async()=>{
 for(const role of ['teacher','hod']){const r=await save({role,old:{...mark,data:{...mark.data,subject:'Mathematics'}},data:{...mark.data,mark:19}});assert.equal(r.status,403);assert.equal(r.writes.length,0);}
});
test('teacher and HOD cannot revise or withdraw an already published mark',async()=>{
 for(const role of ['teacher','hod'])for(const status of ['draft','pending','published']){const r=await save({role,old:{...mark,data:{...mark.data,status:'published'}},data:{...mark.data,mark:19,status}});assert.equal(r.status,403);assert.equal(r.writes.length,0);}
});
test('ordinary teacher edits keep mark student, class, subject, assessment and year fixed',async()=>{
 for(const [field,value] of [['studentId','other'],['class','Form 2B'],['subject','Mathematics'],['assessment','Sequence 2'],['year','2025/2026']]){const r=await save({data:{...mark.data,[field]:value}});assert.equal(r.status,403,field);assert.equal(r.writes.length,0);}
});
test('authorized draft score updates and new marks still save normally',async()=>{
 for(const role of ['teacher','hod']){const r=await save({role,data:{...mark.data,mark:0}});assert.equal(r.status,200,JSON.stringify(r.body));assert.equal(r.writes[0].record_data.mark,0);}
 const created=await save({old:null});assert.equal(created.status,200);assert.equal(created.writes.length,1);
});
test('administration may withdraw a published mark while entry is closed, then teacher edits require reopening',async()=>{
 const published={...mark,data:{...mark.data,status:'published'}};
 for(const role of ['principal','vp']){const r=await save({role,old:published,data:{...published.data,status:'draft'},open:false});assert.equal(r.status,200,JSON.stringify(r.body));}
 const closed=await save({data:{...mark.data,mark:15},open:false});assert.equal(closed.status,403);assert.equal(closed.writes.length,0);
});
test('a teacher cannot move another lesson attendance record into their own lesson',async()=>{
 const attendance={...mark,kind:'attendance',data:{studentId:pupil.id,class:cls,date:'2026-11-02',year,assignmentId:'other-lesson',subject:'Mathematics',status:'absent'}};
 const r=await save({kind:'attendance',old:attendance,data:{...attendance.data,assignmentId:lesson.id,subject:'Computer Science',status:'present'}});assert.equal(r.status,403);assert.equal(r.writes.length,0);
});
