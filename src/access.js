import {requestingStaff} from './document-requests.js';
import {studies} from './domain.js';
export const admin=p=>['principal','vp'].includes(p.role);
export const teacher=p=>['teacher','hod'].includes(p.role);
export const staff=p=>!['student','parent'].includes(p.role);
export const assigned=(p,d,all)=>all.some(r=>r.kind==='assignment'&&r.data.teacherId===p.id&&r.data.class===d.class&&(!d.subject||r.data.subject===d.subject));
// Departmental records sit in front of the principal's blanket read, because for
// these the principal is not automatically entitled. A department's papers reach
// the administration when the head of department transmits them and not before,
// and staff messages are between the people in them.
//
// This is an application rule, not secrecy. Whoever administers the Supabase
// project can read every row in the table directly, and the portal says so on the
// messages page rather than implying a privacy it cannot provide.
export const sameDepartment=(p,d)=>!!p.department&&!!d.department&&p.department===d.department;
export const inThread=(p,d)=>d.fromId===p.id||d.toId===p.id||(d.scope==='department'&&sameDepartment(p,d));
export function canRead(p,r,all){const d=r.data;
 if(r.kind==='message')return staff(p)&&inThread(p,d);
 if(r.kind==='dept_document')return staff(p)&&(sameDepartment(p,d)||(admin(p)&&d.transmitted===true));
 if(p.role==='principal')return true;
 if(r.kind==='document_request')return d.requesterId===p.id;
 if(['classroom','subject'].includes(r.kind))return true;
 if(r.kind==='exam_attempt')return admin(p)||d.studentId===p.id||teacher(p)&&all.some(x=>x.id===d.resourceId&&x.data.ownerId===p.id);
 if(p.role==='vp')return true;
 if(r.kind==='profile')return r.id===p.id;
 if(['event','post','gallery','textbook'].includes(r.kind))return d.status==='published'||((p.role==='content_creator'||p.contentCreator===true)&&d.ownerId===p.id);
 if(r.kind==='dept_item')return staff(p)&&(sameDepartment(p,d)||admin(p));
 if(r.kind==='progression')return staff(p)&&(sameDepartment(p,d)||admin(p));
 if(r.kind==='assignment')return p.role==='discipline'||d.teacherId===p.id;
 if(r.kind==='timetable')return d.status==='published';
 if(r.kind==='document')return d.profileId===p.id;
 if(r.kind==='student')return p.role==='discipline'||(teacher(p)&&assigned(p,d,all))||(p.role==='student'&&r.id===p.id)||(p.role==='parent'&&(p.children||[]).includes(r.id));
 if(r.kind==='resource')return (teacher(p)&&(d.ownerId===p.id||p.role==='hod'&&d.department===p.department))||(p.role==='student'&&d.class===p.class&&studies(p,d.subject)&&d.status==='published');
 if(['mark','attendance'].includes(r.kind))return (teacher(p)&&assigned(p,d,all))||(p.role==='discipline'&&r.kind==='attendance')||(p.role==='student'&&d.studentId===p.id&&(r.kind==='attendance'||d.status==='published'))||(p.role==='parent'&&(p.children||[]).includes(d.studentId)&&(r.kind==='attendance'||d.status==='published'));
 if(r.kind==='submission')return d.studentId===p.id||all.some(x=>x.kind==='resource'&&x.id===d.resourceId&&x.data.ownerId===p.id);
 return false;
}
export function canWrite(p,kind,d,old,all){
 // Departmental writes come before the principal's blanket allow, for the same
 // reason the reads do: these belong to the department, and the principal writing
 // a department's minutes or someone else's message would be a forgery.
 if(kind==='message')return staff(p)&&d.fromId===p.id&&!old&&(d.scope==='department'?sameDepartment(p,d):!!d.toId);
 if(kind==='dept_document'){
  if(!staff(p)||!sameDepartment(p,d))return false;
  // Only the head of department signs and transmits; any member may draft.
  if(d.transmitted===true&&old?.data.transmitted!==true&&p.role!=='hod')return false;
  if(d.status==='signed'&&old?.data.status!=='signed'&&p.role!=='hod')return false;
  return !old||old.data.department===p.department;
 }
 if(kind==='dept_item')return p.role==='hod'&&sameDepartment(p,d)&&(!old||old.data.department===p.department);
 if(kind==='progression')return staff(p)&&sameDepartment(p,d)&&(!old||old.data.department===p.department);
 if(p.role==='principal')return true;
 if(['classroom','subject'].includes(kind))return p.role==='vp';
 if(kind==='exam_attempt')return false;
 if(kind==='document_request')return requestingStaff(p)&&(!old||old.data.requesterId===p.id&&old.data.status==='pending'&&d.status==='cancelled');
 if(kind==='profile')return old?.id===p.id; // protected fields are separately immutable
 if(kind==='document')return false;
 if(p.role==='vp')return !['profile','document'].includes(kind);
 if(['event','post','gallery','textbook'].includes(kind))return (p.role==='content_creator'||p.contentCreator===true)&&(!old||old.data.ownerId===p.id);
 if(kind==='resource')return teacher(p)&&((!old||old.data.ownerId===p.id)&&assigned(p,d,all)||p.role==='hod'&&old?.data.department===p.department&&d.department===p.department);
 if(kind==='attendance'||kind==='mark')return teacher(p)&&assigned(p,d,all)||kind==='attendance'&&p.role==='discipline';
 if(kind==='submission')return p.role==='student'&&(!old||old.data.studentId===p.id)&&all.some(r=>r.kind==='resource'&&r.id===d.resourceId&&r.data.class===p.class&&studies(p,r.data.subject)&&r.data.status==='published'&&r.data.submissionMode==='online')||teacher(p)&&old&&all.some(r=>r.kind==='resource'&&r.id===old.data.resourceId&&r.data.ownerId===p.id);
 return false;
}
