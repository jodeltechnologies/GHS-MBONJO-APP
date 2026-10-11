import {blankPrintHTML} from './student-printing.js';
// ---------------------------------------------------------------------------
// The two printed sheets
// ---------------------------------------------------------------------------
// The report card and the master result sheet, laid out as the school's own
// printouts lay them out. Markup only: every figure arrives already worked out by
// reports.js, so nothing here decides what a mark means.
//
// One deliberate difference from the school's current printout. Where no mark
// exists — a subject nobody in the class has been assessed in, a student who has
// sat nothing — it prints a dash, not 00.00. A printed 00.00 reads as a class that
// scored zero, and a parent cannot tell the two apart.

import {competenceScale,belowPass,sequences,TERMS,cbaResult,cbaScale} from './reports.js';

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// 8.85 prints as 08.85, the way the school's sheets pad their figures.
export const fig=v=>v===null||v===undefined||v===''||!Number.isFinite(Number(v))?'--'
 :(Number(v)<10&&Number(v)>=0?'0':'')+Number(v).toFixed(2);
const red=(v,text)=>belowPass(v)?`<span class="rc-low">${text}</span>`:text;
// "Sequence 2" is printed SEQ2 on the sheet.
export const columnLabel=a=>{const i=sequences.indexOf(a);return i<0?String(a||'').toUpperCase():`SEQ${i+1}`;};

export const subjectFrench={'English Language':'Anglais','French':'Français','Mathematics':'Mathématiques',
 'Biology':'Biologie','Chemistry':'Chimie','Computer Science':'Informatique','Economics':'Economie',
 'Geography':'Géographie','Geology':'Géologie','History':'Histoire','Physics':'Physique',
 'Literature in English':'Littérature anglaise','Philosophy':'Philosophie','Citizenship':'Education à la citoyenneté',
 'Physical Education':'Education physique','Religious Studies':'Education religieuse','Manual Labour':'Travail manuel',
 'Home Economics':'Economie familiale','Food and Nutrition':'Alimentation et nutrition','Commerce':'Commerce','Logic':'Logique',
 'Human Biology':'Biologie humaine','Additional Mathematics':'Mathématiques supplémentaires'};
// 2008-06-06 prints as 6 / 6 / 2008, the way the school's card prints it.
export const printedDate=v=>{const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(v||''));return m?`${+m[3]} / ${+m[2]} / ${m[1]}`:String(v||'');};
const subjectLine=name=>{const fr=subjectFrench[name];return esc(String(name).toUpperCase())+(fr?` / ${esc(fr.toUpperCase())}`:'');};

// The bilingual heading block, as a table so it prints as the ruled box the school
// uses rather than as free-floating text.
export function reportLetterhead(){
 const fr=['REPUBLIQUE DU CAMEROUN','Paix-Travail-Patrie','MINISTERE DES ENSEIGNEMENTS SECONDAIRES',
           'DELEGATION REGIONALE DU SUD OUEST','DELEGATION DEPARTEMENTALE DU FAKO'];
 const en=['REPUBLIC OF CAMEROON','Peace-Work-Fatherland','MINISTRY OF SECONDARY EDUCATION',
           'REGIONAL DELEGATION FOR THE SOUTH WEST','DIVISIONAL DELEGATION FOR FAKO'];
 return `<table class="rc-head"><tbody>
  ${fr.map((line,i)=>`<tr><td>${esc(line)}</td>${i===0?'<td rowspan="6" class="rc-crest"><img src="/crest.jpg" alt="School crest"></td>':''}<td>${esc(en[i])}</td></tr>`).join('')}
  <tr><td class="rc-strong">LYCEE DE MBONJO LIMBE</td><td class="rc-strong">GOVERNMENT HIGH SCHOOL MBONJO LIMBE</td></tr>
  <tr><td>Reg. No.: 6CE1GSAD110491113</td><td class="rc-email">Email: limbeghsmbonjo@gmail.com</td><td>Tel: (+237) 677 832 194</td></tr>
 </tbody></table>`;
}

