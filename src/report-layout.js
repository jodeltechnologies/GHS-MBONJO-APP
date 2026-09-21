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

import {competenceScale,belowPass,sequences} from './reports.js';

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
 'Food and Nutrition':'Alimentation et nutrition','Commerce':'Commerce','Logic':'Logique',
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
export function reportCardHTML(sheet,report,{year='',assessment='',cls='',teacherOf=()=>''}={}){
 const d=sheet.student.data||{},t=sheet.totals;
 const cols=report.assessments;
 const identity=[
  ['Name',d.name,'Class',cls||d.class],
  ['Date of birth',printedDate(d.birthDate),'Matricule',d.matricule],
  ['Gender',d.gender,'Enrolment',report.onRoll],
  ['Parent’s contact no.',d.phone,'Term',assessment],
  ['VP / CENSEUR','','SDM / SG','']];
 const row=r=>{
  const teacher=teacherOf(r.subject);
  return `<tr>
   <td class="rc-subject">${subjectLine(r.subject)}${teacher?`<small>${esc(String(teacher).toUpperCase())}</small>`:''}</td>
   <td>${r.finalMark===null?'--':esc(r.coefficient??'--')}</td>
   ${cols.map(a=>{const v=r.perAssessment.find(x=>x.assessment===a)?.mark;return `<td>${v===null||v===undefined?'--':red(v,fig(v))}</td>`}).join('')}
   <td>${r.finalMark===null?'--':red(r.finalMark,fig(r.finalMark))}</td>
   <td>${r.total===null?'--':red(r.finalMark,fig(r.total))}</td>
   <td>${red(r.subjectAverage,fig(r.subjectAverage))}</td>
   <td>${esc(r.grade||'--')}</td>
   <td>${r.rank??'--'}</td>
   <td>${esc(r.remark||'--')}</td></tr>`;
 };
 return `<article class="print-page report-card">
 ${reportLetterhead()}
 <h2 class="rc-title">PROGRESS REPORT CARD / BULLETIN DE NOTES</h2>
 <p class="rc-year">ACADEMIC YEAR / ANNEE SCOLAIRE: ${esc(year)}</p>
 <table class="rc-identity"><tbody>${identity.map(([a,b,c,e],i)=>
  `<tr><td>${esc(a)}: <b>${esc(b||'')}</b></td><td>${esc(c)}: <b>${esc(e||'')}</b></td>${i===0?photoCell(d.photo):''}</tr>`).join('')}</tbody></table>
 <table class="rc-marks"><thead><tr><th>Subjects</th><th>Coeff</th>${cols.map(a=>`<th>${esc(columnLabel(a))}</th>`).join('')}
  <th>Final Mark</th><th>Total</th><th>Subject Avg</th><th>Grade</th><th>Rank</th><th>Remarks</th></tr></thead>
  <tbody>${sheet.rows.map(row).join('')}
  <tr class="rc-total"><td>TOTAL</td><td>${t.coefficients||'--'}</td>${cols.map(()=>'<td></td>').join('')}<td></td><td>${fig(t.total)}</td><td colspan="4"></td></tr>
  </tbody></table>
 <div class="rc-foot">
  <div>
   <p class="rc-extremes">Highest Avg : ${fig(report.highest)} &nbsp;&nbsp; Lowest Avg : ${fig(report.lowest)}</p>
   <table class="rc-box"><tbody>
    <tr><td>Student Average</td><td>${red(t.average,fig(t.average))}</td></tr>
    <tr><td>Class average</td><td>${red(report.classAverage,fig(report.classAverage))}</td></tr>
    <tr><td>Position</td><td><b>${sheet.position??'--'}/${report.ranked}</b></td></tr>
   </tbody></table>
   <h3 class="rc-h">SDM'S REMARKS</h3>
   <table class="rc-box"><tbody>${['Absences','Warning/Avertissements','Serious Warning/Blames','Punishment/Consignes','Suspension/Exclusion Temporaire','Observation']
     .map(k=>`<tr><td>${esc(k)}</td><td></td></tr>`).join('')}</tbody></table>
  </div>
  <div>
   <h3 class="rc-h">CLASS COUNCIL'S OBSERVATIONS</h3>
   <table class="rc-box"><tbody><tr><td></td><td>ACADEMIC WARNING</td></tr><tr><td></td><td>DISCIPLINE WARNING</td></tr></tbody></table>
   <h3 class="rc-h">REFERENCE</h3>
   ${referenceTable()}
  </div>
 </div>
 <table class="rc-sign"><thead><tr><th colspan="3">NAMES / SIGNATURES</th></tr></thead>
  <tbody><tr><td>Class Master / Maître de classe</td><td>Principal / Proviseur</td><td>Parent / Tuteur</td></tr></tbody></table>
 <p class="rc-note">A dash means no mark was published, which is not a zero: blank marks are left out of the totals, the averages and the positions. Positions, class averages and subject averages are worked out inside ${esc(cls||'the class')}.</p>
</article>`;
}

