import catalogue from './gce-papers.json' with {type:'json'};
import {departments} from './domain.js';
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const gcePapers=catalogue.papers;
export const gceSource=catalogue.source;
const states=new Map();
const PAGE_SIZE=12;
const normal=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export function filterGcePapers({department='',level='',subject='',year='',type='',search=''}={},papers=gcePapers){
 const words=normal(search).trim().split(/\s+/).filter(Boolean);
 return papers.filter(p=>(!department||p.department===department)&&(!level||p.level===level)&&(!subject||p.subject===subject)&&(!year||String(p.year)===String(year))&&(!type||p.type===type)&&words.every(w=>normal([p.title,p.subject,p.department,p.level,p.year,p.type==='mock'?'mock exam examen blanc':'GCE'].join(' ')).includes(w))).sort((a,b)=>b.year-a.year||a.department.localeCompare(b.department)||a.subject.localeCompare(b.subject)||a.title.localeCompare(b.title));
}
export function gcePage(items,page=1){const pages=Math.max(1,Math.ceil(items.length/PAGE_SIZE));page=Math.min(pages,Math.max(1,Number(page)||1));return {items:items.slice((page-1)*PAGE_SIZE,page*PAGE_SIZE),page,pages,total:items.length};}
const option=(value,label,current)=>`<option value="${escape(value)}"${String(value)===String(current)?' selected':''}>${escape(label)}</option>`;
function scoped(state){return filterGcePapers({department:state.fixedDepartment||state.department,level:state.level});}
function results(state){
 const t=(en,fr)=>state.lang==='fr'?fr:en;
 const all=filterGcePapers({...state,department:state.fixedDepartment||state.department});
 const page=gcePage(all,state.page);state.page=page.page;
 const department=state.fixedDepartment||state.department;
 const total=gcePapers.filter(p=>!department||p.department===department).length;
 const empty=!total?t('No GCE papers for this department were found in the checked MINESEC collection.','Aucun sujet du GCE pour ce département n’a été trouvé dans la collection du MINESEC consultée.'):t('No papers match these filters. Try another class, year or subject.','Aucun sujet ne correspond aux filtres. Essayez une autre classe, année ou matière.');
 return `<p class="gce-result-count" role="status" aria-live="polite">${page.total} ${t('papers','sujets')}${page.total?` · ${t('Page','Page')} ${page.page} / ${page.pages}`:''}</p>${page.total?`<div class="gce-paper-grid">${page.items.map(p=>`<article class="gce-paper"><div class="gce-paper-meta"><span class="badge">${escape(p.level)}</span><span class="badge ${p.type==='mock'?'gce-mock':'published'}">${p.type==='mock'?t('Mock exam','Examen blanc'):t('GCE paper','Sujet du GCE')}</span></div><p class="gce-subject">${escape(p.department)} · ${escape(p.subject)}</p><h3>${escape(p.title)}</h3><p class="muted">${p.year} · ${p.level==='Form 5'?'Ordinary Level':'Advanced Level'}</p><div class="actions"><a class="primary" href="${escape(p.pdfUrl||p.url)}" target="_blank" rel="noopener noreferrer">${p.pdfUrl?t('Open PDF ↗','Ouvrir le PDF ↗'):t('View paper ↗','Voir le sujet ↗')}</a>${p.pdfUrl?`<a class="text-link" href="${escape(p.url)}" target="_blank" rel="noopener noreferrer">${t('Source','Source')}</a>`:''}</div></article>`).join('')}</div>`:`<div class="empty"><p>${empty}</p>${state.fixedDepartment?`<a class="secondary" href="/revision">${t('Browse other departments','Consulter les autres départements')}</a>`:''}</div>`}${page.pages>1?`<nav class="gce-pagination" aria-label="${t('Past paper pages','Pages des anciens sujets')}"><button type="button" class="secondary" data-gce-page="${page.page-1}"${page.page===1?' disabled':''}>${t('Previous','Précédent')}</button><span>${page.page} / ${page.pages}</span><button type="button" class="secondary" data-gce-page="${page.page+1}"${page.page===page.pages?' disabled':''}>${t('Next','Suivant')}</button></nav>`:''}`;
}
function filterOptions(state,field){
 const t=(en,fr)=>state.lang==='fr'?fr:en;
 const values=[...new Set(scoped(state).map(p=>p[field]))].sort(field==='year'?(a,b)=>b-a:(a,b)=>a.localeCompare(b));
 return option('',field==='year'?t('All years','Toutes les années'):t('All subjects','Toutes les matières'),state[field])+values.map(v=>option(v,v,state[field])).join('');
}
export function renderGceLibrary({department='',lang='en',level=''}={}){
 const key=department||'all';let state=states.get(key);
 if(!state){state={fixedDepartment:department,department:'',level,subject:'',year:'',type:'',search:'',page:1};states.set(key,state);}state.lang=lang;
 const t=(en,fr)=>lang==='fr'?fr:en;
 return `<section class="gce-library panel" data-gce-library="${escape(key)}" aria-label="${t('GCE past questions','Anciens sujets du GCE')}"><div class="gce-library-heading"><div><p class="eyebrow">MINESEC · GCE</p><h2>${t('GCE past questions','Anciens sujets du GCE')}</h2></div><a class="text-link" href="${escape(gceSource)}" target="_blank" rel="noopener noreferrer">${t('MINESEC collection ↗','Collection du MINESEC ↗')}</a></div><p class="muted">${t('Form 5 and Upper Sixth. Choose your subject and year. GCE papers and mock exams are labelled separately. Papers open on the MINESEC website.','Form 5 et Upper Sixth. Choisissez votre matière et votre année. Les sujets du GCE et les examens blancs sont identifiés séparément. Les sujets s’ouvrent sur le site du MINESEC.')}</p><div class="gce-filters">${department?'':`<label>${t('Department','Département')}<select data-gce-filter="department">${option('',t('All departments','Tous les départements'),state.department)}${departments.map(d=>option(d,d,state.department)).join('')}</select></label>`}<label>${t('Class','Classe')}<select data-gce-filter="level">${option('',t('Both levels','Les deux niveaux'),state.level)}${option('Form 5','Form 5 · Ordinary Level',state.level)}${option('Upper Sixth','Upper Sixth · Advanced Level',state.level)}</select></label><label>${t('Subject','Matière')}<select data-gce-filter="subject">${filterOptions(state,'subject')}</select></label><label>${t('Year','Année')}<select data-gce-filter="year">${filterOptions(state,'year')}</select></label><label>${t('Exam type','Type d’examen')}<select data-gce-filter="type">${option('',t('All papers','Tous les sujets'),state.type)}${option('gce',t('GCE papers','Sujets du GCE'),state.type)}${option('mock',t('Mock exams','Examens blancs'),state.type)}</select></label><label class="gce-search">${t('Search papers','Rechercher un sujet')}<input type="search" data-gce-filter="search" value="${escape(state.search)}" placeholder="${t('Subject, paper number or year','Matière, numéro du sujet ou année')}"></label></div><button class="text-button" type="button" data-gce-reset>${t('Clear filters','Effacer les filtres')}</button><div data-gce-results>${results(state)}</div><p class="small muted">${t('Collection checked','Collection consultée')} ${catalogue.checkedOn}. ${t('Internet access is needed to open the original papers.','Une connexion Internet est nécessaire pour ouvrir les sujets originaux.')}</p></section>`;
}
function update(root,resetOptions=false){
 const state=states.get(root.dataset.gceLibrary);if(!state)return;
 if(resetOptions)for(const field of ['subject','year']){const select=root.querySelector(`[data-gce-filter="${field}"]`);select.innerHTML=filterOptions(state,field);}
 root.querySelector('[data-gce-results]').innerHTML=results(state);
}
export function bindGceLibrary(document){
 const change=e=>{const input=e.target.closest('[data-gce-filter]'),root=input?.closest('[data-gce-library]');if(!root)return;
 if(e.type==='input'&&input.dataset.gceFilter!=='search'||e.type==='change'&&input.dataset.gceFilter==='search')return;
 const state=states.get(root.dataset.gceLibrary),field=input.dataset.gceFilter;state[field]=input.value;state.page=1;
 const rescope=['department','level'].includes(field);if(rescope){state.subject='';state.year='';}update(root,rescope);
 };
 document.addEventListener('input',change);document.addEventListener('change',change);
 document.addEventListener('click',e=>{const button=e.target.closest('[data-gce-page],[data-gce-reset]'),root=button?.closest('[data-gce-library]');if(!root)return;
 const state=states.get(root.dataset.gceLibrary);
 if(button.hasAttribute('data-gce-reset')){Object.assign(state,{department:'',level:'',subject:'',year:'',type:'',search:'',page:1});root.querySelectorAll('[data-gce-filter]').forEach(input=>input.value='');update(root,true);}
 else{state.page=+button.dataset.gcePage;update(root);root.querySelector('[data-gce-results]').scrollIntoView({block:'start',behavior:'smooth'});root.querySelector('[data-gce-page]:not(:disabled)')?.focus({preventScroll:true});}
 });
}
