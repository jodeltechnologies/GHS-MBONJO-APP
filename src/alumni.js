const escape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const searchable=value=>String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase();

export function alumniRoster(records,{year='',cls='',query=''}={}){
 return records.filter(r=>r.kind==='student'&&!r.data.deleted&&['graduated','completed'].includes(r.data.status)).map(r=>{
  const d=r.data,completed=Object.entries(d.enrolments||{}).filter(([,e])=>['completed','graduated'].includes(e.status)).map(([y])=>y).sort().at(-1);
  const exitYear=d.exitYear||completed||d.academicYear||d.sourceYear?.replace('-','/')||'';
  return {...r,data:{...d,exitYear,formerClass:d.enrolments?.[exitYear]?.class||d.class||''}};
 }).filter(r=>(!year||r.data.exitYear===year)&&(!cls||r.data.formerClass===cls)&&(!query||searchable(r.data.name+' '+r.data.matricule).includes(searchable(query)))).sort((a,b)=>b.data.exitYear.localeCompare(a.data.exitYear)||String(a.data.name).localeCompare(String(b.data.name)));
}

export function renderAlumniPanel(records,{year='',cls='',lang='en'}={}){
 const t=(en,fr)=>lang==='fr'?fr:en,all=alumniRoster(records),roll=alumniRoster(records,{year,cls});
 const options=(values,selected)=>values.map(v=>`<option value="${escape(v)}" ${v===selected?'selected':''}>${escape(v)}</option>`).join('');
 const headings=[t('Name','Nom'),t('Matricule','Matricule'),t('Former class','Ancienne classe'),t('Exit academic year','Année de sortie'),t('Exit date','Date de sortie')];
 return `<section class="panel" data-alumni-panel><h2>${t('Alumni','Anciens élèves')}</h2><p>${t('Students who completed school. Earlier class records are preserved.','Élèves ayant terminé leur scolarité. Les anciens dossiers de classe sont conservés.')}</p><div class="form-grid"><label>${t('Exit academic year','Année de sortie')}<select data-alumni-year><option value="">${t('All years','Toutes les années')}</option>${options([...new Set(all.map(r=>r.data.exitYear).filter(Boolean))].sort().reverse(),year)}</select></label><label>${t('Former class','Ancienne classe')}<select data-alumni-class><option value="">${t('All classes','Toutes les classes')}</option>${options([...new Set(all.map(r=>r.data.formerClass).filter(Boolean))].sort(),cls)}</select></label><label>${t('Find by name or matricule','Rechercher par nom ou matricule')}<input type="search" data-alumni-search></label></div><p data-alumni-count role="status">${roll.length} ${t('alumni','anciens élèves')}</p><div class="table-scroll record-list"><table><thead><tr>${headings.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${roll.map(r=>`<tr data-alumni-row data-search="${escape(searchable(r.data.name+' '+r.data.matricule))}">${[r.data.name,r.data.matricule,r.data.formerClass,r.data.exitYear,r.data.exitDate].map((v,i)=>`<td data-label="${headings[i]}">${escape(v||'—')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>${!roll.length?`<p>${t('No alumni match these filters.','Aucun ancien élève ne correspond à ces filtres.')}</p>`:''}</section>`;
}

export function filterAlumniPanel(panel,query,{lang='en'}={}){
 let count=0;const text=searchable(query);
 for(const row of panel.querySelectorAll('[data-alumni-row]')){row.hidden=!row.dataset.search.includes(text);if(!row.hidden)count++;}
 panel.querySelector('[data-alumni-count]').textContent=`${count} ${lang==='fr'?'anciens élèves':'alumni'}`;
}