// ---------------------------------------------------------------------------
// The master result sheet
// ---------------------------------------------------------------------------
// One page per class. Printed landscape, because the school's own portrait
// printout cuts the last columns off the page.
export function masterSheetHTML(report,{year='',assessment='',cls='',showMarks=false}={}){
 const subjects=report.subjectNames;
 const count=(n,of)=>`${n}`;
 const summary=[
  ['Number on roll',report.onRoll,report.onRoll],
  ['Number assessed',report.assessed,report.assessed],
  ['Number Passed',report.passedAvg,report.passedPapers],
  ['Percentage Passed',report.percentPassedAvg,report.percentPassedPapers],
  ['Number Failed',report.failedAvg,report.failedPapers],
  ['Percentage Failed',report.percentFailedAvg,report.percentFailedPapers]];
 const cell=r=>{
  if(r.finalMark===null)return '<td>--</td>';
  return `<td>${showMarks?red(r.finalMark,fig(r.finalMark)):esc(r.grade)}</td>`;
 };
 return `<article class="print-page master-sheet">
 <div class="ms-head">
  <div>
   <h2>Government High School Mbonjo Limbe</h2>
   <p>Academic Year: <b>${esc(year)}</b><br>Term / Report: <b>${esc(assessment)}</b><br>Class Year: <b>${esc(cls)}</b></p>
  </div>
  <table class="ms-summary"><thead><tr><th></th><th>Per Avg</th><th>Per Papers</th></tr></thead><tbody>
   ${summary.map(([k,a,b])=>`<tr><td>${esc(k)}</td><td>${a===null?'--':esc(a)}</td><td>${b===null?'--':esc(b)}</td></tr>`).join('')}
   <tr><td>Class Avg - ${esc(cls)}</td><td colspan="2">${fig(report.classAverage)}</td></tr>
   <tr><td>Stream Avg</td><td colspan="2">${fig(report.streamAverage)}</td></tr>
  </tbody></table>
 </div>
 <div class="table-scroll"><table class="ms-grid"><thead><tr><th class="ms-no">No.</th><th class="ms-name">Name of Student</th>
  ${subjects.map(s=>`<th class="ms-vertical"><span>${subjectLine(s)}</span></th>`).join('')}
  <th class="ms-vertical"><span>Subjects Sat</span></th><th class="ms-vertical"><span>Subjects Passed</span></th>
  <th class="ms-vertical"><span>Total</span></th><th class="ms-vertical"><span>Average</span></th><th class="ms-vertical"><span>Position</span></th></tr></thead>
 <tbody>
  ${report.sheets.map((sheet,i)=>`<tr><td>${i+1}</td><td class="ms-name">${esc(sheet.student.data.name)}</td>
   ${subjects.map(s=>{const r=sheet.rows.find(x=>x.subject===s);return r?cell(r):'<td>--</td>'}).join('')}
   <td>${sheet.totals.subjectsSat||'--'}</td><td>${sheet.totals.subjectsSat?sheet.totals.subjectsPassed:'--'}</td>
   <td>${fig(sheet.totals.total)}</td><td>${red(sheet.totals.average,fig(sheet.totals.average))}</td>
   <td>${sheet.position??'--'}</td></tr>`).join('')}
  <tr class="ms-averages"><td></td><td class="ms-name">Subject Average</td>
   ${subjects.map(s=>`<td>${red(report.subjects[s]?.average,fig(report.subjects[s]?.average))}</td>`).join('')}
   <td colspan="5"></td></tr>
 </tbody></table></div>
 <p class="rc-note">Cells show the letter grade for the final mark. A dash means no published mark, which is not a zero. Passed on average is 10 or more; passed on papers is at least half the papers that student sat. The stream average covers every class in the level.</p>
</article>`;
}
