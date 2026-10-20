import {academicYear,enrolment,classRoster} from './academics.js';
import {studies} from './domain.js';

export function teachesStudent(teacherId,student,records,{year,subject=''}={}){
 return records.some(r=>{
  if(r.kind!=='assignment'||r.data.teacherId!==teacherId)return false;
  const a=r.data,assignedYear=a.year||academicYear();
  if(year&&assignedYear!==year||subject&&a.subject!==subject)return false;
  const d=student.data,entry=d.enrolments?.[assignedYear];
  if(!entry&&assignedYear!==(d.academicYear||d.sourceYear?.replace('-','/')||academicYear()))return false;
  const enrolled=enrolment({...d,...entry},records,assignedYear,student.id);
  return enrolled.class===a.class&&studies(enrolled,a.subject);
 });
}

export function teachingRoster(records,{teacherId,subject='',...filters}={}){
 return classRoster(records,filters).filter(student=>teachesStudent(teacherId,student,records,{year:filters.year,subject}));
}
