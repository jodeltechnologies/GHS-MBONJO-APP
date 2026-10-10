import test from 'node:test';
import assert from 'node:assert/strict';
import {progressionLinks} from '../src/progression-links.js';
import {departmentGuides} from '../src/department-guides.js';
test('official progression links use checked year and curriculum identifiers',()=>{
 const seen=new Set();let total=0;
 for(const [department,entries] of Object.entries(progressionLinks)){
  assert.ok(departmentGuides[department]);
  for(const entry of entries){
   const u=new URL(entry.url);assert.equal(u.origin,'https://minesec-ige.com');assert.equal(u.pathname,'/progression-sheets/download-pdf');
   assert.equal(u.searchParams.get('session_id'),'2');assert.equal(u.searchParams.get('sub_system_id'),'1');assert.equal(u.searchParams.get('education_type_id'),'1');
   assert.ok(['1','2','3','5','6','8','10'].includes(u.searchParams.get('class_id')));assert.match(u.searchParams.get('subject_id'),/^\d+$/);
   assert.ok(entry.className&&entry.subject);assert.ok(!seen.has(entry.url));seen.add(entry.url);total++;
  }
 }
 assert.equal(total,115);assert.equal(progressionLinks['Religious Studies'],undefined);
});
