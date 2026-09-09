// School-level catalogue. 'core' follows the school services in Decree 2001/041.
// Optional school duties are not represented as statutory appointments.
export const postCatalogue = [
 ['principal','Principal','Proviseur','principal','core'],
 ['vp','Vice Principal (VP)','Censeur','vp','core'],
 ['sdm','Senior Discipline Master / Mistress (SDM)','Surveillant général','discipline','core'],
 ['dm','Discipline Master / Mistress (DM)','Surveillant de secteur','discipline','core'],
 ['bursar','Bursar','Intendant (lycée) / Économe (collège)','staff','core'],
 ['stores_accountant','Stores Accountant','Comptable-matières','staff','core'],
 ['librarian','Documentalist / Librarian','Documentaliste','staff','core'],
 ['guidance_counsellor','Guidance Counsellor','Conseiller d’orientation','staff','core'],
 ['school_doctor','School Medical Officer','Médecin scolaire','staff','core'],
 ['social_worker','Social Worker','Assistant social','staff','core'],
 ['extracurricular_coordinator','Extracurricular Activities Officer','Responsable des activités post et périscolaires','staff','core'],
 ['sports_coordinator','School Sports Coordinator','Responsable des sports scolaires','teacher','core'],
 ['hod','Head of Department (HOD)','Animateur pédagogique / Chef de département','hod','core'],
 ['teacher','Teacher','Enseignant','teacher','core'],
 ['class_master','Class Master / Mistress','Professeur principal','teacher','school duty'],
 ['secretary','School Secretary','Secrétaire','staff','support'],
 ['nurse','School Nurse / Infirmary Attendant','Infirmier scolaire','staff','support'],
 ['ict_coordinator','ICT / Multimedia Coordinator','Responsable TIC / multimédia','staff','school duty'],
 ['laboratory_attendant','Laboratory Attendant','Agent de laboratoire','staff','support'],
 ['club_coordinator','Club Coordinator','Encadreur de club','teacher','school duty'],
 ['examinations_officer','Examinations Officer','Responsable des examens','teacher','school duty'],
 ['boarding_supervisor','Boarding Supervisor, where applicable','Responsable d’internat, le cas échéant','staff','support'],
 ['security','Security Guard / Watchperson','Gardien','staff','support'],
 ['maintenance','Maintenance / Cleaning Staff','Agent d’entretien','staff','support'],
 ['support_staff','Other Support Staff','Autre personnel d’appui','staff','support'],
 ['content_creator','Website Content Creator','Créateur de contenu du site','content_creator','app permission'],
 ['discipline','Discipline Staff (legacy account)','Personnel de discipline (ancien compte)','discipline','legacy'],
 ['parent','Parent / Guardian','Parent / Tuteur','parent','family access']
].map(([id,en,fr,access,category])=>({id,en,fr,access,category,maxActive:id==='bursar'?1:null}));
export const postOptions=(lang='en')=>postCatalogue.map(p=>[p.id,p[lang==='fr'?'fr':'en']]);
export const effectiveRole=role=>postCatalogue.find(p=>p.id===role)?.access||role;
export const canUseWriter=p=>['principal','vp','hod'].includes(effectiveRole(p.role));
export function colleagueContacts(p,profiles){
 if(!canUseWriter(p))throw Error('Principal, VP or HOD access required.');
 return profiles.filter(r=>r.kind==='profile'&&r.data.active!==false&&r.data.role!=='parent'&&r.id!==p.id&&(effectiveRole(p.role)!=='hod'||Boolean(p.department)&&r.data.department===p.department)).map(r=>({id:r.id,name:r.data.name,department:r.data.department||'Unassigned',post:r.data.role,phone:r.data.whatsapp||r.data.phone||''}));
}
export function whatsappNumber(value){const raw=String(value||'').trim();if(!raw||/[^\d+\s().-]/.test(raw))throw Error('This contact needs a valid international WhatsApp number.');let n=raw.replace(/[\s().-]/g,'');if(n.startsWith('+'))n=n.slice(1);if(n.startsWith('00'))n=n.slice(2);if(/^6\d{8}$/.test(n))n='237'+n;if(!/^[1-9]\d{7,14}$/.test(n))throw Error('Confirm the contact’s country code and number.');return n;}
export function whatsappLink(phone,message){if(!String(message).trim())throw Error('Write or generate the message first.');return `https://wa.me/${whatsappNumber(phone)}?text=${encodeURIComponent(message)}`;}
