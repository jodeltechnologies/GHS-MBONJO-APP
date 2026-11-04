import {levelOf} from './domain.js';

export function changeStudent(record,{action,year,cls,reason,actor,at=new Date().toISOString()},records){
 if(!record||record.kind!=='student'||record.data.deleted)throw Error('Student not found.');
 if(!['promote','demote','transfer','dismiss','reinstate','delete'].includes(action))throw Error('Choose a valid student action.');
 reason=String(reason||'').trim();if(!reason||reason.length>1000)throw Error('Give a reason of no more than 1,000 characters.');
 const old=record.data,current=old.enrolments?.[year]||old;
 if(old.academicYear!==year&&!old.enrolments?.[year])throw Error('Student is not enrolled in the current academic year.');
 if(action!=='delete'&&['graduated','completed'].includes(old.status))throw Error('Use the alumni record for a student who has completed school.');
 const destination=['dismiss','delete'].includes(action)?current.class:cls;
 if(!['delete','dismiss'].includes(action)&&!records.some(r=>r.kind==='classroom'&&r.data.name===destination))throw Error('Choose a valid destination class.');
 const from=levelOf(current.class),to=levelOf(destination),levels=['Form 1','Form 2','Form 3','Form 4','Form 5','Lower Sixth','Upper Sixth'];
 if(['promote','demote'].includes(action)){
  if(!levels.includes(from)||!levels.includes(to)||(action==='promote'?levels.indexOf(to)<=levels.indexOf(from):levels.indexOf(to)>=levels.indexOf(from)))throw Error(action==='promote'?'Promotion must move the student to a higher class.':'Demotion must move the student to a lower class.');
 }
 const status={promote:'promoted',demote:'demoted',transfer:'active',dismiss:'dismissed',reinstate:'active',delete:'deleted'}[action];
 const data={...old,class:destination,status,academicYear:year,movement:action,movementReason:reason,updatedAt:at,enrolments:{...old.enrolments,[year]:{...old.enrolments?.[year],class:destination,status}},classHistory:[...(old.classHistory||[]),{from:current.class,to:destination,previousStatus:current.status,status,action,reason,academicYear:year,date:at,actor}]};
 if(action==='delete')Object.assign(data,{deleted:true,deletedAt:at,deletedBy:actor,active:false,authEpoch:(old.authEpoch||0)+1});
 delete data.requiredSubjects;delete data.subjectParticipation;
 return data;
}
