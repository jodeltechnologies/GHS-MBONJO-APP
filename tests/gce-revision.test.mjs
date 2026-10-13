import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gcePapers,filterGcePapers,gcePage,renderGceLibrary} from '../src/gce-revision.js';
import {departments} from '../src/domain.js';
test('GCE catalogue has unique trusted links and class-specific source evidence',()=>{
 const seen=new Set();assert.ok(gcePapers.length>500);
 for(const p of gcePapers){
  assert.ok(departments.includes(p.department));assert.ok(['Form 5','Upper Sixth'].includes(p.level));assert.ok(['gce','mock'].includes(p.type));
  assert.equal(new URL(p.url).origin,'https://minesec-distance.schoolfaqs.net');assert.ok(new URL(p.url).pathname.startsWith('/paper/'));assert.ok(!seen.has(p.url));seen.add(p.url);
  assert.ok(p.title&&p.subject);assert.match(p.catalogueUrl,new RegExp('/'+(p.level==='Form 5'?'gce-ordinary-level':'gce-advanced-level')+'/'+p.year+'/'));
  if(p.pdfUrl){const u=new URL(p.pdfUrl);assert.equal(u.origin,'https://minesec-distance.schoolfaqs.net');assert.ok(u.pathname.startsWith('/storage/exams/'));assert.ok(u.pathname.endsWith('.pdf'));}
 }
});
test('filters combine class, department, subject, year and exam type without mixing levels',()=>{
 for(const department of new Set(gcePapers.map(p=>p.department)))for(const level of ['Form 5','Upper Sixth']){
  const subset=filterGcePapers({department,level});assert.ok(subset.every(p=>p.department===department&&p.level===level));
 }
 const chosen=gcePapers.find(p=>p.type==='mock');const matches=filterGcePapers({...chosen,search:String(chosen.year)});
 assert.ok(matches.some(p=>p.url===chosen.url));assert.ok(matches.every(p=>p.type==='mock'&&p.subject===chosen.subject&&p.year===chosen.year));
 assert.equal(filterGcePapers({search:'no-such-paper-xyz'}).length,0);
 assert.ok(filterGcePapers({department:'English',subject:'Literature In English'}).length);
 assert.ok(filterGcePapers({department:'Mathematics',subject:'Pure Mathematics'}).length);
});
test('pagination keeps every paper reachable, clamps empty and out-of-range requests',()=>{
 const items=filterGcePapers();let urls=[];
 for(let page=1;page<=gcePage(items).pages;page++)urls.push(...gcePage(items,page).items.map(p=>p.url));
 assert.deepEqual(urls,items.map(p=>p.url));assert.equal(gcePage([],99).page,1);assert.equal(gcePage(items,-1).page,1);assert.equal(gcePage(items,999).page,gcePage(items).pages);
});
test('every department renders a bilingual revision section and empty coverage stays explicit',()=>{
 for(const department of departments){assert.match(renderGceLibrary({department}),/GCE past questions/);assert.match(renderGceLibrary({department,lang:'fr'}),/Anciens sujets du GCE/);}
 for(const department of ['Guidance and Counselling','Religious Studies','Physical Education']){assert.equal(filterGcePapers({department}).length,0);assert.match(renderGceLibrary({department}),/No GCE papers for this department/);}
 const markup=renderGceLibrary();assert.match(markup,/data-gce-filter="type"/);assert.match(markup,/data-gce-filter="search"/);assert.match(markup,/target="_blank" rel="noopener noreferrer"/);
 const app=readFileSync(new URL('../src/app.js',import.meta.url),'utf8');assert.match(app,/renderGceLibrary\(\{department:d,lang\}\)/);assert.match(app,/if\(tab==='resources'\)return `\$\{renderGceLibrary/);
 const config=JSON.parse(readFileSync(new URL('../vercel.json',import.meta.url),'utf8'));assert.ok(config.rewrites.some(r=>r.source.includes('|revision|')));
});
