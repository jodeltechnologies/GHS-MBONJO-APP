import {studentsInYear,classStream} from './academics.js';
import {validYear} from './school-controls.js';
export const nextAcademicYear=year=>{if(!validYear(year))throw Error('Choose a valid academic year.');const n=+year.slice(0,4)+1;return `${n}/${n+1}`;};
export function nextClass(cls,rows){const m=/^Form ([1-5])([A-Z])$/.exec(cls||'');if(m&&+m[1]<5)return `Form ${+m[1]+1}${m[2]}`;if(m){const stream=classStream(cls,rows);return ['Arts','Science'].includes(stream)?`Lower Sixth ${stream}`:undefined;}if(/^Lower Sixth (Arts|Science)$/.test(cls))return cls.replace('Lower','Upper');if(/^Upper Sixth (Arts|Science)$/.test(cls))return null;return undefined;}
export function promotionPlan(rows,fromYear,toYear,{actor='',at=new Date().toISOString()}={}){
 if(toYear!==nextAcademicYear(fromYear))throw Error('Advance one academic year at a time.');
 const knownClasses=new Set(rows.filter(r=>r.kind==='classroom').map(r=>r.data.name));const originals=new Map(rows.filter(r=>r.kind==='student').map(r=>[r.id,r]));const updates=[],held=[],groups=new Map();
 for(const r of studentsInYear(rows,fromYear)){
  const original=originals.get(r.id),d=original.data;
  if(['dismissed','transferred out','graduated'].includes(d.status)||['dismissed','transferred out','graduated','completed'].includes(r.data.status))continue;
  if(d.enrolments?.[toYear]){held.push({id:r.id,name:d.name,reason:'Already has a record in the destination year'});continue;}
  const target=nextClass(r.data.class,rows);if(target===undefined||target!==null&&!knownClasses.has(target)){held.push({id:r.id,name:d.name,reason:'Class or stream needs review'});continue;}
  const data={...d,enrolments:{...d.enrolments,[fromYear]:{...d.enrolments?.[fromYear],class:r.data.class,status:target===null?'completed':r.data.status||'active'}},classHistory:[...(d.classHistory||[]),{from:r.data.class,to:target,action:target===null?'completed school':'annual advancement',academicYear:toYear,date:at,actor}],updatedAt:at};delete data.requiredSubjects;delete data.subjectParticipation;
  if(target===null){data.status='graduated';data.exitYear=fromYear;data.exitDate=at.slice(0,10);}else{data.class=target;data.status='active';data.academicYear=toYear;data.enrolments[toYear]={class:target,status:'active',source:'annual advancement',fromYear};}
  updates.push({id:r.id,version:original.version,data,from:r.data.class,to:target});const key=JSON.stringify([r.data.class,target]);const g=groups.get(key)||{from:r.data.class,to:target,count:0};g.count++;groups.set(key,g);
 }
 return {fromYear,toYear,updates,held,groups:[...groups.values()].sort((a,b)=>a.from.localeCompare(b.from,undefined,{numeric:true})),advancing:updates.filter(r=>r.to!==null).length,exiting:updates.filter(r=>r.to===null).length};
}
