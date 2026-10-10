import test from 'node:test';
import assert from 'node:assert/strict';
import {departmentGuides,curriculumSources} from '../src/department-guides.js';
import {departmentCopy} from '../src/school-content.js';
test('every school department has a complete bilingual learning guide',()=>{
 assert.deepEqual(Object.keys(departmentGuides).sort(),Object.keys(departmentCopy).sort());
 for(const guide of Object.values(departmentGuides)) for(const lang of ['en','fr']){
  for(const field of ['purpose','outcomes','practice','progression'])assert.ok(guide[lang][field].length>100);
  assert.equal(guide[lang].topics.length,3);assert.ok(guide.name[lang]);
 }
});
test('curriculum references link only to official education authorities',()=>{
 for(const source of curriculumSources)assert.ok(['minesec.gov.cm','www.minesec.gov.cm','camgceb.org'].includes(new URL(source.url).hostname));
 assert.match(departmentGuides['Guidance and Counselling'].en.purpose,/not a GCE examination subject/);
 assert.match(departmentGuides['Physical Education'].en.progression,/does not present it as a listed GCE/);
 assert.match(departmentGuides.Logic.en.progression,/distinct Advanced Level/);
});
