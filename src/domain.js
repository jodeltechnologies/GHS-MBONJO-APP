import {requestTypes} from './document-requests.js';
import {postCatalogue} from './posts.js';
export const classes = [...Array.from({length:5},(_,i)=>['A','B'].map(s=>`Form ${i+1}${s}`)).flat(),'Lower Sixth Arts','Lower Sixth Science','Upper Sixth Arts','Upper Sixth Science'];
export const departments=['Mathematics','English','French','Physics','Biology','Computer Science','Food and Nutrition','Geography','History','Economics','Guidance and Counselling','Chemistry','Logic','Philosophy','Religious Studies','Physical Education'];
export const roles=postCatalogue.map(p=>p.id);
export const normalizeMatricule = v => String(v??'').trim().toUpperCase().replace(/[\s‐‑–—]/g,'').replace(/-/g,'');
// Returns a calendar date as YYYY-MM-DD, or '' when the value is absent or not a real date.
// Accepts the stored ISO form and the day/month/year form a phone keyboard may produce.
// It never guesses between day and month: 03/04/2010 is read as 3 April 2010.
export const normalizeBirthDate = v => {
 const s=String(v??'').trim();if(!s)return '';
 const iso=/^(\d{4})-(\d{2})-(\d{2})/.exec(s);
 const dmy=iso?null:/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s);
 if(!iso&&!dmy)return '';
 const [y,m,d]=iso?[+iso[1],+iso[2],+iso[3]]:[+dmy[3],+dmy[2],+dmy[1]];
 if(m<1||m>12||d<1||d>31||y<1900||y>2100)return '';
 const t=new Date(Date.UTC(y,m-1,d));
 if(t.getUTCFullYear()!==y||t.getUTCMonth()!==m-1||t.getUTCDate()!==d)return '';
 return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
};
export const promotionEligible = c => /^Form [1-4][A-Z]$/.test(c)||c.startsWith('Lower Sixth');
export const studies=(student,subject)=>Array.isArray(student.requiredSubjects)?[...student.requiredSubjects,...(student.subjects||[])].includes(subject):!Array.isArray(student.subjects)||student.subjects.length===0||student.subjects.includes(subject);
export function slotsFor(cls,day,form5End){
 const end=day==='Wednesday'?780:cls.startsWith('Form 5')?Number(form5End):cls.includes('Sixth')?960:880;
 if(!end)throw Error('Choose the Form 5 closing time before generating.');
 const out=[]; for(let start=450;start+50<=end;start+=50){if(start===650)start=680;if(start+50<=end)out.push({start,end:start+50});}return out;
}
export const time = m => `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;
export function generateTimetable(assignments,form5End,allowedClasses=classes){
 const days=['Monday','Tuesday','Wednesday','Thursday','Friday'],result=[],jobs=[];
 for(const a of assignments){if(!allowedClasses.includes(a.class)||!a.teacherId||!a.subject||!Number.isInteger(+a.periods)||+a.periods<1||+a.periods>30)throw Error('Each assignment needs a class, teacher, subject and 1–30 periods.');for(let i=0;i<+a.periods;i++)jobs.push(a);}
 // Most constrained classes first. Backtracking never emits a conflicting partial schedule.
 jobs.sort((a,b)=>days.reduce((n,d)=>n+slotsFor(a.class,d,form5End).length-slotsFor(b.class,d,form5End).length,0));
 let attempts=0;
 function place(n){if(n===jobs.length)return true;if(++attempts>100000)return false;const a=jobs[n];
 const options=days.flatMap(day=>slotsFor(a.class,day,form5End).map(s=>({...s,day}))).filter(s=>!result.some(r=>r.day===s.day&&s.start<r.end&&r.start<s.end&&(r.class===a.class||r.teacherId===a.teacherId))).sort((x,y)=>result.filter(r=>r.day===x.day&&r.class===a.class).length-result.filter(r=>r.day===y.day&&r.class===a.class).length);
 for(const s of options){result.push({...a,...s});if(place(n+1))return true;result.pop();}return false;}
 if(!place(0))throw Error('No complete timetable found within the search limit. Reduce workload or revise teacher assignments; no partial timetable was saved.');return result;
}
export function reportSummary(marks){const valid=marks.filter(m=>m.mark!==''&&m.mark!==null&&m.mark!==undefined&&Number.isFinite(+m.mark)&&+m.coefficient>0);if(valid.some(m=>+m.mark<0||+m.mark>20))throw Error('Marks must be between 0 and 20.');const coefficients=valid.reduce((s,m)=>s+(+m.coefficient),0),total=valid.reduce((s,m)=>s+(+m.mark)*(+m.coefficient),0);return {coefficients,total,average:coefficients?total/coefficients:null};}
export function attestationText(d){if(d.issuedBody)return d.issuedBody;const verb=d.kind==='assumption'?'assumed':d.kind==='resumption'?'resumed':d.action;if(!['assumed','resumed'].includes(verb))throw Error('Select assumed or resumed.');return `I, the undersigned, ${d.principal}, Principal of Government High School Mbonjo Limbe, certify that ${d.name} ${verb} duty on ${d.dutyDate}.\n\nMatricule: ${d.matricule}. Rank: ${d.rank}. Salary index: ${d.salaryIndex}. Appointment or transfer decision: ${d.decision}.\n\n${d.name} is effectively serving as ${d.position} in this institution.\n\nIn testimony whereof, this attestation is issued to serve the purpose for which it is intended.`;}
export function validateRecord(kind,d,allowedClasses=classes){
 const required={classroom:['name','stream'],subject:['name','department','coefficient'],exam_attempt:['studentId','resourceId'],document_request:['requestType','purpose'],student:['name','matricule','class','gender'],profile:['name'],assignment:['teacherId','class','subject','department','periods'],resource:['title','class','subject','department','type','submissionMode'],event:['title','date','body'],post:['title','category','body'],gallery:['title','department','image'],textbook:['title','class','subject'],attendance:['studentId','class','date','status','assignmentId'],mark:['studentId','class','subject','assessment','year','mark','coefficient'],submission:['resourceId','body'],document:['name','matricule','kind','principal','rank','salaryIndex','decision','dutyDate','issueDate','reference','position']};
 if(!required[kind]&& !['timetable'].includes(kind))throw Error('Unknown record type.');
 for(const k of (kind==='document'&&d.kind==='letter'?['title','body','principal','issueDate','reference']:required[kind])||[])if(!(kind==='event'&&k==='date'&&d.status==='draft')&&(d[k]===undefined||d[k]===null||String(d[k]).trim()===''))throw Error(`${k} is required.`);
 if(d.class&&!allowedClasses.includes(d.class))throw Error('Invalid class.');
 if(kind==='student'){d.matricule=normalizeMatricule(d.matricule);if(d.birthDate&&(!/^\d{4}-\d{2}-\d{2}$/.test(d.birthDate)||!Number.isFinite(Date.parse(d.birthDate))))throw Error('Use YYYY-MM-DD for date of birth.');}
 if(kind==='resource'&&!d.body&&!d.attachment&&!d.questions?.length)throw Error('Enter notes, upload a file or add assessment questions.');
 if(kind==='subject'&&(!Number.isFinite(+d.coefficient)||+d.coefficient<=0))throw Error('Coefficient must be positive.');
 if(kind==='classroom'&&!/^(Form [1-5][A-Z]|(?:Lower|Upper) Sixth (?:Arts|Science)(?: [A-Z])?)$/.test(d.name))throw Error('Use a class name such as Form 2A or Lower Sixth Arts.');
 if(kind==='attendance'&&!['present','absent','late','excused'].includes(d.status))throw Error('Invalid attendance status.');
 if(kind==='mark'){if(d.grade&&!['A','B','C','D','E','U'].includes(d.grade))throw Error('Choose a valid letter grade.');if(!/^Sequence [1-6]$/.test(d.assessment)&&d.assessment!=='Promotion exam')throw Error('Invalid assessment.');if(d.assessment==='Promotion exam'&&!promotionEligible(d.class))throw Error('Form 5 and Upper Sixth do not write promotion exams.');if(!Number.isFinite(+d.mark)||+d.mark<0||+d.mark>20||!Number.isFinite(+d.coefficient)||+d.coefficient<=0)throw Error('Invalid mark or coefficient.');}
 if(kind==='document'&&d.kind!=='letter')attestationText(d);
 if(kind==='document'&&d.kind==='letter'&&(d.title.length>160||d.body.length>12000))throw Error('Keep the subject under 160 characters and body under 12,000 characters.');
 if(kind==='document_request'&&!requestTypes.includes(d.requestType))throw Error('Choose a valid document type.');
 return d;
}
