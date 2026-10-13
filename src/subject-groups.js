import {studentsInYear,enrolment,availableSubjects} from './academics.js';
import {studies} from './domain.js';
const inactive=new Set(['dismissed','transferred out','graduated','completed']);
export function subjectGroupRoster(records,{year,cls,subject}){
 const originals=new Map(records.filter(r=>r.kind==='student').map(r=>[r.id,r.data]));
 return studentsInYear(records,year).filter(r=>r.data.class===cls&&!inactive.has(r.data.status)&&!inactive.has(originals.get(r.id)?.status)&&r.data.active!==false).map(r=>({...r,selected:studies(enrolment(r.data,records,year,r.id),subject)})).sort((a,b)=>String(a.data.name).localeCompare(String(b.data.name))||a.id.localeCompare(b.id));
}
export function subjectGroupSnapshot(roster){return JSON.stringify(roster.map(r=>({id:r.id,version:r.version,class:r.data.class,status:r.data.status||''})).sort((a,b)=>a.id.localeCompare(b.id)));}
export function subjectGroupChange(records,old,{year,subject,mode,studentIds,actor,at=new Date().toISOString()}){
 if(!/^\d{4}\/\d{4}$/.test(year||'')||+year.slice(5)!==+year.slice(0,4)+1)throw Error('Choose a valid academic year.');
 if(!old||old.kind!=='classroom')throw Error('Set up this class before choosing subject students.');
 if(!availableSubjects(records).some(s=>s.name===subject))throw Error('Choose a valid subject.');
 if(!['all','selected'].includes(mode))throw Error('Choose all students or selected students.');
 if(!Array.isArray(studentIds)||studentIds.some(id=>typeof id!=='string'))throw Error('Choose students from the class list.');
 const roster=subjectGroupRoster(records,{year,cls:old.data.name,subject}),ids=new Set(roster.map(r=>r.id));
 if(studentIds.some(id=>!ids.has(id)))throw Error('A selected student is no longer active in this class. Reload the class list.');
 if(!roster.length)throw Error('No active students are registered in this class for this year.');
 const group={mode,studentIds:mode==='all'?[]:[...new Set(studentIds)].sort(),updatedBy:actor,updatedAt:at};
 return {...old.data,subjectGroups:{...old.data.subjectGroups,[year]:{...old.data.subjectGroups?.[year],[subject]:group}},updatedAt:at};
}
