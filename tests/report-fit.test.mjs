import test from 'node:test';
import assert from 'node:assert/strict';
import {reportFitScale} from '../src/report-fit.js';
import {classReport} from '../src/reports.js';
import {reportCardHTML} from '../src/report-layout.js';
import {blankReport} from '../src/student-printing.js';
test('fit keeps short reports at full size and chooses the largest non-overflowing scale',()=>{
 assert.equal(reportFitScale(()=>true),1);
 for(const limit of [.93,.75,.61,.49,.12]){const scale=reportFitScale(s=>s<=limit);assert.ok(scale<=limit);assert.ok(limit-scale<.0003);}
});
test('term, annual and blank reports keep all their sections inside one sheet content wrapper',()=>{
 const student={id:'one',data:{name:'SAMPLE STUDENT'}};
 for(const choice of ['First Term','Annual Report'])for(const format of ['cba','sba'])for(const sample of [false,true]){
  let report=classReport({students:[student],choice,subjectsFor:()=>['English Language','Mathematics']});if(sample)report=blankReport(report);
  const html=reportCardHTML(report.sheets[0],report,{assessment:choice,format});
  assert.equal((html.match(/class="rc-page-content"/g)||[]).length,1);
  assert.equal((html.match(/<article /g)||[]).length,1);
  assert.match(html,/<div class="rc-page-content">[^]*class="rc-sign"[^]*class="rc-note"[^]*<\/div><\/article>/);
 }
});
