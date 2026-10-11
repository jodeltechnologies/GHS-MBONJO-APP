import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import JSZip from 'jszip';
import ExcelJS from 'exceljs';
import {makeReadableBackup,groupFor} from '../src/readable-backup.js';
test('selected readable backup keeps full fields, long values and original files',async()=>{
 const long='é'.repeat(33000),photo='data:image/png;base64,aGVsbG8=';
 const backup={startedAt:'2026-10-11T12:00:00.000Z',finishedAt:'2026-10-11T12:01:00.000Z',records:[{id:'../../student',kind:'student',data:{name:'ÉLÈVE TEST',notes:long,photo,nested:{flag:false,zero:0,empty:[]}}},{id:'staff',kind:'profile',data:{name:'STAFF'}},{id:'future',kind:'new_record_type',data:{name:'Future'}}],audit:[{id:'log',action:'save'}]};
 assert.equal(groupFor(backup.records[2]),'other');
 const blob=await makeReadableBackup(backup,['students','other'],()=>{},{font:await readFile(new URL('../public/fonts/Tinos-Regular.ttf',import.meta.url))});
 const zip=await JSZip.loadAsync(await blob.arrayBuffer());const full=JSON.parse(await zip.file('complete-records.json').async('string'));
 assert.deepEqual(full.records,[backup.records[0],backup.records[2]]);assert.deepEqual(full.audit,[]);assert.equal(zip.folder('staff').file('records.json'),null);
 const originals=Object.keys(zip.files).filter(p=>p.startsWith('students/original-files/')&&!zip.files[p].dir);assert.equal(originals.length,1);assert.ok(!originals[0].includes('../'));assert.equal(await zip.file(originals[0]).async('string'),'hello');
 const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(await zip.file('students/records.xlsx').async('uint8array'));const parts=[];workbook.worksheets[0].eachRow(row=>{if(row.getCell(4).value==='data.notes')parts.push(row.getCell(5).value);});assert.equal(parts.join(''),long);
 assert.match(await zip.file('students/records.pdf').async('string'),/^%PDF/);const doc=await JSZip.loadAsync(await zip.file('students/records.docx').async('uint8array'));assert.match(await doc.file('word/document.xml').async('string'),/ÉLÈVE TEST/);
 const manifest=JSON.parse(await zip.file('manifest.json').async('string'));assert.deepEqual(manifest.groups.map(g=>g.records),[1,1]);
});
