import {academicYear} from './academics.js';
// Only reporting details for the requested student, year and assessment.
// Names are returned without staff account identifiers or authentication data.
export function reportInformation(all,student,{year,assessment,cls}={}){
 const d=student.data||{},current=all.find(r=>r.kind==='student'&&r.id===student.id)?.data||d;
 const notes=current.reportDetails?.[year]?.[assessment]||d.reportDetails?.[year]?.[assessment]||{};
 const room=all.find(r=>r.kind==='classroom'&&r.data.name===cls)?.data||{};
 const staffName=id=>all.find(r=>r.kind==='profile'&&r.id===id)?.data.name||'';
 const parents=all.filter(r=>r.kind==='profile'&&r.data.role==='parent'&&(r.data.children||[]).includes(student.id));
 return {...notes,
  guardianName:notes.guardianName||d.guardianName||parents.map(r=>r.data.name).join(', '),
  guardianPhone:notes.guardianPhone||d.guardianPhone||parents.map(r=>r.data.phone).filter(Boolean).join(', ')||d.phone||'',
  repeater:notes.repeater??d.repeater??'',
  classMasterName:notes.classMasterName||staffName(room.classMasters?.[year])};
}

export function reportTeacherNames(all,{year,cls}={}){
 const names={};
 for(const r of all.filter(r=>r.kind==='assignment'&&r.data.class===cls&&(r.data.year===year||!r.data.year&&year===academicYear()))){
  const name=all.find(p=>p.kind==='profile'&&p.id===r.data.teacherId)?.data.name;
  if(name)names[r.data.subject]=[...(names[r.data.subject]||[]),name];
 }
 return Object.fromEntries(Object.entries(names).map(([subject,names])=>[subject,[...new Set(names)].join(' / ')]));
}
