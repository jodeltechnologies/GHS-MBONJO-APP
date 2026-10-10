export const CONTROL_ID='7fe916c2-5b21-4a10-a12d-420e870ad5c9';
export const assessments=['Sequence 1','Sequence 2','Sequence 3','Sequence 4','Sequence 5','Sequence 6','Promotion exam'];
export const validYear=y=>/^\d{4}\/\d{4}$/.test(y||'')&&+y.slice(5)===+y.slice(0,4)+1;
export function schoolControls(rows){return rows.find(r=>r.kind==='school_control'&&r.id===CONTROL_ID)?.data||{activeYear:'2025/2026',markWindows:{}};}
export function changeControls(p,current,input){
 const next={...current,markWindows:{...current.markWindows}};
 if(input.action==='year'){
  if(p.role!=='principal')throw Error('Only the principal can change the academic year.');
  if(!validYear(input.year))throw Error('Enter a school year such as 2026/2027.');
  next.activeYear=input.year;
 }else if(input.action==='marks'){
  if(!['principal','vp'].includes(p.role))throw Error('Only the principal or vice-principal can open or close mark entry.');
  if(!['open','closed'].includes(input.status)||!['all',...assessments].includes(input.assessment))throw Error('Choose an assessment and Open or Closed.');
  next.markWindows[current.activeYear]={status:input.status,assessment:input.assessment,changedBy:p.id,changedAt:new Date().toISOString()};
 }else throw Error('Choose a school control to change.');
 return next;
}
export function markEntryAllowed(controls,d){const w=controls.markWindows?.[controls.activeYear];return d.year===controls.activeYear&&w?.status==='open'&&(w.assessment==='all'||w.assessment===d.assessment);}
export function markSaveAllowed(controls,d,old,p){
 if(markEntryAllowed(controls,d)&&(!old||markEntryAllowed(controls,old.data)))return true;
 // Closing entry still permits administration to publish or withdraw existing results.
 const fields=['studentId','class','subject','assessment','year','mark','coefficient','grade','remark'];
 return ['principal','vp'].includes(p.role)&&!!old&&fields.every(k=>String(d[k]??'')===String(old.data[k]??''))&&['draft','pending','published','rejected'].includes(d.status);
}