// The photograph box beside the identity block. A stored photograph is printed;
// where there is none the box still prints, ruled and empty, so the school can
// staple or stamp one onto the card the way it always has. Only an inline image
// is accepted — a card must not fetch anything when it is opened or printed.
const photoSource=v=>/^data:image\/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=]+$/.test(String(v||''))?String(v):'';
export function photoCell(photo){
 const src=photoSource(photo);
 return `<td class="rc-photo" rowspan="5">${src
  ?`<img src="${src}" alt="Student photograph">`
  :'<span>PHOTO</span>'}</td>`;
}

// The REFERENCE table at the foot of the card: the bands the Remarks column uses.
export const referenceTable=()=>`<table class="rc-ref"><thead><tr><th>MARKS /<br>NOTES</th><th>Abbr.</th><th>COMMENT / OBSERVATIONS</th></tr></thead><tbody>
 ${competenceScale.map(b=>`<tr><td>${String(b.from).padStart(2,'0')}-${b.to}/20</td><td>${esc(b.abbr)}</td><td>${esc(b.en)}</td></tr>`).join('')}
</tbody></table>`;

// ---------------------------------------------------------------------------
// One student's report card
// ---------------------------------------------------------------------------

const countValue=v=>v===undefined||v===null||v===''?'--':esc(v);
const fullName=v=>esc(String(v||'').toUpperCase());
const range=(a,b)=>a===null||a===undefined?'--':`${fig(a)}–${fig(b)}`;
const pair=(label,value)=>`<span class="rc-label">${esc(label)}</span><b>${countValue(value)}</b>`;
const detailRows=items=>items.map(([label,value])=>`<tr><td>${esc(label)}</td><td>${countValue(value)}</td></tr>`).join('');
const signature=name=>`<b>${fullName(name)}</b><span class="rc-sign-line"></span>`;

