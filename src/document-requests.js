export const requestTypes=['assumption','resumption','effective service','employment confirmation'];
export const officialTypes=['Employment confirmation','Recommendation letter','Meeting invitation','Administrative circular','School announcement','Permission letter','Custom letter'];
export const requestingStaff=p=>['teacher','hod','vp','discipline','staff'].includes(p.role);
export function requestState(request,documents){const issued=documents.find(r=>r.kind==='document'&&r.data.requestId===request.id&&r.data.status==='issued');return issued?{status:'issued',documentId:issued.id}:{status:request.data.status,documentId:null};}
