import {renderHomepage} from './homepage.js';
import {progressionLinks} from './progression-links.js';
import {departmentGuides,curriculumSources} from './department-guides.js';
import {attendanceGrid} from './attendance-grid.js';
import {attendanceOverview} from './analytics.js';
import {primaryTasks,taskGuides} from './portal-guide.js';
import {markEntryAllowed,yearChoices} from './school-controls.js';
import {canProvision} from './accounts.js';
import {subjectCatalogue,availableSubjects,recommendSubjects,academicYear,availableAcademicYears,studentsInYear,classStream,classRoster,assignmentsInYear,competency} from './academics.js';
import {barChart,columnChart,lineChart,statTile,figureTable,shorten} from './charts.js';
import {documentLibrary,categoryLabels,canTransmit,inventorySummary,coverage,coveragePrompt,lessonKey,termOfWeek,weekInHand,parseProgressionRows,TERMS} from './department.js';
import {calendar,schoolWeek,currentWeek,weekRange,knownYear,defaultYear} from './calendar.js';
import {lessonsFromPages,sheetHeading,describeImport} from './progression-pdf.js';
import {providers} from './providers.js';
import {requestTypes,officialTypes,requestingStaff,requestState} from './document-requests.js';
import {documentTitles,documentLines,letterheadEN,letterheadFR,displayDate} from './document-layout.js';
import {reportCardHTML,masterSheetHTML} from './report-layout.js';
import {sequences} from './reports.js';
import {departmentCopy,principalMessage,calendarSeed} from './school-content.js';
import {postCatalogue,postOptions,whatsappLink} from './posts.js';
import {exportModel,loadExportAssets,makeDocx,makePdf,downloadBlob} from './exports.js';
import {encryptBackup} from './backup.js';
import QRCode from 'qrcode';
import {classes as baseClasses,levels,levelOf,classesInLevel,departments,roles,normalizeMatricule,promotionEligible,time,clockTime,attestationText,studies,documentCategories,itemCategories,itemConditions,timetablePeriods,timetableBreak,timetableDays,timetableRow,timetableFor,subjectCode,defaultPreferences,normalizePreferences,teacherWeekCost} from './domain.js';
import archive from './archive.json';
const $=s=>document.querySelector(s),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let classes=[...baseClasses];
let lang=localStorage.getItem('school-language')||'en',profile=null,rows=[],publicRows=[],calendarOverrides=[],tab='overview',filter='',busy=false;
const t=(en,fr)=>lang==='fr'?fr:en;
const today=()=>new Date().toLocaleDateString('en-CA',{timeZone:'Africa/Douala'});
const list=kind=>rows.filter(r=>r.kind===kind);
const byId=id=>rows.find(r=>r.id===id);
const name=id=>byId(id)?.data.name||id||'—';
function toast(s){$('#toast').textContent=s;$('#toast').classList.add('show');setTimeout(()=>$('#toast').classList.remove('show'),6000);}
async function api(op,data={}){const r=await fetch('/api/school',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({op,...data})});let a;try{a=await r.json();}catch{throw Error(t('The portal is not connected yet. Please contact the school.','Le portail n’est pas encore connecté. Veuillez contacter le lycée.'));}if(!r.ok)throw Error(a.error);return a;}
async function refresh(){const s=await api('state');profile=s.profile;rows=s.rows;if(s.controls){controls=s.controls;portalYear=controls.activeYear;studentYear=portalYear;marksYear=portalYear;anYear=portalYear;}classes=[...new Set([...baseClasses,...list('classroom').map(r=>r.data.name)])];if(!profile.passwordChangeRequired&&tab==='marks'&&['principal','vp','teacher','hod'].includes(profile.role)){const m=await api('marks',{year:marksYear,class:marksClass});rows=rows.filter(r=>r.kind!=='mark').concat(m.rows);}render();}
function options(values,value){return values.map(v=>{const [id,label]=Array.isArray(v)?v:[v,v];return `<option value="${esc(id)}" ${String(id)===String(value)?'selected':''}>${esc(label)}</option>`}).join('');}
const button=(label,action,cls='primary',attrs='')=>`<button type="button" class="${cls}" data-action="${action}" ${attrs}>${label}</button>`;
const routeName=()=>globalThis.SCHOOL_PREVIEW?(location.hash.slice(1)||'home'):location.hash&&location.hash!=='#main'?location.hash.slice(1):location.pathname.replace(/^\/+|\/+$/g,'')||'home';
const navigate=path=>{if(globalThis.SCHOOL_PREVIEW){location.hash=path;render();return;}history.pushState({},'',path==='home'?'/':'/'+path);render();window.scrollTo(0,0);};
let importConflicts=[];
let controls={activeYear:'2025/2026',markWindows:{},version:null};
let portalYear='2025/2026';
let studentYear=portalYear,studentStream='';
let studentClass='',studentSelection='',marksYear=portalYear,marksClass='';
let ttClass='',ttTeacher='';
// Analytics is fetched on demand — the range can cover a whole year, far more
// attendance than the dashboard's own 30-day window.
const monthsAgo=n=>{const d=new Date();d.setUTCMonth(d.getUTCMonth()-n);return d.toISOString().slice(0,10);};
let anFrom=monthsAgo(3),anTo=new Date().toISOString().slice(0,10),anClass='',anSubject='',anSummaryOnly=false,anYear=portalYear,anReport=null,anScope='',anBusy=false,anError='';
const link=(label,path,cls='')=>`<a class="${cls}" href="/${path==='home'?'':path}">${label}</a>`;
function heading(kicker,title,copy=''){return `<div class="section-heading"><p class="eyebrow">${kicker}</p><h1>${title}</h1>${copy?`<p class="muted">${copy}</p>`:''}</div>`;}
const empty=(msg)=>`<div class="empty"><span aria-hidden="true">◇</span><p>${msg}</p></div>`;
const badge=status=>`<span class="badge ${esc(status)}">${esc(status)}</span>`;
function header(){const route=routeName();return `<div class="topline"><span>${t('Government Secondary Education · Limbe III, Cameroon','Enseignement secondaire public · Limbé III, Cameroun')}</span><button data-action="language" aria-label="Change language">${lang==='en'?'FR / Français':'EN / English'}</button></div><header><a class="brand" href="/"><img src="/crest.jpg" alt="GHS Mbonjo Limbe crest"><span>GHS MBONJO<span>LIMBE · ${t('A place to be','Un lieu où il fait bon vivre')}</span></span></a><button class="menu-toggle secondary" data-action="menu" aria-label="Open navigation" aria-expanded="false">☰</button><nav id="nav" aria-label="Main navigation">${[['home',t('Home','Accueil')],['about',t('Our school','Notre lycée')],['departments',t('Academics','Enseignement')],['news',t('News & events','Actualités')],['gallery',t('Gallery','Galerie')],['contact',t('Contact','Contact')]].map(([r,n])=>link(n,r,route===r?'active':'')).join('')}${link(t('School portal','Portail scolaire'),profile?'portal':'login','nav-portal')}</nav></header>`;}
function footer(){return `<footer><div><a class="brand light" href="/"><img src="/crest.jpg" alt="School crest"><span>GHS MBONJO LIMBE<span>Discipline, Hardwork & Success</span></span></a><p>${t('Growing in knowledge. Grounded in values.','Grandir par le savoir. Guidés par nos valeurs.')}</p></div><div><strong>${t('Explore','Découvrir')}</strong>${link(t('Our school','Notre lycée'),'about')}${link(t('Departments','Départements'),'departments')}${link(t('Admissions','Admissions'),'admissions')}</div><div><strong>${t('School services','Services scolaires')}</strong>${link(t('School portal','Portail scolaire'),'login')}${link(t('Verify a document','Vérifier un document'),'verify')}${link(t('Textbooks','Manuels scolaires'),'textbooks')}</div><div><strong>${t('Visit us','Nous rendre visite')}</strong><p>Bimbia, Limbe III<br>Fako · South West Region<br>Cameroon</p></div><small>© ${new Date().getFullYear()} Government High School Mbonjo Limbe</small></footer>`;}
const published=kind=>{const actual=publicRows.filter(r=>r.kind===kind);return kind==='event'?[...actual,...calendarSeed.filter(r=>r.data.status==='published'&&!calendarOverrides.includes(r.data.sourceId)&&!actual.some(a=>a.data.sourceId===r.data.sourceId||a.data.title===r.data.title&&a.data.date===r.data.date))]:actual;};
function eventCards(limit=Infinity){const upcoming=published('event').filter(r=>(r.data.endDate||r.data.date)>=today()).sort((a,b)=>a.data.date.localeCompare(b.data.date)).slice(0,limit);return upcoming.length?`<div class="event-list">${upcoming.map(r=>`<article><div class="date-tile"><b>${new Date(r.data.date+'T12:00:00').getDate()}</b><span>${new Date(r.data.date+'T12:00:00').toLocaleDateString(lang,{month:'short'})}</span></div><div><span class="eyebrow">${esc(r.data.category||t('School calendar','Calendrier scolaire'))}</span><h3>${esc(localized(r.data,'title'))}</h3><p>${r.data.endDate?esc(r.data.date+' → '+r.data.endDate)+' · ':''}${esc(r.data.time||'')} ${esc(r.data.location||'GHS Mbonjo Limbe')}</p></div>${button(t('Details','Détails'),'public-detail','text-button',`data-id="${r.id}"`)}</article>`).join('')}</div>`:empty(t('No upcoming activities have been published yet.','Aucune activité à venir n’a encore été publiée.'));}
function localized(d,k){return lang==='fr'&&d[k+'Fr']?d[k+'Fr']:d[k];}
function home(){return renderHomepage({lang,departmentCount:departments.length,principalMessage:principalMessage[lang]||principalMessage.en,news:homeNewsCards(),events:eventCards(3)});}
function homeNewsCards(){const entries=published('post').map(r=>({...r.data,id:r.id}));if(entries.length<3)entries.push(...archive.slice(0,3-entries.length).map(r=>({...r,category:t('School archive','Archives du lycée'),date:''})));return entries.slice(0,3).map((r,i)=>`<article class="news-card"><div class="article-number"><span>${esc(r.category||t('School news','Actualités du lycée'))}</span><b aria-hidden="true">${String(i+1).padStart(2,'0')}</b></div><div>${r.date?`<small>${esc(r.date)}</small>`:''}<h3>${esc(localized(r,'title'))}</h3>${button(t('Read story →','Lire l’article →'),'public-detail','text-button',`data-id="${esc(r.id)}"`)}</div></article>`).join('')||empty(t('School news will appear here once published.','Les actualités paraîtront ici après publication.'));}
function principalWelcome(){const paragraphs=principalMessage[lang]||principalMessage.en;return `<section class="section principal-message"><p class="eyebrow">${t('FROM THE PRINCIPAL','LE MOT DU PROVISEUR')}</p><h2>${t('Welcome to GHS Mbonjo Limbe','Bienvenue au Lycée de Mbonjo Limbé')}</h2><p class="principal-opening">${esc(paragraphs[0])}</p><details><summary>${t('Read the principal’s full message','Lire le message complet du proviseur')}</summary>${paragraphs.slice(1).map(p=>`<p>${esc(p)}</p>`).join('')}</details><p><strong>DAVID MOKI NDIVE</strong><br>${t('Principal, GHS Mbonjo Limbe','Proviseur, Lycée de Mbonjo Limbé')}</p></section>`;}
function newsCards(limit=100,category=''){let a=published('post').filter(r=>!category||r.data.category===category).map(r=>({...r.data,id:r.id}));if(!category)a.push(...archive.slice(0,3).map((r,i)=>({...r,date:['2026-01-14','2025-12-03','2025-08-19'][i],category:t('School archive','Archives du lycée')})));return a.slice(0,limit).map((r,i)=>`<article class="news-card"><div class="article-number">${String(i+1).padStart(2,'0')}<span>${esc(r.category)}</span></div><div><small>${esc(r.date||'')}</small><h3>${esc(localized(r,'title'))}</h3>${button(t('Read story →','Lire l’article →'),'public-detail','text-button',`data-id="${esc(r.id)}"`)}</div></article>`).join('')||empty(t('No published entries yet.','Aucune publication pour le moment.'));}
function about(){return `${heading(t('OUR SCHOOL','NOTRE LYCÉE'),t('A legacy of learning since 1975.','Une tradition d’apprentissage depuis 1975.'))}<div class="split section"><img class="rounded" src="/campus.jpg" alt="GHS Mbonjo school grounds"><div><h2>${t('Our story','Notre histoire')}</h2><p>${t('Government High School Mbonjo Limbe was established on 3 November 1975, welcoming 103 students: 65 boys and 38 girls. The school began in the former Public Works Department packing stores at Down Beach–Mbonjo.','Le Lycée de Mbonjo Limbé a été créé le 3 novembre 1975 avec 103 élèves : 65 garçons et 38 filles. Il a commencé dans les anciens entrepôts des Travaux publics à Down Beach–Mbonjo.')}</p><p>${t('Following persistent flooding at its original location, the school relocated to Bimbia, within Limbe III, Fako Division, South West Region.','À la suite d’inondations persistantes sur son site d’origine, le lycée a été transféré à Bimbia, dans l’arrondissement de Limbé III, département du Fako, région du Sud-Ouest.')}</p></div></div><div class="section cards two"><article><p class="eyebrow">${t('OUR MISSION','NOTRE MISSION')}</p><h3>${t('Educating the whole person','Former la personne dans sa globalité')}</h3><p>${t('To provide holistic education that promotes academic excellence, discipline and moral integrity, preparing students for responsible citizenship and global competitiveness.','Offrir une éducation complète favorisant l’excellence scolaire, la discipline et l’intégrité morale, pour préparer les élèves à une citoyenneté responsable.')}</p></article><article><p class="eyebrow">${t('OUR VISION','NOTRE VISION')}</p><h3>${t('Opportunity through education','Des possibilités grâce à l’éducation')}</h3><p>${t('To be a leading institution in the South West Region, recognized for quality teaching, innovative programmes and a nurturing learning environment.','Être un établissement de référence dans la région du Sud-Ouest, reconnu pour la qualité de son enseignement, ses programmes innovants et un cadre propice à l’épanouissement.')}</p></article></div>`;}
function publicPage(route){
 if(route==='home')return home();if(route==='about')return about();
 if(route==='departments')return `${heading(t('ACADEMICS','ENSEIGNEMENT'),t('Find your field of discovery.','Trouvez votre domaine de découverte.'),t('Forms 1–5 · Lower Sixth & Upper Sixth · Arts and Science','Forms 1–5 · Lower Sixth et Upper Sixth · Arts et Sciences'))}<div class="section department-grid">${departments.map((d,i)=>`<a href="/department/${encodeURIComponent(d)}"><span>${String(i+1).padStart(2,'0')}</span><h3>${esc(d)}</h3><b>↗</b></a>`).join('')}</div>`;
 if(route.startsWith('department/')){const d=decodeURIComponent(route.split('/')[1]);return `${heading(t('DEPARTMENT','DÉPARTEMENT'),esc(d))}<section class="section"><div class="department-intro">${(departmentCopy[d]?.[lang]||departmentCopy[d]?.en||[]).map(p=>`<p>${esc(p)}</p>`).join('')}</div>${departmentLearningGuide(d)}${officialProgressionLinks(d)}<h2>${t('Department gallery','Galerie du département')}</h2>${gallery(d)}<h2>${t('Learning resources','Ressources pédagogiques')}</h2><p>${t('Students can sign in to access approved notes, quizzes and assignments for their class.','Les élèves peuvent se connecter pour consulter les notes, quiz et devoirs approuvés pour leur classe.')}</p>${link(t('Student login','Connexion élève'),'login','primary')}</section>`;}
 if(route==='news'||route==='visits')return `${heading(t('OUR COMMUNITY','NOTRE COMMUNAUTÉ'),route==='visits'?t('Official visits','Visites officielles'):t('News & school life','Actualités et vie scolaire'))}<div class="section"><div class="actions">${link(t('Calendar','Calendrier'),'calendar','secondary')}${link(t('Official visits','Visites officielles'),'visits','secondary')}</div><div class="news-grid">${newsCards(100,route==='visits'?'Official visits':'')}</div><h2>${t('From the archives','Les archives')}</h2><div class="archive-list">${archive.filter(r=>route!=='visits'||['archive-8','archive-12'].includes(r.id)).map(r=>`<button data-action="public-detail" data-id="${r.id}">${esc(r.title)} <span>↗</span></button>`).join('')}</div></div>`;
 if(route==='calendar')return `${heading(t('SCHOOL LIFE','VIE SCOLAIRE'),t('Calendar of activities','Calendrier des activités'))}<section class="section">${eventCards()}<h2>${t('Past activities','Activités passées')}</h2>${published('event').filter(r=>r.data.date<today()).map(r=>`<p>${esc(r.data.date)} · ${esc(localized(r.data,'title'))}</p>`).join('')||empty(t('No past activities published.','Aucune activité passée publiée.'))}</section>`;
 if(route==='gallery')return `${heading(t('IN PICTURES','EN IMAGES'),t('Life at GHS Mbonjo','La vie au Lycée de Mbonjo'))}<section class="section"><label>${t('Department','Département')}<select id="gallery-filter"><option value="">${t('All departments','Tous les départements')}</option>${options(departments,filter)}</select></label>${gallery(filter)}</section>`;
 if(route==='textbooks')return `${heading(t('ACADEMICS','ENSEIGNEMENT'),t('Approved textbook list','Liste des manuels approuvés'))}<section class="section">${published('textbook').length?table(published('textbook'),['title','class','subject','author','edition'],false):empty(t('The school has not published its textbook list yet.','Le lycée n’a pas encore publié sa liste de manuels.'))}</section>`;
 if(route==='admissions')return `${heading(t('JOIN OUR COMMUNITY','REJOINDRE NOTRE COMMUNAUTÉ'),t('Admissions','Admissions'))}<section class="section narrow"><p>${t('Please contact the school office for current interview dates, places and admission requirements. Historical notices in our news archive refer to their stated academic years.','Veuillez contacter le secrétariat pour les dates d’entretien, les places disponibles et les conditions d’admission en vigueur. Les anciennes annonces concernent les années scolaires indiquées.')}</p><h2>${t('Prepare your information','Préparez vos informations')}</h2><p>${t('Have the student’s birth certificate, previous report card and a passport photograph ready. Confirm the full current list with the school before submission.','Préparez l’acte de naissance de l’élève, son dernier bulletin et une photo d’identité. Confirmez la liste complète auprès du lycée avant le dépôt.')}</p>${link(t('Contact the school','Contacter le lycée'),'contact','primary')}</section>`;
 if(route==='contact')return `${heading(t('LET’S CONNECT','CONTACTEZ-NOUS'),t('We look forward to welcoming you.','Nous serons heureux de vous accueillir.'))}<section class="section split"><div><h2>GHS Mbonjo Limbe</h2><p>Bimbia · Limbe III<br>Fako Division · South West Region<br>Cameroon</p><p>+237 677 832 194<br><a href="mailto:limbeghsmbonjo@gmail.com">limbeghsmbonjo@gmail.com</a></p><a class="primary" href="https://www.google.com/maps/search/?api=1&query=GHS+Mbonjo+Limbe+Cameroon" target="_blank" rel="noopener">${t('Find the school','Localiser le lycée')}</a></div><img class="rounded" src="/campus.jpg" alt="GHS Mbonjo Limbe campus"></section>`;
 if(route.startsWith('verify'))return `${heading(t('SCHOOL RECORDS','DOCUMENTS SCOLAIRES'),t('Verify a document','Vérifier un document'))}<section class="section narrow"><form id="verify-form"><label>${t('Verification code from the QR link','Code de vérification du lien QR')}<input name="token" required value="${esc(route.split('/')[1]||'')}" autocomplete="off"></label><button class="primary">${t('Verify document','Vérifier le document')}</button></form><div id="verification"></div></section>`;
 if(route==='login')return login();return home();
}
function gallery(dept=''){const a=published('gallery').filter(r=>!dept||r.data.department===dept);return `<div class="gallery-grid">${!dept?`<figure><img src="/campus.jpg" alt="School campus"><figcaption>${t('Our campus · Bimbia','Notre campus · Bimbia')}</figcaption></figure>`:''}${a.map(r=>`<figure><img src="${safeImage(r.data.image)}" alt="${esc(r.data.title)}" loading="lazy"><figcaption>${esc(r.data.department)} · ${esc(localized(r.data,'title'))}</figcaption></figure>`).join('')}</div>${dept&&!a.length?empty(t('No photographs have been published for this department yet.','Aucune photographie publiée pour ce département.')):''}`;}
function safeImage(v){return /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(v||'')?v:'/crest.jpg';}
function login(){return `<section class="login-wrap"><div class="login-intro"><img src="/crest.jpg" alt="School crest"><p class="eyebrow gold">GHS MBONJO LIMBE</p><h1>${t('Welcome back<br>to your school.','Bienvenue dans<br>votre lycée.')}</h1><p>${t('A shared space for learning, teaching and supporting every student.','Un espace partagé pour apprendre, enseigner et accompagner chaque élève.')}</p></div><div class="login-card"><h2>${t('School portal','Portail scolaire')}</h2><p class="muted">${t('Choose your sign-in method.','Choisissez votre méthode de connexion.')}</p><form id="login-form"><label>${t('I am signing in as','Je me connecte en tant que')}<select name="mode" id="login-mode">${options([['staff',t('Email / username and password','E-mail / identifiant et mot de passe')],['student',t('Student without a password account','Élève sans compte avec mot de passe')]])}</select></label><div id="staff-fields"><label>${t('Email or assigned username','E-mail ou identifiant attribué')}<input type="text" name="email" autocomplete="username" required></label><label>${t('Password','Mot de passe')}<input type="password" name="password" autocomplete="current-password" required></label></div><div id="student-fields" hidden><label>${t('Your matricule','Votre matricule')}<input name="matricule" autocomplete="username"></label><label>${t('Your date of birth','Votre date de naissance')}<input type="date" name="birthDate" autocomplete="bday"></label><small class="muted">${t('Both are needed. They must match your school record. Contact the administration if your date of birth is wrong.','Les deux sont nécessaires et doivent correspondre à votre dossier scolaire. Contactez l’administration si votre date de naissance est incorrecte.')}</small></div><button class="primary full">${t('Sign in securely','Se connecter')}</button><p id="login-error" class="error" role="alert"></p></form><p class="muted small">${t('Need help with your account? Contact the school administration.','Besoin d’aide ? Contactez l’administration du lycée.')}</p>${link(t('← Back to school website','← Retour au site du lycée'),'home','text-link')}</div></section>`;}
const tabs={overview:'Overview',profile:'My profile',academics:'Classes & subjects',students:'Students',staff:'Staff & roles',assignments:'Teaching assignments',attendance:'Attendance',analytics:'Analytics',department:'My department',messages:'Messages',resources:'Learning centre',marks:'Marks & report cards',requests:'Document requests',documents:'School documents',timetable:'Timetable',publishing:'Website publishing',ai:'AI writing assistant',settings:'AI settings',audit:'Activity log',backup:'PC backup'};
const frTabs={overview:'Vue d’ensemble',profile:'Mon profil',academics:'Classes et matières',students:'Élèves',staff:'Personnel et rôles',assignments:'Affectations',attendance:'Assiduité',analytics:'Analyses',department:'Mon département',messages:'Messages',resources:'Centre pédagogique',marks:'Évaluations et bulletins',requests:'Demandes de documents',documents:'Documents scolaires',timetable:'Emploi du temps',publishing:'Publications',ai:'Assistant de rédaction IA',settings:'Paramètres IA',audit:'Journal d’activité',backup:'Sauvegarde PC'};
function allowedTabs(){const r=profile.role;return Object.keys(tabs).filter(k=>({overview:true,academics:['principal','vp'].includes(r),profile:r!=='student'||!!profile.authId,students:['principal','vp','discipline','teacher','hod'].includes(r),staff:r==='principal',assignments:['principal','vp','teacher','hod'].includes(r),attendance:r!=='content_creator',analytics:attendanceOverview(profile)||['teacher','hod'].includes(r),department:!['student','parent'].includes(r)&&(!!profile.department||r==='principal'||r==='vp'),messages:!['student','parent'].includes(r),resources:['principal','vp','teacher','hod','student'].includes(r),requests:r==='principal'||requestingStaff(profile),marks:['principal','vp','teacher','hod','student','parent'].includes(r),documents:['principal','teacher','hod','vp','discipline','staff'].includes(r),timetable:true,publishing:['principal','vp','content_creator'].includes(r)||profile.contentCreator===true,ai:['principal','vp','hod'].includes(r),settings:r==='principal',audit:r==='principal',backup:r==='principal'}[k]));}
function portal(){if(!profile)return login();if(profile.passwordChangeRequired)return `<section class="panel narrow"><h1>${t('Change your temporary password','Changez votre mot de passe temporaire')}</h1><p>Welcome, ${esc(profile.name)}. Set your own password before accessing school records.</p><form id="password-form"><label>${t('New password','Nouveau mot de passe')}<input type="password" name="password" autocomplete="new-password" minlength="12" required></label><label>${t('Confirm password','Confirmer le mot de passe')}<input type="password" name="confirm" autocomplete="new-password" minlength="12" required></label><button class="primary">${t('Change password and sign out','Changer le mot de passe et se déconnecter')}</button></form>${button('Sign out','logout','secondary')}</section>`;const wanted=new URLSearchParams(location.search).get('tab');if(wanted&&allowedTabs().includes(wanted))tab=wanted;if(!allowedTabs().includes(tab))tab='overview';return `<div class="portal"><aside><div class="portal-identity">${profileAvatar(profile)}<strong>${esc(profile.name)}</strong>${badge(postCatalogue.find(x=>x.id===(profile.post||profile.role))?.en||profile.role)}</div><nav aria-label="Portal navigation">${portalNavigation()}</nav>${button(t('Sign out','Déconnexion'),'logout','secondary')}</aside><section class="workspace"><div class="workspace-header"><div><p class="eyebrow">GHS MBONJO · ${esc(profile.role.replace('_',' '))}</p><h1>${lang==='fr'?frTabs[tab]:tabs[tab]}</h1></div>${button(t('Refresh','Actualiser'),'refresh','secondary')}</div>${schoolStatus()}<div class="actions">${button(t('Email and phone notifications','Notifications par e-mail et téléphone'),'notifications','secondary')}</div><label class="portal-jump">${t('Go to','Aller à')}<select id="portal-jump">${options(allowedTabs().map(k=>[k,taskTitle(k)]),tab)}</select></label>${taskInstructions()}${portalContent()}</section></div>`;}

