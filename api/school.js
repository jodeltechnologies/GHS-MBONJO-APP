import {subjectGroupRoster,subjectGroupChange,subjectGroupSnapshot} from '../src/subject-groups.js';
import {blankReport} from '../src/student-printing.js';
import {temporaryPassword} from '../src/login-password.js';
import {notificationAction} from '../src/notifications.js';
import {promotionPlan,nextAcademicYear} from '../src/promotion.js';
import {CONTROL_ID,schoolControls,changeControls,markSaveAllowed} from '../src/school-controls.js';
import {accountUsername,accountEmail,canProvision,normalizeUsername} from '../src/accounts.js';
import bundledStudents from './data/students.json' with {type:'json'};
import progressionSheets from './data/progression.json' with {type:'json'};
import {validateQuestions,publicQuestions,gradeAttempt,acceptAnswers} from '../src/exams.js';
import {enrolment,availableSubjects,academicYear,studentsInYear,assignmentsInYear} from '../src/academics.js';
import {classReport,assessmentsIn,streamAverage} from '../src/reports.js';
import {reportInformation,reportTeacherNames} from '../src/report-information.js';
import {providers,chooseModel} from '../src/providers.js';
import {trustedOrigin} from '../src/origin.js';
import {effectiveRole,canUseWriter,colleagueContacts} from '../src/posts.js';
import {writingInstruction,cleanGeneratedText} from '../src/writing-style.js';
import crypto from 'node:crypto';
import {attestationText,classes,classesInLevel,roles,normalizeMatricule,normalizeBirthDate,validateRecord,generateTimetable,normalizePreferences,studies} from '../src/domain.js';
import {canRead,canWrite,admin,assigned,staff} from '../src/access.js';
import {schoolAnalytics,attendanceOverview,scopeAttendance} from '../src/analytics.js';
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
const redact=(p,r)=>{if(r.kind==='classroom'&&['student','parent'].includes(p.role)&&r.data.subjectGroups){const ids=new Set(p.role==='student'?[p.id]:p.children||[]);const subjectGroups=Object.fromEntries(Object.entries(r.data.subjectGroups).map(([year,groups])=>[year,Object.fromEntries(Object.entries(groups).map(([subject,g])=>[subject,{mode:g.mode,studentIds:(g.studentIds||[]).filter(id=>ids.has(id))}]))]));return {...r,data:{...r.data,subjectGroups}};}if(p.role==='student'&&r.kind==='resource')return {...r,data:{...r.data,questions:publicQuestions(r.data.questions)}};if(r.kind==='exam_attempt'&&p.role==='student')return {...r,data:{...r.data,questions:publicQuestions(r.data.questions)}};if(r.kind==='student'&&!admin(p)&&p.role!=='student'&&p.role!=='parent'){const {name,class:cls,gender,photo,subjects,requiredSubjects,subjectParticipation,status,academicYear,sourceYear,enrolments}=r.data;return {...r,data:{name,class:cls,gender,photo,subjects,requiredSubjects,subjectParticipation,status,academicYear,sourceYear,enrolments}};}return r;};
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
   if(!r||r.data.authId||['dismissed','transferred out','graduated'].includes(r.data.status))fail('Invalid login.',401);
   const stored=normalizeBirthDate(r.data.birthDate);
   if(!stored)fail('Your school record has no date of birth yet. Ask the school administration to complete it.',403);
   if(stored!==dob)fail('Invalid login.',401);
   issue(res,{studentId:r.id});return res.json({ok:true});
  }
  const identifier=String(b.email||b.username||'').trim().toLowerCase();
  let email=identifier;
  if(!identifier.includes('@')){
   if(!identifier||normalizeUsername(identifier)!==identifier)fail('Username or password is incorrect.',401);
   const matches=await db(`school_records?kind=in.(profile,student)&data->>username=eq.${encodeURIComponent(identifier)}`);
   if(matches.length!==1||!matches[0].data.loginEmail)fail('Username or password is incorrect.',401);
   email=matches[0].data.loginEmail;
  }
  const r=await fetch(`${base()}/auth/v1/token?grant_type=password`,{method:'POST',headers:{apikey:key(),'Content-Type':'application/json'},body:JSON.stringify({email,password:b.password})});const auth=await r.json();if(!r.ok)fail('Username or password is incorrect.',401);
  const accounts=await db(`school_records?kind=in.(profile,student)&data->>authId=eq.${auth.user.id}`);
  const account=accounts.find(x=>x.kind==='profile'&&x.data.active!==false)||accounts.find(x=>x.kind==='student'&&!['dismissed','transferred out','graduated'].includes(x.data.status));
  if(!account)fail('Contact the principal to activate your school account.',403);
  issue(res,{authId:auth.user.id,accessToken:auth.access_token,authEpoch:account.data.authEpoch||0,...(account.kind==='student'?{studentId:account.id}:{})});return res.json({ok:true});
 }
 const s=session(req);if(!s)fail('Please sign in.',401);
 if(op==='backup-page'&&s.studentId)fail('Only the principal can export school records.',403);
 const all=await allRecords(op==='backup-page'?'kind=eq.profile':'kind=in.(profile,student,assignment,classroom,subject,school_control)');let p;
 if(s.accessToken){const auth=await fetch(`${base()}/auth/v1/user`,{headers:{apikey:key(),Authorization:`Bearer ${s.accessToken}`}});if(!auth.ok)fail('Session expired. Please sign in again.',401);const user=await auth.json();if(user.id!==s.authId)fail('Session expired.',401);}
 if(s.studentId){const r=all.find(r=>r.id===s.studentId&&r.kind==='student');if(!r||(r.data.authId&&(!s.accessToken||r.data.authId!==s.authId))||['dismissed','transferred out','graduated'].includes(r.data.status))fail('Account inactive.',401);p={...r.data,id:r.id,role:'student'};}
 else {const r=all.find(r=>r.kind==='profile'&&r.data.authId===s.authId&&r.data.active!==false);if(!r)fail('Account inactive.',403);p={...r.data,id:r.id,post:r.data.role,role:effectiveRole(r.data.role)};}
 if(s.authId&&(s.authEpoch||0)!==(p.authEpoch||0))fail('Your login was reset. Please sign in with your new temporary password.',401);
 if(p.passwordChangeRequired&&op!=='password'){if(op==='state')return res.json({profile:{id:p.id,name:p.name,role:p.role,passwordChangeRequired:true},rows:[]});fail('Change your temporary password before using the portal.',403);}
 const controls=schoolControls(all);
 for(const r of all.filter(r=>r.kind==='student'))r.data=enrolment(r.data,all,controls.activeYear,r.id);if(p.role==='student')p=enrolment({...p,...p.enrolments?.[controls.activeYear]},all,controls.activeYear,p.id);
 if(op?.startsWith('notification-'))return res.json(await notificationAction(op,b,{p,all,db,crypt,fail,rate,req}));
 if(['promotion-preview','advance-year'].includes(op)){
  if(p.role!=='principal')fail('Only the principal can advance the academic year.',403);
  if(controls.rollovers?.[b.year])fail('This year was already advanced. Select it from the year dropdown without advancing again.',409);
  let plan;try{plan=promotionPlan(all,controls.activeYear,b.year,{actor:p.id});}catch(e){fail(e.message);}
  const snapshot=all.filter(r=>['student','classroom'].includes(r.kind)).map(r=>({id:r.id,version:r.version})).sort((a,b)=>a.id.localeCompare(b.id));
  const version=all.find(r=>r.id===CONTROL_ID)?.version;
  const token=crypto.createHash('sha256').update(JSON.stringify({from:controls.activeYear,to:b.year,version,snapshot})).digest('hex');
  if(op==='promotion-preview')return res.json({fromYear:plan.fromYear,toYear:plan.toYear,advancing:plan.advancing,exiting:plan.exiting,groups:plan.groups,held:plan.held,token});
  if(b.token!==token)fail('Student or class records changed. Preview the year change again.',409);
  const result=await db('rpc/school_advance_year','POST',{actor_id:p.id,control_id:CONTROL_ID,expected_version:version,from_year:controls.activeYear,to_year:b.year,changes:plan.updates.map(({id,version,data})=>({id,version,data})),expected_snapshot:snapshot});
  return res.json({ok:true,...result,advancing:plan.advancing,exiting:plan.exiting,held:plan.held.length});
 }
 if(op==='school-controls'){const old=all.find(r=>r.id===CONTROL_ID&&r.kind==='school_control');if(!old)fail('School controls are not ready. Contact the principal.',409);if(b.version!==old.version)fail('School controls changed. Refresh and try again.',409);if(b.action==='year'&&p.role!=='principal')fail('Only the principal can change the academic year.',403);if(b.action==='year'&&+b.year?.slice(0,4)>+controls.activeYear.slice(0,4)&&!controls.rollovers?.[b.year])fail('Preview student advancement before opening a new academic year.');let data;try{data=changeControls(p,controls,b);}catch(e){fail(e.message,403);}const saved=await db('rpc/school_save_record','POST',{record_kind:'school_control',record_data:data,actor_id:p.id,record_id:old.id,expected_version:old.version});return res.json({ok:true,controls:saved[0]});}
 if(p.role!=='principal'&&['marks','reports','analytics','timetable'].includes(op)&&b.year&&b.year!==controls.activeYear)fail('The principal sets the school academic year. Refresh to use '+controls.activeYear+'.',403);
 const classNames=[...new Set([...classes,...all.filter(r=>r.kind==='classroom').map(r=>r.data.name)])];
 if(['subject-roster','subject-group'].includes(op)){
  if(!admin(p))fail('Only the principal or vice-principal can choose subject students.',403);
  if(b.year!==controls.activeYear)fail('Reload to use the school academic year '+controls.activeYear+'.',409);
  const old=all.find(r=>r.kind==='classroom'&&r.data.name===b.class);
  if(!old)fail('Set up this class in Classes & subjects first.');
  if(!availableSubjects(all).some(x=>x.name===b.subject))fail('Choose a valid subject.');
  const roster=subjectGroupRoster(all,{year:b.year,cls:b.class,subject:b.subject});
  const token=crypto.createHash('sha256').update(subjectGroupSnapshot(roster)).digest('hex');
  if(op==='subject-roster'){
   const group=old.data.subjectGroups?.[b.year]?.[b.subject];
   return res.json({version:old.version,token,mode:group?.mode||(roster.length&&roster.every(r=>r.selected)?'all':'selected'),students:roster.map(r=>({id:r.id,name:r.data.name,matricule:r.data.matricule||'',selected:r.selected})),year:b.year,class:b.class,subject:b.subject});
  }
  if(old.version!==b.version||token!==b.token)fail('The class or student list changed. Reload the list before saving.',409);
  let data;try{data=subjectGroupChange(all,old,{year:b.year,subject:b.subject,mode:b.mode,studentIds:b.studentIds,actor:p.id});}catch(e){fail(e.message);}
  const saved=await db('rpc/school_save_record','POST',{record_kind:'classroom',record_data:data,actor_id:p.id,record_id:old.id,expected_version:old.version});
  return res.json({row:saved[0],selected:b.mode==='all'?roster.length:data.subjectGroups[b.year][b.subject].studentIds.length,total:roster.length});
 }

 const enc=encodeURIComponent;
 const contextForClass=(cls,year)=>{const ids=new Set(studentsInYear(all,year).filter(r=>r.data.class===cls).map(r=>r.id));return all.filter(r=>r.kind==='classroom'&&r.data.name===cls||r.kind==='student'&&ids.has(r.id)).filter(r=>canRead(p,r,all)).map(r=>redact(p,r));};
 if(['state','save'].includes(op)){
  all.push(...await allRecords('kind=in.(resource,post,event,gallery,textbook,document,timetable,document_request,exam_attempt,dept_document,dept_item,progression)'));
  if(op==='state'){
   const cutoff=new Date(Date.now()-30*86400000).toISOString().slice(0,10);
   all.push(...await allRecords('kind=eq.attendance&data->>date=gte.'+cutoff));
   all.push(...await allRecords('kind=eq.mark&data->>year=eq.'+enc(controls.activeYear)));
   all.push(...await allRecords('kind=eq.submission&data->>updatedAt=gte.'+cutoff));
  }else if(b.id&&!all.some(r=>r.id===b.id)){
   if(!/^[0-9a-f-]{36}$/.test(b.id))fail('Invalid record ID.');all.push(...await allRecords('id=eq.'+b.id));
  }
 }
 if(op==='marks'){if(!['principal','vp','teacher','hod'].includes(p.role))fail('Staff marks access required.',403);if(!/^\d{4}\/\d{4}$/.test(b.year||''))fail('Choose an academic year such as 2026/2027.');if(b.class&&!classNames.includes(b.class))fail('Choose a valid class.');const found=await allRecords('kind=eq.mark&data->>year=eq.'+enc(b.year)+(b.class?'&data->>class=eq.'+enc(b.class):''));return res.json({rows:found.filter(r=>canRead(p,r,all)),contextRows:b.class?contextForClass(b.class,b.year):[]});}
 // A report covers a whole term — both its sequences — and the stream average on
 // the master sheet covers the level, so the marks of every class in the level are
 // read, not just the one being printed. One query per class and assessment keeps
 // the filter simple and the assessment names, which contain spaces, unescaped.
 if(op==='reports'){
  if(!['principal','vp','student','parent'].includes(p.role))fail('Only the administration, student or linked parent can access a full report.',403);
  if(b.mode&& !['published','blank'].includes(b.mode))fail('Choose published results or a blank sample.');
  if(b.mode==='blank'&&!admin(p))fail('Only the principal or vice-principal can print blank samples.',403);
  if(!/^\d{4}\/\d{4}$/.test(b.year||''))fail('Choose a valid academic year.');
  const wanted=assessmentsIn(b.assessment||'').filter(Boolean);
  if(!wanted.length)fail('Choose a term, a sequence or the promotion exam.');
  if(!classNames.includes(b.class))fail('Choose a valid class.');
  if(b.mode!=='blank')for(const cls of classesInLevel(b.class,classNames))for(const a of wanted)
   all.push(...await allRecords('kind=eq.mark&data->>class=eq.'+enc(cls)+'&data->>year=eq.'+enc(b.year)+'&data->>assessment=eq.'+enc(a)+'&data->>status=eq.published'));
 }
 if(op==='state'){const visible=all.filter(r=>canRead(p,r,all)).map(r=>redact(p,r));for(const r of all.filter(r=>r.kind==='profile'&&r.data.role!=='parent'))if(!visible.some(x=>x.id===r.id))visible.push({id:r.id,kind:'directory',data:{name:r.data.name}});return res.json({profile:p,rows:visible,controls:{...controls,version:all.find(r=>r.id===CONTROL_ID)?.version}});}
 if(op==='reports'){
  if(!['principal','vp','student','parent'].includes(p.role))fail('Only the administration, student or linked parent can access a full report.',403);
  const wanted=assessmentsIn(b.assessment);
  const marksIn=cls=>b.mode==='blank'?[]:all.filter(r=>r.kind==='mark'&&r.data.class===cls&&r.data.year===b.year&&wanted.includes(r.data.assessment)&&r.data.status==='published').map(r=>r.data);
  // Who is on the roll: everyone registered in the class this year, plus anyone a
  // published mark names, so a student who has since left still gets their sheet.
  const rollOf=cls=>{
   const out=studentsInYear(all,b.year).filter(r=>r.data.class===cls);if(b.year===academicYear())out.push(...all.filter(r=>r.kind==='student'&&!r.data.academicYear&&!r.data.sourceYear&&!Object.keys(r.data.enrolments||{}).length&&r.data.class===cls));
   for(const m of marksIn(cls)){
    const r=all.find(r=>r.kind==='student'&&r.id===m.studentId);
    if(r&&!out.some(x=>x.id===r.id))out.push({...r,data:m.studentSnapshot||{...r.data,class:cls}});
   }
   return out.sort((a,c)=>String(a.data.name).localeCompare(String(c.data.name)));
  };
  const coefficients={};
  for(const s of availableSubjects(all))if(Number(s.coefficient)>0)coefficients[s.name]=Number(s.coefficient);
  // The subjects a sheet lists: the class's compulsory ones plus the student's own
  // extras, so a subject they take but have no mark in still prints with dashes.
  const subjectsFor=s=>{const e=enrolment(s.data,all,b.year,s.id);return [...new Set([...(e.requiredSubjects||[]),...(s.data.subjects||[])])].filter(subject=>studies(e,subject));};
  const build=cls=>{const students=rollOf(cls);const enrolled=new Map(students.map(r=>[r.id,enrolment(r.data,all,b.year,r.id)]));return classReport({students,marks:marksIn(cls).filter(m=>enrolled.get(m.studentId)?.subjectParticipation?.[m.subject]!==false),choice:b.assessment,subjectsFor,coefficients});};
  const own=build(b.class);
  // The stream average is the level's students taken together — Form 4A and 4B as
  // one — which is the only figure on either sheet that leaves the class.
  const level=classesInLevel(b.class,classNames)
   .map(cls=>(cls===b.class?own:build(cls)).sheets.map(x=>x.totals.average));
  own.streamAverage=streamAverage(level);
  // The administration prints the class; a student or parent gets only their own
  // sheet, with the class figures it is measured against left intact.
  const visible=own.sheets.filter(x=>canRead(p,all.find(r=>r.id===x.student.id)||{kind:'student',data:x.student.data},all));
  const sheets=visible.map(sheet=>({...sheet,details:reportInformation(all,sheet.student,{year:b.year,assessment:b.assessment,cls:b.class})}));
  const report={...own,sheets,teacherNames:reportTeacherNames(all,{year:b.year,cls:b.class})};
  return res.json({report:b.mode==='blank'?blankReport(report):report,class:b.class,year:b.year,assessment:b.assessment});
 }

 if(op==='import-students'){
  if(p.role!=='principal')fail('Principal access required.',403);
  if(!Number.isInteger(b.offset)||b.offset<0)fail('Invalid import position.');const batch=bundledStudents.slice(b.offset,b.offset+10);let imported=0,skipped=0;const conflicts=[];
  for(const source of batch){const data={...source,name:String(source.name||'').trim().toUpperCase()};const existing=all.find(r=>r.kind==='student'&&r.data.matricule===normalizeMatricule(data.matricule));if(!data.matricule){conflicts.push({data,reason:'Missing matricule. Enter the correct school identifier before creating this account.'});continue;}if(existing){if(existing.data.name.trim().toUpperCase()!==data.name.trim().toUpperCase())conflicts.push({data,reason:'This matricule belongs to a different existing name. Review the school register.'});else skipped++;continue;}validateRecord('student',data,classNames);await db('rpc/school_save_record','POST',{record_kind:'student',record_data:data,actor_id:p.id});all.push({kind:'student',data});imported++;}
  return res.json({imported,skipped,conflicts,next:b.offset+batch.length,total:bundledStudents.length,more:b.offset+batch.length<bundledStudents.length});
 }
 if(['exam-start','exam-save','exam-submit','exam-review'].includes(op)){
  if(!/^[a-f0-9-]{36}$/.test(b.resourceId||''))fail('Choose an assessment.');
  const resource=(await db('school_records?kind=eq.resource&id=eq.'+b.resourceId))[0];if(!resource)fail('Assessment unavailable.',404);let attempts=await db('school_records?kind=eq.exam_attempt&data->>resourceId=eq.'+b.resourceId+'&data->>studentId=eq.'+enc(op==='exam-review'?b.studentId:p.id));let a=attempts[0];
  if(op==='exam-review'){if(!admin(p)&&!(p.role==='teacher'||p.role==='hod')||!admin(p)&&resource.data.ownerId!==p.id)fail('Only the assigned teacher or administration can mark this attempt.',403);if(!a||a.data.status==='in_progress')fail('Choose a submitted attempt.');const manualMax=a.data.questions.filter(q=>['short','essay'].includes(q.type)).reduce((n,q)=>n+q.points,0);if(!Number.isFinite(+b.manualScore)||+b.manualScore<0||+b.manualScore>manualMax)fail('Manual score is outside the available marks.');const data={...a.data,manualScore:+b.manualScore,score:a.data.autoScore+(+b.manualScore),feedback:String(b.feedback||'').slice(0,3000),status:'marked'};const saved=await db('rpc/school_save_record','POST',{record_kind:'exam_attempt',record_data:data,actor_id:p.id,record_id:a.id,expected_version:a.version});return res.json({row:saved[0]});}
  if(p.role!=='student'||!canRead(p,resource,all)||!resource.data.questions?.length)fail('This assessment is not available for your subjects.',403);
  const now=Date.now();
  if(op==='exam-start'&&!a){const minutes=Number(resource.data.durationMinutes);if(!Number.isFinite(minutes)||minutes<1||minutes>180)fail('The teacher must set a duration between 1 and 180 minutes.');if(resource.data.dueDate&&now>Date.parse(resource.data.dueDate+'T23:59:59+01:00'))fail('This assessment is closed.');const data={studentId:p.id,resourceId:resource.id,title:resource.data.title,questions:validateQuestions(resource.data.questions),answers:{},startedAt:new Date(now).toISOString(),deadline:new Date(now+minutes*60000).toISOString(),status:'in_progress'};const result=await db('rpc/school_save_record','POST',{record_kind:'exam_attempt',record_data:data,actor_id:p.id});a=result[0];issue(res,{...s,studentId:p.id},4*3600);}
  if(!a)fail('Start the assessment first.');if(op==='exam-start')return res.json({row:redact(p,a),serverNow:new Date(now).toISOString()});
  const answers=acceptAnswers(a.data,b.answers||{},now),expired=now>=Date.parse(a.data.deadline);const data={...a.data,answers,savedAt:new Date(now).toISOString()};if(op==='exam-submit'||expired){Object.assign(data,gradeAttempt(data.questions,answers),{status:'submitted',submittedAt:new Date(now).toISOString()});}
  const result=await db('rpc/school_save_record','POST',{record_kind:'exam_attempt',record_data:data,actor_id:p.id,record_id:a.id,expected_version:a.version});return res.json({row:redact(p,result[0]),serverNow:new Date(now).toISOString()});
 }
 if(op==='attendance-register'){
  const assignment=all.find(r=>r.kind==='assignment'&&r.id===b.assignmentId);
  if(!assignment||(assignment.data.year||academicYear())!==controls.activeYear||!(['principal','vp','discipline'].includes(p.role)||['teacher','hod'].includes(p.role)&&assignment.data.teacherId===p.id))fail('Choose a lesson assigned to you for this academic year.',403);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(b.date||'')||!Number.isFinite(Date.parse(b.date)))fail('Choose a valid attendance date.');
  const found=await allRecords('kind=eq.attendance&data->>assignmentId=eq.'+enc(assignment.id)+'&data->>date=eq.'+enc(b.date));
  return res.json({rows:found,contextRows:contextForClass(assignment.data.class,controls.activeYear)});
 }
 if(op==='analytics'){
  const overview=attendanceOverview(p),summaryOnly=overview&&p.role==='staff';if(!overview&&!['teacher','hod'].includes(p.role))fail('Staff access is required for analytics.',403);const year=controls.activeYear;
  const iso=v=>/^\d{4}-\d{2}-\d{2}$/.test(v||'')&&Number.isFinite(Date.parse(v));
  if(!iso(b.from)||!iso(b.to))fail('Choose a start and end date.');
  if(b.to<b.from)fail('The end date comes before the start date.');
  if((Date.parse(b.to)-Date.parse(b.from))/86400000>400)fail('Choose a range of at most about a year.');
  if(b.year&&!/^\d{4}\/\d{4}$/.test(b.year))fail('Choose an academic year such as 2026/2027.');
  if(b.class&&!classNames.includes(b.class))fail('Choose a valid class.');
  // Everything is filtered through the same read rules as anywhere else, so a
  // teacher's figures are built only from the classes they are assigned to, and
  // only aggregates ever leave the server — never the underlying records.
  const attendance=scopeAttendance(await allRecords('kind=eq.attendance&data->>date=gte.'+enc(b.from)+'&data->>date=lte.'+enc(b.to)),{year,assignments:all.filter(r=>r.kind==='assignment'),overview,teacherId:p.id,cls:b.class||'',subject:b.subject||''});
  const marks=!summaryOnly&&b.year?(await allRecords('kind=eq.mark&data->>year=eq.'+enc(b.year)+(b.class?'&data->>class=eq.'+enc(b.class):'')))
   .filter(r=>canRead(p,r,all)&&(!b.subject||r.data.subject===b.subject)):[];
  const timetable=(await allRecords('kind=eq.timetable')).filter(r=>canRead(p,r,all)&&(r.data.year||academicYear())===year);
  const entries=timetable.flatMap(r=>r.data.entries||[])
   .filter(e=>(!b.class||e.class===b.class)&&(!b.subject||e.subject===b.subject))
   .filter(e=>overview||all.some(a=>a.kind==='assignment'&&(a.data.year||academicYear())===year&&a.data.teacherId===p.id&&a.data.class===e.class&&a.data.subject===e.subject));
  const students=studentsInYear(all,year).filter(r=>(overview||canRead(p,r,all))&&(!b.class||r.data.class===b.class))
   .filter(r=>!b.subject||studies(r.data,b.subject)).map(r=>({id:r.id,data:{name:summaryOnly?'':r.data.name,class:r.data.class,gender:r.data.gender}}));
  const assignments=assignmentsInYear(all,year).filter(r=>(overview||r.data.teacherId===p.id)&&(!b.class||r.data.class===b.class)&&(!b.subject||r.data.subject===b.subject))
   .map(r=>({id:r.id,data:r.data}));
  const staff=new Map(all.filter(r=>r.kind==='profile').map(r=>[r.id,r.data.name]));
  const report=schoolAnalytics({
   attendance:attendance.map(r=>r.data),marks:marks.map(r=>r.data),
   students,assignments,timetableEntries:entries,
   from:b.from,to:b.to,year:b.year||'',assessment:b.assessment||'',
   watchBelow:Math.min(100,Math.max(1,Math.round(Number(b.watchBelow))||80)),
   minLessons:Math.min(100,Math.max(1,Math.round(Number(b.minLessons))||5)),
   nameFor:id=>staff.get(id)||''});
  if(summaryOnly)report.attendance.watchlist=[];report.range.subject=b.subject||'';return res.json({report,scope:overview?'school attendance':'own subjects and classes',summaryOnly});
 }
 if(op==='messages'){
  if(!staff(p))fail('Staff access required.',403);
  const mine=(await allRecords('kind=eq.message')).filter(r=>canRead(p,r,all));
  const names=new Map(all.filter(r=>r.kind==='profile').map(r=>[r.id,r.data.name]));
  return res.json({rows:mine.map(r=>({id:r.id,data:{...r.data,fromName:names.get(r.data.fromId)||'',toName:r.data.toId?names.get(r.data.toId)||'':''}})),
                   colleagues:all.filter(r=>r.kind==='profile'&&r.id!==p.id&&r.data.active!==false&&!['parent'].includes(effectiveRole(r.data.role)))
                    .map(r=>({id:r.id,name:r.data.name,department:r.data.department||''}))
                    .sort((a,b)=>a.name.localeCompare(b.name))});
 }
 if(op==='progression-catalogue'){
  if(!staff(p))fail('Staff access required.',403);
  // Only the headings travel: the full lesson list for one sheet is fetched when
  // a department actually adopts it, and 785 lessons should not ride on every load.
  return res.json({sheets:progressionSheets.map(s=>({subject:s.subject,class:s.class,department:s.department||'',title:s.title,weeklyPeriods:s.weeklyPeriods,lessons:s.lessons.length}))});
 }
 if(op==='progression-sheet'){
  if(!staff(p))fail('Staff access required.',403);
  const sheet=progressionSheets.find(x=>x.subject===b.subject&&x.class===b.class);
  if(!sheet)fail('That progression sheet is not one of the supplied ones.',404);
  return res.json({sheet});
 }
 if(op==='contacts'){if(!canUseWriter(p))fail('Principal, VP or HOD access required.',403);return res.json({contacts:colleagueContacts(p,all)});}
 if(op==='backup-page'){
  if(p.role!=='principal')fail('Only the principal can export school records.',403);
  const table=b.table==='records'?'school_records':b.table==='audit'?'school_audit':null;
  if(!table||!Number.isInteger(b.offset)||b.offset<0||b.offset>10000000)fail('Invalid backup request.');
  if(!/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/.test(b.cutoff||''))fail('Invalid backup cutoff.');
  const size=b.table==='records'?1:100;
  const batch=await db(table+'?select=*&order=created_at.asc,id.asc&limit='+size+'&offset='+b.offset+'&created_at=lte.'+encodeURIComponent(b.cutoff));
  // Staff messages and a department's own papers are left out of the export, for
  // the same reason they are left out of the principal's screens. A transmitted
  // document has been handed to the administration and is included.
  const kept=b.table==='records'?batch.filter(r=>r.kind!=='message'&&!(r.kind==='dept_document'&&r.data?.transmitted!==true)):batch;
  return res.json({rows:kept,more:batch.length===size,skipped:batch.length-kept.length});
 }
 if(op==='audit'){if(p.role!=='principal')fail('Principal access required.',403);return res.json({rows:await db('school_audit?order=created_at.desc&limit=200')});}


 if(op==='accounts'){
  if(p.role!=='principal')fail('Principal access required.',403);
  const users=new Map();for(let page=1;page<=50;page++){
   const response=await fetch(`${base()}/auth/v1/admin/users?page=${page}&per_page=1000`,{headers:{apikey:key(),Authorization:`Bearer ${key()}`}});
   if(!response.ok)fail('The login list could not be loaded. Try again.',503);const result=await response.json();for(const user of result.users||[])users.set(user.id,user);if((result.users||[]).length<1000)break;
  }
  return res.json({rows:all.filter(r=>['profile','student'].includes(r.kind)).map(r=>{const u=users.get(r.data.authId);return {...r,data:{...r.data,loginEmail:u?.email||r.data.loginEmail||'',loginExists:!!u,lastSignIn:u?.last_sign_in_at||''}};})});
 }
 if(op==='reset-login'){
  if(p.role!=='principal')fail('Principal access required.',403);
  const target=all.find(r=>r.id===b.recordId&&['profile','student'].includes(r.kind));
  if(!target?.data.authId)fail('Choose a person with an existing login.');
  if(target.id===p.id)fail('Use Change password for your own account.');
  if(target.data.active===false||['graduated','dismissed','transferred out'].includes(target.data.status))fail('Activate this school record before resetting its login.');
  if(b.version!==target.version)fail('Account changed. Refresh before resetting.',409);
  const password=temporaryPassword();
  // Persist the session barrier first. A provider failure leaves access blocked until the principal retries.
  await db('rpc/school_save_record','POST',{record_kind:target.kind,record_data:{...target.data,authEpoch:(target.data.authEpoch||0)+1,passwordChangeRequired:true,passwordResetAt:new Date().toISOString(),passwordResetBy:p.id},actor_id:p.id,record_id:target.id,expected_version:target.version});
  const response=await fetch(`${base()}/auth/v1/admin/users/${encodeURIComponent(target.data.authId)}`,{method:'PUT',headers:{apikey:key(),Authorization:`Bearer ${key()}`,'Content-Type':'application/json'},body:JSON.stringify({password})});
  if(!response.ok)fail('Password reset was not completed. Refresh the account list and retry. Previous school sessions have been blocked.',503);
  const user=await response.json();const email=user.email||user.user?.email||target.data.loginEmail||'';return res.json({ok:true,credential:{name:target.data.name,username:target.data.username||'',email:email.endsWith('@accounts.ghs-mbonjo.invalid')?'':email,temporaryPassword:password}});
 }
 if(op==='provision'){
  if(p.role!=='principal')fail('Principal access required.',403);
  const target=all.find(r=>r.id===(b.recordId||b.profileId));if(!target||!canProvision(target))fail('Choose an active account without an existing login.');
  const password=b.password||temporaryPassword();
  const username=normalizeUsername(b.username||accountUsername(target,all));
  const email=String(b.email||accountEmail(target)).trim().toLowerCase();
  if((typeof password!=='string'||password.length<8||password.length>12)||!/^\S+@\S+\.\S+$/.test(email)||!username)fail('Provide a valid email or username and a password between 8 and 12 characters.');
  if(all.some(r=>r.id!==target.id&&r.data.username===username))fail('This username is already assigned.',409);
  const r=await fetch(`${base()}/auth/v1/admin/users`,{method:'POST',headers:{apikey:key(),Authorization:`Bearer ${key()}`,'Content-Type':'application/json'},body:JSON.stringify({email,password,email_confirm:true})});const user=await r.json();if(!r.ok)fail('Account creation failed. Check whether this email already has an account.');
  try{await db('rpc/school_save_record','POST',{record_kind:target.kind,record_data:{...target.data,authId:user.id,username,loginEmail:email,passwordChangeRequired:true},actor_id:p.id,record_id:target.id,expected_version:target.version});}catch(e){await fetch(`${base()}/auth/v1/admin/users/${user.id}`,{method:'DELETE',headers:{apikey:key(),Authorization:`Bearer ${key()}`}});throw e;}
  return res.json({ok:true,credential:{name:target.data.name,username,email:b.email?email:'',temporaryPassword:password}});
 }
 if(op==='password'){
  if(!s.accessToken)fail('Ask the principal to create your password account.');if(typeof b.password!=='string'||(b.password.length<8||b.password.length>12))fail('Use between 8 and 12 characters.');
  const r=await fetch(`${base()}/auth/v1/user`,{method:'PUT',headers:{apikey:key(),Authorization:`Bearer ${s.accessToken}`,'Content-Type':'application/json'},body:JSON.stringify({password:b.password})});if(!r.ok)fail('The password could not be changed. Sign in again and retry.');
  const target=all.find(r=>r.id===p.id);if(target.data.passwordChangeRequired)await db('rpc/school_save_record','POST',{record_kind:target.kind,record_data:{...target.data,passwordChangeRequired:false},actor_id:p.id,record_id:target.id,expected_version:target.version});
  cookie(res,'',0);return res.json({ok:true});
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
  const year=b.year||controls.activeYear;if(!/^\d{4}\/\d{4}$/.test(year))fail('Choose an academic year.');const assignments=assignmentsInYear(all,year).map(r=>r.data);if(assignments.some(a=>!Number.isInteger(+a.periods)||+a.periods<1))fail('Confirm weekly periods for the imported assignments before generating this year’s timetable.');
  if(!assignments.length)fail('Add teacher assignments first.');
  // Whatever the browser sent is re-checked here: the limits are enforced on the
  // server, not by the form. Unknown subjects and staff are dropped, every number
  // is clamped to its allowed range.
  const preferences=normalizePreferences({...(b.preferences||{}),form5End:b.preferences?.form5End??b.form5End},
   {subjectNames:[...new Set(assignments.map(a=>a.subject))],teacherIds:[...new Set(assignments.map(a=>a.teacherId))]});
  let entries;
  try{entries=generateTimetable(assignments,preferences.form5End,classNames,{preferences,deadlineMs:40000});}
  catch(e){fail(e.message,400);}
  const data={title:'School timetable',year,entries,status:'published',form5End:preferences.form5End,preferences,generatedAt:new Date().toISOString()};
  const result=await db('rpc/school_save_record','POST',{record_kind:'timetable',record_data:data,actor_id:p.id});
  return res.json({row:result[0]});
 }
 if(op==='save'){
  const kind=b.kind,old=b.id?all.find(r=>r.id===b.id&&r.kind===kind):null;if(b.id&&!old)fail('Record not found.',404);let d={...b.data};if(['profile','student'].includes(kind)&&typeof d.name==='string')d.name=d.name.trim().toUpperCase();if(kind==='attendance')d.year=controls.activeYear;
  if(kind==='school_control')fail('Use the school controls on the Home page.',403);
  if(kind==='mark'&&!markSaveAllowed(controls,d,old,p))fail('Mark entry is closed for this year or assessment. Ask the principal or vice-principal to open it.',403);
  if(p.role!=='principal'&&['student','assignment'].includes(kind)){const k=kind==='student'?'academicYear':'year';if(d[k]&&d[k]!==old?.data[k]&&d[k]!==controls.activeYear)fail('Only the principal can select another academic year.',403);}
  if(['profile','student'].includes(kind)){for(const field of ['authId','username','loginEmail','passwordChangeRequired','authEpoch','passwordResetAt','passwordResetBy']){if(old&&field in old.data)d[field]=old.data[field];else delete d[field];}}
  if(kind==='exam_attempt')fail('Use the timed assessment workflow.');if(kind==='timetable')fail('Use the timetable generator to validate conflicts.');if(!canWrite(p,kind,d,old,all))fail('Your role cannot make this change.',403);
  if(kind==='profile'&&p.role!=='principal'){const allowed=['name','photo','bio','birthDate','birthPlace','gender','publicServiceDate','schoolAssumptionDate','rank','salaryIndex','phone','whatsapp'];d={...old.data,...Object.fromEntries(Object.entries(d).filter(([k])=>allowed.includes(k)))};}
  if(kind==='profile'&&p.role==='principal'){if(!roles.includes(d.role))fail('Invalid staff role.');if(d.role==='bursar'&&d.active!==false&&all.some(r=>r.kind==='profile'&&r.id!==old?.id&&r.data.role==='bursar'&&r.data.active!==false))fail('There is already an active bursar. End the existing appointment before assigning another.',409);if(old?.data.role==='principal'&&(d.role!=='principal'||d.active===false)&&all.filter(r=>r.kind==='profile'&&r.data.role==='principal'&&r.data.active!==false).length<=1)fail('The last active principal cannot be removed.');}
  if(kind==='assignment'){if(!/^\d{4}\/\d{4}$/.test(d.year||''))fail('Choose an academic year.');if(Number.isInteger(+d.periods)&&+d.periods>0){delete d.needsPeriodsReview;d.status='active';}}
  if(kind==='resource'){
   if(!admin(p)&&!(p.role==='hod'&&p.department===d.department)){if(d.status==='published')fail('HOD approval is required.',403);}
   if(p.role==='hod'&&old&&old.data.ownerId!==p.id){const original={...old.data};d={...original,status:d.status,reviewComment:d.reviewComment};}
   if(d.status==='published'){d.approvedBy=p.id;d.approvedAt=new Date().toISOString();}else {delete d.approvedBy;delete d.approvedAt;}
  }
  if(kind==='resource'){if(d.questions?.length){try{d.questions=validateQuestions(d.questions);}catch(e){fail(e.message);}if(!Number.isFinite(+d.durationMinutes)||+d.durationMinutes<1||+d.durationMinutes>180)fail('Set a duration between 1 and 180 minutes.');}if(d.attachment){if(!/^data:application\/pdf;base64,[A-Za-z0-9+/=]+$/.test(d.attachment.data||'')||d.attachment.data.length>2800000||Buffer.from((d.attachment.data||'').split(',')[1]||'','base64').subarray(0,5).toString()!=='%PDF-')fail('Upload a PDF smaller than 2 MB.');}}
  if(kind==='mark'&&!admin(p)&&!assigned(p,d,all))fail('Choose a subject and class assigned to you for this academic year.',403);
  if(kind==='mark'&&!admin(p)&&d.status==='published')fail('The administration publishes results.',403);
  if(['assignment','resource'].includes(kind)){const subject=availableSubjects(all).find(x=>x.name===d.subject);if(!subject)fail('Choose a subject in Classes & subjects.');d.department=subject.department;const staff=kind==='assignment'?all.find(r=>r.kind==='profile'&&r.id===d.teacherId)?.data:p;if(kind==='assignment'&&staff?.department!==d.department&&!staff?.teachingSubjects?.includes(d.subject)&&!(old?.data.sourceKey&&old.data.teacherId===d.teacherId&&old.data.subject===d.subject))fail('The teacher’s department must match this subject.');if(kind==='resource'&&!admin(p)&&p.department!==d.department)fail('Choose a subject in your own department.',403);const rule=all.find(r=>r.kind==='classroom'&&r.data.name===d.class);if(rule&&!rule.data.subjects?.includes(d.subject)&&!rule.data.subjectGroups?.[d.year||controls.activeYear]?.[d.subject]&&!(kind==='assignment'&&rule.data.legacyAcademics?.[d.year]?.subjects?.includes(d.subject))&&!all.some(r=>r.kind==='student'&&r.data.class===d.class&&r.data.subjects?.includes(d.subject)))fail('Add this subject to the class or an individual student first.');}
  if(kind==='classroom'){if(old?.data.subjectGroups)d.subjectGroups=old.data.subjectGroups;else delete d.subjectGroups;if(!Array.isArray(d.subjects)||d.subjects.some(x=>!availableSubjects(all).some(s=>s.name===x)))fail('Select valid compulsory subjects.');if(old&&old.data.name!==d.name)fail('Class names are fixed after creation. Create a new class and transfer students instead.');}
  if(kind==='assignment'){const t=all.find(r=>r.id===d.teacherId&&r.kind==='profile');if(!t||!['teacher','hod','vp','principal'].includes(effectiveRole(t.data.role)))fail('Choose a teacher profile.');}
  if(['mark','attendance'].includes(kind)){const student=all.find(r=>r.kind==='student'&&r.id===d.studentId);const enrolledClass=student?.data.enrolments?.[d.year||controls.activeYear]?.class||student?.data.class;if(!student||(enrolledClass!==d.class&&old?.data.class!==d.class))fail('Student does not belong to this class.');if(kind==='mark')d.studentSnapshot=old?.data.studentSnapshot||{name:student.data.name,matricule:student.data.matricule,birthDate:student.data.birthDate,birthPlace:student.data.birthPlace,gender:student.data.gender,class:d.class,photo:student.data.photo,guardianName:student.data.guardianName,guardianPhone:student.data.guardianPhone,repeater:student.data.repeater};if(kind==='mark'&&!studies(enrolment({...student.data,class:d.class},all,d.year||controls.activeYear,student.id),d.subject))fail('Student is not enrolled in this subject.');}
  if(kind==='attendance'){d.year=controls.activeYear;const a=all.find(r=>r.kind==='assignment'&&r.id===d.assignmentId);if(!a||(a.data.year||academicYear())!==controls.activeYear||a.data.class!==d.class||(!admin(p)&&p.role!=='discipline'&&a.data.teacherId!==p.id))fail('Attendance must belong to your assigned lesson.',403);d.subject=a.data.subject;const pupil=all.find(r=>r.kind==='student'&&r.id===d.studentId);if(!studies(enrolment({...pupil.data,class:a.data.class},all,controls.activeYear,pupil.id),d.subject))fail('Student is not enrolled in this lesson.');}
  if(kind==='submission'){if(p.role==='student'){d.studentId=p.id;delete d.feedback;delete d.score;const r=all.find(r=>r.id===d.resourceId&&r.kind==='resource');if(r?.data.dueDate&&Date.now()>new Date(r.data.dueDate+'T23:59:59+01:00').getTime())fail('Submission deadline has passed.');}else{if(!old)fail('Choose an existing submission.');d={...old.data,feedback:d.feedback||'',score:d.score||'',reviewedBy:p.id};}}
  if(kind==='document_request'){if(!old){d={requestType:d.requestType,purpose:String(d.purpose||'').slice(0,2000),dutyDate:d.dutyDate||'',requesterId:p.id,name:p.name,status:'pending',requestedAt:new Date().toISOString()};}else{if(all.some(r=>r.kind==='document'&&r.data.requestId===old.id&&r.data.status==='issued'))fail('This request already has an issued document.');if(!['rejected','cancelled'].includes(d.status))fail('Choose rejection or cancellation.');if(p.role!=='principal'&&d.status!=='cancelled')fail('Only the principal reviews requests.',403);d={...old.data,status:d.status,reviewComment:String(d.reviewComment||'').slice(0,2000),reviewedAt:new Date().toISOString()};}}
  if(kind==='document'){if(old){if(d.status!=='revoked')fail('Issued documents are immutable. Revoke and issue a new reference.');d={...old.data,status:'revoked'};}else {if(d.requestId){const request=all.find(r=>r.kind==='document_request'&&r.id===d.requestId);if(!request||request.data.status!=='pending')fail('Choose a pending request.');if(all.some(r=>r.kind==='document'&&r.data.requestId===d.requestId&&r.data.status==='issued'))fail('This request already has an issued document.',409);d.profileId=request.data.requesterId;d.name=request.data.name;}delete d.issuedBody;if(d.kind!=='letter')d.issuedBody=attestationText(d);else d.name=d.recipient||d.name||d.title;d.token=crypto.randomBytes(24).toString('hex');d.status='issued';}}
  if(kind==='student'){const year=d.academicYear||old?.data.academicYear;if(year){if(!/^\d{4}\/\d{4}$/.test(year)||+year.slice(5)!==+year.slice(0,4)+1)fail('Choose a valid academic year.');d.academicYear=year;d.enrolments={...old?.data.enrolments,[year]:{class:d.class,status:d.status||'active'}};}else d.enrolments=old?.data.enrolments||{};d.classHistory=old?.data.classHistory||[];if(old&&(old.data.class!==d.class||old.data.status!==d.status))d.classHistory=[...d.classHistory,{from:old.data.class,to:d.class,previousStatus:old.data.status,status:d.status,action:d.movement||'profile update',reason:String(d.movementReason||'').slice(0,1000),date:new Date().toISOString(),actor:p.id}];delete d.requiredSubjects;delete d.subjectParticipation;}
  d.ownerId=old?.data.ownerId||p.id;d.updatedAt=new Date().toISOString();try{validateRecord(kind,d,classNames);}catch(e){fail(e.message);}
  if(['event','post','gallery','textbook','resource','mark'].includes(kind)&&!['draft','pending','published','rejected'].includes(d.status))fail('Invalid publication status.');
  const result=await db('rpc/school_save_record','POST',{record_kind:kind,record_data:d,actor_id:p.id,record_id:old?.id||null,expected_version:old?b.version:null});return res.json({row:result[0]});
 }
 fail('Unknown action.');
 }catch(e){res.status(e.status||500).json({error:e.status?e.message:'The request could not be completed. Please try again.'});}}