// One student's sheet. Missing school information stays visibly blank.
export function reportCardHTML(sheet,report,{year='',assessment='',cls='',teacherOf=()=>'',format='sba'}={}){
 const d=sheet.student.data||{},n=sheet.details||{},tot=sheet.totals,cba=format==='cba';
 const annual=assessment==='Annual Report',cols=annual?TERMS:report.assessments;
 const result=cba?cbaResult(tot.average):null;
 const identity=[
  ['Name / Nom',String(d.name||'').toUpperCase(),'Class / Classe',cls||d.class],
  ['Date and place of birth / Naissance',[printedDate(d.birthDate),d.birthPlace].filter(Boolean).join(', '),'Gender / Sexe',d.gender],
  ['Unique ID / Matricule',d.matricule,'Repeater / Redoublant',n.repeater===true?'Yes / Oui':n.repeater===false?'No / Non':n.repeater],
  ['Parent or guardian / Parent ou tuteur',[n.guardianName,n.guardianPhone].filter(Boolean).join(' · '),'Enrolment / Effectif',report.onRoll],
  ['Class master / Maître de classe',String(n.classMasterName||'').toUpperCase(),'Class attendance / Présents aux évaluations',n.classAttendance??report.assessed]];
 const row=r=>{
  const teacher=teacherOf(r.subject),grade=cba?cbaResult(r.finalMark)?.letter:r.grade;
  const remark=cba?cbaResult(r.finalMark)?.en:r.remark;
  const subject=report.subjects[r.subject]||{};
  const cells=cols.map(a=>{const v=(annual?r.termAverages?.find(x=>x.term===a):r.perAssessment.find(x=>x.assessment===a))?.mark;return `<td>${red(v,fig(v))}</td>`;}).join('');
  const competencyGroups=new Map();for(const x of r.perAssessment.filter(x=>x.competencies)){const labels=competencyGroups.get(x.competencies)||[];labels.push(columnLabel(x.assessment));competencyGroups.set(x.competencies,labels);}const competencies=[...competencyGroups].map(([text,labels])=>`<span><b>${esc(labels.join(' / '))}:</b> ${esc(text)}</span>`).join('');
  return `<tr><td class="rc-subject">${subjectLine(r.subject)}${teacher?`<small>${fullName(teacher)}</small>`:''}</td>
   <td>${countValue(r.coefficient)}</td>${cells}
   <td class="rc-final">${red(r.finalMark,fig(r.finalMark))}</td><td>${red(r.finalMark,fig(r.total))}</td>
   <td>${fig(r.subjectAverage)}</td><td>${range(subject.minimum,subject.maximum)}</td>
   <td><b>${esc(grade||'--')}</b></td><td>${countValue(r.rank)}</td><td class="rc-remark">${esc(remark||'--')}</td></tr>
   ${cba?`<tr class="rc-competency-row"><td colspan="${cols.length+9}"><b>Competencies evaluated / Compétences évaluées:</b> ${competencies||'--'}</td></tr>`:''}`;
 };
 const discipline=[
  ['Unjustified absence (hours) / Absence non justifiée (h)',n.unjustifiedAbsenceHours],
  ['Justified absence (hours) / Absence justifiée (h)',n.justifiedAbsenceHours],
  ['Lateness (times) / Retards',n.lateCount],
  ['Punishment (hours) / Consignes (h)',n.punishmentHours],
  ['Conduct warning / Avertissement',n.conductWarning],
  ['Reprimand / Blâme',n.reprimand],
  ['Suspension / Exclusion temporaire',n.suspension],
  ['Dismissed / Exclusion définitive',n.dismissed]];
 const html=`<article class="print-page report-card report-${cba?'cba':'sba'}">
 ${reportLetterhead()}
 <div class="rc-title-block"><h2 class="rc-title">${report.sample?'BLANK SAMPLE / MODÈLE VIERGE · ':''}${esc(assessment).toUpperCase()} PROGRESS REPORT / BULLETIN DE NOTES</h2>
 <p class="rc-year">ACADEMIC YEAR / ANNÉE SCOLAIRE: ${esc(year)} <span>${cba?'CBA · COMPETENCE BASED':'SBA · SEQUENCE BASED'}</span></p></div>
 <table class="rc-identity"><tbody>${identity.map(([a,b,c,e],i)=>`<tr><td>${pair(a,b)}</td><td>${pair(c,e)}</td>${i===0?photoCell(d.photo):''}</tr>`).join('')}</tbody></table>
 <div class="rc-performance">
 <div><span>Average / Moyenne</span><strong>${red(tot.average,fig(tot.average))}<small> / 20</small></strong></div>
 <div><span>Position / Rang</span><strong>${countValue(sheet.position)}<small> / ${report.ranked??''}</small></strong></div>
 <div><span>Subjects sat / Matières évaluées</span><strong>${tot.subjectsSat??''}</strong></div>
 <div><span>Passed / Réussies</span><strong>${tot.subjectsPassed??''}</strong></div>
 <div><span>Failed / Échouées</span><strong>${report.sample?'':tot.subjectsSat-tot.subjectsPassed}</strong></div>
 </div>
 <table class="rc-marks"><thead><tr><th>Subject and teacher / Matière et enseignant</th><th>Coef.</th>
 ${cols.map(a=>`<th>${esc(annual?a.replace(' Term',''):columnLabel(a))}</th>`).join('')}
 <th>AV / 20</th><th>AV × Coef.</th><th>Subject avg.</th><th>Min–Max</th><th>Grade</th><th>Rank</th><th>Remarks / Observations</th></tr></thead>
 ${sheet.rows.map(r=>`<tbody class="rc-subject-group">${row(r)}</tbody>`).join('')}<tbody>
 <tr class="rc-total"><td>TOTAL</td><td>${tot.coefficients||'--'}</td>${cols.map(()=>'<td></td>').join('')}<td>${fig(tot.average)}</td><td>${fig(tot.total)}</td><td colspan="5"></td></tr></tbody></table>
 <div class="rc-foot">
 <section><h3 class="rc-h">DISCIPLINE / SDM · SURVEILLANCE GÉNÉRALE</h3>
 <table class="rc-box"><tbody>${detailRows(discipline)}</tbody></table>
 <p class="rc-observation"><b>Observation:</b> ${esc(n.disciplineObservation||'')}</p></section>
 <section><h3 class="rc-h">CLASS PROFILE / RÉSULTATS DE LA CLASSE</h3>
 <table class="rc-box"><tbody>${detailRows([
 ['Class average / Moyenne de classe',fig(report.classAverage)],
 ['Lowest / Highest average',range(report.lowest,report.highest)],
 ['Number passed / Nombre admis',report.passedAvg],
 ['Success rate / Taux de réussite',report.percentPassedAvg===null?'--':report.percentPassedAvg+'%'],
 ['Total score / Total des points',fig(tot.total)],
 ['Coefficient total',tot.coefficients||'--'],
 ['Overall grade / Note globale',cba?result?.letter:undefined]
 ])}</tbody></table>
 <p class="rc-observation"><b>Student performance / Appréciation:</b> ${esc(cba?result?.en||'':n.performanceObservation||'')}</p>
 <h3 class="rc-h">CLASS COUNCIL / CONSEIL DE CLASSE</h3>
 <p class="rc-observation">${esc(n.councilObservation||'')}</p></section></div>
 <details class="rc-key" open><summary>GRADING REFERENCE / BARÈME</summary>
 ${cba?`<table class="rc-ref"><thead><tr><th>Mark / Note</th><th>Grade</th><th>Code</th><th>Competences / Compétences</th></tr></thead><tbody>
 ${cbaScale.map(b=>`<tr><td>${b.from}–${b.to===20?'20':b.to+'.99'} / 20</td><td>${b.letter}</td><td>${b.abbr}</td><td>${esc(b.en)} / ${esc(b.fr)}</td></tr>`).join('')}</tbody></table>`:referenceTable()}</details>
 <table class="rc-sign"><thead><tr><th colspan="3">NAMES AND SIGNATURES / NOMS ET SIGNATURES</th></tr></thead>
 <tbody><tr><td>Class master / Maître de classe${signature(n.classMasterName)}</td><td>Principal / Proviseur${signature(n.principalName)}</td><td>Parent or guardian / Parent ou tuteur${signature(n.guardianName)}</td></tr></tbody></table>
 <p class="rc-note">-- means no published mark or information. Missing marks are excluded from averages and rankings. ${annual?'Annual marks average the available term averages. ':''}Absence hours and disciplinary observations are entered by the school.</p>
 </article>`;
 return report.sample?blankPrintHTML(html):html;
}

