import bundledStudents from './data/students.json' with {type:'json'};
import {validateQuestions,publicQuestions,gradeAttempt,acceptAnswers} from '../src/exams.js';
import {enrolment,availableSubjects,academicYear} from '../src/academics.js';
import {providers,chooseModel} from '../src/providers.js';
import {trustedOrigin} from '../src/origin.js';
import {effectiveRole,canUseWriter,colleagueContacts} from '../src/posts.js';
import {writingInstruction,cleanGeneratedText} from '../src/writing-style.js';
import crypto from 'node:crypto';
import {attestationText,classes,roles,normalizeMatricule,normalizeBirthDate,validateRecord,generateTimetable,normalizePreferences,studies,reportSummary} from '../src/domain.js';
import {canRead,canWrite,admin,assigned} from '../src/access.js';
const base=()=>process.env.SUPABASE_URL?.replace(/\/$/,''),key=()=>process.env.SUPABASE_SERVICE_ROLE_KEY;
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status})};
async function db(path,method='GET',body){const r=await fetch(`${base()}/rest/v1/${path}`,{method,headers:{apikey:key(),Authorization:`Bearer ${key()}`,'Content-Type':'application/json',Prefer:'return=representation'},body:body===undefined?undefined:JSON.stringify(body)});const data=await r.json().catch(()=>null);if(!r.ok&&data?.code==='40001')fail('Record changed. Refresh before saving.',409);if(!r.ok)fail(r.status===409?'Duplicate record. Check matricule, reference, or assessment.':'Database operation failed. Verify setup or retry.',r.status===409?409:503);return data;}
async function allRecords(filter=''){let out=[];for(let n=0;n<50000;n+=1000){const a=await db(`school_records?select=*&order=created_at.asc,id.asc&limit=1000&offset=${n}${filter?'&'+filter:''}`);out.push(...a);if(a.length<1000)return out;}fail('Record limit reached. Archive old years before continuing.',503);}
const sign=v=>crypto.createHmac('sha256',process.env.SESSION_SECRET).update(v).digest('base64url');
function cookie(res,value,age=3600){res.setHeader('Set-Cookie',`school_session=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${age}`);}
function issue(res,payload,age=3600){const v=Buffer.from(JSON.stringify({...payload,exp:Date.now()+age*1000})).toString('base64url');cookie(res,`${v}.${sign(v)}`,age);}
function session(req){const v=(req.headers.cookie||'').split('; ').find(x=>x.startsWith('school_session='))?.split('=')[1];if(!v)return null;const [data,sig]=v.split('.');if(!data||!sig)return null;const expected=sign(data);if(sig.length!==expected.length||!crypto.timingSafeEqual(Buffer.from(sig),Buffer.from(expected)))return null;try{const s=JSON.parse(Buffer.from(data,'base64url'));return s.exp>Date.now()?s:null;}catch{return null;}}
function crypt(value,decrypt=false){const k=crypto.createHash('sha256').update(process.env.KEY_ENCRYPTION_SECRET||fail('Encryption secret not configured.',503)).digest();if(decrypt){const [iv,tag,ct]=value.split('.').map(x=>Buffer.from(x,'base64'));const c=crypto.createDecipheriv('aes-256-gcm',k,iv);c.setAuthTag(tag);return Buffer.concat([c.update(ct),c.final()]).toString();}const iv=crypto.randomBytes(12),c=crypto.createCipheriv('aes-256-gcm',k,iv),ct=Buffer.concat([c.update(value),c.final()]);return [iv,c.getAuthTag(),ct].map(x=>x.toString('base64')).join('.');}
async function rate(req,scope,max=20){const ip=req.headers['x-vercel-forwarded-for']||req.socket?.remoteAddress||'unknown';const bucket=crypto.createHash('sha256').update(`${scope}:${ip}`).digest('hex');const n=await db('rpc/school_rate_limit','POST',{bucket});if(n>max)fail('Too many attempts. Try again in 15 minutes.',429);}
const publicKinds=['event','post','gallery','textbook'];
const redact=(p,r)=>{if(p.role==='student'&&r.kind==='resource')return {...r,data:{...r.data,questions:publicQuestions(r.data.questions)}};if(r.kind==='exam_attempt'&&p.role==='student')return {...r,data:{...r.data,questions:publicQuestions(r.data.questions)}};if(r.kind==='student'&&!admin(p)&&p.role!=='student'&&p.role!=='parent'){const {name,class:cls,gender,photo,subjects,requiredSubjects,status}=r.data;return {...r,data:{name,class:cls,gender,photo,subjects,requiredSubjects,status}};}return r;};
export default async function handler(req,res){res.setHeader('Cache-Control','no-store');try{
 if(!base()||!key()||!process.env.SESSION_SECRET||process.env.SESSION_SECRET.length<32)fail('The school portal is awaiting secure database setup. The public website remains available.',503);
 if(req.method!=='POST')fail('Method not allowed.',405);
 if(!trustedOrigin(req.headers.origin))fail('Untrusted request origin.',403);
 const b=typeof req.body==='string'?JSON.parse(req.body):req.body||{};if(JSON.stringify(b).length>3500000)fail('Upload exceeds 3 MB.',413);
 const op=b.op;
 if(op==='logout'){cookie(res,'',0);return res.json({ok:true});}
 if(op==='public'){const rows=await db('school_records?select=*&kind=in.(event,post,gallery,textbook)&data->>status=eq.published');const imported=await db('school_records?select=data&kind=eq.event&data->>sourceId=like.calendar-2026-*');return res.json({rows,calendarOverrides:imported.map(r=>r.data.sourceId)});}
 if(op==='verify'){await rate(req,'verify',60);if(!/^[a-f0-9]{48}$/.test(b.token||''))fail('Document not found.',404);const rows=await db(`school_records?kind=eq.document&data->>token=eq.${b.token}`);const d=rows[0]?.data;if(!d)fail('Document not found.',404);return res.json({document:{name:d.name,reference:d.reference,kind:d.kind,issueDate:d.issueDate,status:d.status}});}
 if(op==='login'){
  await rate(req,'login');
  if(b.mode==='student'){
   // A matricule is an identifier, not a secret: it is printed on report cards and known to classmates.
   // The student's own date of birth is required as a second factor. It is never sent to the database
   // in a query string; the record is fetched by matricule and the date compared here.
   const m=normalizeMatricule(b.matricule);const dob=normalizeBirthDate(b.birthDate);
   if(!/^[A-Z0-9]{5,25}$/.test(m)||!dob)fail('Invalid login.',401);
   const rows=await db(`school_records?kind=eq.student&data->>matricule=eq.${encodeURIComponent(m)}`);const r=rows[0];
   if(!r||['dismissed','transferred out'].includes(r.data.status))fail('Invalid login.',401);
   const stored=normalizeBirthDate(r.data.birthDate);
   if(!stored)fail('Your school record has no date of birth yet. Ask the school administration to complete it.',403);
   if(stored!==dob)fail('Invalid login.',401);
   issue(res,{studentId:r.id});return res.json({ok:true});
  }
  const r=await fetch(`${base()}/auth/v1/token?grant_type=password`,{method:'POST',headers:{apikey:key(),'Content-Type':'application/json'},body:JSON.stringify({email:b.email,password:b.password})});const auth=await r.json();if(!r.ok)fail('Email or password is incorrect.',401);
  const profiles=await db(`school_records?kind=eq.profile&data->>authId=eq.${auth.user.id}`);if(!profiles[0]||profiles[0].data.active===false)fail('Contact the principal to activate your school role.',403);issue(res,{authId:auth.user.id,accessToken:auth.access_token});return res.json({ok:true});
 }
 const s=session(req);if(!s)fail('Please sign in.',401);
 if(op==='backup-page'&&s.studentId)fail('Only the principal can export school records.',403);
 const all=await allRecords(op==='backup-page'?'kind=eq.profile':'kind=in.(profile,student,assignment,classroom,subject)');let p;
 if(s.studentId){const r=all.find(r=>r.id===s.studentId&&r.kind==='student');if(!r||['dismissed','transferred out'].includes(r.data.status))fail('Account inactive.',401);p={...r.data,id:r.id,role:'student'};}
 else {const auth=await fetch(`${base()}/auth/v1/user`,{headers:{apikey:key(),Authorization:`Bearer ${s.accessToken}`}});if(!auth.ok)fail('Session expired. Please sign in again.',401);const r=all.find(r=>r.kind==='profile'&&r.data.authId===s.authId&&r.data.active!==false);if(!r)fail('Account inactive.',403);p={...r.data,id:r.id,post:r.data.role,role:effectiveRole(r.data.role)};}
 for(const r of all.filter(r=>r.kind==='student'))r.data=enrolment(r.data,all);if(p.role==='student')p=enrolment(p,all);
 const classNames=[...new Set([...classes,...all.filter(r=>r.kind==='classroom').map(r=>r.data.name)])];
 const enc=encodeURIComponent;
 if(['state','save'].includes(op)){
  all.push(...await allRecords('kind=in.(resource,post,event,gallery,textbook,document,timetable,document_request,exam_attempt)'));
  if(op==='state'){
   const cutoff=new Date(Date.now()-30*86400000).toISOString().slice(0,10);
   all.push(...await allRecords('kind=eq.attendance&data->>date=gte.'+cutoff));
   const now=new Date(),startYear=now.getUTCMonth()>=8?now.getUTCFullYear():now.getUTCFullYear()-1;
   all.push(...await allRecords('kind=eq.mark&data->>year=eq.'+enc(startYear+'/'+(startYear+1))));
   all.push(...await allRecords('kind=eq.submission&data->>updatedAt=gte.'+cutoff));
  }else if(b.id&&!all.some(r=>r.id===b.id)){
   if(!/^[0-9a-f-]{36}$/.test(b.id))fail('Invalid record ID.');all.push(...await allRecords('id=eq.'+b.id));
  }
 }
 if(op==='marks'){if(!['principal','vp','teacher','hod'].includes(p.role))fail('Staff marks access required.',403);if(!/^\d{4}\/\d{4}$/.test(b.year||''))fail('Choose an academic year such as 2026/2027.');if(b.class&&!classNames.includes(b.class))fail('Choose a valid class.');const found=await allRecords('kind=eq.mark&data->>year=eq.'+enc(b.year)+(b.class?'&data->>class=eq.'+enc(b.class):''));return res.json({rows:found.filter(r=>canRead(p,r,all))});}
 if(op==='reports')all.push(...await allRecords('kind=eq.mark&data->>class=eq.'+enc(b.class)+'&data->>year=eq.'+enc(b.year)+'&data->>assessment=eq.'+enc(b.assessment)+'&data->>status=eq.published'));
 if(op==='state'){const visible=all.filter(r=>canRead(p,r,all)).map(r=>redact(p,r));for(const r of all.filter(r=>r.kind==='profile'&&r.data.role!=='parent'))if(!visible.some(x=>x.id===r.id))visible.push({id:r.id,kind:'directory',data:{name:r.data.name}});return res.json({profile:p,rows:visible});}
 if(op==='reports'){
  if(!['principal','vp','student','parent'].includes(p.role))fail('Only the administration, student or linked parent can access a full report.',403);
  let students=b.year===academicYear()?all.filter(r=>r.kind==='student'&&r.data.class===b.class):[];
  const marks=all.filter(r=>r.kind==='mark'&&r.data.class===b.class&&r.data.year===b.year&&r.data.assessment===b.assessment&&r.data.status==='published');
  for(const m of marks){const r=all.find(r=>r.kind==='student'&&r.id===m.data.studentId);if(r&&!students.some(x=>x.id===r.id))students.push({...r,data:m.data.studentSnapshot||{...r.data,class:b.class}});}
  const avgs=students.map(s=>({id:s.id,average:reportSummary(marks.filter(m=>m.data.studentId===s.id).map(m=>m.data)).average})).filter(x=>x.average!==null);
  const permitted=students.filter(r=>canRead(p,r,all));
  return res.json({reports:permitted.map(student=>({student,marks:marks.filter(m=>m.data.studentId===student.id),subjects:[...new Set([...(student.data.requiredSubjects||[]),...(student.data.subjects||[]),...marks.filter(m=>m.data.studentId===student.id).map(m=>m.data.subject)])],subjectStats:Object.fromEntries([...new Set(marks.map(m=>m.data.subject))].map(subject=>{const group=marks.filter(m=>m.data.subject===subject&&m.data.mark!==''&&m.data.mark!=null);const own=group.find(m=>m.data.studentId===student.id);return [subject,{average:group.length?group.reduce((n,m)=>n+Number(m.data.mark),0)/group.length:null,rank:own?1+group.filter(m=>Number(m.data.mark)>Number(own.data.mark)).length:null}]})),stats:{enrolment:students.length,rank:avgs.find(x=>x.id===student.id)?1+avgs.filter(x=>x.average>avgs.find(x=>x.id===student.id).average).length:null,rankedCount:avgs.length,classAverage:avgs.length?avgs.reduce((s,x)=>s+x.average,0)/avgs.length:null,highest:avgs.length?Math.max(...avgs.map(x=>x.average)):null,lowest:avgs.length?Math.min(...avgs.map(x=>x.average)):null}}))});
 }

 if(op==='import-students'){
  if(p.role!=='principal')fail('Principal access required.',403);
  if(!Number.isInteger(b.offset)||b.offset<0)fail('Invalid import position.');const batch=bundledStudents.slice(b.offset,b.offset+10);let imported=0,skipped=0;const conflicts=[];
  for(const data of batch){const existing=all.find(r=>r.kind==='student'&&r.data.matricule===normalizeMatricule(data.matricule));if(!data.matricule){conflicts.push({data,reason:'Missing matricule. Enter the correct school identifier before creating this account.'});continue;}if(existing){if(existing.data.name.trim().toUpperCase()!==data.name.trim().toUpperCase())conflicts.push({data,reason:'This matricule belongs to a different existing name. Review the school register.'});else skipped++;continue;}validateRecord('student',data,classNames);await db('rpc/school_save_record','POST',{record_kind:'student',record_data:data,actor_id:p.id});all.push({kind:'student',data});imported++;}
  return res.json({imported,skipped,conflicts,next:b.offset+batch.length,total:bundledStudents.length,more:b.offset+batch.length<bundledStudents.length});
 }
 if(['exam-start','exam-save','exam-submit','exam-review'].includes(op)){
  if(!/^[a-f0-9-]{36}$/.test(b.resourceId||''))fail('Choose an assessment.');
  const resource=(await db('school_records?kind=eq.resource&id=eq.'+b.resourceId))[0];if(!resource)fail('Assessment unavailable.',404);let attempts=await db('school_records?kind=eq.exam_attempt&data->>resourceId=eq.'+b.resourceId+'&data->>studentId=eq.'+enc(op==='exam-review'?b.studentId:p.id));let a=attempts[0];
  if(op==='exam-review'){if(!admin(p)&&!(p.role==='teacher'||p.role==='hod')||!admin(p)&&resource.data.ownerId!==p.id)fail('Only the assigned teacher or administration can mark this attempt.',403);if(!a||a.data.status==='in_progress')fail('Choose a submitted attempt.');const manualMax=a.data.questions.filter(q=>['short','essay'].includes(q.type)).reduce((n,q)=>n+q.points,0);if(!Number.isFinite(+b.manualScore)||+b.manualScore<0||+b.manualScore>manualMax)fail('Manual score is outside the available marks.');const data={...a.data,manualScore:+b.manualScore,score:a.data.autoScore+(+b.manualScore),feedback:String(b.feedback||'').slice(0,3000),status:'marked'};const saved=await db('rpc/school_save_record','POST',{record_kind:'exam_attempt',record_data:data,actor_id:p.id,record_id:a.id,expected_version:a.version});return res.json({row:saved[0]});}
  if(p.role!=='student'||!canRead(p,resource,all)||!resource.data.questions?.length)fail('This assessment is not available for your subjects.',403);
  const now=Date.now();
  if(op==='exam-start'&&!a){const minutes=Number(resource.data.durationMinutes);if(!Number.isFinite(minutes)||minutes<1||minutes>180)fail('The teacher must set a duration between 1 and 180 minutes.');if(resource.data.dueDate&&now>Date.parse(resource.data.dueDate+'T23:59:59+01:00'))fail('This assessment is closed.');const data={studentId:p.id,resourceId:resource.id,title:resource.data.title,questions:validateQuestions(resource.data.questions),answers:{},startedAt:new Date(now).toISOString(),deadline:new Date(now+minutes*60000).toISOString(),status:'in_progress'};const result=await db('rpc/school_save_record','POST',{record_kind:'exam_attempt',record_data:data,actor_id:p.id});a=result[0];issue(res,{studentId:p.id},4*3600);}
  if(!a)fail('Start the assessment first.');if(op==='exam-start')return res.json({row:redact(p,a),serverNow:new Date(now).toISOString()});
  const answers=acceptAnswers(a.data,b.answers||{},now),expired=now>=Date.parse(a.data.deadline);const data={...a.data,answers,savedAt:new Date(now).toISOString()};if(op==='exam-submit'||expired){Object.assign(data,gradeAttempt(data.questions,answers),{status:'submitted',submittedAt:new Date(now).toISOString()});}
  const result=await db('rpc/school_save_record','POST',{record_kind:'exam_attempt',record_data:data,actor_id:p.id,record_id:a.id,expected_version:a.version});return res.json({row:redact(p,result[0]),serverNow:new Date(now).toISOString()});
 }
 if(op==='contacts'){if(!canUseWriter(p))fail('Principal, VP or HOD access required.',403);return res.json({contacts:colleagueContacts(p,all)});}
 if(op==='backup-page'){
  if(p.role!=='principal')fail('Only the principal can export school records.',403);
  const table=b.table==='records'?'school_records':b.table==='audit'?'school_audit':null;
  if(!table||!Number.isInteger(b.offset)||b.offset<0||b.offset>10000000)fail('Invalid backup request.');
  if(!/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/.test(b.cutoff||''))fail('Invalid backup cutoff.');
  const size=b.table==='records'?1:100;
  const batch=await db(table+'?select=*&order=created_at.asc,id.asc&limit='+size+'&offset='+b.offset+'&created_at=lte.'+encodeURIComponent(b.cutoff));
  return res.json({rows:batch,more:batch.length===size});
 }
 if(op==='audit'){if(p.role!=='principal')fail('Principal access required.',403);return res.json({rows:await db('school_audit?order=created_at.desc&limit=200')});}
 if(op==='provision'){
  if(p.role!=='principal')fail('Principal access required.',403);
  const target=all.find(r=>r.id===b.profileId&&r.kind==='profile');if(!target||target.data.authId)fail('Choose a staff or parent profile without an existing login.');
  if(typeof b.password!=='string'||b.password.length<12||!/^\S+@\S+\.\S+$/.test(b.email||''))fail('Provide an email and a temporary password of at least 12 characters.');
  const r=await fetch(`${base()}/auth/v1/admin/users`,{method:'POST',headers:{apikey:key(),Authorization:`Bearer ${key()}`,'Content-Type':'application/json'},body:JSON.stringify({email:b.email,password:b.password,email_confirm:true})});const user=await r.json();if(!r.ok)fail('Account creation failed. Check whether this email already has an account.');
  try{await db('rpc/school_save_record','POST',{record_kind:'profile',record_data:{...target.data,authId:user.id},actor_id:p.id,record_id:target.id,expected_version:target.version});}catch(e){await fetch(`${base()}/auth/v1/admin/users/${user.id}`,{method:'DELETE',headers:{apikey:key(),Authorization:`Bearer ${key()}`}});throw e;}
  return res.json({ok:true});
 }
 if(op==='password'){
  if(!s.accessToken)fail('Password changes apply to staff and parent accounts.');if(typeof b.password!=='string'||b.password.length<12)fail('Use at least 12 characters.');
  const r=await fetch(`${base()}/auth/v1/user`,{method:'PUT',headers:{apikey:key(),Authorization:`Bearer ${s.accessToken}`,'Content-Type':'application/json'},body:JSON.stringify({password:b.password})});if(!r.ok)fail('The password could not be changed. Sign in again and retry.');cookie(res,'',0);return res.json({ok:true});
 }
 if(op==='ai-settings'){if(p.role!=='principal')fail('Principal access required.',403);if(!providers[b.provider]||!b.key)fail('Choose a provider and enter its API key.');let selectedModel;try{selectedModel=await chooseModel(b.provider,b.key);}catch(e){fail(e.message,400);}await db('school_secrets?on_conflict=id','POST',{id:'ai',value:crypt(JSON.stringify({provider:b.provider,model:selectedModel,key:b.key}))}).catch(async e=>{if(e.status!==409)throw e;await db('school_secrets?id=eq.ai','PATCH',{value:crypt(JSON.stringify({provider:b.provider,model:selectedModel,key:b.key}))});});return res.json({ok:true});}
 if(op==='ai'){
  if(!canUseWriter(p))fail('Principal, VP or HOD access required.',403);await rate(req,'ai',10);if(!b.prompt||b.prompt.length>8000)fail('Provide a prompt under 8,000 characters.');const settings=(await db('school_secrets?id=eq.ai'))[0];if(!settings)fail('Ask the principal to configure an AI provider.');const c=JSON.parse(crypt(settings.value,true));
  const instruction=writingInstruction(b.language,b.style);let url,headers,body;
  if(c.provider==='gemini'){url=`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(c.model)}:generateContent`;headers={'x-goog-api-key':c.key};body={systemInstruction:{parts:[{text:instruction}]},contents:[{parts:[{text:b.prompt}]}]};}
  else {if(!providers[c.provider])fail('Choose the AI provider again in settings.');url=providers[c.provider].base+'/chat/completions';headers={Authorization:`Bearer ${c.key}`};body={model:c.model,messages:[{role:'system',content:instruction},{role:'user',content:b.prompt}],max_tokens:1200};}
  const r=await fetch(url,{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(25000)});if(!r.ok)fail('The AI provider rejected this request. Check model, credits and key.',502);const a=await r.json();return res.json({text:cleanGeneratedText(a.candidates?.[0]?.content?.parts?.map(x=>x.text||'').join('')||a.choices?.[0]?.message?.content||'')});
 }
 if(op==='timetable'){
  if(!admin(p))fail('Principal or VP access required.',403);
  const assignments=all.filter(r=>r.kind==='assignment').map(r=>r.data);
  if(!assignments.length)fail('Add teacher assignments first.');
  // Whatever the browser sent is re-checked here: the limits are enforced on the
  // server, not by the form. Unknown subjects and staff are dropped, every number
  // is clamped to its allowed range.
  const preferences=normalizePreferences({...(b.preferences||{}),form5End:b.preferences?.form5End??b.form5End},
   {subjectNames:[...new Set(assignments.map(a=>a.subject))],teacherIds:[...new Set(assignments.map(a=>a.teacherId))]});
  let entries;
  try{entries=generateTimetable(assignments,preferences.form5End,classNames,{preferences,deadlineMs:40000});}
  catch(e){fail(e.message,400);}
  const data={title:'School timetable',entries,status:'published',form5End:preferences.form5End,preferences,generatedAt:new Date().toISOString()};
  const result=await db('rpc/school_save_record','POST',{record_kind:'timetable',record_data:data,actor_id:p.id});
  return res.json({row:result[0]});
 }
 if(op==='save'){
  const kind=b.kind,old=b.id?all.find(r=>r.id===b.id&&r.kind===kind):null;if(b.id&&!old)fail('Record not found.',404);let d={...b.data};
  if(kind==='exam_attempt')fail('Use the timed assessment workflow.');if(kind==='timetable')fail('Use the timetable generator to validate conflicts.');if(!canWrite(p,kind,d,old,all))fail('Your role cannot make this change.',403);
  if(kind==='profile'&&p.role!=='principal'){const allowed=['name','photo','bio','birthDate','birthPlace','gender','publicServiceDate','schoolAssumptionDate','rank','salaryIndex','phone','whatsapp'];d={...old.data,...Object.fromEntries(Object.entries(d).filter(([k])=>allowed.includes(k)))};}
  if(kind==='profile'&&p.role==='principal'){if(!roles.includes(d.role))fail('Invalid staff role.');if(d.role==='bursar'&&d.active!==false&&all.some(r=>r.kind==='profile'&&r.id!==old?.id&&r.data.role==='bursar'&&r.data.active!==false))fail('There is already an active bursar. End the existing appointment before assigning another.',409);if(old?.data.role==='principal'&&(d.role!=='principal'||d.active===false)&&all.filter(r=>r.kind==='profile'&&r.data.role==='principal'&&r.data.active!==false).length<=1)fail('The last active principal cannot be removed.');}
  if(kind==='resource'){
   if(!admin(p)&&!(p.role==='hod'&&p.department===d.department)){if(d.status==='published')fail('HOD approval is required.',403);}
   if(p.role==='hod'&&old&&old.data.ownerId!==p.id){const original={...old.data};d={...original,status:d.status,reviewComment:d.reviewComment};}
   if(d.status==='published'){d.approvedBy=p.id;d.approvedAt=new Date().toISOString();}else {delete d.approvedBy;delete d.approvedAt;}
  }
  if(kind==='resource'){if(d.questions?.length){try{d.questions=validateQuestions(d.questions);}catch(e){fail(e.message);}if(!Number.isFinite(+d.durationMinutes)||+d.durationMinutes<1||+d.durationMinutes>180)fail('Set a duration between 1 and 180 minutes.');}if(d.attachment){if(!/^data:application\/pdf;base64,[A-Za-z0-9+/=]+$/.test(d.attachment.data||'')||d.attachment.data.length>2800000||Buffer.from((d.attachment.data||'').split(',')[1]||'','base64').subarray(0,5).toString()!=='%PDF-')fail('Upload a PDF smaller than 2 MB.');}}
  if(kind==='mark'&&!admin(p)&&availableSubjects(all).find(s=>s.name===d.subject)?.department!==p.department)fail('Choose a subject in your department.',403);
  if(kind==='mark'&&!admin(p)&&d.status==='published')fail('The administration publishes results.',403);
  if(['assignment','resource'].includes(kind)){const subject=availableSubjects(all).find(x=>x.name===d.subject);if(!subject)fail('Choose a subject in Classes & subjects.');d.department=subject.department;const staff=kind==='assignment'?all.find(r=>r.kind==='profile'&&r.id===d.teacherId)?.data:p;if(kind==='assignment'&&staff?.department!==d.department)fail('The teacher’s department must match this subject.');if(kind==='resource'&&!admin(p)&&p.department!==d.department)fail('Choose a subject in your own department.',403);const rule=all.find(r=>r.kind==='classroom'&&r.data.name===d.class);if(rule&&!rule.data.subjects?.includes(d.subject)&&!all.some(r=>r.kind==='student'&&r.data.class===d.class&&r.data.subjects?.includes(d.subject)))fail('Add this subject to the class or an individual student first.');}
  if(kind==='classroom'){if(!Array.isArray(d.subjects)||d.subjects.some(x=>!availableSubjects(all).some(s=>s.name===x)))fail('Select valid compulsory subjects.');if(old&&old.data.name!==d.name)fail('Class names are fixed after creation. Create a new class and transfer students instead.');}
  if(kind==='assignment'){const t=all.find(r=>r.id===d.teacherId&&r.kind==='profile');if(!t||!['teacher','hod','vp','principal'].includes(effectiveRole(t.data.role)))fail('Choose a teacher profile.');}
  if(['mark','attendance'].includes(kind)){const student=all.find(r=>r.kind==='student'&&r.id===d.studentId);if(!student||(student.data.class!==d.class&&old?.data.class!==d.class))fail('Student does not belong to this class.');if(kind==='mark')d.studentSnapshot=old?.data.studentSnapshot||{name:student.data.name,matricule:student.data.matricule,birthDate:student.data.birthDate,gender:student.data.gender,class:d.class,photo:student.data.photo};if(kind==='mark'&&!studies(student.data,d.subject))fail('Student is not enrolled in this subject.');}
  if(kind==='attendance'){const a=all.find(r=>r.kind==='assignment'&&r.id===d.assignmentId);if(!a||a.data.class!==d.class||(!admin(p)&&p.role!=='discipline'&&a.data.teacherId!==p.id))fail('Attendance must belong to your assigned lesson.',403);d.subject=a.data.subject;const pupil=all.find(r=>r.kind==='student'&&r.id===d.studentId);if(!studies(pupil.data,d.subject))fail('Student is not enrolled in this lesson.');}
  if(kind==='submission'){if(p.role==='student'){d.studentId=p.id;delete d.feedback;delete d.score;const r=all.find(r=>r.id===d.resourceId&&r.kind==='resource');if(r?.data.dueDate&&Date.now()>new Date(r.data.dueDate+'T23:59:59+01:00').getTime())fail('Submission deadline has passed.');}else{if(!old)fail('Choose an existing submission.');d={...old.data,feedback:d.feedback||'',score:d.score||'',reviewedBy:p.id};}}
  if(kind==='document_request'){if(!old){d={requestType:d.requestType,purpose:String(d.purpose||'').slice(0,2000),dutyDate:d.dutyDate||'',requesterId:p.id,name:p.name,status:'pending',requestedAt:new Date().toISOString()};}else{if(all.some(r=>r.kind==='document'&&r.data.requestId===old.id&&r.data.status==='issued'))fail('This request already has an issued document.');if(!['rejected','cancelled'].includes(d.status))fail('Choose rejection or cancellation.');if(p.role!=='principal'&&d.status!=='cancelled')fail('Only the principal reviews requests.',403);d={...old.data,status:d.status,reviewComment:String(d.reviewComment||'').slice(0,2000),reviewedAt:new Date().toISOString()};}}
  if(kind==='document'){if(old){if(d.status!=='revoked')fail('Issued documents are immutable. Revoke and issue a new reference.');d={...old.data,status:'revoked'};}else {if(d.requestId){const request=all.find(r=>r.kind==='document_request'&&r.id===d.requestId);if(!request||request.data.status!=='pending')fail('Choose a pending request.');if(all.some(r=>r.kind==='document'&&r.data.requestId===d.requestId&&r.data.status==='issued'))fail('This request already has an issued document.',409);d.profileId=request.data.requesterId;d.name=request.data.name;}delete d.issuedBody;if(d.kind!=='letter')d.issuedBody=attestationText(d);else d.name=d.recipient||d.name||d.title;d.token=crypto.randomBytes(24).toString('hex');d.status='issued';}}
  if(kind==='student'){d.classHistory=old?.data.classHistory||[];if(old&&(old.data.class!==d.class||old.data.status!==d.status))d.classHistory=[...d.classHistory,{from:old.data.class,to:d.class,previousStatus:old.data.status,status:d.status,action:d.movement||'profile update',reason:String(d.movementReason||'').slice(0,1000),date:new Date().toISOString(),actor:p.id}];delete d.requiredSubjects;}
  d.ownerId=old?.data.ownerId||p.id;d.updatedAt=new Date().toISOString();try{validateRecord(kind,d,classNames);}catch(e){fail(e.message);}
  if(['event','post','gallery','textbook','resource','mark'].includes(kind)&&!['draft','pending','published','rejected'].includes(d.status))fail('Invalid publication status.');
  const result=await db('rpc/school_save_record','POST',{record_kind:kind,record_data:d,actor_id:p.id,record_id:old?.id||null,expected_version:old?b.version:null});return res.json({row:result[0]});
 }
 fail('Unknown action.');
 }catch(e){res.status(e.status||500).json({error:e.status?e.message:'The request could not be completed. Please try again.'});}}
