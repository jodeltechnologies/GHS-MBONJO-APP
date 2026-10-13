export const subjectCatalogue=[
 ['English Language','English','shared'],['French','French','shared'],['Mathematics','Mathematics','shared'],['Additional Mathematics','Mathematics','science'],['Biology','Biology','science'],['Chemistry','Chemistry','science'],['Citizenship','History','shared'],['Commerce','Economics','arts'],['Computer Science','Computer Science','shared'],['Economics','Economics','arts'],['Geography','Geography','arts'],['Geology','Geography','science'],['History','History','arts'],['Human Biology','Biology','science'],['Logic','Logic','arts'],['Physics','Physics','science'],['Food and Nutrition','Food and Nutrition','elective'],['Literature in English','English','arts'],['Physical Education','Physical Education','shared'],['Religious Studies','Religious Studies','elective'],['Manual Labour','Physical Education','shared'],['Philosophy','Philosophy','arts']
].map(([name,department,group])=>({name,department,group,coefficient:1}));
export function classSubjects(cls,all){const rule=all.find(r=>r.kind==='classroom'&&r.data.name===cls);return rule?rule.data.subjects||[]:null;}
export function enrolment(student,all,year=student.academicYear||student.sourceYear?.replace('-','/')||academicYear(),studentId=student.id){
 const cls=all.find(r=>r.kind==='classroom'&&r.data.name===student.class),compulsory=classSubjects(student.class,all),groups=cls?.data.subjectGroups?.[year]||{};
 const subjectParticipation={};
 for(const [subject,group] of Object.entries(groups))if(group&&['all','selected'].includes(group.mode))subjectParticipation[subject]=group.mode==='all'||Array.isArray(group.studentIds)&&group.studentIds.includes(studentId);
 const required=[...new Set([...(compulsory||[]),...Object.keys(subjectParticipation).filter(s=>subjectParticipation[s])])].filter(s=>subjectParticipation[s]!==false);
 return {...student,...(compulsory!==null||Object.keys(subjectParticipation).length?{requiredSubjects:required}:{}),subjectParticipation};
}
export function availableSubjects(all){const map=new Map(subjectCatalogue.map(s=>[s.name,s]));for(const r of all.filter(r=>r.kind==='subject'))map.set(r.data.name,r.data);return [...map.values()];}
export function recommendSubjects(stream){const shared=['English Language','French','Mathematics','Computer Science','Citizenship','Physical Education','Manual Labour'];if(stream==='Arts')return [...shared,'History','Geography','Economics','Literature in English','Commerce'];if(stream==='Science')return [...shared,'Physics','Chemistry','Biology'];return [...shared,'History','Geography','Biology','Physics','Chemistry'];}
export function academicYear(date=new Date()){const n=date.getUTCFullYear()-(date.getUTCMonth()<8?1:0);return n+'/'+(n+1);}
export function competency(mark){if(mark===null||mark===undefined)return '';return mark>=18?'A+/E':mark>=15?'CA':mark>=11?'CECA':'CNA';}

export function availableAcademicYears(records, current=academicYear()) {
 const years=new Set([current]);
 const start=+current.slice(0,4);for(let i=1;i<=5;i++)years.add(`${start-i}/${start-i+1}`);
 for(const r of records){for(const value of [r.data.academicYear,r.data.sourceYear?.replace('-','/'),r.data.year,...Object.keys(r.data.enrolments||{})])if(/^\d{4}\/\d{4}$/.test(value||''))years.add(value);}
 return [...years].sort().reverse();
}
export function studentsInYear(records, year) {
 return records.filter(r=>r.kind==='student').flatMap(r=>{
  const d=r.data,entry=d.enrolments?.[year];
  if(entry)return [{...r,data:enrolment({...d,...entry},records,year,r.id)}];
  const recorded=d.academicYear||d.sourceYear?.replace('-','/');
  if(recorded===year||year==='unassigned'&&!recorded&&!Object.keys(d.enrolments||{}).length)return [{...r,data:enrolment(d,records,year,r.id)}];
  return [];
 });
}
export function classStream(cls,records){
 if(/ Sixth Arts/.test(cls))return 'Arts';if(/ Sixth Science/.test(cls))return 'Science';
 return records.find(r=>r.kind==='classroom'&&r.data.name===cls)?.data.stream||'Unspecified';
}
export function classRoster(records,{year,stream='',cls='',studentId=''}={}){
 return studentsInYear(records,year).filter(r=>(!stream||classStream(r.data.class,records)===stream)&&(!cls||r.data.class===cls)&&(!studentId||r.id===studentId)).sort((a,b)=>a.data.class.localeCompare(b.data.class,undefined,{numeric:true})||a.data.name.localeCompare(b.data.name));
}
export function assignmentsInYear(records,year,current=academicYear()){
 return records.filter(r=>r.kind==='assignment'&&(r.data.year===year||!r.data.year&&year===current));
}