export function masterSheetHTML(report,{year='',assessment='',cls='',showMarks=false,format='sba',order='average'}={}){
 const subjects=report.subjectNames,cba=format==='cba';
 const summary=[
 ['Number on roll / Effectif',report.onRoll,report.onRoll],
 ['Number assessed / Évalués',report.assessed,report.assessed],
 ['Passed / Admis',report.passedAvg,report.passedPapers],
 ['Pass rate / Réussite (%)',report.percentPassedAvg,report.percentPassedPapers],
 ['Failed / Échoués',report.failedAvg,report.failedPapers],
 ['Failure rate / Échec (%)',report.percentFailedAvg,report.percentFailedPapers]];
 const sheets=[...report.sheets].sort(order==='name'?(a,b)=>a.student.data.name.localeCompare(b.student.data.name):
 (a,b)=>(b.totals.average??-Infinity)-(a.totals.average??-Infinity)||a.student.data.name.localeCompare(b.student.data.name));
 const cell=r=>r.finalMark===null?'<td>--</td>':`<td>${showMarks?red(r.finalMark,fig(r.finalMark)):esc(cba?cbaResult(r.finalMark)?.letter:r.grade)}</td>`;
 const html=`<article class="print-page master-sheet">
 <header class="ms-head"><div class="ms-heading"><img src="/crest.jpg" alt="School crest"><div>
 <p class="ms-kicker">GOVERNMENT HIGH SCHOOL MBONJO LIMBE · LYCEE DE MBONJO LIMBE</p>
 <h2>${report.sample?'BLANK SAMPLE / MODÈLE VIERGE · ':''}MASTER RESULT SHEET / FICHE RÉCAPITULATIVE</h2>
 <p><b>${esc(cls)}</b> · ${esc(assessment)} · ${esc(year)}</p>
 <p class="ms-format">${cba?'Competence based approach (CBA)':'Sequence based approach (SBA)'} · ${showMarks?'Marks / Notes sur 20':'Letter grades / Notes en lettres'}</p></div></div>
 <table class="ms-summary"><thead><tr><th>CLASS SUMMARY</th><th>Per average</th><th>Per papers</th></tr></thead>
 <tbody>${summary.map(([k,a,b])=>`<tr><td>${esc(k)}</td><td>${countValue(a)}</td><td>${countValue(b)}</td></tr>`).join('')}
 <tr><td>Class average / Moyenne de classe</td><td colspan="2">${fig(report.classAverage)}</td></tr>
 <tr><td>Stream average / Moyenne du niveau</td><td colspan="2">${fig(report.streamAverage)}</td></tr></tbody></table></header>
 <div class="table-scroll"><table class="ms-grid"><colgroup><col style="width:3%"><col style="width:20%">${Array.from({length:subjects.length+5},()=>'<col>').join('')}</colgroup>
 <thead><tr><th class="ms-no">No.</th><th class="ms-name">Student / Élève</th>
 ${subjects.map(s=>`<th class="ms-vertical"><span>${subjectLine(s)}</span></th>`).join('')}
 <th class="ms-vertical"><span>Subjects sat / Évaluées</span></th><th class="ms-vertical"><span>Passed / Réussies</span></th>
 <th class="ms-vertical"><span>Total score / Points</span></th><th class="ms-vertical"><span>Average / Moyenne</span></th><th class="ms-vertical"><span>Position / Rang</span></th></tr></thead>
 <tbody>${sheets.map((sheet,i)=>`<tr><td>${i+1}</td><td class="ms-name">${fullName(sheet.student.data.name)}<small>${esc(sheet.student.data.matricule||'')}</small></td>
 ${subjects.map(s=>{const r=sheet.rows.find(x=>x.subject===s);return r?cell(r):'<td>--</td>';}).join('')}
 <td>${sheet.totals.subjectsSat??''}</td><td>${sheet.totals.subjectsPassed??''}</td><td>${fig(sheet.totals.total)}</td>
 <td class="ms-result">${red(sheet.totals.average,fig(sheet.totals.average))}</td><td><b>${countValue(sheet.position)}</b></td></tr>`).join('')}
 <tr class="ms-averages"><td></td><td class="ms-name">Subject average / Moyenne matière</td>${subjects.map(s=>`<td>${fig(report.subjects[s]?.average)}</td>`).join('')}<td colspan="5"></td></tr>
 <tr class="ms-averages"><td></td><td class="ms-name">Subjects passed / Admis par matière</td>${subjects.map(s=>`<td>${report.subjects[s]?.passed??'--'}</td>`).join('')}<td colspan="5"></td></tr></tbody></table></div>
 <div class="ms-footer"><p>-- = no published mark. Pass by average: ≥ 10/20. Pass by papers: at least half the assessed subjects. Rankings cover this class. The stream average covers the level.</p><p>Class master / Maître de classe: ____________________ &nbsp; Principal / Proviseur: ____________________</p></div>
 </article>`;
 return report.sample?blankPrintHTML(html):html;
}

