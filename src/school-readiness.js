import {assignmentsInYear,studentsInYear} from './academics.js';
import {effectiveRole} from './posts.js';

export function schoolReadiness(records,year){
 const staff=records.filter(r=>r.kind==='profile'&&r.data.active!==false),assigned=new Set(assignmentsInYear(records,year).map(r=>r.data.teacherId));
 const unassignedTeachers=staff.filter(r=>['teacher','hod'].includes(effectiveRole(r.data.role))&&!assigned.has(r.id));
 const missingBirthDates=studentsInYear(records,year).filter(r=>r.data.active!==false&&!['graduated','completed','dismissed','transferred out'].includes(r.data.status)&&!r.data.birthDate);
 const names=new Map();for(const r of staff){const key=String(r.data.name||'').trim().replace(/\s+/g,' ').toUpperCase();if(!key)continue;const group=names.get(key)||[];group.push(r);names.set(key,group);}
 return {unassignedTeachers,missingBirthDates,duplicateNames:[...names.values()].filter(group=>group.length>1)};
}

export function renderReadinessPanel(records,year,{role,lang='en'}={}){
 if(!['principal','vp'].includes(role))return '';
 const {unassignedTeachers,missingBirthDates,duplicateNames}=schoolReadiness(records,year);if(!unassignedTeachers.length&&!missingBirthDates.length&&!duplicateNames.length)return '';
 const t=(en,fr)=>lang==='fr'?fr:en,escape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
 return `<section class="panel"><h2>${t('School records to review','Dossiers scolaires à vérifier')} · ${escape(year)}</h2>${unassignedTeachers.length?`<details><summary>${unassignedTeachers.length} ${t('teaching accounts without a current assignment','comptes enseignants sans affectation actuelle')}</summary><p>${t('Confirm this year’s classes and subjects in Teaching assignments. Historical assignments are preserved.','Confirmez les classes et matières de cette année dans Affectations. Les anciennes affectations sont conservées.')}</p><ul>${unassignedTeachers.map(r=>`<li>${escape(r.data.name)}</li>`).join('')}</ul><button type="button" data-action="tab" data-tab="assignments">${t('Review teaching assignments','Vérifier les affectations')}</button></details>`:''}${missingBirthDates.length?`<details><summary>${missingBirthDates.length} ${t('active students without a birth date','élèves actifs sans date de naissance')}</summary><p>${t('Confirm these dates from school records so matricule and birth-date sign-in can work.','Confirmez ces dates dans le registre scolaire pour permettre la connexion par matricule et date de naissance.')}</p><ul>${missingBirthDates.map(r=>`<li>${escape(r.data.name)} · ${escape(r.data.class)} · ${escape(r.data.matricule)}</li>`).join('')}</ul><button type="button" data-action="tab" data-tab="students">${t('Review student profiles','Vérifier les profils des élèves')}</button></details>`:''}${duplicateNames.length?`<details><summary>${duplicateNames.length} ${t('staff-name groups to check','groupes de noms du personnel à vérifier')}</summary><p>${t('Matching names may belong to different people. Check the register before changing any account.','Des noms identiques peuvent désigner différentes personnes. Vérifiez le registre avant toute modification de compte.')}</p><ul>${duplicateNames.map(group=>`<li>${escape(group[0].data.name)} (${group.length})</li>`).join('')}</ul></details>`:''}</section>`;
}