function loginCandidates(form){
 const group=form.elements.group.value,cls=form.elements.loginClass.value,stream=form.elements.loginStream.value;
 const pupils=studentsInYear(rows,portalYear);
 const matches=d=>(!cls||d.class===cls)&&(!stream||classStream(d.class,rows)===stream);
 return rows.filter(r=>canProvision(r)&&r.data.role!=='principal'&&!['graduated','completed'].includes(r.data.status)).filter(r=>{
  if(group==='students')return r.kind==='student'&&pupils.some(p=>p.id===r.id&&matches(p.data));
  if(group==='parents')return r.kind==='profile'&&r.data.role==='parent'&&(!cls&&!stream||(r.data.children||[]).some(id=>pupils.some(p=>p.id===id&&matches(p.data))));
  if(group==='teachers')return r.kind==='profile'&&['teacher','hod'].includes(r.data.role);
  return r.kind==='profile'&&!['teacher','hod','parent','student'].includes(r.data.role);
 }).sort((a,b)=>(a.data.name||'').localeCompare(b.data.name||''));
}
function loginFilters(){return `<div class="form-grid"><label>${t('Account group','Groupe de comptes')}<select name="group" data-login-filter>${options([['teachers',t('Teachers','Enseignants')],['parents',t('Parents','Parents')],['students',t('Students','Élèves')],['staff',t('Other staff','Autre personnel')]])}</select></label><label data-login-school-filter>${t('Stream','Section')}<select name="loginStream" data-login-filter><option value="">${t('All streams','Toutes les sections')}</option>${options([...new Set(studentsInYear(rows,portalYear).map(r=>classStream(r.data.class,rows)))].sort())}</select></label><label data-login-school-filter>${t('Class','Classe')}<select name="loginClass" data-login-filter></select></label></div><p class="muted">${t('Academic year','Année scolaire')}: ${esc(portalYear)}</p><p data-login-count role="status"></p>`;}
function updateLoginFilters(form,resetClass=false){
 const group=form.elements.group.value,school=group==='students'||group==='parents',stream=form.elements.loginStream.value,chosen=resetClass?'':form.elements.loginClass.value;
 form.querySelectorAll('[data-login-school-filter]').forEach(el=>{el.hidden=!school;el.style.display=school?'':'none';});
 if(!school){form.elements.loginStream.value='';form.elements.loginClass.value='';}
 const classList=[...new Set(studentsInYear(rows,portalYear).filter(r=>!school||!stream||classStream(r.data.class,rows)===stream).map(r=>r.data.class).filter(Boolean))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
 form.elements.loginClass.innerHTML=`<option value="">${t('All classes','Toutes les classes')}</option>`+options(classList,chosen);
 const candidates=loginCandidates(form);
 form.querySelector('[data-login-count]').textContent=t(candidates.length+' people without a login.',candidates.length+' personnes sans compte.');
 if(form.elements.recordId)form.elements.recordId.innerHTML=`<option value="">${t('Choose a person','Choisissez une personne')}</option>`+options(candidates.map(r=>[r.id,r.data.name+(r.kind==='student'?' · '+(studentsInYear(rows,portalYear).find(p=>p.id===r.id)?.data.class||''):'')]));
 form.querySelector('button[type="submit"]').disabled=!candidates.length;
}

function table(a,cols,edit=true){if(!a.length)return empty(t('No records yet.','Aucun enregistrement.'));return `<div class="table-scroll record-list"><table><thead><tr>${cols.map(c=>`<th>${esc(label(c))}</th>`).join('')}${edit?'<th>Actions</th>':''}</tr></thead><tbody>${a.map(r=>`<tr data-search="${esc([r.data.name,r.data.matricule,r.data.role,r.data.department,r.data.class,r.data.subject,name(r.data.teacherId)].join(' ').toLowerCase())}" data-role="${esc(r.data.role||'')}" data-department="${esc(r.data.department||'')}" data-class="${esc(r.data.class||'')}" data-teacher="${esc(r.data.teacherId||'')}" data-subject="${esc(r.data.subject||'')}">${cols.map(c=>`<td data-label="${esc(label(c))}">${c==='status'||c==='role'?badge(r.data[c]):['teacherId','studentId'].includes(c)?esc(name(r.data[c])):esc(r.data[c]??'—')}</td>`).join('')}${edit?`<td data-label="${t('Actions','Actions')}">${button(t('Open','Ouvrir'),'edit','text-button',`data-id="${r.id}"`)}</td>`:''}</tr>`).join('')}</tbody></table></div>`;}
const frenchLabels={name:"Nom complet",class:"Classe",role:"Rôle",department:"Département",teacherId:"Enseignant",studentId:"Élève",subject:"Matière",assessment:"Évaluation",mark:"Note",coefficient:"Coefficient",status:"État",year:"Année scolaire",academicYear:"Année scolaire",birthDate:"Date de naissance",birthPlace:"Lieu de naissance",gender:"Sexe",phone:"Téléphone",children:"Élèves liés",teachingSubjects:"Matières enseignées",active:"Actif",periods:"Périodes par semaine",profile:"membre du personnel",student:"élève",assignment:"affectation",resource:"ressource",remark:"Observation",date:"Date",title:"Titre",type:"Type",dueDate:"Date limite",body:"Contenu",attachment:"Pièce jointe",submissionMode:"Mode de remise",durationMinutes:"Durée en minutes",officeLabel:"Fonction",salaryIndex:"Indice salarial",rank:"Grade",publicServiceDate:"Prise de service dans la fonction publique",schoolAssumptionDate:"Prise de service au lycée",photo:"Photo",signature:"Signature",bio:"Présentation",contentCreator:"Publication du site",authId:"Identifiant du compte"};

const labels={name:'Full name',matricule:'Matricule',class:'Class',birthDate:'Date of birth',birthPlace:'Place of birth',publicServiceDate:'First public-service assumption',schoolAssumptionDate:'Assumption at GHS Mbonjo',authId:'Supabase Auth user ID',salaryIndex:'Salary index',teacherId:'Teacher',studentId:'Student',dueDate:'Due date',submissionMode:'Submission method',titleFr:'Title in French',bodyFr:'Content in French',profileId:'Staff member',dutyDate:'Duty date',issueDate:'Issue date',reference:'Reference number',form5End:'Form 5 closing time',subjects:'Extra subjects (compulsory class subjects are always included)',code:'Short code for the timetable (for example CSC). Leave empty for the default.',officeLabel:'Office label (for example VP Arts or SDM 2)',whatsapp:'WhatsApp number (include country code)',signature:'Signature image, used on department documents you sign (PNG with a transparent background works best)',children:'Linked students',periods:'Periods per week'};
const label=k=>(lang==='fr'?frenchLabels[k]:null)||labels[k]||k.replace(/([A-Z])/g,' $1').replace(/^./,x=>x.toUpperCase());
function toolbar(kind,extra=''){return `<div class="toolbar">${button(t('+ Add '+label(kind),'+ Ajouter '+label(kind)),'new','primary',`data-kind="${kind}"`)}${extra}</div>`;}
function portalContent(){
 const r=profile.role,isAdmin=['principal','vp'].includes(r);
 if(tab==='academics')return academicsPanel();
 if(tab==='requests')return requestsPanel();
 if(tab==='overview')return homeWorkspace();
 if(tab==='profile')return `<div class="panel"><div class="profile-summary">${profileAvatar(profile,true)}<div><h2>${esc(profile.name)}</h2><p>${esc(postCatalogue.find(x=>x.id===(profile.post||profile.role))?.[lang]||profile.role)}</p></div></div><p>${t('Keep your contact details, photograph and service dates up to date. Administrative roles are assigned by the principal.','Actualisez vos coordonnées, votre photo et vos dates de service. Le proviseur attribue les rôles administratifs.')}</p>${profile.role==='student'?'':button(t('Update my profile','Modifier mon profil'),'edit','primary',`data-id="${profile.id}"`)}${button(t('Change password','Modifier le mot de passe'),'password','secondary')}${table(list('profile').filter(x=>x.id===profile.id),['name','department','publicServiceDate','schoolAssumptionDate','rank'],false)}</div>`;
 if(tab==='students')return studentsPanel(isAdmin);
 if(tab==='staff')return `${toolbar('profile',button(t('Import staff Excel / CSV','Importer le personnel'),'import','secondary','data-kind="profile"')+button(t('Create login','Créer un accès'),'provision','secondary')+button(t('Generate temporary passwords','Créer les mots de passe temporaires'),'bulk-provision','secondary'))}<p class="notice">${t('Assign HOD and content-creator roles here. To end an HOD appointment, change the role back to teacher. Departments must be confirmed by the principal.','Attribuez les rôles de chef de département et de créateur de contenu ici. Pour terminer un mandat de chef de département, réattribuez le rôle d’enseignant. Le proviseur confirme les départements.')}</p>${listFilters('staff')}${table(list('profile'),['name','department','role','officeLabel','matricule','teachingSubjects'])}${button(t('School logins and password resets','Comptes scolaires et réinitialisation'),'account-list','primary')}<details class="panel"><summary>School post catalogue and current appointments</summary><p>Several people may hold the same post. Only one bursar may be active. Optional support duties apply where the school has those services.</p><div class="table-scroll"><table><thead><tr><th>Post</th><th>French title</th><th>Category</th><th>Active staff</th></tr></thead><tbody>${postCatalogue.filter(p=>!['legacy','family access','app permission'].includes(p.category)).map(p=>`<tr><td>${esc(p.en)}</td><td>${esc(p.fr)}</td><td>${esc(p.category)}</td><td>${list('profile').filter(r=>r.data.role===p.id&&r.data.active!==false).length}${p.maxActive?' / '+p.maxActive:''}</td></tr>`).join('')}</tbody></table></div></details>`;
 if(tab==='assignments')return `${isAdmin?toolbar('assignment'):''}<p class="notice">${t('Imported assignments without weekly periods need confirmation before timetable generation.','Confirmez les périodes hebdomadaires des affectations importées avant de générer un emploi du temps.')}</p>${listFilters('assignments')}${table(assignmentsInYear(rows,portalYear),['class','subject','teacherId','department','periods','status'],isAdmin)}`;
 if(tab==='attendance'){const a=assignmentsInYear(rows,portalYear);return `${(isAdmin||['teacher','hod','discipline'].includes(r))?`<div class="panel"><h2>${t('Take roll call','Faire l’appel')}</h2><div class="form-grid"><label>${t('Lesson / class','Cours / classe')}<select id="roll-assignment"><option value="">${t('Choose a lesson','Choisir un cours')}</option>${options(a.map(x=>[x.id,x.data.class+' · '+x.data.subject]))}</select></label><label>${t('Date','Date')}<input type="date" id="roll-date" value="${today()}"></label></div><p>${t('Choose the lesson and date, then tick one option for each student.','Choisissez le cours et la date, puis cochez une option par élève.')}</p><div id="roll-list"></div></div>`:''}${attendanceOverview(profile)||['teacher','hod'].includes(r)?button(t('Attendance summaries','Bilans des présences'),'tab','secondary','data-tab="analytics"'):''}<h2>${t('Attendance records','Registres d’assiduité')}</h2><p class="muted">${t('Showing the last 30 days of lesson attendance, not an inferred daily attendance total.','Affichage des 30 derniers jours d’assiduité par cours, et non d’un total journalier déduit.')}</p>${table(list('attendance'),['date','studentId','class','status'],false)}`;}
 if(tab==='resources')return `${isAdmin||['teacher','hod'].includes(r)?toolbar('resource'):''}<div class="resource-grid">${list('resource').map(x=>`<article class="panel"><div class="row">${badge(x.data.type)}${badge(x.data.status)}</div><h3>${esc(x.data.title)}</h3><p>${esc(x.data.class)} · ${esc(x.data.subject)}</p><p class="muted">${esc(x.data.dueDate||'')} · ${esc(x.data.submissionMode)}</p>${button(t('Open resource','Ouvrir la ressource'),'resource','primary',`data-id="${x.id}"`)}</article>`).join('')||empty(t('No learning resources available yet.','Aucune ressource disponible.'))}</div><h2>${t('Timed assessment attempts','Évaluations chronométrées')}</h2>${list('exam_attempt').map(a=>`<article class="panel row"><div><strong>${esc(name(a.data.studentId))}</strong><p>${esc(a.data.title)} · ${badge(a.data.status)}</p></div>${profile.role!=='student'&&a.data.status!=='in_progress'?button('Mark written answers','review-exam','secondary',`data-id="${a.id}"`):''}</article>`).join('')}<h2>${t('Submissions','Travaux remis')}</h2>${table(list('submission'),['studentId','body','feedback','score'],profile.role!=='student')}`;
 if(tab==='marks')return `${markControlsPanel()}${['principal','vp','teacher','hod'].includes(r)?marksGridPanel():''}${['principal','vp','teacher','hod'].includes(r)?`<form id="marks-query" class="panel form-grid"><label>${t('Academic year','Année scolaire')}<input name="year" value="${esc(portalYear)}" readonly></label><label>${t('Class','Classe')}<select name="class"><option value="">${t('All permitted classes','Toutes les classes autorisées')}</option>${options(permittedClasses(),marksClass)}</select></label><button class="primary">${t('Load marks','Afficher les notes')}</button><p class="wide muted">Includes draft and published marks you are permitted to view. The principal controls the school year.</p></form>`:''}${markEntryAllowed(controls,{year:portalYear,assessment:controls.markWindows?.[portalYear]?.assessment==='all'?'Sequence 1':controls.markWindows?.[portalYear]?.assessment})&&(isAdmin||['teacher','hod'].includes(r))?toolbar('mark'):''}<div class="panel"><h2>${t('Print report cards','Imprimer les bulletins')}</h2><form id="report-form" class="form-grid"><label>${t('Class','Classe')}<select name="class">${options(permittedClasses())}</select></label><label>${t('Term or sequence','Trimestre ou séquence')}<select name="assessment">${options([...TERMS.map(x=>[x,t(x+' (both sequences)',x+' (deux séquences)')]),...sequences.map(x=>[x,x]),['Promotion exam','Promotion exam']])}</select><small>${t('A term averages its two sequences into the final mark. A single sequence prints that sequence alone.','Un trimestre calcule la moyenne de ses deux séquences. Une séquence seule est imprimée telle quelle.')}</small></label><label>${t('Academic year','Année scolaire')}<input name="year" value="${esc(portalYear)}" readonly></label><label>${t('Output','Document')}<select name="output"><option value="reports">${t('Individual report cards','Bulletins individuels')}</option><option value="master">${t('Master result sheet','Fiche récapitulative')}</option></select></label><label>${t('Master sheet shows','La fiche affiche')}<select name="master"><option value="grades">${t('Letter grades','Notes en lettres')}</option><option value="marks">${t('Marks out of 20','Notes sur 20')}</option></select></label><button class="primary">${t('Preview class reports','Aperçu des bulletins')}</button></form></div><p class="muted">${t('Six sequence tests. Promotion exams apply only to Forms 1–4 and Lower Sixth. Blank marks are not zero.','Six séquences. L’examen de promotion concerne uniquement les Forms 1–4 et Lower Sixth. Une note vide n’est pas un zéro.')}</p>${table(list('mark'),['studentId','subject','assessment','mark','coefficient','status'],isAdmin||(['teacher','hod'].includes(r)&&controls.markWindows?.[portalYear]?.status==='open'))}`;
 if(tab==='documents')return `${r==='principal'?toolbar('document',button('Other official documents','official-letter','secondary')+button(t('Bulk issue','Émission en lot'),'bulk-docs','secondary')):''}${list('document').map(x=>`<article class="panel row"><div><h3>${esc(x.data.title||x.data.name)}</h3><p>${esc(x.data.reference)} · ${esc(x.data.kind)} ${badge(x.data.status)}</p></div><div class="actions">${button(t('Print','Imprimer'),'print-document','secondary',`data-id="${x.id}"`)}${r==='principal'&&x.data.status==='issued'?button(t('Revoke','Révoquer'),'revoke','danger',`data-id="${x.id}"`):''}</div></article>`).join('')||empty(t('No attestations issued yet.','Aucune attestation délivrée.'))}`;
 if(tab==='department'){
  const dept=deptFilter||profile.department||'';
  const picker=admin(profile)?`<label>${t('Department','Département')}<select id="dept-pick">${options([['',t('Choose a department','Choisir un département')],...departments.map(d=>[d,d])],dept)}</select></label>`:'';
  if(!dept)return `<div class="panel">${picker||`<p class="notice">${t('Your profile has no department yet. Ask the principal to set it in Staff & roles.','Aucun département n’est associé à votre profil. Demandez au proviseur de le renseigner.')}</p>`}</div>`;
  const isHod=profile.role==='hod'&&profile.department===dept;
  const docs=list('dept_document').filter(x=>x.data.department===dept);
  const items=list('dept_item').filter(x=>x.data.department===dept);
  const prog=list('progression').filter(x=>x.data.department===dept);
  const lib=documentLibrary(docs),inv=inventorySummary(items);
  const staffHere=list('profile').filter(x=>x.data.department===dept&&x.data.active!==false);
  const adminOnly=admin(profile)&&!isHod;

  const head=`<div class="panel an-head"><div><p class="eyebrow">${t('DEPARTMENT','DÉPARTEMENT')}</p><h2>${esc(dept)}</h2>
   <p class="muted small">${staffHere.length} ${t('staff','enseignants')}${isHod?' · '+t('You are the head of department','Vous êtes chef de département'):''}</p></div>${picker}</div>`;

  const tiles=`<div class="stats an-stats">
   ${statTile(t('Documents','Documents'),adminOnly?lib.transmitted:lib.total,{note:adminOnly?t('transmitted to the administration','transmis à l’administration'):`${lib.signed} ${t('signed','signés')} · ${lib.transmitted} ${t('transmitted','transmis')}`})}
   ${statTile(t('Equipment','Équipement'),inv.items,{note:`${inv.working} ${t('working','en état')} · ${inv.faulty} ${t('need repair','à réparer')}`,tone:inv.faulty?'fair':'good'})}
   ${statTile(t('Out of service','Hors service'),inv.dead,{tone:inv.dead?'poor':'good'})}
   ${statTile(t('Schemes tracked','Progressions suivies'),prog.length,{note:t('progression sheets','fiches de progression')})}
  </div>`;

  // --- documents ---
  const docCard=r=>{
   const d=r.data;
   return `<article class="dept-doc"><div><h4>${esc(d.title)}</h4>
    <p class="muted small">${esc(d.date||'')} · ${esc(nameOrSelf(d.authorId))}${d.status==='signed'?` · <b class="ok">${t('signed','signé')}</b>`:` · ${t('draft','brouillon')}`}${d.transmitted?` · <b class="ok">${t('transmitted','transmis')}</b>`:''}</p></div>
    <div class="actions">${button(t('Open','Ouvrir'),'dept-doc-open','secondary',`data-id="${r.id}"`)}
    ${!adminOnly&&isHod&&d.status!=='signed'?button(t('Sign','Signer'),'dept-doc-sign','secondary',`data-id="${r.id}"`):''}
    ${!adminOnly&&isHod&&canTransmit(d)?button(t('Transmit to principal','Transmettre au proviseur'),'dept-doc-transmit','primary',`data-id="${r.id}"`):''}</div></article>`;
  };
  const documents=`<div class="panel"><div class="row"><h3>${t('Department documents','Documents du département')}</h3>
   ${adminOnly?'':`<div class="actions">${button(t('New document','Nouveau document'),'dept-doc-new','primary')}</div>`}</div>
   ${adminOnly?`<p class="muted small">${t('Only documents the head of department has transmitted appear here.','Seuls les documents transmis par le chef de département apparaissent ici.')}</p>`:''}
   ${documentCategories.map(c=>{
     const inCat=adminOnly?lib.byCategory[c].filter(x=>x.data.transmitted):lib.byCategory[c];
     return `<details class="tt-more"${inCat.length?' open':''}><summary>${esc(t(categoryLabels[c],categoryLabels[c]))} · ${inCat.length}</summary>
      ${inCat.length?inCat.map(docCard).join(''):`<p class="chart-empty">${t('Nothing filed here yet.','Rien de classé ici pour l’instant.')}</p>`}</details>`;
    }).join('')}
  </div>`;

  // --- inventory ---
  const inventory=`<div class="panel"><div class="row"><h3>${t('Department equipment','Équipement du département')}</h3>
   ${isHod?`<div class="actions">${button(t('Add equipment','Ajouter un équipement'),'dept-item-new','primary')}</div>`:''}</div>
   <p class="muted small">${t('The administration can always see this list. It is the department’s record of what it answers for.','L’administration a toujours accès à cette liste. C’est l’inventaire dont le département répond.')}</p>
   ${items.length?`<div class="table-scroll"><table><thead><tr><th>${t('Item','Article')}</th><th>${t('Category','Catégorie')}</th><th>${t('Qty','Qté')}</th><th>${t('Condition','État')}</th><th>${t('Location','Emplacement')}</th><th>${t('Serial / tag','N° de série')}</th>${isHod?'<th></th>':''}</tr></thead><tbody>
    ${items.sort((a,b)=>String(a.data.name).localeCompare(String(b.data.name))).map(r=>`<tr>
     <td>${esc(r.data.name)}</td><td>${esc(r.data.category)}</td><td>${esc(r.data.quantity??1)}</td>
     <td><span class="badge ${r.data.condition==='working'||!r.data.condition?'published':r.data.condition==='needs repair'?'pending':'rejected'}">${esc(r.data.condition||'working')}</span></td>
     <td>${esc(r.data.location||'—')}</td><td>${esc(r.data.serial||'—')}</td>
     ${isHod?`<td>${button(t('Edit','Modifier'),'edit','text-button',`data-id="${r.id}"`)}</td>`:''}</tr>`).join('')}
   </tbody></table></div>`:`<p class="chart-empty">${t('No equipment recorded yet.','Aucun équipement enregistré.')}</p>`}
   ${inv.byCategory.length?barChart(inv.byCategory.map(c=>({key:c.key,value:c.items})),{max:Math.max(...inv.byCategory.map(c=>c.items)),unit:'',label:'Equipment by category'}):''}
  </div>`;

  // Progression comes before the paperwork: it is what a head of department
  // opens this page to look at.
  return head+calendarBanner()+tiles+progressionViewer(dept,prog,isHod||!adminOnly)
        +progressionPanel(dept,prog,isHod||!adminOnly)+documents+inventory;
 }
 if(tab==='messages')return messagesPanel();
 if(tab==='analytics'){
  const activeAssignments=assignmentsInYear(rows,portalYear),classOptions=attendanceOverview(profile)?classes:[...new Set(activeAssignments.map(r=>r.data.class))].sort(),subjectOptions=attendanceOverview(profile)?availableSubjects(rows).map(s=>s.name):[...new Set(activeAssignments.map(r=>r.data.subject))].sort();
  const controls=`<form id="analytics-form" class="panel">
   <h2>${t('Analytics','Analyses')}</h2>
   <p class="muted">${t('Attendance, results and roll-call coverage over a period you choose. Figures cover only the classes you are allowed to see.','Assiduité, résultats et suivi des appels sur une période de votre choix. Les chiffres ne portent que sur les classes auxquelles vous avez accès.')}</p>
   <div class="form-grid">
    <label>${t('From','Du')}<input type="date" name="from" value="${esc(anFrom)}" required></label>
    <label>${t('To','Au')}<input type="date" name="to" value="${esc(anTo)}" required></label>
    <label>${t('Class','Classe')}<select name="class">${options([['',attendanceOverview(profile)?t('All school classes','Toutes les classes'):t('All my classes','Toutes mes classes')],...classOptions.map(c=>[c,c])],anClass)}</select></label>
    <label>${t('Subject','Matière')}<select name="subject">${options([['',t('All subjects','Toutes les matières')],...subjectOptions],anSubject)}</select></label><label>${t('Academic year','Année scolaire')}<input name="year" value="${esc(portalYear)}" readonly></label>
   </div>
   <div class="actions"><button class="primary"${anBusy?' disabled':''}>${anBusy?t('Working…','Calcul…'):t('Show analytics','Afficher les analyses')}</button>${anReport?button(t('Print','Imprimer'),'print-analytics','secondary'):''}</div>
   ${anError?`<p class="error">${esc(anError)}</p>`:''}
  </form>`;
  if(!anReport)return controls+empty(t('Choose a period and show the analytics.','Choisissez une période puis affichez les analyses.'));
  return controls+analyticsView(anReport);
 }
 if(tab==='timetable'){
  const sheets=list('timetable'),entries=allTimetableEntries(),subjects=availableSubjects(rows);
  const generator=isAdmin?timetablePanel(subjects):'';
  if(!sheets.length)return generator+empty(t('No timetable has been published.','Aucun emploi du temps publié.'));
  const myId=profile.role==='student'?null:profile.id;
  const teacherList=timetableTeachers(entries),classList=timetableClasses(entries);
  const chosenClass=ttClass||(profile.role==='student'?profile.class:classList[0])||'';
  const chosenTeacher=ttTeacher||(teacherList.some(x=>x[0]===myId)?myId:teacherList[0]?.[0])||'';
  const mine=teacherList.some(x=>x[0]===myId)?`<div class="panel"><div class="row"><h2>${t('My timetable','Mon emploi du temps')}</h2>${button(t('Print','Imprimer'),'print-teacher','secondary',`data-id="${esc(myId)}"`)}</div><div class="tt-scroll">${teacherSheet(myId,entries,subjects)}</div></div>`:'';
  const classPanel=`<div class="panel"><div class="row"><h2>${t('Class timetable','Emploi du temps par classe')}</h2><div class="actions">${button(t('Print this class','Imprimer cette classe'),'print-class','secondary',`data-id="${esc(chosenClass)}"`)}${isAdmin?button(t('Print all classes','Imprimer toutes les classes'),'print-all-classes','secondary'):''}</div></div><label>${t('Choose a class','Choisir une classe')}<select id="tt-class">${options(classList,chosenClass)}</select></label><div class="tt-scroll">${chosenClass?classSheet(chosenClass,entries,subjects):''}</div></div>`;
  const staffPanel=['principal','vp','hod'].includes(profile.role)?`<div class="panel"><div class="row"><h2>${t('Teacher timetable','Emploi du temps par enseignant')}</h2><div class="actions">${button(t('Print this teacher','Imprimer cet enseignant'),'print-teacher','secondary',`data-id="${esc(chosenTeacher)}"`)}${isAdmin?button(t('Print all teachers','Imprimer tous les enseignants'),'print-all-teachers','secondary'):''}</div></div><label>${t('Choose a teacher','Choisir un enseignant')}<select id="tt-teacher">${options(teacherList,chosenTeacher)}</select></label><div class="tt-scroll">${chosenTeacher?teacherSheet(chosenTeacher,entries,subjects):''}</div></div>`:'';
  return generator+mine+classPanel+staffPanel;
 }
 if(tab==='publishing')return `${isAdmin?button('Import supplied activities','import-calendar','secondary'):''}<div class="toolbar">${['post','event','gallery','textbook'].map(k=>button('+ '+label(k),'new','primary',`data-kind="${k}"`)).join('')}</div>${['post','event','gallery','textbook'].map(k=>`<h2>${label(k)}</h2>${table(list(k),['title','status'])}`).join('')}`;
 if(tab==='ai')return `<div class="panel narrow"><form id="ai-form"><p>${t('Draft a message, review it, then choose where to publish it.','Rédigez un message, relisez-le, puis choisissez où le publier.')}</p><p class="notice">Your school writing guide is applied automatically. Enter only the facts needed for this message.</p><label>Document title<input id="writing-title" value="School message"></label><label>${t('Facts to include','Faits à inclure')}<textarea name="prompt" rows="6" required placeholder="Audience, purpose, confirmed dates and key points"></textarea></label><label>${t('Writing guide / style','Guide / style de rédaction')}<textarea name="style" rows="3" placeholder="Paste your preferred writing guide here"></textarea></label><label>${t('Language','Langue')}<select name="language">${options([['en','English'],['fr','Français']],lang)}</select></label><button class="primary">${t('Generate draft','Générer un brouillon')}</button><label>${t('Editable draft','Brouillon modifiable')}<textarea id="ai-result" rows="12"></textarea></label>${['principal','vp'].includes(r)||profile.contentCreator?button(t('Use as announcement','Utiliser comme annonce'),'ai-announcement','secondary'):''}${profile.department?button(t('Save to my department','Enregistrer dans mon département'),'ai-save-department','secondary'):''}<div class="actions">${button('Save Word (.docx)','export-writing','secondary','data-format="docx"')}${button('Save PDF','export-writing','secondary','data-format="pdf"')}${button('Print','print-writing','secondary')}</div></form><section class="panel"><h2>Write to a colleague on WhatsApp</h2>${button('Load department contacts','contacts','secondary')}<div id="colleague-picker"></div></section></div>`;
 if(tab==='settings')return `<form id="settings-form" class="panel narrow"><h2>AI writing provider</h2><p>Select a provider and paste its API key. The app selects the writing model automatically.</p><label>Provider<select name="provider">${options(Object.entries(providers).map(([id,p])=>[id,p.label]))}</select></label><label>API key<input type="password" name="key" required autocomplete="off"></label><p class="muted">Free tiers and trial credits have limits. Grok is not guaranteed free. OpenRouter uses its free-model router.</p><button class="primary">Save encrypted API key</button></form>`;
 if(tab==='backup')return `<form id="backup-form" class="panel narrow"><h2>Save school records to your PC</h2><p>This downloads an encrypted export of school records, photographs and the activity log. Account passwords, AI keys and hosting settings are excluded.</p><p>Pause record editing during the export. It reads records in pages, so it is not a database snapshot.</p><label>Backup password<input type="password" name="password" minlength="12" autocomplete="new-password" required></label><label>${t('Confirm password','Confirmer le mot de passe')}<input type="password" name="confirm" minlength="12" autocomplete="new-password" required></label><p>Keep this password separately. It is needed to open the backup.</p><button class="primary">Download encrypted backup</button><p id="backup-progress" role="status"></p></form>`;
 if(tab==='audit')return `<div id="audit-content">${button(t('Load recent activity','Charger l’activité récente'),'audit','primary')}</div>`;
 return '';
}
const bytesBase64=bytes=>{let out='';for(let i=0;i<bytes.length;i+=8192)out+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(out);};
function academicsPanel(){return `<div class="panel"><h2>Classes and compulsory subjects</h2><p>Add subjects to a class and every student in that class takes them. Extra subjects are selected on individual student profiles. Suggested groupings are editable school choices.</p><div class="actions">${button('Add class','new','primary','data-kind="classroom"')}${button('Add subject','new','secondary','data-kind="subject"')}${profile.role==='principal'?button('Import supplied Form Five students','import-bundled-students','secondary'):''}</div></div><div class="cards two">${classes.map(c=>{const r=list('classroom').find(x=>x.data.name===c);const source=r?.data.legacyAcademics?.[portalYear];return `<article class="panel"><h3>${esc(c)}</h3><p>${r?esc(r.data.stream):'Subject allocation not configured'}</p><p>${r?esc((r.data.subjects||[]).join(', ')):'Set compulsory subjects before using this class for enrolment.'}</p>${source?`<details><summary>${t('Migrated subject reference','Référence des matières importées')} · ${esc(portalYear)}</summary><p>${t('Class master','Professeur principal')}: ${esc(source.classMasterName||'Unassigned')}</p>${source.subjects.map(s=>`<p>${esc(s)} · ${t('coefficient','coefficient')} ${esc(source.coefficients[s]??'Unspecified')}</p>`).join('')}</details>`:''}${r?button('Edit subjects','edit','secondary',`data-id="${r.id}"`):button('Set up class','setup-class','primary',`data-class="${esc(c)}"`)}</article>`;}).join('')}</div><h2>Subject catalogue</h2>${table(availableSubjects(rows).map(data=>({data})),['name','department','group','coefficient'],false)}`;}
function questionRow(q){return `<fieldset class="question-editor"><legend>Question</legend><label>Type<select class="q-type">${options(['mcq','truefalse','short','essay'],q.type||'mcq')}</select></label><label>Question<textarea class="q-prompt" rows="3">${esc(q.prompt||'')}</textarea></label><label>Marks<input class="q-points" type="number" min="1" value="${q.points||1}"></label><label>MCQ options, one per line<textarea class="q-options" rows="4">${esc((q.options||[]).join('\n'))}</textarea></label><label>Correct option number (1 = first option, True = 1, False = 2)<input class="q-correct" type="number" min="1" value="${(q.correct??0)+1}"></label>${button('Remove question','remove-question','secondary')}</fieldset>`;}
function questionEditor(questions){return `<section class="wide panel"><h3>Timed assessment questions</h3><p>Use MCQ, true/false, short answers or essays. Set Duration minutes above. Short answers and essays are marked by the teacher. Leave empty for ordinary notes and homework.</p><div id="question-list">${questions.map(questionRow).join('')}</div>${button('Add question','add-question','secondary')}</section>`;}
function readQuestions(form){return [...form.querySelectorAll('.question-editor')].map(el=>({type:el.querySelector('.q-type').value,prompt:el.querySelector('.q-prompt').value,points:+el.querySelector('.q-points').value,options:el.querySelector('.q-options').value.split('\n').filter(x=>x.trim()),correct:+el.querySelector('.q-correct').value-1}));}
let activeExam=null,examTimer=null,examOffset=0,examSaving=false,examSubmitPending=false;
async function startExam(id){const a=await api('exam-start',{resourceId:id});activeExam=a.row;examOffset=Date.parse(a.serverNow)-Date.now();if(activeExam.data.status!=='in_progress'){modal('Assessment submitted',`<p>Your answers have been submitted. MCQ score: ${activeExam.data.autoScore??'Pending'} / ${activeExam.data.total??''}. ${activeExam.data.manualRequired?'Written answers await teacher marking.':''}</p>`);return;}const d=activeExam.data;modal(d.title,`<div class="exam-status"><strong id="exam-clock"></strong><span id="exam-save-status">Answers save as you work.</span></div><form id="exam-form">${d.questions.map((q,i)=>`<fieldset><legend>Question ${i+1} · ${q.points} marks</legend><p>${esc(q.prompt)}</p>${['mcq','truefalse'].includes(q.type)?q.options.map((opt,n)=>`<label class="exam-option"><input type="radio" name="${q.id}" value="${n}" ${String(d.answers[q.id])===String(n)?'checked':''}>${esc(opt)}</label>`).join(''):`<textarea name="${q.id}" rows="${q.type==='essay'?8:3}">${esc(d.answers[q.id]||'')}</textarea>`}</fieldset>`).join('')}<button class="primary">Submit assessment</button></form>`);clearInterval(examTimer);examTimer=setInterval(()=>{if(!$('#exam-form')){clearInterval(examTimer);return;}const seconds=Math.max(0,Math.ceil((Date.parse(d.deadline)-Date.now()-examOffset)/1000));$('#exam-clock').textContent=`Time remaining ${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;if(!seconds)saveExam(true).catch(e=>toast(e.message));},1000);}
async function saveExam(submit=false){if(examSaving){if(submit)examSubmitPending=true;return;}if(!activeExam||!$('#exam-form'))return;examSaving=true;try{const answers=Object.fromEntries(new FormData($('#exam-form')));const a=await api(submit?'exam-submit':'exam-save',{resourceId:activeExam.data.resourceId,answers});activeExam=a.row;$('#exam-save-status').textContent='Saved '+new Date().toLocaleTimeString();if(submit||a.row.data.status!=='in_progress'){clearInterval(examTimer);$('#modal').close();await refresh();toast('Assessment submitted.');}}finally{examSaving=false;if(examSubmitPending){examSubmitPending=false;await saveExam(true);}}}
let answerSaveTimer;document.addEventListener('input',e=>{if(e.target.closest('#exam-form')){clearTimeout(answerSaveTimer);answerSaveTimer=setTimeout(()=>saveExam().catch(err=>{if($('#exam-save-status'))$('#exam-save-status').textContent='Not saved. Check your connection.';toast(err.message);}),600);}});
function requestsPanel(compact=false){const a=list('document_request').filter(r=>!compact||requestState(r,list('document')).status==='pending');return `${!compact&&requestingStaff(profile)?button('Request a document','request-document','primary'):''}${a.length?a.map(r=>{const state=requestState(r,list('document'));return `<article class="panel request-card"><div><h3>${esc(r.data.name)}</h3><p>${esc(r.data.requestType)} · ${badge(state.status)}</p><p>${esc(r.data.purpose)}</p>${r.data.reviewComment?`<p>${esc(r.data.reviewComment)}</p>`:''}</div><div class="actions">${state.status==='pending'?(profile.role==='principal'?button('Prepare document','fulfil-request','primary',`data-id="${r.id}"`)+button('Decline','reject-request','secondary',`data-id="${r.id}"`):button('Cancel request','cancel-request','secondary',`data-id="${r.id}"`)):state.documentId?button('Open issued document','print-document','primary',`data-id="${state.documentId}"`):''}</div></article>`;}).join(''):empty('No document requests to show.')}`;}
function officialLetter(request=null){modal('Official letterhead document',`<form id="official-letter-form" data-request="${request?.id||''}"><div class="form-grid"><label>Document type<select name="letterType">${options(officialTypes,request?'Employment confirmation':'Custom letter')}</select></label><label>Reference number<input name="reference" required></label><label>Issue date<input name="issueDate" type="date" value="${today()}" required></label><label>Recipient<input name="recipient" value="${esc(request?.data.name||'')}" required></label><label class="wide">Subject heading<input name="title" maxlength="160" value="${request?'CONFIRMATION OF EMPLOYMENT':''}" required></label><label class="wide">Document body<textarea name="body" rows="12" maxlength="12000" required placeholder="Enter the complete official text. Include confirmed names, dates and details only."></textarea></label></div><p>The subject is centred and underlined, like the attestations. Review the wording before issuing.</p><button class="primary">Issue and preview</button></form>`);}
// --- Department office --------------------------------------------------------
// The head of department's own working area: the paper they write and sign, the
// equipment they answer for, and how far the subject has actually got through its
// progression sheet. The administration sees the equipment always and a document
// only once it has been transmitted.
let deptFilter='',msgThread='',msgRows=[],msgColleagues=[],msgLoaded=false;
let progSheets=[],progSheetCache={},progPick={subject:'',class:''},progWeek='',progImport=null;
// The PDF reader is loaded only when a PDF is actually imported, so the library
// never rides on an ordinary page load. Its worker is disabled: the app's
// Content-Security-Policy allows scripts from this origin only, and a progression
// sheet is small enough to read on the main thread.
async function readProgressionPdf(file){
 if(!file)throw Error(t('Choose a file first.','Choisissez d’abord un fichier.'));
 if(file.size>12000000)throw Error(t('Use a PDF smaller than 12 MB.','Utilisez un PDF de moins de 12 Mo.'));
 const lib=await import('pdfjs-dist/legacy/build/pdf.mjs');
 lib.GlobalWorkerOptions.workerSrc='/pdf.worker.js';
 const doc=await lib.getDocument({data:new Uint8Array(await file.arrayBuffer()),disableFontFace:true,isEvalSupported:false,useWorkerFetch:false}).promise;
 const pages=[];
 for(let n=1;n<=doc.numPages;n++){
  const content=await (await doc.getPage(n)).getTextContent();
  pages.push(content.items.filter(i=>i.str).map(i=>({str:i.str,x:i.transform[4],y:i.transform[5],width:i.width,rotated:Math.abs(i.transform[1])>0.01})));
 }
 const lessons=lessonsFromPages(pages);
 if(!lessons.length)throw Error(t('No lessons were found in that PDF. Check that it is a progression sheet rather than a scan.','Aucune leçon trouvée dans ce PDF. Vérifiez qu’il s’agit bien d’une fiche de progression et non d’un scan.'));
 const heading=sheetHeading(pages[0]);
 return {lessons,sourceTitle:heading.title||file.name,weeklyPeriods:heading.weeklyPeriods};
}
const nameOrSelf=id=>id===profile.id?t('you','vous'):name(id);
const admin=p=>['principal','vp'].includes(p.role);
const todayISO=()=>new Date().toISOString().slice(0,10);

// Where the school is today, worked out from the ministry's calendar rather than
// typed in by anyone. In a holiday it says so: a week that has not started yet
// cannot already be behind.
function calendarBanner(year=academicYear()){
 const c=calendar(knownYear(year)?year:defaultYear);
 if(!c)return '';
 const s=schoolWeek(today(),c.year);
 const dates=w=>{const r=weekRange(w,c.year);return r?`${r.from} → ${r.to}`:'';};
 const line=s.status==='teaching'
  ?`<strong>${t('Week','Semaine')} ${s.week} ${t('of','sur')} ${c.weeks}</strong> · ${esc(t(s.term,s.term))} · ${esc(dates(s.week))}`
  :s.status==='before'
  ?`<strong>${t('The school year has not opened yet','L’année scolaire n’a pas encore commencé')}</strong> · ${t('teaching begins','la rentrée a lieu le')} ${esc(c.opens)}`
  :s.status==='holiday'
  ?`<strong>${t('Holiday','Vacances')}</strong> · ${t('week','semaine')} ${s.lastWeek} ${t('was the last one taught; teaching resumes on','a été la dernière enseignée ; reprise le')} ${esc(s.resumesOn)} (${t('week','semaine')} ${s.nextWeek})`
  :`<strong>${t('The teaching year is over','L’année d’enseignement est terminée')}</strong> · ${c.weeks} ${t('weeks were taught','semaines enseignées')}`;
 return `<div class="panel an-head"><div><p class="eyebrow">${t('SCHOOL CALENDAR','CALENDRIER SCOLAIRE')} · ${esc(c.year)}</p>
  <p>${line}</p>
  <p class="muted small">${t('Worked out from','Établi à partir de')} ${esc(c.order)}: ${t('the year opens','l’année ouvre le')} ${esc(c.opens)}, ${c.weeks} ${t('working weeks, holidays excluded.','semaines de cours, vacances non comprises.')}</p></div></div>`;
}

// --- Looking a progression sheet up ------------------------------------------
// A head of department, or the administration through the department picker,
// picks a class and a subject and reads the sheet itself — whether or not the
// department has started ticking lessons off against it.
let progView={class:'',subject:'',lessons:null,title:'',weeklyPeriods:0,source:'',recordId:''};
let progCatalogue='idle';
function ensureCatalogue(){
 if(progCatalogue!=='idle')return;
 progCatalogue='loading';
 api('progression-catalogue')
  .then(r=>{progSheets=r.sheets;progCatalogue='ready';render();})
  .catch(err=>{progCatalogue='ready';toast(err.message);});
}
// The sheets this department can look at: the ones supplied with the app for its
// subjects, plus everything it has adopted or imported itself.
function sheetChoices(dept,records){
 const out=new Map();
 const add=(subject,cls,source)=>{const key=subject+'|'+levelOf(cls);if(!out.has(key))out.set(key,{subject,level:levelOf(cls),source});};
 for(const s of progSheets)if(!s.department||s.department===dept)add(s.subject,s.class,'supplied');
 for(const r of records)add(r.data.subject,r.data.class,'tracked');
 return [...out.values()];
}
function progressionViewer(dept,records,mayEdit){
 ensureCatalogue();
 const choices=sheetChoices(dept,records);
 const subjects=[...new Set([...choices.map(c=>c.subject),...availableSubjects(rows).filter(s=>s.department===dept).map(s=>s.name)])].sort();
 const chosenSubject=progView.subject||subjects[0]||'';
 const chosenClass=progView.class||classes[0]||'';
 const body=progCatalogue==='loading'&&!progSheets.length
  ?`<p class="chart-empty">${t('Loading the supplied sheets…','Chargement des fiches fournies…')}</p>`
  :progView.lessons?sheetReading(records,mayEdit)
  :`<p class="chart-empty">${t('Choose a class and a subject, then open the sheet.','Choisissez une classe et une matière, puis ouvrez la fiche.')}</p>`;
 return `<div class="panel"><h3>${t('Progression sheets','Fiches de progression')}</h3>
  <p class="muted small">${t('The scheme of work for a class, week by week. Supplied sheets and sheets the department has imported are both here.','Le programme d’une classe, semaine par semaine. Les fiches fournies et celles importées par le département figurent ici.')}</p>
  <div class="form-grid">
   <label>${t('Class','Classe')}<select id="prog-view-class">${options(classes,chosenClass)}</select></label>
   <label>${t('Subject','Matière')}<select id="prog-view-subject">${options(subjects.length?subjects:[''],chosenSubject)}</select></label>
  </div>
  <div class="actions">${button(t('Open the sheet','Ouvrir la fiche'),'prog-view','primary')}${progView.lessons?button(t('Print','Imprimer'),'print-progression','secondary'):''}</div>
  ${body}</div>`;
}
// The sheet itself. When the department is tracking this class and subject the
// ticks and the coverage come with it; otherwise it is simply the scheme, read
// the way it is printed: by term, then by week.
function sheetReading(records,mayEdit){
 const rec=records.find(r=>r.id===progView.recordId)||null;
 const d=rec?.data||{};
 const week=rec?weekInHand(d,today()):currentWeek(today(),academicYear());
 const c=coverage(progView.lessons,d.taught||{},{currentWeek:week});
 const heading=`<div class="row"><div><h4>${esc(progView.subject)} · ${esc(progView.class)}</h4>
  <p class="muted small">${esc(shorten(progView.title||'',70))}${progView.weeklyPeriods?` · ${progView.weeklyPeriods} ${t('periods a week','périodes par semaine')}`:''} · ${c.total} ${t('lessons','leçons')}
   · ${progView.source==='tracked'?t('tracked by the department','suivie par le département'):t('supplied with the app','fournie avec l’application')}</p></div>
  <div class="actions">${rec&&mayEdit?button(t('Mark lessons','Pointer les leçons'),'prog-open','secondary',`data-id="${rec.id}"`):''}
   ${!rec&&mayEdit?button(t('Track this sheet','Suivre cette fiche'),'prog-add','primary'):''}</div></div>`;
 const tiles=rec?`<div class="stats an-stats">
   ${statTile(t('Covered','Couvert'),c.rate,{unit:'%',note:`${c.taught} ${t('of','sur')} ${c.total}`,tone:c.onTrack===null?'':c.onTrack?'good':'poor'})}
   ${statTile(t('Expected by now','Attendu à ce jour'),c.expected===null?null:c.expected,{note:week?`${t('week','semaine')} ${week}`:t('outside the teaching year','hors année scolaire'),tone:''})}
   ${statTile(t('Behind','Retard'),c.behind===null?null:c.behind,{note:t('lessons','leçons'),tone:c.behind?'poor':'good'})}
  </div>`:'';
 // Grouped the way the printed sheet is, so a head of department can follow it
 // against the paper copy.
 const byTerm=new Map();
 for(const row of c.rows){
  const term=row.term||termOfWeek(row.week)||t('Unplaced','Non placées');
  if(!byTerm.has(term))byTerm.set(term,new Map());
  const weeks=byTerm.get(term),w=row.week===''||row.week===null||row.week===undefined?'—':row.week;
  if(!weeks.has(w))weeks.set(w,[]);
  weeks.get(w).push(row);
 }
 const table=[...byTerm].map(([term,weeks])=>`<details class="tt-more" open><summary>${esc(term)} · ${[...weeks.values()].reduce((n,l)=>n+l.length,0)} ${t('lessons','leçons')}</summary>
  <div class="table-scroll"><table><thead><tr><th>${t('Week','Semaine')}</th><th>#</th><th>${t('Lesson','Leçon')}</th><th>${t('Objectives','Objectifs')}</th>${rec?`<th>${t('Taught','Traitée')}</th>`:''}</tr></thead><tbody>
  ${[...weeks].map(([w,list])=>list.map((row,i)=>`<tr class="${week&&+w===+week?'prog-now':''}">
    ${i===0?`<td rowspan="${list.length}">${esc(w)}${week&&+w===+week?`<br><small class="ok">${t('this week','cette semaine')}</small>`:''}${(()=>{const r=weekRange(w,knownYear(d.year||academicYear())?(d.year||academicYear()):defaultYear);return r?`<br><small class="muted">${esc(r.from.slice(5))}</small>`:'';})()}</td>`:''}
    <td>${esc(row.number??'—')}</td>
    <td>${esc(row.title)}</td>
    <td>${row.objectives?.length?`<details><summary>${row.objectives.length}</summary><ul>${row.objectives.map(o=>`<li>${esc(o)}</li>`).join('')}</ul></details>`:'—'}</td>
    ${rec?`<td>${row.taught?`<b class="ok">✓</b> <small class="muted">${esc(row.record?.date||'')}</small>`:'—'}</td>`:''}</tr>`).join('')).join('')}
  </tbody></table></div></details>`).join('');
 return heading+tiles+table;
}

// --- Splitting a subject ------------------------------------------------------
// A sheet is written for a level: one scheme covers Form 1A and Form 1B. Where
// the streams are not in step — a different teacher, a class that lost a week —
// the department splits the subject and follows each class on its own copy.
function splitFieldset(level,split=false){
 return `<fieldset class="prog-split"><legend>${t('Which classes does this sheet follow?','Quelles classes suivent cette fiche ?')}</legend>
  <label class="prog-row"><input type="radio" name="scope" value="level" ${split?'':'checked'}>
   <span>${t('One scheme for the whole level','Un seul programme pour tout le niveau')} (${esc(levelOf(level)||'—')}) — <span class="muted">${t('every class in the level is counted together','toutes les classes du niveau sont comptées ensemble')}</span></span></label>
  <label class="prog-row"><input type="radio" name="scope" value="split" ${split?'checked':''}>
   <span>${t('Split the subject: one scheme per class','Scinder la matière : un programme par classe')} — <span class="muted">${t('for when the classes are not at the same point','lorsque les classes n’en sont pas au même point')}</span></span></label>
  <div id="prog-split-classes" ${split?'':'hidden'}>${classChoices(level)}</div></fieldset>`;
}
function classChoices(level){
 const inLevel=classesInLevel(level,classes);
 return inLevel.length
  ?inLevel.map(c=>`<label class="prog-row"><input type="checkbox" name="classes" value="${esc(c)}" checked><span>${esc(c)}</span></label>`).join('')
  :`<p class="muted small">${t('No classes are registered for this level yet. Add them in Classes & subjects first.','Aucune classe enregistrée pour ce niveau. Ajoutez-les d’abord dans Classes et matières.')}</p>`;
}
// The classes a scheme should be created for: the level itself, or each ticked
// class when the subject is split.
function splitTargets(form,level){
 const data=new FormData(form);
 if(data.get('scope')!=='split')return [levelOf(level)];
 const picked=data.getAll('classes');
 if(!picked.length)throw Error(t('Tick at least one class, or keep one scheme for the whole level.','Cochez au moins une classe, ou gardez un seul programme pour le niveau.'));
 return picked;
}

// Fetching the sheet behind a class and a subject: the department's own copy if
// it has one, otherwise the sheet supplied with the app.
async function openProgressionSheet(dept,cls,subject){
 if(!subject)throw Error(t('Choose a subject.','Choisissez une matière.'));
 const records=list('progression').filter(x=>x.data.department===dept);
 const level=levelOf(cls);
 const rec=records.find(r=>r.data.subject===subject&&r.data.class===cls)
       ||records.find(r=>r.data.subject===subject&&levelOf(r.data.class)===level);
 if(rec){
  const d=rec.data;
  progView={class:cls,subject,lessons:d.lessons||[],title:d.sourceTitle||'',weeklyPeriods:d.weeklyPeriods||0,source:'tracked',recordId:rec.id};
  return;
 }
 const key=subject+'|'+level;
 if(!progSheetCache[key]){
  if(!progSheets.some(s=>s.subject===subject&&s.class===level))
   throw Error(t(`There is no sheet for ${subject} ${level} yet. Import the department's own sheet and it will appear here.`,`Aucune fiche pour ${subject} ${level}. Importez la fiche du département et elle apparaîtra ici.`));
  const r=await api('progression-sheet',{subject,class:level});
  progSheetCache[key]=r.sheet;
 }
 const sheet=progSheetCache[key];
 progView={class:cls,subject,lessons:sheet.lessons,title:sheet.title,weeklyPeriods:sheet.weeklyPeriods,source:'supplied',recordId:''};
}

function progressionPanel(dept,records,mayEdit){
 const rows=records.slice().sort((a,b)=>String(a.data.subject+a.data.class).localeCompare(String(b.data.subject+b.data.class)));
 const cards=rows.map(r=>{
  const d=r.data,c=coverage(d.lessons||[],d.taught||{},{currentWeek:weekInHand(d,today())});
  const tone=c.onTrack===null?'':c.onTrack?'good':'poor';
  return `<article class="panel prog-card">
   <div class="row"><div><h4>${esc(d.subject)} · ${esc(d.class)}</h4>
    <p class="muted small">${esc(d.year||'')} · ${c.total} ${t('lessons in the scheme','leçons au programme')}${d.sourceTitle?` · ${esc(shorten(d.sourceTitle,60))}`:''}</p></div>
    <div class="actions">${mayEdit?button(t('Mark lessons','Pointer les leçons'),'prog-open','secondary',`data-id="${r.id}"`):''}${mayEdit?button(t('Ask the AI','Demander à l’IA'),'prog-advice','secondary',`data-id="${r.id}"`):''}</div></div>
   <div class="stats an-stats">
    ${statTile(t('Covered','Couvert'),c.rate,{unit:'%',note:`${c.taught} ${t('of','sur')} ${c.total}`,tone})}
    ${statTile(t('Expected by now','Attendu à ce jour'),c.expected===null?null:c.expected,{note:c.currentWeek?`${t('week','semaine')} ${c.currentWeek}`:t('outside the teaching year','hors année scolaire'),tone:''})}
    ${statTile(t('Behind','Retard'),c.behind===null?null:c.behind,{note:t('lessons','leçons'),tone:c.behind?'poor':'good'})}
   </div>
   ${c.byTerm.length?columnChart(c.byTerm.map(x=>({key:x.key.replace(' Term',''),value:x.rate,note:`${x.taught}/${x.total}`})),{label:'Coverage by term'}):''}
   ${c.next?`<p class="muted small">${t('Next untaught','Prochaine leçon non traitée')}: ${t('week','semaine')} ${esc(c.next.week)}${c.next.number?` · ${t('lesson','leçon')} ${esc(c.next.number)}`:''} — ${esc(c.next.title)}</p>`:`<p class="muted small">${t('Every lesson in the scheme is marked taught.','Toutes les leçons du programme sont pointées.')}</p>`}
   ${d.advice?`<details class="tt-more"><summary>${t('AI note','Note de l’IA')}</summary><div class="prose">${esc(d.advice)}</div><p class="muted small">${t('Written by the AI from the counts above. Check it before acting on it.','Rédigé par l’IA à partir des chiffres ci-dessus. Vérifiez avant d’agir.')}</p></details>`:''}
  </article>`;
 }).join('');
 return `<div class="panel"><div class="row"><h3>${t('Progression and coverage','Progression et couverture')}</h3>
  ${mayEdit?`<div class="actions">${button(t('Track a scheme','Suivre un programme'),'prog-add','primary')}${button(t('Import a sheet','Importer une fiche'),'prog-import','secondary')}</div>`:''}</div>
  <p class="muted small">${t('Coverage is measured against the progression sheet, not against the timetable: a lesson counts when someone marks it taught.','La couverture est mesurée par rapport à la fiche de progression : une leçon compte lorsqu’elle est pointée.')}</p>
  ${rows.length?'':`<p class="chart-empty">${t('No scheme is being tracked yet.','Aucun programme suivi pour l’instant.')}</p>`}</div>${cards}`;
}

// --- Messages -----------------------------------------------------------------
// Direct notes between colleagues and one running thread per department. The
// principal is not a member of these threads and does not see them in the portal;
// the page says plainly that this is not protection from whoever administers the
// database, because it is not.
async function loadMessages(){
 try{const r=await api('messages');msgRows=r.rows;msgColleagues=r.colleagues;msgLoaded=true;}
 catch(err){msgRows=[];msgColleagues=[];msgLoaded=true;toast(err.message);}
}
function messagesPanel(){
 if(!msgLoaded)return `<div class="panel"><h2>${t('Messages','Messages')}</h2><p class="chart-empty">${t('Loading…','Chargement…')}</p></div>`;
 const dept=profile.department||'';
 const threads=[];
 if(dept)threads.push({id:'dept:'+dept,label:`${dept} · ${t('department','département')}`,scope:'department'});
 const partners=new Map();
 for(const m of msgRows){
  if(m.data.scope!=='direct')continue;
  const other=m.data.fromId===profile.id?m.data.toId:m.data.fromId;
  const label=m.data.fromId===profile.id?m.data.toName:m.data.fromName;
  if(other&&!partners.has(other))partners.set(other,label||name(other));
 }
 for(const [id,label] of partners)threads.push({id:'direct:'+id,label,scope:'direct'});
 const active=msgThread||threads[0]?.id||'';
 const inThreadRows=msgRows.filter(m=>{
  if(active.startsWith('dept:'))return m.data.scope==='department'&&m.data.department===active.slice(5);
  const who=active.slice(7);
  return m.data.scope==='direct'&&(m.data.fromId===who||m.data.toId===who);
 }).sort((a,b)=>String(a.data.at||'').localeCompare(String(b.data.at||'')));

 const list_=threads.map(x=>`<button class="msg-thread${x.id===active?' selected':''}" data-action="msg-open" data-id="${esc(x.id)}">${esc(x.label)}</button>`).join('')
  ||`<p class="muted small">${t('No conversations yet.','Aucune conversation.')}</p>`;
 const bubbles=inThreadRows.map(m=>`<div class="msg${m.data.fromId===profile.id?' mine':''}">
   <span class="msg-who">${esc(m.data.fromId===profile.id?t('You','Vous'):m.data.fromName||name(m.data.fromId))}</span>
   <p>${esc(m.data.body)}</p><span class="msg-at">${esc(String(m.data.at||'').slice(0,16).replace('T',' '))}</span></div>`).join('')
  ||`<p class="chart-empty">${t('No messages in this conversation yet.','Aucun message dans cette conversation.')}</p>`;

 return `<div class="panel"><div class="row"><h2>${t('Messages','Messages')}</h2>
   <div class="actions">${button(t('Write to a colleague','Écrire à un collègue'),'msg-new','secondary')}</div></div>
  <p class="notice">${t('These conversations are between the staff in them and are not shown to the principal in the portal. They are not encrypted: whoever administers the school database can read them there. Do not use this for anything that must stay truly private.','Ces conversations ne sont pas affichées au proviseur dans le portail, mais elles ne sont pas chiffrées : l’administrateur de la base de données peut les lire. N’y placez rien qui doive rester strictement confidentiel.')}</p>
  <div class="msg-wrap"><aside class="msg-list">${list_}</aside>
   <div class="msg-panel"><div class="msg-scroll">${bubbles}</div>
    ${active?`<form id="msg-form" data-thread="${esc(active)}"><textarea name="body" rows="2" required placeholder="${esc(t('Write a message','Écrire un message'))}"></textarea><button class="primary">${t('Send','Envoyer')}</button></form>`:''}
   </div></div></div>`;
}

// --- Analytics ----------------------------------------------------------------
// Every figure is shown with the count it came from. A class with no roll call
// reads as "no records", never as 0%, because the two mean opposite things.
const previousYear=()=>{const [a,b]=academicYear().split('/').map(Number);return `${a-1}/${b-1}`;};
const pctText=v=>v===null||v===undefined?'—':v+'%';
const toneFor=(v,good,fair)=>v===null?'':v>=good?'good':v>=fair?'fair':'poor';

function analyticsView(report){
 const {attendance:a,results:r,coverage:c,range}=report;
 const period=`${esc(range.from)} → ${esc(range.to)}`;
 const target=Number(a.watchBelow)||80;

 const heading=`<div class="panel an-head"><div><p class="eyebrow">${t('PERIOD','PÉRIODE')}</p><h2>${period}</h2>
  <p class="muted small">${esc(anScope==='school'||anScope==='school attendance'?t('Whole school','Tout l’établissement'):anScope==='attendance'?t('Attendance across the school','Assiduité de l’établissement'):t('Your own classes only','Vos classes uniquement'))}${anClass?' · '+esc(anClass):''}${anSubject?' · '+esc(anSubject):''}</p></div></div>`;

 // --- attendance ---
 const kpis=`<div class="stats an-stats">
  ${statTile(t('Attendance','Assiduité'),a.overall.rate,{unit:'%',note:`${a.overall.counted} ${t('lessons recorded','présences enregistrées')}`,tone:toneFor(a.overall.rate,90,80)})}
  ${statTile(t('Absences','Absences'),a.overall.absent,{note:`${a.overall.late} ${t('late','retards')} · ${a.overall.excused} ${t('excused','justifiées')}`})}
  ${statTile(t('Students below target','Élèves sous le seuil'),a.watchlist.length,{note:`${t('under','moins de')} ${target}%`,tone:a.watchlist.length?'poor':'good'})}
  ${statTile(t('Roll call taken','Appels faits'),c.rate,{unit:'%',note:`${c.taken} ${t('of','sur')} ${c.expected} ${t('lessons','cours')}`,tone:toneFor(c.rate,90,75)})}
 </div>`;

 const attendanceSection=`<div class="panel">
  <h3>${t('Attendance over time','Évolution de l’assiduité')}</h3>
  <p class="muted small">${t('Each point is one week. Present and late both count as attended; excused absences are left out of the rate.','Chaque point représente une semaine. Présences et retards comptent comme présence ; les absences justifiées sont exclues du taux.')}</p>
  ${lineChart(a.byWeek.map(w=>({key:w.key.slice(5),value:w.rate,note:`${w.counted} lessons`})),{label:t('Weekly attendance rate','Taux hebdomadaire')})}
  <h3>${t('By subject','Par matière')}</h3>
  ${barChart(a.bySubject.map(x=>({key:x.key,value:x.rate,note:`${x.counted} ${t('student lesson records','présences enregistrées')}`})),{target,label:t('Attendance by subject','Assiduité par matière')})}
  <h3>${t('By class and subject','Par classe et matière')}</h3>
  ${a.byClassSubject.length?`<div class="table-scroll"><table><thead><tr><th>${t('Class','Classe')}</th><th>${t('Subject','Matière')}</th><th>${t('Attendance rate','Taux de présence')}</th><th>${t('Present','Présents')}</th><th>${t('Absent','Absents')}</th><th>${t('Late','Retards')}</th><th>${t('Excused','Justifiées')}</th><th>${t('Records','Enregistrements')}</th></tr></thead><tbody>${a.byClassSubject.map(x=>`<tr><td>${esc(x.class)}</td><td>${esc(x.subject)}</td><td>${pctText(x.rate)}</td><td>${x.present}</td><td>${x.absent}</td><td>${x.late}</td><td>${x.excused}</td><td>${x.total}</td></tr>`).join('')}</tbody></table></div>`:empty(t('No recorded attendance for this selection.','Aucune présence enregistrée pour cette sélection.'))}
  <h3>${t('By class','Par classe')}</h3>
  ${barChart(a.byClass.map(x=>({key:x.key,value:x.rate,note:`${x.counted} lessons`})),{target,label:t('Attendance by class','Assiduité par classe')})}
  <p class="muted small">${t(`The dashed line is the ${target}% target. A class in red is below it.`,`La ligne pointillée marque le seuil de ${target} %. Une classe en rouge est en dessous.`)}</p>
  ${figureTable(a.byClass.map(x=>({key:x.key,value:x})),{headings:[t('Class','Classe'),t('Rate · present · late · absent · excused','Taux · présents · retards · absents · justifiées')],format:x=>`${pctText(x.value.rate)} · ${x.value.present} · ${x.value.late} · ${x.value.absent} · ${x.value.excused}`})}
  <div class="an-two">
   <div><h3>${t('By day of the week','Par jour')}</h3>
    ${columnChart(a.byWeekday.filter(d=>d.counted).map(d=>({key:d.key.slice(0,3),value:d.rate,note:`${d.counted} lessons`})),{target,label:t('Attendance by weekday','Assiduité par jour')})}</div>
   <div><h3>${t('By period of the day','Par période')}</h3>
    ${a.byPeriod.length?columnChart(a.byPeriod.map(x=>({key:'P'+x.key,value:x.rate,note:`${x.counted} lessons`})),{target,label:t('Attendance by period','Assiduité par période')}):`<p class="chart-empty">${t('Needs a published timetable to match lessons to periods.','Nécessite un emploi du temps publié pour rattacher les cours aux périodes.')}</p>`}</div>
  </div>
  ${a.byGender.length===2?`<h3>${t('Girls and boys','Filles et garçons')}</h3><div class="stats an-stats">${a.byGender.map(g=>statTile(g.key,g.rate,{unit:'%',note:`${g.counted} ${t('lessons','présences')}`,tone:toneFor(g.rate,90,80)})).join('')}</div>`:''}
 </div>`;

 const watch=`<div class="panel">
  <h3>${t('Attendance watchlist','Élèves à suivre')}</h3>
  <p class="muted small">${t(`Students below ${target}% with at least ${a.minLessons} lessons on record. A student with only one or two lessons recorded is left out — the percentage would mean nothing.`,`Élèves sous ${target} % avec au moins ${a.minLessons} cours enregistrés. Les élèves ayant très peu de cours enregistrés sont exclus : le pourcentage n’aurait pas de sens.`)}</p>
  ${a.watchlist.length?`<div class="table-scroll"><table><thead><tr><th>${t('Student','Élève')}</th><th>${t('Class','Classe')}</th><th>${t('Rate','Taux')}</th><th>${t('Absent','Absences')}</th><th>${t('Late','Retards')}</th><th>${t('Lessons','Cours')}</th></tr></thead><tbody>
   ${a.watchlist.slice(0,60).map(s=>`<tr><td>${esc(s.name||'—')}</td><td>${esc(s.class||'—')}</td><td><b class="low">${pctText(s.rate)}</b></td><td>${s.absent}</td><td>${s.late}</td><td>${s.counted}</td></tr>`).join('')}
  </tbody></table></div>${a.watchlist.length>60?`<p class="muted small">${t('Showing the 60 lowest.','Les 60 taux les plus faibles sont affichés.')}</p>`:''}`
  :`<p class="chart-empty">${t('No student is below the threshold in this period.','Aucun élève sous le seuil sur cette période.')}</p>`}
 </div>`;

 // --- results ---
 const resultsSection=`<div class="panel">
  <h3>${t('Results','Résultats')} · ${esc(range.year||'—')}</h3>
  ${r.overall.count?`<div class="stats an-stats">
   ${statTile(t('Average','Moyenne'),r.overall.average,{unit:'/20',note:`${r.overall.count} ${t('published marks','notes publiées')}`,tone:toneFor(r.overall.average*5,70,50)})}
   ${statTile(t('Pass rate','Taux de réussite'),r.overall.passRate,{unit:'%',note:`${r.overall.pass} ${t('marks at 10 or above','notes ≥ 10')}`,tone:toneFor(r.overall.passRate,70,50)})}
   ${statTile(t('Subjects','Matières'),r.subjects,{note:`${r.classes} ${t('classes','classes')}`})}
  </div>
  <h3>${t('Average by subject','Moyenne par matière')}</h3>
  ${barChart(r.bySubject.map(x=>({key:x.key,value:x.average,note:`${x.count} marks · ${pctText(x.passRate)} pass`})),{max:20,unit:'',target:10,label:t('Average by subject','Moyenne par matière')})}
  <p class="muted small">${t('Out of 20. The dashed line is the pass mark; a subject in red is averaging a fail.','Sur 20. La ligne pointillée marque la moyenne de passage ; une matière en rouge est sous la moyenne.')}</p>
  ${figureTable(r.bySubject.map(x=>({key:x.key,value:x})),{headings:[t('Subject','Matière'),t('Average · pass rate · marks · lowest · highest','Moyenne · réussite · notes · min · max')],format:x=>`${x.value.average}/20 · ${pctText(x.value.passRate)} · ${x.value.count} · ${x.value.lowest} · ${x.value.highest}`})}
  <div class="an-two">
   <div><h3>${t('Spread of marks','Répartition des notes')}</h3>
    ${columnChart(r.distribution.map(d=>({key:d.key,value:d.count})),{max:Math.max(1,...r.distribution.map(d=>d.count)),unit:'',label:t('Mark distribution','Répartition des notes')})}
    <p class="muted small">${t('Number of marks in each band, out of 20.','Nombre de notes par tranche, sur 20.')}</p></div>
   <div><h3>${t('By class','Par classe')}</h3>
    ${barChart(r.byClass.map(x=>({key:x.key,value:x.average,note:`${x.count} marks`})),{max:20,unit:'',target:10,label:t('Average by class','Moyenne par classe')})}</div>
  </div>
  ${r.sequences.length>1?`<h3>${t('Across the sequences','Évolution par séquence')}</h3>
   ${lineChart(r.sequences.map(x=>({key:x.key.replace('Sequence','Seq'),value:x.average,note:`${x.count} marks`})),{unit:'/20',max:20,min:0,label:t('Average by sequence','Moyenne par séquence')})}`:''}`
  :`<p class="chart-empty">${t('No published marks for this year yet. Publish marks in Marks & report cards and they will appear here.','Aucune note publiée pour cette année. Publiez des notes dans Évaluations et bulletins pour les voir ici.')}</p>`}
 </div>`;

 // --- coverage ---
 const coverageSection=`<div class="panel">
  <h3>${t('Roll-call coverage','Suivi des appels')}</h3>
  <p class="muted small">${t(`Of the lessons the timetable places on the ${c.schoolDays} days the school recorded anything, how many had a roll call taken. A day with no roll call anywhere is treated as a holiday and not counted, so a whole day the school forgot the register is invisible here.`,`Parmi les cours prévus à l’emploi du temps sur les ${c.schoolDays} jours où l’établissement a enregistré quelque chose, part de ceux dont l’appel a été fait. Une journée sans aucun appel est considérée comme non travaillée.`)}</p>
  ${c.expected?`<div class="an-two">
   <div><h3>${t('By class','Par classe')}</h3>${barChart(c.byClass.map(x=>({key:x.key,value:x.rate,note:`${x.taken}/${x.expected}`})),{target:80,label:t('Coverage by class','Suivi par classe')})}</div>
   <div><h3>${t('Lessons missed','Appels manquants')}</h3>${columnChart(c.byTeacher.slice(0,8).map(x=>({key:shorten(x.name,10),value:x.missed,note:`${x.taken}/${x.expected} taken`})),{max:Math.max(1,...c.byTeacher.map(x=>x.missed)),unit:'',label:t('Lessons without a roll call','Cours sans appel')})}
   <p class="muted small">${t('The eight teachers with the most lessons where no roll call was recorded.','Les huit enseignants ayant le plus de cours sans appel enregistré.')}</p></div>
  </div>
  <div class="table-scroll"><table><thead><tr><th>${t('Teacher','Enseignant')}</th><th>${t('Taken','Faits')}</th><th>${t('Expected','Prévus')}</th><th>${t('Missed','Manquants')}</th><th>${t('Rate','Taux')}</th></tr></thead><tbody>
   ${c.byTeacher.map(x=>`<tr><td>${esc(x.name)}</td><td>${x.taken}</td><td>${x.expected}</td><td>${x.missed}</td><td><b class="${x.rate!==null&&x.rate<80?'low':''}">${pctText(x.rate)}</b></td></tr>`).join('')}
  </tbody></table></div>`
  :`<p class="chart-empty">${t('Needs a published timetable and some attendance records before coverage can be measured.','Nécessite un emploi du temps publié et des présences enregistrées.')}</p>`}
 </div>`;

 return heading+kpis+attendanceSection+(anSummaryOnly?'':watch+resultsSection)+coverageSection;
}

// --- Printed timetable sheets -------------------------------------------------
// Two layouts, matching the sheets the school already prints: one page per class,
// and one sheet per teacher with their weekly subject totals beside the grid.
const printedYear=()=>portalYear.replace('/','-');
function timetableHead(){
 return `<thead><tr><th class="tt-corner"></th>${timetablePeriods.map((p,i)=>`${i===4?`<th class="tt-break-head">BREAK<small>${clockTime(timetableBreak.start)}<br>${clockTime(timetableBreak.end)}</small></th>`:''}<th><b>${p.n}</b><small>${clockTime(p.start)}<br>${clockTime(p.end)}</small></th>`).join('')}</tr></thead>`;
}
function timetableCell(cell,subjects,showClass){
 if(!cell.lessons.length)return `<td colspan="${cell.span}"></td>`;
 const split=cell.lessons.length>1;
 // A lesson that belongs to a group carries its label, whether or not the cell is
 // split: on a class sheet a combined lesson looks ordinary otherwise, and the
 // students would not know they are sitting it with another class.
 const lesson=(e,i)=>`<div class="tt-lesson">${split||(e.group&&!showClass)?`<span class="tt-group">${esc(e.group||'Group '+(i+1))}</span>`:''}<b>${esc(subjectCode(e.subject,subjects))}</b>${showClass?`<span class="tt-class">${esc(String(e.class||'').toUpperCase())}</span>`:''}<small>${esc(name(e.teacherId))}</small></div>`;
 return `<td colspan="${cell.span}" class="tt-cell${split?' tt-split':''}${cell.span===1?' tt-narrow':''}">${cell.lessons.map(lesson).join('')}</td>`;
}
function timetableGrid(entries,subjects,{mergeEmpty=false,showClass=false,shortDays=false}={}){
 const body=timetableDays.map((day,d)=>{
  const cells=timetableRow(entries,day,{mergeEmpty});
  const before=cells.filter(c=>c.from<4),after=cells.filter(c=>c.from>=4);
  const cell=c=>timetableCell(c,subjects,showClass);
  return `<tr><th class="tt-day${shortDays?' short':' upright'}"><span>${esc(shortDays?day.slice(0,2):day)}</span></th>${before.map(cell).join('')}${d===0?'<td class="tt-break-body" rowspan="5"><span>BREAK</span></td>':''}${after.map(cell).join('')}</tr>`;
 }).join('');
 return `<table class="tt">${timetableHead()}<tbody>${body}</tbody></table>`;
}
function classSheet(cls,entries,subjects){
 const mine=timetableFor(entries,{class:cls}).entries;
 return `<article class="print-page tt-sheet"><header class="tt-head"><img src="/crest.jpg" alt=""><div><p class="tt-banner">GHS MBONJO LIMBE CLASS TIMETABLE ${esc(printedYear())}</p><h1>${esc(cls.toUpperCase())}</h1><p class="tt-sub">GHS MBONJO LIMBE</p></div></header>${timetableGrid(mine,subjects,{shortDays:true})}<footer class="tt-foot"><span>HOD\`S SIGNATURE-${esc(academicYear())}</span><span>GHS Mbonjo Limbe</span></footer></article>`;
}
function teacherSheet(teacherId,entries,subjects){
 const {entries:mine,subjects:counts,total}=timetableFor(entries,{teacherId});
 const panel=`<table class="tt-counts"><thead><tr><th>Subjects</th><th>Count</th></tr></thead><tbody>${counts.map(c=>`<tr><td>${esc(c.subject.toUpperCase())}</td><td>${c.count}</td></tr>`).join('')}${counts.length?'':'<tr><td colspan="2" class="tt-none">No lessons assigned</td></tr>'}</tbody><tfoot><tr><th>Lessons/week</th><td>${total}</td></tr></tfoot></table>`;
 return `<article class="print-page tt-sheet tt-teacher"><header class="tt-head centred"><div><h1>Timetable: ${esc(name(teacherId))}</h1><p class="tt-sub">GOVERNMENT HIGH SCHOOL MBONJO LIMBE ${esc(printedYear())}</p></div></header><p class="tt-corner-label">GHS MBONJO LIMBE</p><div class="tt-body">${timetableGrid(mine,subjects,{mergeEmpty:true,showClass:true})}${panel}</div><footer class="tt-foot"><span>HOD\`S SIGNATURE-${esc(academicYear())}</span></footer></article>`;
}
// --- Generation preferences ---------------------------------------------------
// One panel holding everything the school decides before generating: the school-wide
// limits, a row per subject and a row per teacher. It opens with whatever was used
// last time, which is stored inside the timetable record itself.
function savedPreferences(){
 const latest=list('timetable').map(x=>x.data).filter(d=>d&&d.preferences).pop();
 return normalizePreferences(latest?.preferences||{form5End:latest?.form5End});
}
function teachingStaff(){
 const ids=new Set(list('assignment').map(r=>r.data.teacherId));
 return [...ids].map(id=>[id,name(id)]).filter(x=>x[1]).sort((a,b)=>a[1].localeCompare(b[1]));
}
// One group: which classes, which subjects, and how they relate. Multi-select
// boxes rather than checkbox grids, because a school has sixteen classes and forty
// subjects and the row has to stay readable on a phone.
function groupRow(g,i,used){
 const pick=(field,values,chosen,size)=>`<select name="grp:${i}:${field}" multiple size="${Math.min(size,Math.max(3,values.length))}">${values.map(v=>`<option value="${esc(v)}" ${chosen.includes(v)?'selected':''}>${esc(v)}</option>`).join('')}</select>`;
 return `<fieldset class="tt-group"><legend>${t('Group','Groupe')} ${i+1}</legend>
  <div class="form-grid">
   <label class="wide">${t('Name it','Nom')}<input name="grp:${i}:name" value="${esc(g.name||'')}" maxlength="60" placeholder="${esc(t('Form 5 options','Options Form 5'))}"></label>
   <label>${t('Classes','Classes')}${pick('classes',classes,g.classes||[],6)}<small>${t('Hold Ctrl, or tap, to choose more than one.','Maintenez Ctrl, ou appuyez, pour en choisir plusieurs.')}</small></label>
   <label>${t('Subjects','Matières')}${pick('subjects',used,g.subjects||[],6)}</label>
   <label>${t('How the subjects run','Relation entre les matières')}<select name="grp:${i}:mode">${options([
     ['parallel',t('At the same time — students split between halls','En même temps — les élèves se répartissent')],
     ['sameDay',t('On the same day where possible','Le même jour si possible')],
     ['apart',t('Separately — this group only joins the classes','Séparément — ce groupe ne fait que réunir les classes')]],g.mode||'parallel')}</select></label>
   <label class="tt-join"><input type="checkbox" name="grp:${i}:merge" ${g.merge?'checked':''}><span>${t('Teach the chosen classes together as one lesson','Réunir les classes choisies en un seul cours')}</span></label>
  </div>
  <div class="actions">${button(t('Remove this group','Supprimer ce groupe'),'tt-group-remove','secondary',`data-index="${i}"`)}</div></fieldset>`;
}
// The group rows are edited before anything is saved, so the panel keeps its own
// draft of them. It is seeded from the last generated timetable and thrown away
// once a new one is generated, so the panel always reopens on what was actually used.
let ttGroups=null;
const subjectsInUse=()=>[...new Set(list('assignment').map(r=>r.data.subject))].sort();
// The rows exactly as they stand in the form, including ones still being filled in.
// normalizePreferences would drop those, which is right when generating and wrong
// when the head of school has just pressed Add and not chosen anything yet.
function readGroups(form){
 const out=new Map();
 for(const [key,value] of new FormData(form).entries()){
  const i=key.indexOf(':'),j=key.lastIndexOf(':');
  if(i<0||j<=i||key.slice(0,i)!=='grp')continue;
  const id=key.slice(i+1,j),field=key.slice(j+1);
  if(!out.has(id))out.set(id,{name:'',classes:[],subjects:[],mode:'parallel',merge:false});
  const g=out.get(id);
  if(field==='name')g.name=value;
  if(field==='mode')g.mode=value;
  if(field==='merge')g.merge=true;
  if(field==='classes')g.classes.push(value);
  if(field==='subjects')g.subjects.push(value);
 }
 // A row whose every box is empty still exists in the form; keep it, since the
 // person is in the middle of filling it.
 return [...out.keys()].sort((a,b)=>Number(a)-Number(b)).map(k=>out.get(k));
}
function drawGroups(){
 const box=$('#tt-groups');
 if(box)box.innerHTML=(ttGroups||[]).map((g,i)=>groupRow(g,i,subjectsInUse())).join('');
}
function timetablePanel(subjects){
 const p=savedPreferences();
 const used=subjectsInUse();
 if(ttGroups===null)ttGroups=p.groups.map(g=>({...g}));
 const num=(key,label,val,min,max,hint='')=>`<label>${esc(label)}<input type="number" name="${key}" value="${esc(val)}" min="${min}" max="${max}" step="1" required>${hint?`<small>${esc(hint)}</small>`:''}</label>`;
 const periodChoices=timetablePeriods.map(x=>[String(x.n),`${x.n} · ends ${clockTime(x.end)}`]);
 const subjectRows=used.map(n=>{
  const v=p.subjects[n]||{pattern:'auto',morning:false,maxPerDay:null};
  return `<tr><td>${esc(n)}</td>
   <td><select name="sub:${esc(n)}:pattern">${options([['auto',t('Automatic','Automatique')],['double',t('Doubles','Blocs de deux')],['single',t('Singles only','Périodes simples')]],v.pattern)}</select></td>
   <td class="tt-tick"><input type="checkbox" name="sub:${esc(n)}:morning" ${v.morning?'checked':''} aria-label="${esc(n)} ${esc(t('prefer mornings','de préférence le matin'))}"></td>
   <td><input type="number" name="sub:${esc(n)}:maxPerDay" value="${v.maxPerDay??''}" min="1" max="4" step="1" placeholder="${p.maxSubjectPerDay}"></td>
   <td><input type="number" name="sub:${esc(n)}:maxPerWeek" value="${v.maxPerWeek??''}" min="1" max="30" step="1" placeholder="${p.maxSubjectPerWeek}"></td></tr>`;
 }).join('');
 // Each teacher's week as it currently stands, printed beside the limits that
 // shape it. A teacher who comes in five days for eleven periods is visible here,
 // and the box to fix it is on the same row.
 const current=allTimetableEntries();
 const staffRows=teachingStaff().map(([id,nm])=>{
  const v=p.teachers[id]||{off:[],maxDays:null,maxPerDay:null};
  const w=current.length?teacherWeekCost(current,id):null;
  return `<tr><td>${esc(nm)}</td>
   <td class="tt-days">${timetableDays.map(d=>`<label title="${esc(d)}"><input type="checkbox" name="stf:${esc(id)}:off" value="${d}" ${v.off.includes(d)?'checked':''}><span>${d.slice(0,2)}</span></label>`).join('')}</td>
   <td><input type="number" name="stf:${esc(id)}:maxDays" value="${v.maxDays??''}" min="1" max="5" step="1" placeholder="${p.maxTeacherDays}"></td>
   <td><input type="number" name="stf:${esc(id)}:maxPerDay" value="${v.maxPerDay??''}" min="1" max="10" step="1" placeholder="${p.maxTeacherPerDay}"></td>
   <td class="tt-now">${w&&w.days?`<b class="${w.days>=5?'low':'ok'}">${w.days}</b> ${t('days','jours')} · ${w.gaps} ${t('free','libres')}`:'—'}</td></tr>`;
 }).join('');
 const groupRows=ttGroups.map((g,i)=>groupRow(g,i,used)).join('');
 return `<form id="timetable-form" class="panel tt-prefs">
  <h2>${t('Timetable preferences','Préférences de l’emploi du temps')}</h2>
  <p class="muted">${t('Set these before generating. They are saved with the timetable and reopen here next time.','À définir avant la génération. Elles sont enregistrées avec l’emploi du temps et réapparaissent ici.')}</p>
  <p class="notice">${t('50-minute periods · Break 10:50–11:20 · Wednesday ends 13:00 for everyone. Forms 1 to 4 close at 14:40, so periods 9 and 10 exist only for Form 5 on the 16:00 setting and for Sixth Form.','Périodes de 50 minutes · Pause 10h50–11h20 · Mercredi : fin à 13h00 pour tous. Les classes de 6e à 3e terminent à 14h40 ; les périodes 9 et 10 ne concernent donc que la Form 5 (option 16h00) et le Sixth Form.')}</p>
  <div class="form-grid">
   <label>${t('Form 5 closing time','Heure de fin, Form 5')}<select name="form5End" required>${options([['880','14:40'],['960','16:00']],String(p.form5End))}</select></label>
   <label>${t('Latest period used','Dernière période utilisée')}<select name="lastPeriod">${options(periodChoices,String(p.lastPeriod))}</select><small>${t('Leave at 10 to use the full day where a class has one.','Laisser à 10 pour utiliser toute la journée lorsque la classe le permet.')}</small></label>
   ${num('maxSubjectPerDay',t('Most periods of one subject a class may have in a day','Périodes maximales d’une matière par jour et par classe'),p.maxSubjectPerDay,1,4,t('2 allows one double period.','2 autorise un bloc de deux.'))}
   ${num('maxSubjectPerWeek',t('Most periods of one subject a class may have in a week','Périodes maximales d’une matière par semaine et par classe'),p.maxSubjectPerWeek,1,30,t('A guard against a mistyped assignment.','Garde-fou contre une saisie erronée.'))}
   ${num('maxTeacherPerDay',t('Most periods a teacher may teach in a day','Périodes maximales par jour et par enseignant'),p.maxTeacherPerDay,1,10,t('A Form 1 to 4 day is 8 periods. Lowering this spreads a teacher over more days.','Une journée de la 6e à la 3e compte 8 périodes. Réduire ce nombre étale l’enseignant sur davantage de jours.'))}
   ${num('maxTeacherDays',t('Most days a teacher comes to school','Jours de présence maximaux par enseignant'),p.maxTeacherDays,1,5,t('Applies to every teacher unless their own row says otherwise.','S’applique à tous, sauf indication contraire dans leur ligne.'))}
  </div>
  <details class="tt-more"${ttGroups.length?' open':''}><summary>${t('Groups: subjects at the same time, classes taught together','Groupes : matières simultanées, classes réunies')} · ${ttGroups.length}</summary>
   <p class="muted small">${t('A group does two things, and they combine. Subjects set to run at the same time share the period: Form 5A periods 3 and 4 can be Commerce and Geography at once, the students splitting between two halls. Classes taught together sit one lesson with one teacher, so Form 5A and Form 5B take that Commerce period in the same room.','Un groupe fait deux choses, et elles se combinent. Les matières simultanées partagent la période : les périodes 3 et 4 de la Form 5A peuvent être Commerce et Géographie en même temps, les élèves se répartissant entre deux salles. Les classes réunies suivent un seul cours avec un seul enseignant.')}</p>
   <div id="tt-groups">${groupRows}</div>
   ${button(t('+ Add a group','+ Ajouter un groupe'),'tt-group-add','secondary')}
   <p class="muted small">${t('Subjects running at the same time must have the same number of periods a week, and classes taught together must share one teacher and the same number of periods. The generator says which line to correct if they do not.','Les matières simultanées doivent avoir le même volume hebdomadaire, et les classes réunies le même enseignant et le même volume. Le générateur indique la ligne à corriger le cas échéant.')}</p>
  </details>
  <details class="tt-more"${used.length?'':' hidden'}><summary>${t('Per subject','Par matière')} · ${used.length}</summary>
   <div class="table-scroll"><table><thead><tr><th>${t('Subject','Matière')}</th><th>${t('Blocks','Blocs')}</th><th>${t('Morning','Matin')}</th><th>${t('Max a day','Max/jour')}</th><th>${t('Max a week','Max/semaine')}</th></tr></thead><tbody>${subjectRows}</tbody></table></div>
   <p class="muted small">${t('Blocks: Automatic pairs periods where the weekly count allows. Singles only suits Physical Education or Manual Labour. Morning is a preference, not a rule — a full week will still place the subject later rather than fail.','Blocs : « Automatique » regroupe les périodes lorsque le volume le permet. « Périodes simples » convient à l’EPS ou au travail manuel. « Matin » est une préférence : une semaine chargée placera malgré tout la matière plus tard.')}</p>
  </details>
  <details class="tt-more"${staffRows?'':' hidden'}><summary>${t('Per teacher','Par enseignant')} · ${teachingStaff().length}</summary>
   <div class="table-scroll"><table><thead><tr><th>${t('Teacher','Enseignant')}</th><th>${t('Days they cannot come','Jours d’indisponibilité')}</th><th>${t('Max days','Jours max')}</th><th>${t('Max a day','Max/jour')}</th><th>${t('Week now','Semaine actuelle')}</th></tr></thead><tbody>${staffRows}</tbody></table></div>
   <p class="muted small">${t('Tick a day to keep that teacher free of lessons on it. Leave the two numbers empty to use the school-wide setting above. Week now is that teacher in the timetable as it stands — days in school, and free periods sitting between their lessons. To bring a scattered teacher in on fewer days, put that number in their Max days box and generate again.','Cochez un jour pour libérer totalement cet enseignant. Laissez les deux nombres vides pour appliquer le réglage général. « Semaine actuelle » indique les jours de présence et les heures creuses dans l’emploi du temps en place : pour resserrer, indiquez un nombre de jours maximum et régénérez.')}</p>
  </details>
  <div class="actions"><button class="primary">${t('Generate from teacher assignments','Générer à partir des affectations')}</button>${button(t('Reset to defaults','Réinitialiser'),'tt-defaults','secondary')}</div>
  <p class="muted small">${t('Lessons are placed in doubles where the weekly count allows, and each teacher’s periods are grouped so they attend on as few days as possible.','Les cours sont placés en blocs de deux lorsque le volume horaire le permet, et les périodes de chaque enseignant sont regroupées afin de réduire le nombre de jours de présence.')}</p>
 </form>`;
}
// Reads the panel back into the shape the server expects.
function readPreferences(form){
 const f=new FormData(form),out=defaultPreferences(),subjects={},teachers={},groups=new Map();
 for(const k of ['form5End','lastPeriod','maxSubjectPerDay','maxSubjectPerWeek','maxTeacherPerDay','maxTeacherDays'])if(f.get(k)!==null)out[k]=Number(f.get(k));
 // A subject name can contain a colon, so only the first two separators are split.
 const parts=key=>{const i=key.indexOf(':'),j=key.lastIndexOf(':');return i<0||j<=i?null:[key.slice(0,i),key.slice(i+1,j),key.slice(j+1)];};
 for(const [key,value] of f.entries()){
  const split=parts(key);
  if(!split)continue;
  const [tag,id,field]=split;
  if(tag==='sub'){subjects[id]=subjects[id]||{pattern:'auto',morning:false,maxPerDay:null,maxPerWeek:null};
   if(field==='pattern')subjects[id].pattern=value;
   if(field==='morning')subjects[id].morning=true;
   if(field==='maxPerDay')subjects[id].maxPerDay=value===''?null:Number(value);
   if(field==='maxPerWeek')subjects[id].maxPerWeek=value===''?null:Number(value);}
  if(tag==='stf'){teachers[id]=teachers[id]||{off:[],maxDays:null,maxPerDay:null};
   if(field==='off')teachers[id].off.push(value);
   if(field==='maxDays')teachers[id].maxDays=value===''?null:Number(value);
   if(field==='maxPerDay')teachers[id].maxPerDay=value===''?null:Number(value);}
  if(tag==='grp'){
   if(!groups.has(id))groups.set(id,{name:'',classes:[],subjects:[],mode:'parallel',merge:false});
   const g=groups.get(id);
   if(field==='name')g.name=value;
   if(field==='mode')g.mode=value;
   if(field==='merge')g.merge=true;
   if(field==='classes')g.classes.push(value);
   if(field==='subjects')g.subjects.push(value);}
 }
 return normalizePreferences({...out,subjects,teachers,groups:[...groups.values()]});
}
function allTimetableEntries(){return list('timetable').flatMap(x=>x.data.entries||[]);}
function timetableClasses(entries){return [...new Set(entries.map(e=>e.class))].sort();}
function timetableTeachers(entries){return [...new Set(entries.map(e=>e.teacherId))].map(id=>[id,name(id)]).sort((a,b)=>a[1].localeCompare(b[1]));}
function readableArticle(text){return esc(text).replace(/^### (.+)$/gm,'<h3>$1</h3>').replace(/^## (.+)$/gm,'<h2>$1</h2>').replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>');}
function render(){document.documentElement.lang=lang;const route=routeName();document.title=(route==='home'?'GHS Mbonjo Limbe':route.replaceAll('/',' · '))+' | Government High School';document.querySelector('meta[name=description]').content=route==='home'?'Government High School Mbonjo Limbe. School news, departments, admissions and secure portal.':'GHS Mbonjo Limbe: '+route.replaceAll('/',' ');$('#app').innerHTML=header()+`${route!=='home'?`<div class="breadcrumb">${link(t('Home','Accueil'),'home')}<span>/</span><span>${esc(route.split('/')[0])}</span>${route==='portal'?link(t('School website','Site du lycée'),'home'):link(t('School portal','Portail scolaire'),profile?'portal':'login')}</div>`:''}<main id="main">${route==='portal'?portal():publicPage(route)}</main>`+footer()+`<nav class="mobile-dock" aria-label="Quick navigation">${link(t('Home','Accueil'),'home')}${link(t('Academics','Études'),'departments')}${link(t('Calendar','Calendrier'),'calendar')}${link(t('Portal','Portail'),profile?'portal':'login')}</nav>`;document.querySelectorAll('main > section, .news-card').forEach(el=>el.classList.add('section-reveal'));if(route.startsWith('verify/')&&$('#verify-form'))$('#verify-form').requestSubmit();}
function modal(title,body){const d=$('#modal');d.innerHTML=`<div class="modal-heading"><h2 id="dialog-title">${esc(title)}</h2>${button('×','close','close','aria-label="Close dialog"')}</div>${body}`;d.setAttribute('aria-labelledby','dialog-title');if(!d.open)d.showModal();}
const field=(key,type='text',values=null,required=false)=>({key,type,values,required});
function fields(kind){const myClasses=permittedClasses();const staff=()=>list('profile').map(r=>[r.id,r.data.name]),students=()=>studentsInYear(rows,portalYear).map(r=>[r.id,`${r.data.name} · ${r.data.class}`]);const subjects=availableSubjects(rows).filter(x=>['principal','vp'].includes(profile.role)||x.department===profile.department||assignmentsInYear(rows,portalYear).some(a=>a.data.teacherId===profile.id&&a.data.subject===x.name)).map(x=>x.name);const f=field;const status=f('status','select',['draft','pending','published','rejected'],true);return {
 classroom:[f('name','text',null,true),f('stream','select',['General','Arts','Science'],true),f('subjects','multiselect',availableSubjects(rows).map(x=>[x.name,x.name])),f('active','select',['true','false'])],
 subject:[f('name','text',null,true),f('code'),f('department','select',departments,true),f('group','select',['shared','arts','science','elective']),f('coefficient','number',null,true)],
 profile:[f('teachingSubjects','multiselect',availableSubjects(rows).map(x=>[x.name,x.name])),f('name','text',null,true),f('matricule'),f('authId'),f('role','select',postOptions(lang),true),f('officeLabel'),f('contentCreator','select',['false','true']),f('department','select',['',...departments]),f('active','select',['true','false']),f('birthDate','date'),f('birthPlace'),f('gender','select',['','Female','Male']),f('publicServiceDate','date'),f('schoolAssumptionDate','date'),f('rank'),f('salaryIndex'),f('phone'),f('whatsapp'),f('bio','textarea'),f('children','multiselect',students()),f('photo','image'),f('signature','image')],
 student:[f('academicYear','select',[portalYear],true),f('name','text',null,true),f('matricule','text',null,true),f('class','select',classes,true),f('birthDate','date',null,true),f('birthPlace','text',null,true),f('gender','select',['Female','Male'],true),f('phone'),f('subjects','multiselect',availableSubjects(rows).map(x=>[x.name,x.name])),f('status','select',['active','promoted','demoted','dismissed','transferred out','graduated']),f('photo','image')],
 assignment:[f('year','select',[portalYear],true),f('teacherId','select',staff(),true),f('class','select',classes,true),f('subject','select',subjects,true),f('department','select',departments,true),f('periods','number',null,true)],
 resource:[f('title','text',null,true),f('type','select',['note','quiz','test','assignment','homework'],true),f('class','select',classes,true),f('subject','select',subjects,true),f('department','select',departments,true),f('body','textarea'),f('attachment','file'),f('durationMinutes','number'),f('submissionMode','select',['online','in class'],true),f('dueDate','date'),status,f('reviewComment','textarea')],
 mark:[f('studentId','select',students(),true),f('class','select',myClasses,true),f('subject','select',subjects,true),f('assessment','select',controls.markWindows?.[portalYear]?.assessment&&controls.markWindows[portalYear].assessment!=='all'?[controls.markWindows[portalYear].assessment]:[...Array.from({length:6},(_,i)=>`Sequence ${i+1}`),'Promotion exam'],true),f('year','select',[portalYear],true),f('mark','number',null,true),f('coefficient','number',null,true),f('grade','select',['','A','B','C','D','E','U']),status,f('remark')],
 post:[f('title','text',null,true),f('titleFr'),f('category','select',['Announcement','School life','Official visits','Meeting'],true),f('date','date'),f('body','textarea',null,true),f('bodyFr','textarea'),status],
 event:[f('title','text',null,true),f('titleFr'),f('date','date',null,true),f('endDate','date'),f('time','time'),f('location'),f('category','select',['Meeting','Examination','School activity','Official visit']),f('body','textarea',null,true),f('bodyFr','textarea'),status],
 gallery:[f('title','text',null,true),f('titleFr'),f('department','select',departments,true),f('image','image',null,true),status],
 textbook:[f('title','text',null,true),f('class','select',classes,true),f('subject','select',subjects,true),f('author'),f('edition'),status],
 document:[f('profileId','select',[['','Choose staff member'],...staff()]),f('kind','select',['assumption','resumption','effective service'],true),f('year','text',null,true),f('action','select',['assumed','resumed'],true),f('name','text',null,true),f('matricule','text',null,true),f('rank','text',null,true),f('salaryIndex','text',null,true),f('decision','text',null,true),f('position','text',null,true),f('principal','text',null,true),f('dutyDate','date',null,true),f('issueDate','date',null,true),f('reference','text',null,true)]}[kind]||[];}
function edit(kind,row=null,defaults={}){if(kind==='mark'&&!['principal','vp'].includes(profile.role)&&!markEntryAllowed(controls,row?.data||{year:portalYear,assessment:controls.markWindows?.[portalYear]?.assessment==='all'?'Sequence 1':controls.markWindows?.[portalYear]?.assessment})){toast(t('Mark entry is closed. Ask the principal or vice-principal.','La saisie est fermée. Contactez le proviseur ou le censeur.'));return;}if(kind==='submission'){modal('Review student work',`<div class="prose">${esc(row.data.body)}</div><form id="feedback-form" data-id="${row.id}"><label>Feedback<textarea name="feedback" rows="5">${esc(row.data.feedback||'')}</textarea></label><label>Score / comment<input name="score" value="${esc(row.data.score||'')}"></label><button class="primary">Save feedback</button></form>`);return;}const d={status:'draft',role:'teacher',active:true,contentCreator:false,year:portalYear,academicYear:studentYear==='unassigned'?academicYear():studentYear,principal:profile?.name,issueDate:today(),...row?.data,...defaults};if(kind==='mark'&&!row){const a=assignmentsInYear(rows,portalYear).find(r=>['principal','vp'].includes(profile.role)||r.data.teacherId===profile.id);d.class=marksClass||a?.data.class||permittedClasses()[0];d.subject=assignmentsInYear(rows,portalYear).find(r=>r.data.class===d.class&&(['principal','vp'].includes(profile.role)||r.data.teacherId===profile.id))?.data.subject||'';d.coefficient=availableSubjects(rows).find(r=>r.name===d.subject)?.coefficient||1;}const own=kind==='profile'&&profile.role!=='principal';const lockedMark=kind==='mark'&&row&&!markEntryAllowed(controls,row.data);const defs=fields(kind).filter(f=>(!lockedMark||f.key==='status')&&(!own||!['authId','role','department','active','children','matricule','contentCreator','officeLabel'].includes(f.key)));modal(t('Edit ','Modifier ')+label(kind),`<form id="record-form" data-kind="${kind}" data-id="${row?.id||''}" data-request="${esc(d.requestId||'')}" data-version="${row?.version||''}"><div class="form-grid">${lockedMark?`<p class="wide">${t('Mark entry is closed for this assessment. You can publish or withdraw this saved result.','La saisie est fermée pour cette évaluation. Vous pouvez publier ou retirer ce résultat.')}<br>${esc(name(d.studentId))} · ${esc(d.subject)} · ${esc(d.assessment)} · ${esc(d.mark)}/20</p>`:''}${defs.map(f=>{let v=d[f.key]??'';if(Array.isArray(v))v=v.join(', ');return `<label class="${f.type==='textarea'?'wide':''}">${esc(label(f.key))}${f.required?' *':''}${f.type==='multiselect'?`<select name="${f.key}" multiple size="5">${f.values.map(([id,n])=>`<option value="${esc(id)}" ${(d[f.key]||[]).includes(id)?'selected':''}>${esc(n)}</option>`).join('')}</select>`:f.type==='select'?`<select name="${f.key}" ${f.required?'required':''}>${options(f.values,v)}</select>`:f.type==='textarea'?`<textarea rows="5" name="${f.key}" ${f.required?'required':''}>${esc(v)}</textarea>`:f.type==='file'?`<input type="file" name="${f.key}" accept="application/pdf"><small>PDF notes, maximum 2 MB. Leave empty to keep an existing upload.</small>`:f.type==='image'?`<input type="file" name="${f.key}" accept="image/jpeg,image/png,image/webp" ${f.required&&!v?'required':''}><small>JPEG, PNG or WebP · max 1 MB</small>`:`<input name="${f.key}" type="${f.type}" value="${esc(v)}" ${f.required?'required':''} ${f.type==='number'?'step="any"':''}>`}</label>`}).join('')}</div>${kind==='resource'?questionEditor(d.questions||[]):kind==='classroom'?button('Suggest subjects for this stream','suggest-subjects','secondary'):''}<div class="actions"><button class="primary">${kind==='document'?t('Issue document','Délivrer le document'):t('Save record','Enregistrer')}</button>${button(t('Cancel','Annuler'),'close','secondary')}</div><p class="error" id="form-error" role="alert"></p></form>`);if(kind==='mark'&&!lockedMark)syncMarkChoices(d.studentId);simplifyForm(kind);}
async function readImage(file){if(file.size>1000000)throw Error('Image must be smaller than 1 MB.');if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('Use JPEG, PNG or WebP.');return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file)});}
function schoolLetterhead(){const block=a=>a.map((line,i)=>`<div class="${i===1?'motto':''}">${esc(line)}</div>`).join('');return `<div class="letterhead"><div>${block(letterheadEN)}</div><img src="/crest.jpg" alt="School crest"><div>${block(letterheadFR)}</div></div>`;}
async function documentHTML(d){const url=location.origin+'/verify/'+d.token;const qr=await QRCode.toDataURL(url,{width:180,margin:1});return `<article class="print-page attestation">${schoolLetterhead()}<div class="doc-register">Reg. No. 6CE1GSAD110491113</div><div class="doc-reference"><span>Ref. No. ${esc(d.reference)}</span><span>LIMBE, ${esc(displayDate(d.issueDate))}</span></div><h2 class="document-title">${esc(d.kind==='letter'?d.title:documentTitles[d.kind])}</h2>${d.year?`<p class="doc-year">ACADEMIC YEAR ${esc(d.year)}</p>`:''}${d.status==='revoked'?'<h2>REVOKED / RÉVOQUÉ</h2>':''}<div class="document-fields">${d.kind==='letter'?`<div class="document-body">${esc(d.body)}</div>`:documentLines(d).map(l=>`<div class="document-field"><div>${esc(l.en)}<strong>${esc(l.value)}</strong>${esc(l.tail||'')}</div><div class="field-fr">${esc(l.fr)}</div></div>`).join('')}</div><div class="document-bottom"><figure class="verification-foot"><img src="${qr}" alt="QR verification code"><figcaption>Verify this document</figcaption></figure><div class="signature"><p>THE PRINCIPAL / LE PROVISEUR</p><div class="signature-space"></div><strong>${esc(d.principal)}</strong></div></div></article>`;}
let exportDocuments=[];
function printView(html,documents=[]){exportDocuments=documents;modal(t('Print preview','Aperçu avant impression'),`<div class="actions no-print">${button(t('Print','Imprimer'),'print','primary')}${documents.length?button('Save PDF','export-documents','secondary','data-format="pdf"')+button('Save Word (.docx)','export-documents','secondary','data-format="docx"'):''}</div><p class="no-print small">${t('For browser PDF, choose Save as PDF. If your browser adds a page address, turn off Headers and footers in print settings. Documents use the bundled Tinos font.','Pour un PDF, choisissez Enregistrer au format PDF. Désactivez les en-têtes et pieds de page du navigateur. Les documents utilisent la police Tinos intégrée.')}</p><div id="print-content">${html}</div>`);}
// The two printed sheets are built by src/report-layout.js from the figures the
// server worked out. All this does is hand it the teacher for each subject, which
// only the browser's copy of the assignment register knows.
function teacherFor(cls){return subject=>{const a=assignmentsInYear(rows,marksYear).find(r=>r.data.class===cls&&r.data.subject===subject);return a?name(a.data.teacherId):'';};}

let importDraft=[];
function csvRows(text){const result=[];let row=[],cell='',quoted=false;for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){row.push(cell);cell='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(x=>x.trim()))result.push(row);row=[];cell='';}else cell+=c;}row.push(cell);if(row.some(x=>x.trim()))result.push(row);if(quoted)throw Error('Unclosed quote in CSV.');return result;}
// Reads a spreadsheet or CSV into a plain array of rows. ExcelJS is loaded only
// when an .xlsx actually arrives, so the chunk stays out of the initial download.
async function readSheet(file){
 if(!file)throw Error('Choose a file first.');
 if(file.size>4000000)throw Error('Use a file smaller than 4 MB.');
 if(file.name.toLowerCase().endsWith('.xlsx')){
  const ExcelJS=(await import('exceljs')).default;
  const w=new ExcelJS.Workbook();await w.xlsx.load(await file.arrayBuffer());
  const matrix=[];
  w.worksheets[0].eachRow(r=>matrix.push(r.values.slice(1).map(v=>v instanceof Date?v.toISOString().slice(0,10):typeof v==='object'&&v!==null?v.text||v.result||'':v)));
  return matrix;
 }
 return csvRows(await file.text());
}
async function prepareImport(file,kind,dateOrder){const matrix=await readSheet(file);
 const start=matrix.findIndex(r=>r.some(v=>/^(name|student|full name)$/i.test(String(v).trim())));if(start<0)throw Error('A Name or Student header is required.');const headers=matrix[start].map(x=>String(x).trim().toLowerCase());const aliases={student:'name','full name':'name','date of birth':'birthDate','place of birth':'birthPlace','phone number':'phone','whatsapp number':'whatsapp','mat. no or eci':'matricule','sex':'gender','date of entry into pub. service':'publicServiceDate','date of entry into present position':'schoolAssumptionDate','salary index':'salaryIndex','telephone number':'phone'};const keys=fields(kind).map(f=>f.key);importDraft=matrix.slice(start+1).filter(r=>r.some(x=>x)).map((r,i)=>{const d={};headers.forEach((h,j)=>{const k=aliases[h]||keys.find(k=>k.toLowerCase()===h);if(k)d[k]=String(r[j]??'').trim();});d.name=d.name?.trim();d.matricule=normalizeMatricule(d.matricule);d.gender=d.gender==='F'?'Female':d.gender==='M'?'Male':d.gender;if(kind==='student'){d.status='active';if(!classes.includes(d.class))d.class='';}else{d.role='teacher';d.active=true;d.contentCreator=false;d.department=departments.includes(d.department)?d.department:'';delete d.authId;}
 for(const k of ['birthDate','publicServiceDate','schoolAssumptionDate'])if(d[k]&&/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(d[k])){const a=d[k].split('/');d[k]=`${a[2]}-${(dateOrder==='dmy'?a[1]:a[0]).padStart(2,'0')}-${(dateOrder==='dmy'?a[0]:a[1]).padStart(2,'0')}`;}
 const errors=[];if(!d.name)errors.push('Missing name');if(kind==='student'&&(!d.matricule||!d.class||!d.birthDate||!d.birthPlace||!['Male','Female'].includes(d.gender)))errors.push('Missing or invalid required student field');if(d.birthDate&&(!/^\d{4}-\d{2}-\d{2}$/.test(d.birthDate)||!Number.isFinite(Date.parse(d.birthDate))))errors.push('Invalid date');if(d.matricule&&list(kind).some(x=>normalizeMatricule(x.data.matricule)===d.matricule))errors.push('Matricule already exists');return {data:d,row:i+start+2,errors};});
 const seen=new Set();for(const r of importDraft){if(r.data.matricule&&seen.has(r.data.matricule))r.errors.push('Duplicate matricule in file');seen.add(r.data.matricule);}
 $('#import-preview').innerHTML=`<p>${importDraft.length} records · ${importDraft.filter(x=>x.errors.length).length} with errors. ${kind==='profile'?'All staff import as teachers without login access; assign roles and Auth IDs after review.':''}</p><div class="table-scroll"><table><thead><tr><th>Row</th><th>Name</th><th>Matricule</th><th>Date of birth</th><th>Review</th></tr></thead><tbody>${importDraft.map(r=>`<tr><td>${r.row}</td><td>${esc(r.data.name)}</td><td>${esc(r.data.matricule)}</td><td>${esc(r.data.birthDate)}</td><td>${esc(r.errors.join('; ')||'Ready')}</td></tr>`).join('')}</tbody></table></div>${button('Confirm import','confirm-import','primary',`data-kind="${kind}" ${importDraft.some(x=>x.errors.length)||!importDraft.length?'disabled':''}`)}`;
}
let rollRequest=0;
async function rollCall(){const request=++rollRequest,a=byId($('#roll-assignment').value),date=$('#roll-date').value;if(!a){$('#roll-list').innerHTML='';return;}$('#roll-list').innerHTML=`<p role="status">${t('Loading the class register...','Chargement de la liste...')}</p>`;try{const result=await api('attendance-register',{assignmentId:a.id,date});if(request!==rollRequest||!$('#roll-list'))return;rows=rows.filter(r=>!(r.kind==='attendance'&&r.data.assignmentId===a.id&&r.data.date===date)).concat(result.rows);const students=studentsInYear(rows,portalYear).filter(s=>s.data.class===a.data.class&&studies(s.data,a.data.subject)&&!['dismissed','transferred out','graduated'].includes(s.data.status)).sort((a,b)=>a.data.name.localeCompare(b.data.name));$('#roll-list').innerHTML=attendanceGrid(students,list('attendance'),{assignmentId:a.id,date,lang});updateRollCount();}catch(err){if(request===rollRequest&&$('#roll-list'))$('#roll-list').innerHTML=`<p class="error" role="alert">${esc(err.message)}</p>`;}}
function updateRollCount(){const f=$('#roll-form'),counter=$('#roll-count');if(!f||!counter)return;const total=new Set([...f.querySelectorAll('input[type=radio]')].map(r=>r.name)).size,marked=f.querySelectorAll('input[type=radio]:checked').length;counter.textContent=t(`${marked} of ${total} students marked`,`${marked} élèves renseignés sur ${total}`);}

let contactsCache=[];
function colleaguePicker(){const depts=[...new Set(contactsCache.map(c=>c.department))].sort();$('#colleague-picker').innerHTML=`<label>Department<select id="contact-department"><option value="">Choose department</option>${options(depts)}</select></label><label>Colleague<select id="contact-person"><option value="">Choose a department first</option></select></label>${button('Review WhatsApp message','whatsapp-review','primary')}`;}
function writingDocument(){const body=$('#ai-result').value.trim();if(!body)throw Error('Write or generate the document text first.');return {kind:'letter',title:$('#writing-title').value.trim()||'School message',body,issueDate:today()};}
async function saveDocuments(documents,format){const models=documents.map(d=>exportModel(d,location.origin)),assets=await loadExportAssets();const blob=await (format==='docx'?makeDocx(models,assets):makePdf(models,assets));downloadBlob(blob,`GHS-Mbonjo-${documents.length>1?'documents':(documents[0].reference||'message').replace(/[^a-z0-9-]/gi,'-')}.${format}`);}
document.addEventListener('click',async e=>{const el=e.target.closest('[data-action]');if(!el)return;const action=el.dataset.action,id=el.dataset.id;if(['tab','refresh','logout','language'].includes(action)&&hasUnsavedMarks()&&!confirm(t('Leave without saving the changed marks?','Quitter sans enregistrer les notes modifiées ?')))return;try{
 if(action==='import-calendar'){modal('Import supplied school calendar',`<p>Import ${calendarSeed.length} entries from the supplied calendar. Clear entries publish immediately. Uncertain entries remain drafts for date review.</p>${button('Import activities','confirm-calendar','primary')}`);}
 if(action==='confirm-calendar'){el.disabled=true;let count=0;for(const item of calendarSeed){if(list('event').some(r=>r.data.sourceId===item.data.sourceId))continue;await api('save',{kind:'event',data:item.data});count++;}await refresh();const pub=await api('public');publicRows=pub.rows;calendarOverrides=pub.calendarOverrides||[];$('#modal').close();toast(`${count} activities imported.`);}
 if(action==='contacts'){contactsCache=(await api('contacts')).contacts;colleaguePicker();}
 if(action==='whatsapp-review'){const selected=$('#contact-person')?.value,message=$('#ai-result').value;const fresh=(await api('contacts')).contacts.find(c=>c.id===selected);if(!fresh)throw Error('Choose a colleague from your permitted departments.');const url=whatsappLink(fresh.phone,message);modal('Review WhatsApp message',`<p><strong>${esc(fresh.name)}</strong><br>${esc(fresh.department)}<br>${esc(fresh.phone)}</p><div class="prose">${esc(message)}</div><a class="primary" href="${esc(url)}" target="_blank" rel="noopener noreferrer">Open WhatsApp</a><p>You send the message in WhatsApp. No message has been sent by this website.</p>`);}
 if(action==='export-writing')await saveDocuments([writingDocument()],el.dataset.format);
 if(action==='export-documents')await saveDocuments(exportDocuments,el.dataset.format);
 if(action==='print-writing'){const d=writingDocument();printView(`<article class="print-page">${schoolLetterhead()}<p>Limbe, ${esc(d.issueDate)}</p><h2 class="document-title">${esc(d.title)}</h2><div class="document-body">${esc(d.body)}</div></article>`,[d]);}
 if(action==='language'){lang=lang==='en'?'fr':'en';localStorage.setItem('school-language',lang);render();}
 if(action==='menu'){const open=$('#nav').classList.toggle('open');el.setAttribute('aria-expanded',String(open));}
 if(action==='close')$('#modal').close();
 if(action==='tab'){tab=el.dataset.tab;if(tab==='messages'&&!msgLoaded)loadMessages().then(render);if(!globalThis.SCHOOL_PREVIEW)history.pushState({},'','/portal?tab='+tab);render();window.scrollTo(0,0);}
 if(action==='refresh')await refresh();
 if(action==='logout'){await api('logout');profile=null;rows=[];navigate('login');render();}
 if(action==='official-letter')officialLetter();
 if(action==='request-document')modal('Request a school document',`<form id="request-form"><label>Document<select name="requestType">${options(requestTypes)}</select></label><label>Duty date, if applicable<input type="date" name="dutyDate"></label><label>Purpose / details<textarea name="purpose" required maxlength="2000" rows="4"></textarea></label><p>The principal reviews your request and confirms the official details before issuing it.</p><button class="primary">Submit request</button></form>`);
 if(action==='reject-request'){const old=byId(id);modal('Decline document request',`<form id="reject-request-form" data-id="${id}"><p>${esc(old.data.name)} · ${esc(old.data.requestType)}</p><label>Reason<textarea name="reviewComment" required></textarea></label><button class="primary">Decline request</button></form>`);}
 if(action==='fulfil-request'){const request=byId(id),staff=byId(request.data.requesterId);if(request.data.requestType==='employment confirmation')officialLetter(request);else edit('document',null,{...staff?.data,profileId:request.data.requesterId,kind:request.data.requestType,requestId:id,principal:profile.name,dutyDate:request.data.dutyDate||staff?.data.schoolAssumptionDate,position:staff?.data.department?staff.data.department+' Teacher':'Teacher',status:'draft',name:staff?.data.name||request.data.name});}
 if(action==='cancel-request'){const old=byId(id);await api('save',{kind:'document_request',id,version:old.version,data:{...old.data,status:'cancelled'}});await refresh();}
 if(action==='new')edit(el.dataset.kind);
 if(action==='edit'){const row=byId(id);edit(row.kind,row);}
 if(action==='public-detail'){const r=[...publicRows,...calendarSeed].find(r=>r.id===id);const d=r?.data||archive.find(r=>r.id===id);modal(localized(d,'title'),`<div class="prose">${readableArticle(localized(d,'body')||'')}</div>`);}
 if(action==='review-exam'){const a=byId(id),d=a.data;modal('Mark assessment',`<form id="exam-review-form" data-id="${id}"><p>Automatically marked: ${d.autoScore} / ${d.total}</p>${d.questions.map(q=>`<article class="panel"><strong>${esc(q.prompt)}</strong><p>${esc(['mcq','truefalse'].includes(q.type)?q.options[Number(d.answers[q.id])]||'No answer':d.answers[q.id]||'No answer')}</p><small>${q.points} marks</small></article>`).join('')}<label>Total awarded for written questions<input name="manualScore" type="number" min="0" step="0.5" value="${d.manualScore||0}" required></label><label>Feedback<textarea name="feedback">${esc(d.feedback||'')}</textarea></label><button class="primary">Save assessment mark</button></form>`);}
 if(action==='setup-class')edit('classroom',null,{name:el.dataset.class,stream:el.dataset.class.endsWith('B')?'Arts':el.dataset.class.includes('Science')?'Science':'General',subjects:[]});
 if(action==='add-question'){document.querySelector('#question-list').insertAdjacentHTML('beforeend',questionRow({}));}
 if(action==='remove-question')el.closest('.question-editor').remove();
 if(action==='start-exam')await startExam(id);
 if(action==='download-note'){const data=byId(id).data.attachment;downloadBlob(new Blob([Uint8Array.from(atob(data.data.split(',')[1]),c=>c.charCodeAt(0))],{type:'application/pdf'}),data.name);}
 if(action==='import-bundled-students'){el.disabled=true;let offset=0,imported=0,skipped=0;importConflicts=[];while(true){const a=await api('import-students',{offset});offset=a.next;imported+=a.imported;skipped+=a.skipped;importConflicts.push(...a.conflicts);toast(`Imported ${imported}, skipped ${skipped}`);if(!a.more)break;}await refresh();modal('Student import result',`<p>${imported} students imported. ${skipped} matching existing records skipped.</p>${importConflicts.length?`<h3>${importConflicts.length} records need a matricule review</h3>${importConflicts.map((r,i)=>`<article class="panel"><h4>${esc(r.data.name)} · ${esc(r.data.class)}</h4><p>${esc(r.reason)}</p>${button('Complete student record','resolve-import','secondary',`data-index="${i}"`)}</article>`).join('')}`:'<p>All supplied rows are accounted for.</p>'}`);}
 if(action==='resolve-import')edit('student',null,{...importConflicts[Number(el.dataset.index)].data,status:'active'});
 if(action==='suggest-subjects'){const select=$('#record-form select[name=subjects]');const recommended=recommendSubjects($('#record-form select[name=stream]').value);for(const opt of select.options)opt.selected=recommended.includes(opt.value);}
 if(action==='student-move'){const student=byId(id);modal('Change student status or class',`<form id="movement-form" data-id="${id}"><h3>${esc(student.data.name)}</h3><label>${t('Academic year','Année scolaire')}<input name="academicYear" value="${esc(portalYear)}" readonly></label><label>Action<select name="movement">${options(['transfer','promote','demote','dismiss','reinstate'])}</select></label><label>Destination class<select name="class">${options(classes,student.data.class)}</select></label><label>Reason<textarea name="reason" required></textarea></label><p>Dismissal keeps the student record and disables student access.</p><button class="primary">Save change</button></form>`);}
 if(action==='resource'){const r=byId(id),d=r.data;modal(d.title,`<p>${esc(d.class)} · ${esc(d.subject)} ${badge(d.status)}</p><div class="prose">${esc(d.body)}</div>${d.attachment?button('Download uploaded notes','download-note','secondary',`data-id="${id}"`):''}${profile.role==='student'&&d.questions?.length?button('Enter timed assessment','start-exam','primary',`data-id="${id}"`):''}<p>Submission: ${esc(d.submissionMode)} · Due: ${esc(d.dueDate||'Not set')}</p>${profile.role==='student'&&!d.questions?.length&&d.submissionMode==='online'?`<form id="submission-form" data-id="${id}"><label>Your answer<textarea name="body" required rows="6"></textarea></label><button class="primary">Submit answer</button></form>`:profile.role==='student'?(d.questions?.length?'<p>Your answers are saved online during the timed assessment.</p>':'<p>Bring your work to class for correction.</p>'):button('Edit / review','edit','primary',`data-id="${id}"`)}`);}
 if(action==='all-present'){$('#roll-list').querySelectorAll('input[type=radio][value=present]').forEach(x=>x.checked=true);updateRollCount();}
 if(action==='print'){await document.fonts.ready;await Promise.all([...document.querySelectorAll('#print-content img')].map(img=>img.decode().catch(()=>{})));window.print();}
 if(action==='print-document')printView(await documentHTML(byId(id).data),[byId(id).data]);
 if(action==='tt-defaults'){
  // Put the panel back to the defaults without saving anything: nothing changes
  // for the school until Generate is pressed.
  const form=$('#timetable-form'),d=defaultPreferences();
  for(const [k,v] of Object.entries(d))if(form.elements[k]&&typeof v!=='object')form.elements[k].value=v;
  form.querySelectorAll('input[type=checkbox]').forEach(x=>x.checked=false);
  form.querySelectorAll('select[name^="sub:"]').forEach(x=>x.value='auto');
  form.querySelectorAll('input[type=number][name^="sub:"],input[type=number][name^="stf:"]').forEach(x=>x.value='');
  ttGroups=[];drawGroups();
  toast(t('Preferences reset. Generate to apply them.','Préférences réinitialisées. Générez pour les appliquer.'));
 }
 if(action==='tt-group-add'){
  ttGroups=readGroups($('#timetable-form'));
  ttGroups.push({name:'',classes:[],subjects:[],mode:'parallel',merge:false});
  drawGroups();
  $('#tt-groups').lastElementChild?.scrollIntoView({block:'nearest'});
 }
 if(action==='tt-group-remove'){
  ttGroups=readGroups($('#timetable-form'));
  ttGroups.splice(Number(el.dataset.index),1);
  drawGroups();
 }
 if(action==='print-analytics'&&anReport)printView(`<article class="print-page an-print"><h1>GHS Mbonjo Limbe · ${esc(t('Analytics','Analyses'))}</h1><p>${esc(anFrom)} → ${esc(anTo)}${anClass?' · '+esc(anClass):''}</p>${analyticsView(anReport)}</article>`);
 // --- department documents ---
 if(action==='dept-doc-new'||action==='dept-doc-edit'){
  const old=action==='dept-doc-edit'?byId(id):null,d=old?.data||{};
  modal(old?t('Edit document','Modifier le document'):t('New department document','Nouveau document'),
   `<form id="dept-doc-form" data-id="${old?.id||''}" data-version="${old?.version||''}">
    <div class="form-grid">
     <label>${t('Title','Titre')}<input name="title" value="${esc(d.title||'')}" required maxlength="200"></label>
     <label>${t('Filed as','Classé comme')}<select name="category" required>${options(documentCategories.map(c=>[c,t(categoryLabels[c].replace(/s$/,''),categoryLabels[c])]),d.category||'report')}</select></label>
     <label>${t('Date','Date')}<input type="date" name="date" value="${esc(d.date||todayISO())}" required></label>
     <label>${t('Reference','Référence')}<input name="reference" value="${esc(d.reference||'')}" placeholder="GHS/CS/2026/01"></label>
    </div>
    <label class="wide">${t('Body','Contenu')}<textarea name="body" rows="14" required>${esc(d.body||'')}</textarea></label>
    <div class="actions"><button class="primary">${t('Save','Enregistrer')}</button>${button(t('Cancel','Annuler'),'close','secondary')}</div>
    <p class="error" id="form-error" role="alert"></p></form>`);
 }
 if(action==='dept-doc-open'){
  const r=byId(id),d=r.data,mine=d.department===profile.department;
  const signer=d.signedBy?byId(d.signedBy)?.data:null;
  modal(d.title,`<p class="muted small">${esc(categoryLabels[d.category]||d.category)} · ${esc(d.date||'')} · ${esc(name(d.authorId))}${d.reference?' · '+esc(d.reference):''}</p>
   <div class="prose">${esc(d.body)}</div>
   ${d.status==='signed'?`<div class="sign-block"><p class="muted small">${t('Signed by','Signé par')} ${esc(name(d.signedBy))}${d.signedAt?', '+esc(String(d.signedAt).slice(0,10)):''}</p>${signer?.signature?`<img class="sign-img" src="${safeImage(signer.signature)}" alt="${esc(t('Signature','Signature'))}">`:`<p class="muted small">${t('No signature image on file for that head of department.','Aucune image de signature enregistrée.')}</p>`}</div>`:''}
   <div class="actions">${button(t('Print','Imprimer'),'dept-doc-print','secondary',`data-id="${r.id}"`)}
   ${mine&&d.status!=='signed'?button(t('Edit','Modifier'),'dept-doc-edit','secondary',`data-id="${r.id}"`):''}</div>`);
 }
 if(action==='dept-doc-print'){
  const d=byId(id).data,signer=d.signedBy?byId(d.signedBy)?.data:null;
  printView(`<article class="print-page"><div class="letterhead"><div>REPUBLIC OF CAMEROON<br>Peace – Work – Fatherland<br>MINISTRY OF SECONDARY EDUCATION</div><img src="/crest.jpg" alt=""><div>RÉPUBLIQUE DU CAMEROUN<br>Paix – Travail – Patrie<br>GHS MBONJO LIMBE</div></div>
   <p class="center"><b>${esc(String(d.department||'').toUpperCase())} DEPARTMENT</b></p>
   <h2 class="document-title">${esc(d.title)}</h2>
   <p>${esc(categoryLabels[d.category]||d.category)}${d.reference?' · '+esc(d.reference):''} · ${esc(d.date||'')}</p>
   <div class="document-body">${esc(d.body)}</div>
   <div class="signature"><p>${t('Head of Department','Chef de Département')}</p>${signer?.signature?`<img class="sign-img" src="${safeImage(signer.signature)}" alt="">`:'<div class="signature-space"></div>'}<p>${esc(d.signedBy?name(d.signedBy):'')}</p></div></article>`);
 }
 if(action==='dept-doc-sign'){
  const r=byId(id);
  if(!profile.signature){modal(t('Add your signature first','Ajoutez d’abord votre signature'),`<p>${t('Open My profile and upload a signature image. It is then placed on every document you sign.','Ouvrez Mon profil et téléversez une image de signature. Elle sera apposée sur chaque document que vous signez.')}</p>`);return;}
  await api('save',{kind:'dept_document',id:r.id,version:r.version,data:{...r.data,status:'signed',signedBy:profile.id,signedAt:new Date().toISOString()}});
  await refresh();toast(t('Document signed.','Document signé.'));
 }
 if(action==='dept-doc-transmit'){
  const r=byId(id);
  modal(t('Transmit to the principal','Transmettre au proviseur'),
   `<p>${t('The principal and vice principal will be able to read this document. Transmitting cannot be undone from here.','Le proviseur et le censeur pourront lire ce document. La transmission est définitive depuis cet écran.')}</p>
    <p><b>${esc(r.data.title)}</b></p>
    <div class="actions">${button(t('Transmit','Transmettre'),'dept-doc-transmit-confirm','primary',`data-id="${r.id}"`)}${button(t('Cancel','Annuler'),'close','secondary')}</div>`);
 }
 if(action==='dept-doc-transmit-confirm'){
  const r=byId(id);
  await api('save',{kind:'dept_document',id:r.id,version:r.version,data:{...r.data,transmitted:true,transmittedAt:new Date().toISOString()}});
  $('#modal').close();await refresh();toast(t('Transmitted to the principal.','Transmis au proviseur.'));
 }
 // --- equipment ---
 if(action==='dept-item-new'){
  modal(t('Add equipment','Ajouter un équipement'),
   `<form id="dept-item-form"><div class="form-grid">
    <label>${t('Item','Article')}<input name="name" required maxlength="120" placeholder="Desktop computer"></label>
    <label>${t('Category','Catégorie')}<select name="category" required>${options(itemCategories)}</select></label>
    <label>${t('Quantity','Quantité')}<input type="number" name="quantity" value="1" min="1" max="9999" step="1" required></label>
    <label>${t('Condition','État')}<select name="condition">${options(itemConditions)}</select></label>
    <label>${t('Location','Emplacement')}<input name="location" placeholder="Computer laboratory"></label>
    <label>${t('Serial or tag','N° de série')}<input name="serial"></label>
   </div><label class="wide">${t('Note','Note')}<textarea name="note" rows="2"></textarea></label>
   <div class="actions"><button class="primary">${t('Save','Enregistrer')}</button>${button(t('Cancel','Annuler'),'close','secondary')}</div>
   <p class="error" id="form-error" role="alert"></p></form>`);
 }
 // --- progression ---
 if(action==='prog-add'){
  if(!progSheets.length){const r=await api('progression-catalogue');progSheets=r.sheets;}
  if(!progSheets.length)throw Error(t('No sheets are supplied for your subjects. Use Import a sheet instead.','Aucune fiche fournie pour vos matières. Utilisez « Importer une fiche ».'));
  // If the head of department was reading a sheet, start from that one.
  const opened=progSheets.findIndex(s=>s.subject===progView.subject&&s.class===levelOf(progView.class));
  const start=opened<0?0:opened;
  modal(t('Track a progression sheet','Suivre une fiche de progression'),
   `<form id="prog-add-form"><p>${t('These are the national and departmental sheets supplied with the app. If yours is not here, use Import a sheet instead.','Voici les fiches nationales et départementales fournies. Sinon, utilisez « Importer une fiche ».')}</p>
    <label>${t('Sheet','Fiche')}<select name="sheet" id="prog-add-sheet" required>${options(progSheets.map((x,i)=>[String(i),`${x.subject} · ${x.class} · ${x.lessons} ${t('lessons','leçons')}`]),String(start))}</select></label>
    <label>${t('Academic year','Année scolaire')}<input name="year" value="${esc(academicYear())}" required></label>
    ${splitFieldset(progSheets[start]?.class||'')}
    <p class="muted small">${t('The school week is worked out from the ministry calendar. You do not have to enter it.','La semaine en cours est déduite du calendrier ministériel. Inutile de la saisir.')}</p>
    <div class="actions"><button class="primary">${t('Start tracking','Commencer le suivi')}</button>${button(t('Cancel','Annuler'),'close','secondary')}</div>
    <p class="error" id="form-error" role="alert"></p></form>`);
 }
 if(action==='prog-import'){
  modal(t('Import a progression sheet','Importer une fiche de progression'),
   `<form id="prog-import-form"><p>${t('Upload the progression sheet. A PDF in the national format is read directly — the same format as the Computer Science and ICT sheets already in the app. An Excel or CSV version also works, and needs a heading row with at least a Lesson title column.','Téléversez la fiche de progression. Un PDF au format national est lu directement — le même format que les fiches d’informatique déjà intégrées. Une version Excel ou CSV convient aussi, avec une ligne d’en-tête comportant au moins « Lesson title ».')}</p>
    <div class="form-grid">
     <label>${t('Subject','Matière')}<input name="subject" required value="${esc(profile.department||'')}"></label>
     <label>${t('Level the sheet is written for','Niveau visé par la fiche')}<select name="level" id="prog-import-level" required>${options(levels,levelOf(progView.class)||levels[0])}</select></label>
     <label>${t('Academic year','Année scolaire')}<input name="year" value="${esc(academicYear())}" required></label>
    </div>
    ${splitFieldset(levelOf(progView.class)||levels[0])}
    <label class="wide">${t('File','Fichier')}<input type="file" name="file" accept=".pdf,.csv,.xlsx" required><small>${t('The PDF of the sheet itself, or an Excel or CSV version of it.','Le PDF de la fiche, ou une version Excel ou CSV.')}</small></label>
    <div class="actions"><button class="primary">${t('Import','Importer')}</button>${button(t('Cancel','Annuler'),'close','secondary')}</div>
    <p class="error" id="form-error" role="alert"></p></form><div id="prog-import-preview"></div>`);
 }
 if(action==='prog-import-confirm'){
  if(!progImport)return;
  const p=progImport;
  let saved=0;
  try{
   for(const cls of p.classes){
    await api('save',{kind:'progression',data:{department:profile.department,subject:p.subject,class:cls,
     year:p.year,sourceTitle:p.sourceTitle,lessons:p.lessons,taught:{}}});
    saved++;
   }
  }catch(err){await refresh();throw Error(`${saved} ${t('of','sur')} ${p.classes.length} ${t('schemes were created before stopping.','programmes créés avant l’arrêt.')} ${err.message}`);}
  progImport=null;$('#modal').close();await refresh();
  toast(`${p.lessons.length} ${t('lessons imported for','leçons importées pour')} ${p.classes.join(', ')}.`);
 }
 if(action==='prog-view'){
  const dept=deptFilter||profile.department||'';
  const cls=$('#prog-view-class')?.value||progView.class,subject=$('#prog-view-subject')?.value||progView.subject;
  await openProgressionSheet(dept,cls,subject);
  render();
 }
 if(action==='print-progression'){
  if(!progView.lessons)return;
  printView(`<h1>${esc(progView.subject)} · ${esc(progView.class)}</h1>
   <p>${esc(progView.title||'')}${progView.weeklyPeriods?` · ${progView.weeklyPeriods} periods a week`:''} · ${progView.lessons.length} lessons</p>
   <table><thead><tr><th>Term</th><th>Week</th><th>#</th><th>Lesson</th></tr></thead><tbody>
   ${progView.lessons.map(l=>`<tr><td>${esc(l.term||termOfWeek(l.week)||'')}</td><td>${esc(l.week||'')}</td><td>${esc(l.number??'')}</td><td>${esc(l.title)}</td></tr>`).join('')}
   </tbody></table>`,[]);
 }
 if(action==='prog-open'){
  const r=byId(id),d=r.data,week=weekInHand(d,today()),auto=currentWeek(today(),d.year);
  const c=coverage(d.lessons||[],d.taught||{},{currentWeek:week});
  const byWeek=new Map();
  for(const row of c.rows){const w=row.week||'—';if(!byWeek.has(w))byWeek.set(w,[]);byWeek.get(w).push(row);}
  modal(`${d.subject} · ${d.class}`,
   `<form id="prog-mark-form" data-id="${r.id}" data-version="${r.version}">
    <p class="muted small">${auto
      ?`${t('Measured against week','Mesuré par rapport à la semaine')} <b>${week}</b>${week!==auto?` (${t('entered by hand; the calendar says','saisie manuelle ; le calendrier indique')} ${auto})`:` — ${t('worked out from the ministry calendar','déduit du calendrier ministériel')}`}.`
      :t('The ministry calendar has no dates for that academic year, so the week below is used.','Le calendrier ministériel ne couvre pas cette année scolaire ; la semaine ci-dessous est utilisée.')}</p>
    <details class="tt-more"${auto?'':' open'}><summary>${t('Measure against a different week','Mesurer par rapport à une autre semaine')}</summary>
     <label>${t('Week','Semaine')}<input type="number" name="weekOverride" min="1" max="40" step="1" value="${esc(d.weekOverride||'')}"><small>${t('Leave it empty to follow the calendar.','Laissez vide pour suivre le calendrier.')}</small></label></details>
    <p class="muted small">${t('Tick a lesson once it has been taught. The date is recorded with it.','Cochez une leçon une fois traitée. La date est enregistrée.')}</p>
    <div class="prog-list">${[...byWeek].map(([w,rowsIn])=>`<fieldset><legend>${t('Week','Semaine')} ${esc(w)} · ${esc(termOfWeek(w)||'')}</legend>
      ${rowsIn.map(row=>`<label class="prog-row"><input type="checkbox" name="lesson" value="${esc(row.key)}" ${row.taught?'checked':''}>
       <span>${row.number?`<b>${esc(row.number)}.</b> `:''}${esc(row.title)}${row.record?.date?` <small class="muted">${esc(row.record.date)}</small>`:''}</span></label>`).join('')}
     </fieldset>`).join('')}</div>
    <div class="actions"><button class="primary">${t('Save','Enregistrer')}</button>${button(t('Cancel','Annuler'),'close','secondary')}</div>
    <p class="error" id="form-error" role="alert"></p></form>`);
 }
 if(action==='prog-advice'){
  const r=byId(id),d=r.data;
  const c=coverage(d.lessons||[],d.taught||{},{currentWeek:weekInHand(d,today())});
  modal(t('Asking the AI…','Demande à l’IA…'),`<p class="chart-empty">${t('Reading the coverage figures…','Lecture des chiffres de couverture…')}</p>`);
  try{
   const a=await api('ai',{prompt:coveragePrompt(c,{subject:d.subject,cls:d.class,year:d.year}),language:lang,style:''});
   await api('save',{kind:'progression',id:r.id,version:r.version,data:{...d,advice:a.text,adviceAt:new Date().toISOString()}});
   await refresh();$('#modal').close();toast(t('The AI note has been saved with the scheme.','La note de l’IA a été enregistrée.'));
  }catch(err){modal(t('The AI could not answer','L’IA n’a pas pu répondre'),`<p class="error">${esc(err.message)}</p>`);}
 }
 // --- messages ---
 if(action==='msg-open'){msgThread=id;render();}
 if(action==='msg-new'){
  modal(t('Write to a colleague','Écrire à un collègue'),
   `<form id="msg-direct-form"><label>${t('Colleague','Collègue')}<select name="toId" required>${options(msgColleagues.map(c=>[c.id,c.department?`${c.name} · ${c.department}`:c.name]))}</select></label>
    <label>${t('Message','Message')}<textarea name="body" rows="4" required maxlength="4000"></textarea></label>
    <div class="actions"><button class="primary">${t('Send','Envoyer')}</button>${button(t('Cancel','Annuler'),'close','secondary')}</div>
    <p class="error" id="form-error" role="alert"></p></form>`);
 }
 // --- save an AI draft into the department library ---
 if(action==='ai-save-department'){
  const body=$('#ai-result')?.value?.trim();
  if(!body){toast(t('Generate a draft first.','Générez d’abord un brouillon.'));return;}
  if(!profile.department){toast(t('Your profile has no department.','Aucun département associé à votre profil.'));return;}
  modal(t('Save to department documents','Enregistrer dans les documents du département'),
   `<form id="dept-doc-form" data-id="" data-version="">
    <div class="form-grid">
     <label>${t('Title','Titre')}<input name="title" value="${esc($('#writing-title')?.value||'')}" required maxlength="200"></label>
     <label>${t('Filed as','Classé comme')}<select name="category" required>${options(documentCategories.map(c=>[c,categoryLabels[c].replace(/s$/,'')]),'report')}</select></label>
     <label>${t('Date','Date')}<input type="date" name="date" value="${todayISO()}" required></label>
     <label>${t('Reference','Référence')}<input name="reference"></label>
    </div>
    <label class="wide">${t('Body','Contenu')}<textarea name="body" rows="12" required>${esc(body)}</textarea></label>
    <p class="muted small">${t('Written with AI assistance. Read it before you sign it.','Rédigé avec l’aide de l’IA. Relisez avant de signer.')}</p>
    <div class="actions"><button class="primary">${t('Save','Enregistrer')}</button>${button(t('Cancel','Annuler'),'close','secondary')}</div>
    <p class="error" id="form-error" role="alert"></p></form>`);
 }
 if(action==='print-class')printView(classSheet(id,allTimetableEntries(),availableSubjects(rows)));
 if(action==='print-teacher')printView(teacherSheet(id,allTimetableEntries(),availableSubjects(rows)));
 if(action==='print-all-classes'){const e=allTimetableEntries(),s=availableSubjects(rows);printView(timetableClasses(e).map(c=>classSheet(c,e,s)).join(''));}
 if(action==='print-all-teachers'){const e=allTimetableEntries(),s=availableSubjects(rows);printView(timetableTeachers(e).map(([tid])=>teacherSheet(tid,e,s)).join(''));}
 if(action==='revoke'){modal('Revoke document',`<p>This QR verification record will show the document as revoked. The original reference remains in the register.</p>${button('Confirm revocation','confirm-revoke','danger',`data-id="${id}"`)}`);}
 if(action==='confirm-revoke'){const old=byId(id);await api('save',{kind:'document',id,version:old.version,data:{...old.data,status:'revoked'}});$('#modal').close();await refresh();}
 if(action==='import'){importDraft=[];modal('Import '+label(el.dataset.kind),`<form id="import-form" data-kind="${el.dataset.kind}"><label>Excel (.xlsx) or CSV<input name="file" type="file" accept=".csv,.xlsx" required></label><label>Dates in the source file<select name="dateOrder">${options([['dmy','Day / Month / Year'],['mdy','Month / Day / Year']])}</select></label><p class="notice">Confirm the date order before importing. Review the converted dates below. No rows are saved until you confirm.</p><button class="primary">Preview import</button></form><div id="import-preview"></div>`);}
 if(action==='confirm-import'){el.disabled=true;let count=0;try{for(const r of importDraft){await api('save',{kind:el.dataset.kind,data:r.data});count++;}$('#modal').close();await refresh();toast(`${count} records imported.`);}catch(err){await refresh();throw Error(`${count} records saved before import stopped. Refresh the import to avoid duplicates. ${err.message}`);}}
 if(action==='ai-announcement'){const body=$('#ai-result').value;if(!body)throw Error('Generate or write a draft first.');edit('post',null,{body,category:'Announcement'});}
 if(action==='print-class-list'){const roll=classRoster(rows,{year:studentYear,stream:studentStream,cls:studentClass,studentId:studentSelection});printView(`<section class="print-page"><h1>GHS MBONJO LIMBE</h1><h2>${esc(studentClass||studentStream||'Class lists')} · ${esc(studentYear)}</h2><p>${roll.length} students</p>${listFilters('students')}${table(roll.map((r,i)=>({...r,data:{...r.data,number:i+1}})),['number','name','matricule','class','gender'],false)}</section>`);}
 if(action==='password')modal('Change password',`<form id="password-form"><label>${t('New password','Nouveau mot de passe')}<input type="password" name="password" autocomplete="new-password" minlength="12" required></label><button class="primary">${t('Change password and sign out','Changer le mot de passe et se déconnecter')}</button></form>`);


 if(action==='notifications')await openNotifications();
 if(action==='notification-push')await enablePush();
 if(action==='notification-unsubscribe'){const reg=await navigator.serviceWorker.ready,sub=await reg.pushManager.getSubscription();if(sub){await api('notification-unsubscribe',{endpoint:sub.endpoint});await sub.unsubscribe();}await openNotifications();toast(t('This device was removed.','Cet appareil a été retiré.'));}
 if(action==='notification-test'){const result=await api('notification-test');modal(t('Notification test','Test de notification'),`<p>${esc(result.results.map(r=>'Email: '+r.email+' · Push: '+r.push).join(' · '))}</p>${button(t('Back to notifications','Retour aux notifications'),'notifications','secondary')}`);}
 if(action==='account-list')await openAccounts();
 if(action==='reset-login'){const record=byId(id);modal(t('Reset school login','Réinitialiser le compte scolaire'),`<p><strong>${esc(record.data.name)}</strong> · ${esc(record.data.username||record.data.loginEmail||'')}</p><p>${t('This replaces the password and ends existing school sessions. Download the new credential and give it only to this person.','Cette action remplace le mot de passe et ferme les sessions scolaires. Téléchargez les nouveaux accès et remettez-les uniquement à cette personne.')}</p><form id="reset-login-form" data-id="${esc(id)}" data-version="${record.version}"><button type="submit" class="primary">${t('Confirm reset and download','Confirmer et télécharger')}</button>${button(t('Cancel','Annuler'),'account-list','secondary')}</form>`);}
 if(action==='provision'){modal(t('Create school login','Créer un compte scolaire'),`<form id="provision-form">${loginFilters()}<label>${t('Person','Personne')}<select name="recordId" required></select></label><label>${t('Email, if available','E-mail, si disponible')}<input name="email" type="email"></label><label>${t('Preferred first-name username, optional','Identifiant souhaité, facultatif')}<input name="username" pattern="[a-zA-Z0-9.-]+"></label><p>${t('A unique username and temporary password will be generated. The person must change their password on first sign-in. No email is sent.','Un identifiant unique et un mot de passe temporaire seront créés. La personne doit changer son mot de passe à la première connexion. Aucun e-mail n’est envoyé.')}</p><button type="submit" class="primary">${t('Create login and download credential','Créer le compte et télécharger les accès')}</button></form>`);updateLoginFilters($('#provision-form'));if(id){const person=byId(id),f=$('#provision-form');f.elements.group.value=person.kind==='student'?'students':person.data.role==='parent'?'parents':['teacher','hod'].includes(person.data.role)?'teachers':'staff';updateLoginFilters(f,true);f.elements.recordId.value=id;}}
 if(action==='bulk-provision'){modal(t('Generate temporary passwords','Créer les mots de passe temporaires'),`<form id="bulk-provision-form">${loginFilters()}<p>${t('Creates accounts only for the selected group and filters. Existing logins stay unchanged. Give each person only their own credential.','Crée des comptes pour le groupe et les filtres choisis. Les comptes existants sont conservés. Remettez à chacun uniquement ses propres accès.')}</p><button type="submit" class="primary">${t('Generate and download passwords','Créer et télécharger les mots de passe')}</button><p id="provision-progress" role="status"></p></form>`);updateLoginFilters($('#bulk-provision-form'));}

 if(action==='bulk-docs'){modal('Bulk attestations',`<p>Select staff, review their service details, then use a shared issue date and reference prefix. Each document receives its own reference and QR code.</p><form id="bulk-form"><label>Staff members<select name="staff" multiple required size="7">${options(list('profile').map(r=>[r.id,`${r.data.name} · ${r.data.matricule||'MISSING MATRICULE'}`]))}</select></label><div class="form-grid"><label>Document<select name="kind">${options(['assumption','resumption','effective service'])}</select></label><label>${t('Academic year','Année scolaire')}<input name="year" value="2026/2027" required></label><label>Duty action<select name="action">${options(['assumed','resumed'])}</select></label><label>Duty date<input type="date" name="dutyDate" required></label><label>Issue date<input type="date" name="issueDate" required value="${today()}"></label><label>Reference prefix<input name="prefix" required placeholder="GHS/2026/"></label><label>Starting number<input name="start" type="number" min="1" step="1" value="1" required></label><label>Decision number<input name="decision" required></label><label>Serving as<input name="position" required placeholder="Teacher"></label></div><button class="primary">Review batch</button></form><div id="bulk-review"></div>`);}
 if(action==='issue-batch'){el.disabled=true;const issued=[];try{for(const d of bulkDraft){const a=await api('save',{kind:'document',data:d});issued.push(a.row);}await refresh();printView((await Promise.all(issued.map(x=>documentHTML(x.data)))).join(''),issued.map(x=>x.data));}catch(err){await refresh();throw Error(`${issued.length} documents issued before stopping. View the register before retrying. ${err.message}`);}}
 }catch(err){toast(err.message);}});
let bulkDraft=[];
document.addEventListener('change',async e=>{if(e.target.matches('[data-notification-target]')){$('#notification-recipient-count').textContent=notificationTargets(e.target.form).length+' '+t('active recipients','destinataires actifs');return;}if(e.target.id==='dept-pick'){deptFilter=e.target.value;progView={class:'',subject:'',lessons:null,title:'',weeklyPeriods:0,source:'',recordId:''};render();return;}
 // The progression viewer: changing either choice puts the open sheet away, so
 // what is on screen always matches the two selects above it.
 if(e.target.id==='prog-view-class'||e.target.id==='prog-view-subject'){
  progView={class:$('#prog-view-class').value,subject:$('#prog-view-subject').value,lessons:null,title:'',weeklyPeriods:0,source:'',recordId:''};
  render();return;
 }
 // Splitting a subject: the class list follows the sheet's level, and is shown
 // only when the department has actually asked to split.
 if(e.target.id==='prog-add-sheet'||e.target.id==='prog-import-level'){
  const level=e.target.id==='prog-add-sheet'?(progSheets[Number(e.target.value)]?.class||''):e.target.value;
  const box=$('#prog-split-classes');
  if(box)box.innerHTML=classChoices(level);
  const label=e.target.form?.querySelector('.prog-split .prog-row span');
  if(label)label.innerHTML=label.innerHTML.replace(/\(([^)]*)\)/,`(${esc(levelOf(level)||'—')})`);
  return;
 }
 if(e.target.name==='scope'&&$('#prog-split-classes')){$('#prog-split-classes').hidden=e.target.value!=='split';return;}
 if(e.target.id==='tt-class'){ttClass=e.target.value;render();return;}
 if(e.target.id==='tt-teacher'){ttTeacher=e.target.value;render();return;}
 if(e.target.closest('#marks-grid-form')&&e.target.matches('select')){if(busy){e.target.value=e.target.dataset.previous||'';return;}if([...document.querySelectorAll('[data-mark-input]')].some(el=>el.value!==el.dataset.original)&&!confirm(t('Discard unsaved marks and change selection?','Abandonner les notes non enregistrées et changer la sélection ?'))){e.target.value=e.target.dataset.previous||'';return;}e.target.dataset.previous=e.target.value;try{await loadMarksGrid();}catch(error){toast(error.message);}return;}
 if(e.target.matches('[data-list-filter]')){filterVisibleList(e.target.closest('[data-list-filters]'));return;}
 if(e.target.matches('[data-login-filter]')){updateLoginFilters(e.target.form,e.target.name==='loginStream'||e.target.name==='group');return;}
 if(e.target.id==='login-mode'){const student=e.target.value==='student';$('#staff-fields').hidden=student;$('#student-fields').hidden=!student;$('#staff-fields').querySelectorAll('input').forEach(x=>x.required=!student);$('#student-fields').querySelectorAll('input').forEach(x=>x.required=student);}
 if(e.target.id==='contact-department'){const dept=e.target.value;$('#contact-person').innerHTML='<option value="">Choose colleague</option>'+options(contactsCache.filter(c=>c.department===dept).map(c=>[c.id,c.name+' · '+(c.phone||'No number')]));}
 if(e.target.id==='portal-jump'){if(hasUnsavedMarks()&&!confirm(t('Leave without saving the changed marks?','Quitter sans enregistrer les notes modifiées ?'))){e.target.value=tab;return;}tab=e.target.value;if(tab==='messages'&&!msgLoaded)loadMessages().then(render);history.pushState({},'','/portal?tab='+tab);render();window.scrollTo(0,0);}

 if(e.target.id==='student-stream'){studentStream=e.target.value;studentClass='';studentSelection='';render();}
 if(e.target.id==='student-class'){studentClass=e.target.value;studentSelection='';render();}
 if(e.target.id==='student-query'){studentSelection=e.target.value;render();}
 if(e.target.id==='gallery-filter'){filter=e.target.value;render();}
 if(e.target.closest('#roll-form'))updateRollCount();
 if(['roll-assignment','roll-date'].includes(e.target.id))await rollCall();
 if(e.target.name==='class'&&$('#record-form')?.dataset.kind==='mark')syncMarkChoices();
 if(e.target.name==='studentId'&&$('#record-form')?.dataset.kind==='mark'){const f=$('#record-form'),student=studentsInYear(rows,portalYear).find(r=>r.id===e.target.value);if(student){f.elements.class.value=student.data.class;syncMarkChoices(student.id);}}
 if(e.target.name==='profileId'&&$('#record-form')){const d=byId(e.target.value)?.data;if(d){for(const k of ['name','matricule','rank','salaryIndex'])$('#record-form').elements[k].value=d[k]||'';$('#record-form').elements.dutyDate.value=d.schoolAssumptionDate||'';$('#record-form').elements.position.value=d.department?d.department+' Teacher':d.role||'';}}
});
document.addEventListener('submit',async e=>{e.preventDefault();const form=e.target;if(busy)return;busy=true;const submit=form.querySelector('button[type="submit"],button:not([type])');if(submit)submit.disabled=true;let feedback=form.querySelector('[data-save-feedback]');if(!feedback){feedback=document.createElement('p');feedback.dataset.saveFeedback='';feedback.setAttribute('role','status');form.append(feedback);}feedback.textContent=t('Saving, please wait.','Enregistrement en cours.');try{const data=Object.fromEntries(new FormData(form));
 if(form.id==='exam-review-form'){const a=byId(form.dataset.id);await api('exam-review',{...data,studentId:a.data.studentId,resourceId:a.data.resourceId});$('#modal').close();await refresh();}
 if(form.id==='movement-form'){const old=byId(form.dataset.id);const status={transfer:'active',promote:'promoted',demote:'demoted',dismiss:'dismissed',reinstate:'active'}[data.movement];await api('save',{kind:'student',id:old.id,version:old.version,data:{...old.data,class:data.movement==='dismiss'?old.data.class:data.class,status,academicYear:data.academicYear,movementReason:data.reason,movement:data.movement}});studentYear=data.academicYear;studentClass=data.movement==='dismiss'?old.data.class:data.class;$('#modal').close();await refresh();toast('Student record updated.');}
 if(form.id==='exam-form'){await saveExam(true);}
 if(form.id==='school-year-form'){if(+data.year.slice(0,4)>+portalYear.slice(0,4)&&!controls.rollovers?.[data.year]){const plan=await api('promotion-preview',{year:data.year});modal(t('Review student advancement','Vérifier le passage des élèves'),`<p>${esc(plan.fromYear)} → ${esc(plan.toYear)}</p><p>${plan.advancing} ${t('students advance','élèves passent en classe supérieure')} · ${plan.exiting} ${t('Upper Sixth students complete school','élèves de Upper Sixth terminent le lycée')} · ${plan.held.length} ${t('records held for review','dossiers à vérifier')}</p>${table(plan.groups.map((data,i)=>({id:i,data:{from:data.from,to:data.to||t('Completed school','Fin de scolarité'),count:data.count}})),['from','to','count'],false)}${plan.held.length?`<details><summary>${t('Records needing review','Dossiers à vérifier')}</summary>${plan.held.map(r=>`<p>${esc(r.name)}: ${esc(r.reason)}</p>`).join('')}</details>`:''}<p>${t('Earlier class records are kept. Mark entry starts closed in the new year. This change applies once.','Les anciens dossiers sont conservés. La saisie des notes commence fermée. Ce passage est appliqué une seule fois.')}</p><form id="advance-year-form"><input type="hidden" name="year" value="${esc(plan.toYear)}"><input type="hidden" name="token" value="${esc(plan.token)}"><button class="primary">${t('Confirm and advance students','Confirmer le passage des élèves')}</button>${button(t('Cancel','Annuler'),'close','secondary')}<p class="error" role="alert"></p></form>`);}else{await api('school-controls',{action:'year',year:data.year,version:controls.version});studentClass='';studentSelection='';marksClass='';await refresh();toast(t('Academic year selected.','Année scolaire sélectionnée.'));}}
 if(form.id==='advance-year-form'){const result=await api('advance-year',data);$('#modal').close();studentClass='';studentSelection='';marksClass='';await refresh();toast(t(`${result.advancing} students advanced. ${result.exiting} completed school.`,`${result.advancing} élèves ont avancé. ${result.exiting} ont terminé le lycée.`));}
 if(form.id==='mark-window-form'){await api('school-controls',{action:'marks',status:data.status,assessment:data.assessment,version:controls.version});await refresh();toast(t('Mark entry setting saved.','Paramètre de saisie enregistré.'));}

 if(form.id==='notification-config-form'){await api('notification-config',data);form.reset();await openNotifications();toast(t('Gmail connected.','Gmail connecté.'));}
 if(form.id==='notification-email-form'){await api('notification-email-code',data);toast(t('Check your inbox for the verification code.','Consultez votre boîte mail pour le code.'));}
 if(form.id==='notification-verify-form'){await api('notification-email-verify',data);await openNotifications();toast(t('Your email notifications are enabled.','Vos notifications par e-mail sont activées.'));}
 if(form.id==='notification-preferences-form'){await api('notification-preferences',{emailEnabled:data.emailEnabled==='true',pushEnabled:data.pushEnabled==='true'});await openNotifications();}
 if(form.id==='notification-send-form'){const recipients=notificationTargets(form);if(!recipients.length)throw Error(t('No active recipients match.','Aucun destinataire actif ne correspond.'));if(!confirm(t(`Send this notice to ${recipients.length} active school recipients? Only enabled channels will receive it.`,`Envoyer cet avis à ${recipients.length} destinataires actifs ? Seuls les canaux activés recevront le message.`)))return;let results=[];for(let i=0;i<recipients.length;i+=20){try{const result=await api('notification-send',{title:data.title,message:data.message,recordIds:recipients.slice(i,i+20).map(r=>r.id)});results.push(...result.results);$('#notification-send-results').textContent=t(`${results.length} of ${recipients.length} processed.`,`${results.length} destinataires traités sur ${recipients.length}.`);}catch(error){throw Error(t(`${results.length} recipients processed before stopping. `,`${results.length} destinataires traités avant l’arrêt. `)+error.message);}}$('#notification-send-results').innerHTML=results.map(r=>`<p><strong>${esc(r.name)}</strong> · Email: ${esc(r.email)} · Push: ${esc(r.push)}</p>`).join('');}
 if(form.id==='reset-login-form'){const result=await api('reset-login',{recordId:form.dataset.id,version:+form.dataset.version});downloadCredentials([result.credential]);await refresh();await openAccounts();toast(t('New temporary password downloaded.','Nouveau mot de passe temporaire téléchargé.'));}
 if(form.id==='marks-grid-form'){await saveMarksGrid(form);}
 if(form.id==='marks-query'){if(hasUnsavedMarks()&&!confirm(t('Discard unsaved marks and load records?','Abandonner les notes non enregistrées et afficher les dossiers ?')))return;const result=await api('marks',data);marksYear=data.year;marksClass=data.class;rows=rows.filter(r=>r.kind!=='mark').concat(result.rows);render();toast(result.rows.length+' mark records loaded.');}
 if(form.id==='request-form'){await api('save',{kind:'document_request',data});$('#modal').close();await refresh();toast('Your request is on the principal’s dashboard.');}
 if(form.id==='reject-request-form'){const old=byId(form.dataset.id);await api('save',{kind:'document_request',id:old.id,version:old.version,data:{...old.data,...data,status:'rejected'}});$('#modal').close();await refresh();}
 if(form.id==='official-letter-form'){const a=await api('save',{kind:'document',data:{...data,kind:'letter',principal:profile.name,...(form.dataset.request?{requestId:form.dataset.request}:{})}});await refresh();printView(await documentHTML(a.row.data),[a.row.data]);}
 if(form.id==='backup-form'){
  if(data.password!==data.confirm)throw Error('The backup passwords do not match.');
  const cutoff=new Date().toISOString(),backup={format:'ghs-mbonjo-records',version:1,startedAt:cutoff,scope:'School records and audit only. No Auth passwords, provider keys or deployment secrets.',records:[],audit:[]};let size=0;
  for(const table of ['records','audit']){let offset=0;while(true){const a=await api('backup-page',{table,offset,cutoff});size+=JSON.stringify(a.rows).length;if(size>100000000)throw Error('This export exceeds the browser backup size limit. Use the Supabase database backup for this data volume.');backup[table].push(...a.rows);offset+=a.rows.length;$('#backup-progress').textContent=`Reading ${table}: ${offset} records`;if(!a.more)break;}}
  backup.finishedAt=new Date().toISOString();$('#backup-progress').textContent='Encrypting backup';const envelope=await encryptBackup(backup,data.password);downloadBlob(new Blob([JSON.stringify(envelope)],{type:'application/json'}),`GHS-Mbonjo-${today()}.ghsbackup`);form.reset();$('#backup-progress').textContent=`Downloaded ${backup.records.length} school records and ${backup.audit.length} activity entries. Keep the password separately.`;
 }
 if(form.id==='login-form'){await api('login',data);await refresh();navigate('portal');}
 if(form.id==='verify-form'){const a=await api('verify',data);$('#verification').innerHTML=`<div class="panel"><h2>${a.document.status==='issued'?t('Verified school document','Document scolaire vérifié'):t('Document revoked','Document révoqué')}</h2><p>${esc(a.document.name)}<br>${esc(a.document.reference)}<br>${esc(a.document.kind)} · ${esc(a.document.issueDate)}</p></div>`;}
 if(form.id==='record-form'){const kind=form.dataset.kind,old=byId(form.dataset.id);let d={...old?.data,...data};if(form.dataset.request)d.requestId=form.dataset.request;for(const f of fields(kind).filter(f=>f.type==='image')){const file=form.elements[f.key]?.files?.[0];if(file?.size)d[f.key]=await readImage(file);else if(old?.data[f.key])d[f.key]=old.data[f.key];else delete d[f.key];}if(kind==='profile'){if('active' in data)d.active=data.active==='true';if('contentCreator' in data)d.contentCreator=data.contentCreator==='true';if(form.elements.children)d.children=new FormData(form).getAll('children');if(form.elements.teachingSubjects)d.teachingSubjects=new FormData(form).getAll('teachingSubjects');if(d.matricule)d.matricule=normalizeMatricule(d.matricule);if(!d.authId)delete d.authId;}if(kind==='classroom'){d.subjects=new FormData(form).getAll('subjects');d.active=data.active==='true';}
 if(kind==='resource'){const file=form.elements.attachment?.files?.[0];if(file?.size){if(file.type!=='application/pdf'||file.size>2000000)throw Error('Use a PDF smaller than 2 MB.');d.attachment={name:file.name,data:'data:application/pdf;base64,'+bytesBase64(new Uint8Array(await file.arrayBuffer()))};}else if(old?.data.attachment)d.attachment=old.data.attachment;else delete d.attachment;d.questions=readQuestions(form);}
 if(kind==='student'){d.matricule=normalizeMatricule(d.matricule);d.subjects=new FormData(form).getAll('subjects');}if(['mark','assignment'].includes(kind))d.year=portalYear;await api('save',{kind,id:old?.id,version:old?.version,data:d});$('#modal').close();await refresh();toast(t('Saved successfully. You can continue.','Enregistrement réussi. Vous pouvez continuer.'));}
 if(form.id==='submission-form'){await api('save',{kind:'submission',data:{resourceId:form.dataset.id,body:data.body}});$('#modal').close();await refresh();toast('Your work has been submitted.');}
 if(form.id==='roll-form'){const a=byId($('#roll-assignment').value),date=$('#roll-date').value;let count=0;try{for(const [studentId,status] of Object.entries(data)){const old=list('attendance').find(r=>r.data.studentId===studentId&&r.data.assignmentId===a.id&&r.data.date===date);await api('save',{kind:'attendance',id:old?.id,version:old?.version,data:{studentId,status,date,class:a.data.class,assignmentId:a.id,subject:a.data.subject}});count++;if($('#roll-count'))$('#roll-count').textContent=t(`Saving ${count} of ${Object.keys(data).length} students...`,`Enregistrement de ${count} élèves sur ${Object.keys(data).length}...`);}}catch(err){await refresh();throw Error(`${count} attendance records saved before stopping. ${err.message}`);}await refresh();$('#roll-assignment').value=a.id;$('#roll-date').value=date;await rollCall();toast(t(`${count} attendance records saved successfully.`,`${count} présences enregistrées avec succès.`));}
 if(form.id==='dept-doc-form'){
  const old=form.dataset.id?byId(form.dataset.id):null;
  await api('save',{kind:'dept_document',id:old?.id,version:old?.version,
   data:{...(old?.data||{}),...data,department:profile.department,
         authorId:old?.data.authorId||profile.id,
         status:old?.data.status||'draft',transmitted:old?.data.transmitted===true}});
  $('#modal').close();await refresh();toast(t('Document saved.','Document enregistré.'));
  return;
 }
 if(form.id==='dept-item-form'){
  await api('save',{kind:'dept_item',data:{...data,department:profile.department,quantity:Number(data.quantity)||1}});
  $('#modal').close();await refresh();toast(t('Equipment added.','Équipement ajouté.'));
  return;
 }
 if(form.id==='prog-add-form'){
  const chosen=progSheets[Number(data.sheet)];
  if(!chosen)throw Error(t('Choose a sheet.','Choisissez une fiche.'));
  const key=chosen.subject+'|'+chosen.class;
  if(!progSheetCache[key]){const r=await api('progression-sheet',{subject:chosen.subject,class:chosen.class});progSheetCache[key]=r.sheet;}
  const sheet=progSheetCache[key];
  const targets=splitTargets(form,chosen.class);
  let saved=0;
  try{
   for(const cls of targets){
    await api('save',{kind:'progression',data:{department:profile.department,subject:chosen.subject,class:cls,
     year:data.year,sourceTitle:sheet.title,weeklyPeriods:sheet.weeklyPeriods,lessons:sheet.lessons,taught:{}}});
    saved++;
   }
  }catch(err){await refresh();throw Error(`${saved} ${t('of','sur')} ${targets.length} ${t('schemes were created before stopping.','programmes créés avant l’arrêt.')} ${err.message}`);}
  $('#modal').close();await refresh();
  toast(targets.length>1?`${targets.length} ${t('schemes are now tracked, one per class.','programmes suivis, un par classe.')}`:t('Now tracking that scheme.','Suivi du programme activé.'));
  return;
 }
 if(form.id==='prog-import-form'){
  const file=form.elements.file.files[0];
  const pdf=/\.pdf$/i.test(file?.name||'');
  const {lessons,sourceTitle}=pdf?await readProgressionPdf(file):{lessons:parseProgressionRows(await readSheet(file)),sourceTitle:file.name};
  // Nothing is saved until the head of department has seen what was read. A
  // progression sheet is a record, and importing the wrong thing silently would
  // be worse than not importing at all.
  progImport={lessons,sourceTitle,subject:data.subject,level:levelOf(data.level),
              classes:splitTargets(form,data.level),year:data.year};
  const d=describeImport(lessons);
  $('#prog-import-preview').innerHTML=`<h3>${t('What was read','Ce qui a été lu')}</h3>
   <div class="stats an-stats">
    ${statTile(t('Lessons','Leçons'),d.lessons,{note:`${d.numbered} ${t('numbered','numérotées')}`,tone:d.lessons>10?'good':'poor'})}
    ${statTile(t('With objectives','Avec objectifs'),d.withObjectives,{tone:d.withObjectives?'good':'fair'})}
    ${statTile(t('Terms','Trimestres'),d.terms,{note:d.firstWeek?`${t('weeks','semaines')} ${d.firstWeek}–${d.lastWeek}`:'',tone:d.terms===3?'good':'fair'})}
   </div>
   <p class="muted small">${t('Check the first lessons below against your sheet before saving.','Vérifiez les premières leçons ci-dessous avant d’enregistrer.')}</p>
   <div class="table-scroll"><table><thead><tr><th>${t('Week','Semaine')}</th><th>#</th><th>${t('Lesson','Leçon')}</th><th>${t('Objectives','Objectifs')}</th></tr></thead><tbody>
    ${lessons.slice(0,12).map(l=>`<tr><td>${esc(l.week||'—')}</td><td>${esc(l.number??'—')}</td><td>${esc(l.title)}</td><td>${l.objectives.length}</td></tr>`).join('')}
   </tbody></table></div>
   ${lessons.length>12?`<p class="muted small">${t('and','et')} ${lessons.length-12} ${t('more.','de plus.')}</p>`:''}
   <div class="actions">${button(t('Save this scheme','Enregistrer ce programme'),'prog-import-confirm','primary')}${button(t('Cancel','Annuler'),'close','secondary')}</div>`;
  return;
 }
 if(form.id==='prog-mark-form'){
  const r=byId(form.dataset.id),d=r.data;
  const ticked=new Set(new FormData(form).getAll('lesson'));
  const taught={...(d.taught||{})};
  (d.lessons||[]).forEach((lesson,i)=>{
   const k=lessonKey(lesson,i);
   if(ticked.has(k)){if(!taught[k])taught[k]={date:todayISO(),by:profile.id};}
   else delete taught[k];
  });
  await api('save',{kind:'progression',id:r.id,version:r.version,data:{...d,taught,weekOverride:Number(data.weekOverride)||null}});
  $('#modal').close();await refresh();toast(t('Coverage updated.','Couverture mise à jour.'));
  return;
 }
 if(form.id==='msg-form'){
  const thread=form.dataset.thread;
  const payload=thread.startsWith('dept:')
   ?{scope:'department',department:thread.slice(5)}
   :{scope:'direct',toId:thread.slice(7)};
  await api('save',{kind:'message',data:{...payload,fromId:profile.id,body:data.body,at:new Date().toISOString()}});
  form.reset();await loadMessages();render();
  return;
 }
 if(form.id==='msg-direct-form'){
  await api('save',{kind:'message',data:{scope:'direct',toId:data.toId,fromId:profile.id,body:data.body,at:new Date().toISOString()}});
  msgThread='direct:'+data.toId;$('#modal').close();await loadMessages();render();
  return;
 }
 if(form.id==='analytics-form'){
  anFrom=data.from;anTo=data.to;anClass=data.class||'';anSubject=data.subject||'';anYear=data.year||academicYear();
  anBusy=true;anError='';render();
  try{
   const r=await api('analytics',{from:anFrom,to:anTo,class:anClass||undefined,subject:anSubject||undefined,year:anYear});
   anReport=r.report;anScope=r.scope;anSummaryOnly=!!r.summaryOnly;
  }catch(err){anReport=null;anError=err.message;}
  finally{anBusy=false;render();}
  return;
 }
 if(form.id==='timetable-form'){
  const preferences=readPreferences(form);
  const r=await api('timetable',{preferences,year:portalYear});
  // The panel reopens on what was actually used, not on the draft.
  ttGroups=null;
  await refresh();
  const entries=r.row?.data?.entries||[];
  const joint=new Set(entries.filter(e=>e.unit).map(e=>e.unit)).size;
  toast(t(`Timetable generated: ${entries.length} periods placed, no teacher or class in two places at once.${joint?` ${joint} grouped lessons.`:''}`,
          `Emploi du temps généré : ${entries.length} périodes placées, sans conflit.${joint?` ${joint} cours groupés.`:''}`));
 }
 if(form.id==='bulk-provision-form'){
  const pending=loginCandidates(form);let credentials=[],done=0;const errors=[];
  try{for(const record of pending){try{const result=await api('provision',{recordId:record.id});credentials.push(result.credential);done++;}catch(error){errors.push(record.data.name+': '+error.message);}$('#provision-progress').textContent=`${done} created, ${errors.length} requiring review, ${pending.length} selected`;if(credentials.length===20){downloadCredentials(credentials);credentials=[];}}}
  finally{if(credentials.length)downloadCredentials(credentials);}
  $('#provision-progress').textContent=`${done} accounts created. ${errors.length} require review.`;if(errors.length)downloadBlob(new Blob([errors.join('\n')],{type:'text/plain'}),'GHS-login-review.txt');const state=await api('state');rows=state.rows;
 }
 if(form.id==='provision-form'){const result=await api('provision',data);downloadCredentials([result.credential]);$('#modal').close();await refresh();toast('Login created. Credential downloaded.');}
 if(form.id==='password-form'){if(data.confirm!==undefined&&data.password!==data.confirm)throw Error('Passwords do not match.');await api('password',data);$('#modal')?.close();profile=null;rows=[];navigate('login');render();toast('Password changed. Please sign in.');}
 if(form.id==='feedback-form'){const old=byId(form.dataset.id);await api('save',{kind:'submission',id:old.id,version:old.version,data:{...old.data,...data}});$('#modal').close();await refresh();}
 if(form.id==='settings-form'){await api('ai-settings',data);form.reset();toast('Encrypted AI settings saved.');}
 if(form.id==='ai-form'){const a=await api('ai',data);$('#ai-result').value=a.text;}
 if(form.id==='import-form'){if(data.file.size>10000000)throw Error('Import file must be smaller than 10 MB.');await prepareImport(data.file,form.dataset.kind,data.dateOrder);}
 if(form.id==='report-form'){
  const a=await api('reports',data);
  const report=a.report;
  if(!report||!report.sheets.length)throw Error(t('No students were found for that class and year.','Aucun élève trouvé pour cette classe et cette année.'));
  if(!report.assessed)throw Error(t('No published marks for that selection. Publish the marks first.','Aucune note publiée pour cette sélection. Publiez d’abord les notes.'));
  const opts={year:data.year,assessment:data.assessment,cls:data.class,teacherOf:teacherFor(data.class)};
  printView(data.output==='master'
   ?masterSheetHTML(report,{...opts,showMarks:data.master==='marks'})
   :report.sheets.map(sheet=>reportCardHTML(sheet,report,opts)).join(''));
 }
 if(form.id==='bulk-form'){bulkDraft=new FormData(form).getAll('staff').map((id,i)=>{const p=byId(id).data;return {profileId:id,name:p.name,matricule:p.matricule,rank:p.rank,salaryIndex:p.salaryIndex,principal:profile.name,kind:data.kind,year:data.year,action:data.action,dutyDate:data.dutyDate,issueDate:data.issueDate,reference:data.prefix+String(+data.start+i).padStart(3,'0'),decision:data.decision,position:data.position};});const missing=bulkDraft.some(d=>['name','matricule','rank','salaryIndex'].some(k=>!d[k]));$('#bulk-review').innerHTML=`<h3>Review before issuing</h3>${table(bulkDraft.map((data,i)=>({id:i,data})),['name','matricule','rank','salaryIndex','dutyDate','reference'],false)}<p>${missing?'Update missing staff details before issuing.':'Confirm that the selected duty date and decision apply to every selected staff member.'}</p>${button('Issue and print batch','issue-batch','primary',missing?'disabled':'')}`;}
 if(form.isConnected){feedback.className='';feedback.textContent=t('Saved successfully.','Enregistrement réussi.');} }catch(err){feedback.textContent=err.message;feedback.className='error';const target=form.querySelector('.error');if(target)target.textContent=err.message;else toast(err.message);}finally{busy=false;if(submit)submit.disabled=false;}});
window.addEventListener('hashchange',()=>{if(!globalThis.SCHOOL_PREVIEW&&location.hash!=='#main'){const route=routeName();history.replaceState({},'',route==='home'?'/':'/'+route);}filter='';render();window.scrollTo(0,0);});
window.addEventListener('popstate',()=>{render();window.scrollTo(0,0);});
document.addEventListener('click',e=>{const a=e.target.closest('a');if(!a||a.target||a.hasAttribute('download')||e.ctrlKey||e.metaKey||e.shiftKey||e.altKey||e.button!==0)return;const url=new URL(a.href,location.href);if(url.origin===location.origin&&!url.hash&&!url.pathname.startsWith('/api/')&&!/\.[a-z0-9]+$/i.test(url.pathname)){e.preventDefault();navigate(url.pathname.replace(/^\//,'')||'home');}});
if(!globalThis.SCHOOL_PREVIEW&&location.hash&&location.hash!=='#main')history.replaceState({},'',routeName()==='home'?'/':'/'+routeName());
render();
api('public').then(a=>{publicRows=a.rows;calendarOverrides=a.calendarOverrides||[];render();}).catch(()=>{});
if(routeName()==='portal')refresh().catch(err=>toast(err.message));


function downloadCredentials(credentials){
 const csv=[['Name','Username','Email','Temporary password'],...credentials.map(c=>[c.name,c.username,c.email,c.temporaryPassword])].map(row=>row.map(value=>'"'+String(value||'').replace(/^[=+@-]/,"'").replaceAll('"','""')+'"').join(',')).join('\r\n');
 downloadBlob(new Blob([csv],{type:'text/csv;charset=utf-8'}),`GHS-temporary-logins-${Date.now()}.csv`);
}

function studentsPanel(isAdmin){
 const roll=classRoster(rows,{year:studentYear,stream:studentStream,cls:studentClass,studentId:studentSelection});
 const available=classRoster(rows,{year:studentYear,stream:studentStream});
 const streams=[...new Set(studentsInYear(rows,studentYear).map(r=>classStream(r.data.class,rows)))].sort();
 return `${isAdmin?toolbar('student',button(t('Import Excel / CSV','Importer Excel / CSV'),'import','secondary','data-kind="student"')):''}
 <div class="panel form-grid"><label>${t('Academic year','Année scolaire')}<input value="${esc(portalYear)}" readonly></label>
 <label>${t('Stream','Filière')}<select id="student-stream"><option value="">${t('All streams','Toutes les filières')}</option>${options(streams,studentStream)}</select></label>
 <label>${t('Class','Classe')}<select id="student-class"><option value="">${t('All classes','Toutes les classes')}</option>${options([...new Set(available.map(r=>r.data.class))].sort(),studentClass)}</select></label>
 <label>${t('Find student by name or matricule','Rechercher par nom ou matricule')}<input id="student-name-search" type="search"></label><label>${t('Student, optional','Élève, facultatif')}<select id="student-query"><option value="">${t('Whole class list','Liste complète')}</option>${options(available.filter(r=>!studentClass||r.data.class===studentClass).map(r=>[r.id,r.data.name]),studentSelection)}</select></label></div>
 <div class="row"><h2>${esc(studentClass||studentStream||t('Class lists','Listes de classe'))} · ${esc(studentYear)}</h2><strong>${roll.length} ${t('students','élèves')}</strong></div>
 ${roll.length?button(t('Print class list','Imprimer la liste'),'print-class-list','secondary'):''}
 ${isAdmin&&studentSelection?button(t('Change class or student status','Changer la classe ou le statut'),'student-move','secondary',`data-id="${studentSelection}"`):''}
 ${listFilters('students')}${table(roll.map((r,i)=>({...r,data:{...r.data,number:i+1,stream:classStream(r.data.class,rows)}})),['number','name','matricule','class','stream','gender','status'],isAdmin)}`;
}

function taskTitle(k){const a=taskGuides[k];return a?(lang==='fr'?a[2]:a[0]):(lang==='fr'?frTabs[k]:tabs[k]);}
function portalNavigation(){const all=allowedTabs(),daily=['overview',...primaryTasks(profile.role)].filter(k=>all.includes(k));const nav=k=>button(k==='overview'?t('Home','Accueil'):taskTitle(k),'tab',k===tab?'selected':'',`data-tab="${k}"`);return daily.map(nav).join('')+`<details ${!daily.includes(tab)?'open':''}><summary>${t('More tools','Autres outils')}</summary>${all.filter(k=>!daily.includes(k)).map(nav).join('')}</details>`;}
function schoolStatus(){const w=controls.markWindows?.[portalYear],open=w?.status==='open';return `<style>.portal .action-card{min-height:112px;text-align:left;padding:20px;display:flex;flex-direction:column;gap:10px;white-space:normal}.portal .action-card small{font-weight:400;line-height:1.5}.portal button,.portal input,.portal select,.portal summary{min-height:44px}.portal nav details summary{padding:12px;cursor:pointer}.school-status{display:flex;flex-wrap:wrap;align-items:center;gap:12px}.school-status p{width:100%;margin:0}.portal .task-help{font-size:1.05rem;line-height:1.65}@media(max-width:700px){.portal .cards.two{grid-template-columns:1fr}.portal .workspace{padding:14px}.portal .form-grid{grid-template-columns:1fr}.portal .table-scroll{overflow-x:auto}}</style><div class="panel school-status"><strong>${t('Academic year','Année scolaire')}: ${esc(portalYear)}</strong><span class="badge ${open?'published':'pending'}">${open?t('Mark entry open','Saisie des notes ouverte'):t('Mark entry closed','Saisie des notes fermée')}</span><p>${t('The principal sets the school year. The principal or vice-principal controls mark entry.','Le proviseur fixe l’année scolaire. Le proviseur ou le censeur contrôle la saisie des notes.')}</p></div>`;}
function markControlsPanel(){const w=controls.markWindows?.[portalYear]||{status:'closed',assessment:'all'};return `<section class="panel"><h2>${t('When can marks be entered?','Quand saisir les notes ?')}</h2><p>${w.status==='open'?t('Entry is open for','La saisie est ouverte pour')+' '+esc(w.assessment==='all'?t('all assessments','toutes les évaluations'):w.assessment)+'.':t('Entry is closed. Saved marks and report cards can still be viewed.','La saisie est fermée. Les notes enregistrées et les bulletins restent consultables.')}</p>${['principal','vp'].includes(profile.role)?`<form id="mark-window-form" class="form-grid"><label>${t('Assessment','Évaluation')}<select name="assessment">${options([['all',t('All assessments','Toutes les évaluations')],...sequences,...['Promotion exam']],w.assessment)}</select></label><label>${t('Allow mark entry','Autoriser la saisie')}<select name="status">${options([['closed',t('Closed','Fermée')],['open',t('Open','Ouverte')]],w.status)}</select></label><button class="primary">${t('Save entry setting','Enregistrer le paramètre')}</button><small>${t('Closing entry prevents new marks and changes. You can still publish existing results.','La fermeture empêche les nouvelles notes et les modifications. Vous pouvez toujours publier les résultats existants.')}</small></form>`:t('Contact the principal or vice-principal if you need to enter or correct marks.','Contactez le proviseur ou le censeur pour saisir ou corriger les notes.')}</section>`;}
function homeWorkspace(){const daily=primaryTasks(profile.role).filter(k=>allowedTabs().includes(k));const own=assignmentsInYear(rows,portalYear).filter(r=>r.data.teacherId===profile.id);return `<div class="welcome-panel"><div><h2>${t('Welcome,','Bienvenue,')} ${esc(profile.name.split(' ')[0])}</h2><p class="task-help">${t('Choose what you want to do. Your other tools are under More tools.','Choisissez une tâche. Les autres fonctions se trouvent sous Autres outils.')}</p></div><img src="/crest.jpg" alt="School crest"></div><div class="cards two">${daily.map(k=>{const a=taskGuides[k];return `<button class="action-card" data-action="tab" data-tab="${k}"><strong>${esc(taskTitle(k))}</strong><small>${esc(a?(lang==='fr'?a[3]:a[1]):'')}</small></button>`;}).join('')}</div>${['teacher','hod'].includes(profile.role)?`<section class="panel"><h2>${t('My classes and subjects','Mes classes et matières')}</h2>${own.length?table(own,['class','subject'],false):`<p>${t('No teaching assignments for this year. Ask the principal or vice-principal to check your classes.','Aucune affectation pour cette année. Demandez au proviseur ou au censeur de vérifier vos classes.')}</p>`}</section>`:''}${profile.role==='principal'?`<section class="panel"><div class="actions">${button(t('School logins and password resets','Comptes scolaires et réinitialisation'),'account-list','secondary')}</div><h2>${t('Set the academic year','Fixer l’année scolaire')}</h2><form id="school-year-form" class="form-grid"><label>${t('School year','Année scolaire')}<select name="year" required>${options(yearChoices(portalYear,availableAcademicYears(rows)),portalYear)}</select><small>${t('Choose the next year to preview student advancement. Three future years are always available. Earlier records are kept.','Choisissez l’année suivante pour vérifier le passage des élèves. Trois années futures sont toujours disponibles. Les anciens dossiers sont conservés.')}</small></label><button class="primary">${t('Review year change','Vérifier le changement d’année')}</button></form></section>`:''}${['principal','vp'].includes(profile.role)?markControlsPanel():''}${profile.role==='parent'?parentHome():''}`;}

function permittedClasses(){if(['principal','vp','discipline'].includes(profile.role))return classes;return [...new Set([...assignmentsInYear(rows,portalYear).filter(r=>r.data.teacherId===profile.id).map(r=>r.data.class),...studentsInYear(rows,portalYear).map(r=>r.data.class)])].sort();}
function taskInstructions(){if(tab==='overview')return '';const a=taskGuides[tab];return a?`<p class="task-help">${esc(lang==='fr'?a[3]:a[1])}</p>`:'';}
function syncMarkChoices(studentId=''){const f=$('#record-form');if(!f||f.dataset.kind!=='mark')return;const cls=f.elements.class.value,students=studentsInYear(rows,portalYear).filter(r=>r.data.class===cls),subjects=availableSubjects(rows).filter(s=>['principal','vp'].includes(profile.role)||assignmentsInYear(rows,portalYear).some(a=>a.data.teacherId===profile.id&&a.data.class===cls&&a.data.subject===s.name));f.elements.studentId.innerHTML=options(students.map(r=>[r.id,r.data.name]),studentId||f.elements.studentId.value);f.elements.subject.innerHTML=options(subjects.map(s=>s.name),f.elements.subject.value);}



function listFilters(kind){const records=kind==='assignments'?assignmentsInYear(rows,portalYear):kind==='staff'?list('profile'):[];const fields=kind==='staff'?['role','department']:kind==='assignments'?['teacher','class','subject']:[];return `<div class="panel form-grid" data-list-filters><label>${t('Search name or matricule','Rechercher un nom ou matricule')}<input type="search" data-list-search placeholder="${t('Type to find a person','Saisissez un nom')}"></label>${fields.map(field=>{const values=[...new Set(records.map(r=>field==='teacher'?r.data.teacherId:r.data[field]).filter(Boolean))].sort();return `<label>${esc(label(field==='teacher'?'teacherId':field))}<select data-list-filter="${field}"><option value="">${t('All','Tous')}</option>${options(values.map(v=>[v,field==='teacher'?name(v):field==='role'?(postCatalogue.find(p=>p.id===v)?.[lang==='fr'?'fr':'en']||v):v]))}</select></label>`;}).join('')}<p data-list-count role="status"></p></div>`;}
function filterVisibleList(filters){const target=filters.nextElementSibling;if(!target)return;const query=(filters.querySelector('[data-list-search]')?.value||'').trim().toLowerCase();const selected=[...filters.querySelectorAll('[data-list-filter]')];let count=0;target.querySelectorAll('tbody tr').forEach(tr=>{const match=(!query||(tr.dataset.search||tr.textContent.toLowerCase()).includes(query))&&selected.every(el=>!el.value||tr.dataset[el.dataset.listFilter]===el.value);tr.hidden=!match;if(match)count++;});filters.querySelector('[data-list-count]').textContent=t(count+' matching records',count+' résultats');}
document.addEventListener('input',e=>{if(e.target.id==='student-name-search'){const q=e.target.value.trim().toLowerCase(),available=classRoster(rows,{year:studentYear,stream:studentStream,cls:studentClass});$('#student-query').innerHTML=`<option value="">${t('Whole class list','Liste complète')}</option>`+options(available.filter(r=>[r.data.name,r.data.matricule].join(' ').toLowerCase().includes(q)).map(r=>[r.id,r.data.name]),studentSelection);}if(e.target.matches('[data-list-search]'))filterVisibleList(e.target.closest('[data-list-filters]'));if(e.target.matches('[data-mark-input]'))updateMarkProgress();});
function simplifyForm(kind){if(!['student','profile','assignment','resource'].includes(kind))return;const f=$('#record-form');if(!f)return;const essential={student:['academicYear','name','matricule','class','birthDate','gender','status'],profile:['name','role','department','phone','active','children'],assignment:['year','teacherId','class','subject','periods'],resource:['title','type','class','subject','body','attachment','dueDate','status','durationMinutes','submissionMode']}[kind];const optional=[...f.querySelectorAll('.form-grid>label')].filter(el=>!essential.includes(el.querySelector('[name]')?.name)&&!el.querySelector('[required]'));if(!optional.length)return;const details=document.createElement('details');details.className='panel';const summary=document.createElement('summary');summary.textContent=t('More details (optional)','Autres détails (facultatifs)');details.append(summary);const grid=document.createElement('div');grid.className='form-grid';details.append(grid);optional.forEach(el=>grid.append(el));f.querySelector('.form-grid').after(details);}
async function openAccounts(){if(profile.role!=='principal')return;const result=await api('accounts');const accounts=result.rows.filter(r=>['profile','student'].includes(r.kind)).map(r=>({...r,data:{...r.data,accountGroup:r.kind==='student'?t('Student','Élève'):r.data.role==='parent'?t('Parent','Parent'):t('Staff','Personnel'),login:r.data.username||r.data.loginEmail||'',loginStatus:!r.data.authId?t('No login','Sans compte'):r.data.loginExists===false?t('Linked login unavailable','Compte lié indisponible'):r.data.active===false||['graduated','dismissed','transferred out'].includes(r.data.status)?t('Inactive','Inactif'):r.data.passwordChangeRequired?t('Password change required','Mot de passe à changer'):t('Active','Actif')}}));modal(t('School logins','Comptes scolaires'),`<p>${t('Search all school account records. Passwords are never displayed. Resetting creates a new temporary password.','Recherchez les comptes scolaires. Les mots de passe ne sont jamais affichés. La réinitialisation crée un mot de passe temporaire.')}</p><div class="panel form-grid" data-list-filters><label>${t('Search name, matricule or login','Rechercher nom, matricule ou identifiant')}<input type="search" data-list-search></label><label>${t('Group','Groupe')}<select data-list-filter="role"><option value="">${t('All groups','Tous les groupes')}</option>${options([...new Set(accounts.map(r=>r.data.role||'student'))].map(v=>[v,postCatalogue.find(p=>p.id===v)?.[lang==='fr'?'fr':'en']||v]))}</select></label><p data-list-count role="status"></p></div><div class="table-scroll record-list"><table><thead><tr>${[t('Name','Nom'),t('Group','Groupe'),t('Class','Classe'),t('Login','Identifiant'),t('Email','E-mail'),t('Status','État'),t('Action','Action')].map(x=>`<th>${x}</th>`).join('')}</tr></thead><tbody>${accounts.map(r=>`<tr data-search="${esc([r.data.name,r.data.matricule,r.data.login,r.data.loginEmail].join(' ').toLowerCase())}" data-role="${esc(r.data.role||'student')}">${[r.data.name,r.data.accountGroup,r.data.class||'',r.data.login,r.data.loginEmail?.endsWith('@accounts.ghs-mbonjo.invalid')?'':r.data.loginEmail||'',r.data.loginStatus].map((v,i)=>`<td data-label="${[t('Name','Nom'),t('Group','Groupe'),t('Class','Classe'),t('Login','Identifiant'),t('Email','E-mail'),t('Status','État')][i]}">${esc(v)}</td>`).join('')}<td data-label="Action">${r.data.authId&&r.id!==profile.id&&r.data.active!==false&&!['graduated','dismissed','transferred out'].includes(r.data.status)?button(t('Reset password','Réinitialiser'),'reset-login','secondary',`data-id="${r.id}"`):!r.data.authId?button(t('Create login','Créer le compte'),'provision','secondary',`data-id="${r.id}"`):r.id===profile.id?button(t('Change my password','Changer mon mot de passe'),'password','secondary'):''}</td></tr>`).join('')}</tbody></table></div>`);}
let marksGridRows=[];
function marksGridPanel(){const w=controls.markWindows?.[portalYear];const pairs=assignmentsInYear(rows,portalYear).filter(a=>['principal','vp'].includes(profile.role)||a.data.teacherId===profile.id);const cls=[...new Set(pairs.map(a=>a.data.class))];return `<section class="panel"><h2>${t('Enter class marks','Saisir les notes de la classe')}</h2><p>${t('Choose a class, subject and sequence. Blank marks stay blank. Save when ready.','Choisissez une classe, une matière et une séquence. Les notes vides restent vides. Enregistrez après la saisie.')}</p><form id="marks-grid-form"><div class="form-grid"><label>${t('Class','Classe')}<select name="class"><option value="">${t('Choose class','Choisissez une classe')}</option>${options(cls.sort())}</select></label><label>${t('Subject','Matière')}<select name="subject"><option value="">${t('Choose subject','Choisissez une matière')}</option></select></label><label>${t('Assessment','Évaluation')}<select name="assessment">${options(w?.assessment&&w.assessment!=='all'?[w.assessment]:sequences)}</select></label></div><div id="marks-grid-list"></div><p id="marks-grid-progress" role="status"></p><button type="submit" class="primary" disabled>${t('Save class marks','Enregistrer les notes')}</button></form></section>`;}
async function loadMarksGrid(){const form=$('#marks-grid-form');if(!form)return;const cls=form.elements.class.value,selected=form.elements.subject.value;const subjects=[...new Set(assignmentsInYear(rows,portalYear).filter(a=>a.data.class===cls&&(['principal','vp'].includes(profile.role)||a.data.teacherId===profile.id)).map(a=>a.data.subject))].sort();form.elements.subject.innerHTML=`<option value="">${t('Choose subject','Choisissez une matière')}</option>`+options(subjects,selected);marksGridRows=[];$('#marks-grid-list').innerHTML='';if(!cls||!form.elements.subject.value){form.querySelector('[type=submit]').disabled=true;return;}const subject=form.elements.subject.value,assessment=form.elements.assessment.value;const state=await api('marks',{year:portalYear,class:cls});if(!form.isConnected||form.elements.class.value!==cls||form.elements.subject.value!==subject||form.elements.assessment.value!==assessment)return;rows=rows.filter(r=>r.kind!=='mark'||r.data.class!==cls).concat(state.rows);const allowed=markEntryAllowed(controls,{year:portalYear,assessment});marksGridRows=classRoster(rows,{year:portalYear,cls}).map(r=>({...r,data:{...r.data,requiredSubjects:list('classroom').find(c=>c.data.name===cls)?.data.subjects}})).filter(r=>!['graduated','dismissed','transferred out','completed'].includes(r.data.status)&&studies(r.data,subject));$('#marks-grid-list').innerHTML=`<div class="table-scroll"><table><thead><tr><th>${t('Student','Élève')}</th><th>${t('Mark / 20','Note / 20')}</th><th>${t('Saved state','État enregistré')}</th></tr></thead><tbody>${marksGridRows.map(r=>{const old=list('mark').find(m=>m.data.studentId===r.id&&m.data.subject===subject&&m.data.assessment===assessment&&m.data.year===portalYear);return `<tr><td>${esc(r.data.name)}<small class="muted"> ${esc(r.data.matricule||'')}</small></td><td><input data-mark-input data-student="${r.id}" data-original="${old?.data.mark??''}" value="${old?.data.mark??''}" type="number" min="0" max="20" step="0.01" aria-label="${esc(t('Mark for ','Note de ')+r.data.name)}" ${!allowed||old?.data.status==='published'?'disabled':''}></td><td data-mark-status>${old?t('Saved','Enregistrée'):t('Missing','Manquante')}${old?.data.status==='published'?' · '+t('Published','Publiée'):''}</td></tr>`;}).join('')}</tbody></table></div>${!allowed?`<p class="notice">${t('Mark entry is closed. Ask the principal or vice-principal.','La saisie est fermée. Contactez le proviseur ou le censeur.')}</p>`:''}`;form.querySelector('[type=submit]').disabled=!allowed||!marksGridRows.length;updateMarkProgress();}
function updateMarkProgress(){const inputs=[...document.querySelectorAll('[data-mark-input]')];const filled=inputs.filter(el=>el.value!=='').length,changed=inputs.filter(el=>el.value!==el.dataset.original).length;const p=$('#marks-grid-progress');if(p)p.textContent=t(`${filled} of ${inputs.length} marks entered. ${inputs.length-filled} missing. ${changed} unsaved changes.`,`${filled} notes sur ${inputs.length}. ${inputs.length-filled} manquantes. ${changed} modifications non enregistrées.`);}
async function saveMarksGrid(form){const inputs=[...form.querySelectorAll('[data-mark-input]')].filter(el=>!el.disabled&&el.value!==el.dataset.original);if(inputs.some(el=>el.value===''&&el.dataset.original!==''))throw Error(t('An existing mark cannot be erased here. Restore its value or ask the administration.','Une note existante ne peut pas être effacée ici. Rétablissez-la ou contactez l’administration.'));let saved=0;for(const input of inputs.filter(el=>el.value!=='')){const subject=form.elements.subject.value,assessment=form.elements.assessment.value,old=list('mark').find(r=>r.data.studentId===input.dataset.student&&r.data.subject===subject&&r.data.assessment===assessment&&r.data.year===portalYear);const pupil=marksGridRows.find(r=>r.id===input.dataset.student);const data={...old?.data,studentId:pupil.id,class:form.elements.class.value,subject,assessment,year:portalYear,mark:+input.value,coefficient:old?.data.coefficient||availableSubjects(rows).find(s=>s.name===subject)?.coefficient||1,status:old?.data.status||'draft'};try{const result=await api('save',{kind:'mark',id:old?.id,version:old?.version,data});rows=rows.filter(r=>r.id!==result.row.id).concat(result.row);input.dataset.original=input.value;input.closest('tr').querySelector('[data-mark-status]').textContent=t('Saved','Enregistrée');saved++;$('#marks-grid-progress').textContent=t(`${saved} marks saved.`,`${saved} notes enregistrées.`);}catch(error){throw Error(t(`${saved} marks saved before stopping. `,`${saved} notes enregistrées avant l’arrêt. `)+error.message);}}updateMarkProgress();toast(t(`${saved} marks saved.`,`${saved} notes enregistrées.`));}
function parentHome(){const children=studentsInYear(rows,portalYear).filter(r=>(profile.children||[]).includes(r.id));return `<section class="panel"><h2>${t('My children','Mes enfants')}</h2>${children.map(r=>{const attendance=list('attendance').filter(a=>a.data.studentId===r.id),marks=list('mark').filter(m=>m.data.studentId===r.id&&m.data.year===portalYear&&m.data.status==='published');return `<article class="panel"><h3>${esc(r.data.name)}</h3><p>${esc(r.data.class)} · ${esc(classStream(r.data.class,rows))}</p><p>${t('Published results','Résultats publiés')}: ${marks.length} · ${t('Absent lessons in the last 30 days','Cours manqués ces 30 derniers jours')}: ${attendance.filter(a=>a.data.status==='absent').length}</p><div class="actions">${button(t('View results','Voir les résultats'),'tab','primary','data-tab="marks"')}${button(t('View attendance','Voir les présences'),'tab','secondary','data-tab="attendance"')}</div></article>`;}).join('')||`<p>${t('Ask the school to link your children to this account.','Demandez au lycée de relier vos enfants à ce compte.')}</p>`}<h3>${t('School notices','Avis du lycée')}</h3>${list('post').filter(p=>p.data.status==='published').slice(0,5).map(p=>`<article><strong>${esc(lang==='fr'?p.data.titleFr||p.data.title:p.data.title)}</strong><p>${esc(lang==='fr'?p.data.bodyFr||p.data.body:p.data.body)}</p></article>`).join('')||t('No new notices.','Aucun nouvel avis.')}</section>`;}


function hasUnsavedMarks(){return [...document.querySelectorAll('[data-mark-input]')].some(el=>el.value!==el.dataset.original);}
window.addEventListener('beforeunload',e=>{if(hasUnsavedMarks()){e.preventDefault();e.returnValue='';}});


let notificationState=null;
async function openNotifications(){notificationState=await api('notification-status');const s=notificationState;modal(t('School notifications','Notifications scolaires'),`<p>${t('Choose where you receive school notices. Phone alerts need permission on this device.','Choisissez où recevoir les avis du lycée. Les alertes nécessitent une autorisation sur cet appareil.')}</p>${profile.role==='principal'?`<section class="panel"><h3>${t('Connect school Gmail','Connecter le Gmail du lycée')}</h3><p>${s.configured?t('Gmail connected: ','Gmail connecté : ')+esc(s.sender):t('Gmail is not connected yet.','Gmail n’est pas encore connecté.')}</p><form id="notification-config-form"><label>Gmail<input type="email" name="email" value="${esc(s.sender)}" required autocomplete="email"></label><label>${t('Gmail App Password','Mot de passe d’application Gmail')}<input type="password" name="appPassword" required autocomplete="new-password"><small>${t('Enable 2-Step Verification in Google, then create an App Password for School notifications. Enter it here.','Activez la validation en deux étapes dans Google puis créez un mot de passe d’application pour Notifications scolaires. Saisissez-le ici.')}</small></label><a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener" class="text-link">${t('Open Google App Passwords','Ouvrir les mots de passe d’application Google')}</a><button type="submit" class="primary">${t('Connect and verify Gmail','Connecter et vérifier Gmail')}</button></form></section>`:''}<section class="panel"><h3>${t('My email notifications','Mes notifications par e-mail')}</h3><p>${s.prefs.verified?t('Verified email: ','E-mail vérifié : ')+esc(s.prefs.email):t('Verify the email where you want school notices.','Vérifiez l’e-mail où recevoir les avis du lycée.')}</p><form id="notification-email-form"><label>${t('Notification email','E-mail de notification')}<input type="email" name="email" value="${esc(s.prefs.email)}" required></label><button type="submit" class="secondary" ${s.configured?'':'disabled'}>${t('Send verification code','Envoyer le code de vérification')}</button></form><form id="notification-verify-form"><label>${t('Six-digit code from your inbox','Code à six chiffres reçu par e-mail')}<input name="code" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" required></label><button type="submit" class="secondary">${t('Verify email','Vérifier l’e-mail')}</button></form></section><section class="panel"><h3>${t('Phone notifications','Notifications sur téléphone')}</h3><p>${t('On iPhone, add the app to your Home Screen and open it there before enabling alerts.','Sur iPhone, ajoutez l’application à l’écran d’accueil puis ouvrez-la pour activer les alertes.')}</p><div class="actions">${button(t('Enable on this device','Activer sur cet appareil'),'notification-push','primary')}${button(t('Remove this device','Retirer cet appareil'),'notification-unsubscribe','secondary')}</div><form id="notification-preferences-form" class="form-grid"><label>${t('Email alerts','Alertes par e-mail')}<select name="emailEnabled">${options([['false',t('Off','Désactivées')],['true',t('On','Activées')]],String(s.prefs.emailEnabled))}</select></label><label>${t('Phone push alerts','Alertes sur téléphone')}<select name="pushEnabled">${options([['false',t('Off','Désactivées')],['true',t('On','Activées')]],String(s.prefs.pushEnabled))}</select></label><button type="submit" class="secondary">${t('Save preferences','Enregistrer les préférences')}</button></form>${button(t('Send me a test','M’envoyer un test'),'notification-test','secondary')}</section>${profile.role==='principal'?notificationCompose():''}`);}
function notificationTargets(form){const group=form.elements.group.value,cls=form.elements.cls.value,stream=form.elements.stream.value;const pupils=studentsInYear(rows,portalYear);const matches=r=>(!cls||r.data.class===cls)&&(!stream||classStream(r.data.class,rows)===stream);return rows.filter(r=>['profile','student'].includes(r.kind)&&r.data.active!==false&&!['dismissed','transferred out','graduated','completed'].includes(r.data.status)).filter(r=>group==='students'?r.kind==='student'&&pupils.some(p=>p.id===r.id&&matches(p)):group==='parents'?r.kind==='profile'&&r.data.role==='parent'&&(!cls&&!stream||(r.data.children||[]).some(id=>pupils.some(p=>p.id===id&&matches(p)))):group==='teachers'?r.kind==='profile'&&['teacher','hod'].includes(r.data.role):r.kind==='profile'&&!['parent','teacher','hod'].includes(r.data.role));}
function notificationCompose(){return `<section class="panel"><h3>${t('Send a school notice','Envoyer un avis du lycée')}</h3><p>${t('Recipients receive alerts only through the channels they have enabled. Review your message before sending.','Les destinataires reçoivent les avis uniquement par les canaux activés. Relisez le message avant l’envoi.')}</p><form id="notification-send-form"><div class="form-grid"><label>${t('Group','Groupe')}<select name="group" data-notification-target>${options([['teachers',t('Teachers','Enseignants')],['parents',t('Parents','Parents')],['students',t('Students','Élèves')],['staff',t('Other staff','Autre personnel')]])}</select></label><label>${t('Class (students or parents)','Classe (élèves ou parents)')}<select name="cls" data-notification-target><option value="">${t('All classes','Toutes les classes')}</option>${options([...new Set(studentsInYear(rows,portalYear).map(r=>r.data.class))].sort())}</select></label><label>${t('Stream (students or parents)','Section (élèves ou parents)')}<select name="stream" data-notification-target><option value="">${t('All streams','Toutes les sections')}</option>${options([...new Set(studentsInYear(rows,portalYear).map(r=>classStream(r.data.class,rows)))].sort())}</select></label></div><label>${t('Title','Titre')}<input name="title" maxlength="100" required></label><label>${t('Message','Message')}<textarea name="message" rows="5" maxlength="1000" required></textarea></label><p id="notification-recipient-count" role="status">${rows.filter(r=>r.kind==='profile'&&['teacher','hod'].includes(r.data.role)&&r.data.active!==false&&! ['dismissed','transferred out','graduated','completed'].includes(r.data.status)).length} ${t('active recipients','destinataires actifs')}</p><button type="submit" class="primary">${t('Review and send notice','Vérifier et envoyer l’avis')}</button><div id="notification-send-results" role="status"></div></form></section>`;}
async function enablePush(){if(!('serviceWorker' in navigator)||!('PushManager' in window)||!('Notification' in window))throw Error(t('Push is unavailable in this browser. Install the app or try a supported browser.','Notifications indisponibles. Installez l’application ou utilisez un navigateur compatible.'));const permission=await Notification.requestPermission();if(permission!=='granted')throw Error(t('Notifications were not allowed. Enable them in your browser settings.','Notifications non autorisées. Activez-les dans les paramètres du navigateur.'));const reg=await navigator.serviceWorker.ready;const key=notificationState.publicKey;const bytes=Uint8Array.from(atob(key.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));const sub=await reg.pushManager.getSubscription()||await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:bytes});await api('notification-subscribe',{subscription:sub.toJSON()});await openNotifications();toast(t('This device is ready for school notifications.','Cet appareil est prêt à recevoir les avis du lycée.'));}

function departmentLearningGuide(name){
 const guide=departmentGuides[name];if(!guide)return '';const g=guide[lang]||guide.en;
 const block=(en,fr,content)=>`<article><h3>${t(en,fr)}</h3>${content}</article>`;
 return `<section aria-label="${t('Department learning guide','Guide pédagogique du département')}"><h2>${esc(guide.name[lang]||name)}</h2><p>${esc(g.purpose)}</p><div class="cards two">${block('What students study','Ce que les élèves étudient',`<ul>${g.topics.map(v=>`<li>${esc(v)}</li>`).join('')}</ul>`)}${block('What students should be able to do','Compétences attendues',`<p>${esc(g.outcomes)}</p>`)}${block('Learning activities and assessment','Activités et évaluation',`<p>${esc(g.practice)}</p>`)}${block('Progression and future pathways','Progression et perspectives',`<p>${esc(g.progression)}</p>`)}</div><details><summary>${t('Cameroon curriculum framework and official references','Cadre camerounais et références officielles')}</summary><p>${t('Cameroon’s Anglophone general secondary education has a five-year first cycle leading to GCE Ordinary Level and a two-year second cycle leading to GCE Advanced Level. These learning overviews help families understand each department. The approved MINESEC programme, current GCE syllabus and school scheme of work determine the exact topics, sequence, prescribed texts and assessment requirements for each class. Subject availability depends on the school’s approved combinations.','L’enseignement secondaire général anglophone comprend un premier cycle de cinq ans menant au GCE Ordinary Level et un second cycle de deux ans menant au GCE Advanced Level. Ces présentations aident les familles à comprendre chaque département. Le programme approuvé du MINESEC, le programme du GCE en vigueur et la progression pédagogique de l’établissement déterminent les thèmes, l’ordre, les textes et les évaluations de chaque classe. Les matières offertes dépendent des combinaisons approuvées.')}</p><p>${t('Learning should connect knowledge to practical situations, communication, responsible behaviour and problem solving. Teachers use regular feedback to identify gaps and support progress. Examination formats and weightings must be checked against the current official syllabus.','L’apprentissage relie connaissances, situations pratiques, communication, responsabilité et résolution de problèmes. Les enseignants donnent des retours réguliers pour repérer les difficultés et soutenir les progrès. Formats et coefficients d’examen doivent être vérifiés dans le programme officiel en vigueur.')}</p><ul>${curriculumSources.map(r=>`<li><a href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">${esc(r[lang]||r.en)}</a></li>`).join('')}</ul></details></section>`;
}

function officialProgressionLinks(name){
 const entries=progressionLinks[name]||[];
 return `<section><h2>${t('Official progression sheets','Fiches officielles de progression')}</h2><p>${t('MINESEC Inspectorate · English Sub System · General Education · 2026/2027. Select the class and course below. These links do not change the school portal’s working year.','Inspection générale du MINESEC · Sous-système anglophone · Enseignement général · 2026/2027. Choisissez la classe et le cours ci-dessous. Ces liens ne changent pas l’année de travail du portail.')}</p>${entries.length?`<details><summary>${t('Download by class and subject','Télécharger par classe et matière')} (${entries.length})</summary><div class="cards two">${entries.map(r=>`<article><h3>${esc(r.className)}</h3><p>${esc(r.subject)}</p><a class="secondary" href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">${t('Download official PDF','Télécharger le PDF officiel')}</a></article>`).join('')}</div></details>`:`<p>${t('No published progression was found for this department in the checked 2026/2027 catalogue. Check the official selector for another year or later publication.','Aucune progression publiée n’a été trouvée pour ce département dans le catalogue 2026/2027 vérifié. Consultez le sélecteur officiel pour une autre année ou une publication ultérieure.')}</p>`}<p><a class="primary" href="https://minesec-ige.com/progression-sheets" target="_blank" rel="noopener noreferrer">${t('View sheets or choose another year on MINESEC','Voir les fiches ou choisir une autre année sur MINESEC')}</a></p><p>${t('On the official page: select the academic calendar, English Sub System, General Education, class, subject and term, then Preview Progression or Download PDF. Early Food and Nutrition learning is listed as Home Economics. Sixth Form History may appear as Cameroon, African or World history. French and Mathematics options must match the course taught. Availability and dates follow the publisher.','Sur la page officielle : sélectionnez l’année, English Sub System, General Education, la classe, la matière et le trimestre, puis Preview Progression ou Download PDF. Les premières notions d’alimentation sont classées sous Home Economics. Au second cycle, l’histoire peut être divisée en histoire du Cameroun, de l’Afrique ou du monde. Les options de français et de mathématiques doivent correspondre au cours suivi. Disponibilité et dates suivent l’éditeur.')}</p></section>`;
}

function profileAvatar(person,large=false){const photo=/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(person.photo||'');return `<span class="avatar ${photo?'avatar-photo':''} ${large?'avatar-large':''}">${photo?`<img src="${safeImage(person.photo)}" alt="${esc(person.name)}" width="${large?150:40}" height="${large?150:40}">`:esc((person.name||'?')[0])}</span>`;}
