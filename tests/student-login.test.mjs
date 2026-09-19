import test from 'node:test';import assert from 'node:assert/strict';import handler from '../api/school.js';
import {normalizeBirthDate} from '../src/domain.js';
process.env.SUPABASE_URL='https://example.supabase.co';process.env.SUPABASE_SERVICE_ROLE_KEY='test';process.env.SESSION_SECRET='x'.repeat(64);process.env.APP_ORIGIN='https://school.example';
const students=[
 {id:'00000000-0000-4000-8000-000000000001',kind:'student',data:{name:'Active Student',class:'Form 5A',matricule:'233255477',birthDate:'2010-04-11',status:'active'}},
 {id:'00000000-0000-4000-8000-000000000002',kind:'student',data:{name:'Left School',class:'Form 5A',matricule:'233000002',birthDate:'2010-05-12',status:'transferred out'}},
 {id:'00000000-0000-4000-8000-000000000003',kind:'student',data:{name:'No Birth Date',class:'Form 5A',matricule:'233000003',status:'active'}}];
async function login(body){
 const original=globalThis.fetch;let cookie='';
 globalThis.fetch=async url=>{const u=new URL(url);
  if(u.pathname.endsWith('/rpc/school_rate_limit'))return Response.json(1);
  if(u.pathname.endsWith('/school_records')){const m=u.searchParams.get('data->>matricule')?.slice(3);return Response.json(students.filter(r=>decodeURIComponent(m||'')===r.data.matricule));}
  throw Error('Unexpected mock path '+u.pathname);};
 let status=200,value;
 try{await handler({method:'POST',headers:{origin:process.env.APP_ORIGIN},socket:{remoteAddress:'1.1.1.1'},body:{op:'login',mode:'student',...body}},{setHeader(k,v){if(k==='Set-Cookie')cookie=v;},status(n){status=n;return this},json(v){value=v;return this}});}
 finally{globalThis.fetch=original;}
 return {status,value,cookie};}

test('student signs in with matricule and the matching date of birth',async()=>{
 const a=await login({matricule:'233255477',birthDate:'2010-04-11'});
 assert.equal(a.status,200,JSON.stringify(a.value));
 assert.ok(a.cookie.startsWith('school_session='));
 assert.ok(a.cookie.includes('HttpOnly'));});

test('spacing and lowercase in the matricule still sign the student in',async()=>{
 assert.equal((await login({matricule:' 233 255-477 ',birthDate:'2010-04-11'})).status,200);});

test('a known matricule without the right date of birth is refused',async()=>{
 const a=await login({matricule:'233255477',birthDate:'2010-04-12'});
 assert.equal(a.status,401);
 assert.equal(a.value.error,'Invalid login.');
 assert.equal(a.cookie,'');});

test('a matricule on its own no longer signs anyone in',async()=>{
 for(const body of [{matricule:'233255477'},{matricule:'233255477',birthDate:''},{matricule:'233255477',birthDate:'not a date'}])
  assert.equal((await login(body)).status,401,JSON.stringify(body));});

test('the login gate no longer depends on an environment variable',async()=>{
 delete process.env.ALLOW_MATRICULE_LOGIN;
 const a=await login({matricule:'233255477',birthDate:'2010-04-11'});
 assert.equal(a.status,200,JSON.stringify(a.value));});

test('a transferred-out student cannot sign in even with the right date',async()=>{
 assert.equal((await login({matricule:'233000002',birthDate:'2010-05-12'})).status,401);});

test('a record with no date of birth is told to contact the administration',async()=>{
 const a=await login({matricule:'233000003',birthDate:'2010-06-13'});
 assert.equal(a.status,403);
 assert.match(a.value.error,/date of birth/);});

test('an unknown matricule gives the same message as a wrong date',async()=>{
 const unknown=await login({matricule:'999999999',birthDate:'2010-04-11'});
 const wrongDate=await login({matricule:'233255477',birthDate:'2001-01-01'});
 assert.equal(unknown.status,wrongDate.status);
 assert.equal(unknown.value.error,wrongDate.value.error);});

test('date of birth is read without guessing between day and month',()=>{
 assert.equal(normalizeBirthDate('2010-04-11'),'2010-04-11');
 assert.equal(normalizeBirthDate('11/04/2010'),'2010-04-11');
 assert.equal(normalizeBirthDate('3/4/2010'),'2010-04-03');
 assert.equal(normalizeBirthDate('2010-02-30'),'');
 assert.equal(normalizeBirthDate('2010-13-01'),'');
 assert.equal(normalizeBirthDate(''),'');
 assert.equal(normalizeBirthDate(null),'');
 assert.equal(normalizeBirthDate('11 April 2010'),'');});
