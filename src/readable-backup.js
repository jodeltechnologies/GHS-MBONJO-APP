import {loadExportAssets,bytesToBase64} from './exports.js';
export const backupGroups=[
 {id:'students',label:'Students and parents',kinds:['student','parent']},
 {id:'staff',label:'Staff and login information',kinds:['profile','directory']},
 {id:'academics',label:'Classes, subjects and assignments',kinds:['classroom','subject','assignment','school_control']},
 {id:'marks',label:'Marks and report information',kinds:['mark']},
 {id:'attendance',label:'Attendance',kinds:['attendance']},
 {id:'timetable',label:'Timetables',kinds:['timetable']},
 {id:'documents',label:'School and department documents',kinds:['document','document_request','letter','dept_document','dept_item','progression']},
 {id:'learning',label:'Learning resources and submissions',kinds:['resource','learning_resource','submission','exam_attempt','textbook']},
 {id:'website',label:'Website and events',kinds:['event','post','gallery']},
 {id:'other',label:'Other school records',kinds:[]},
 {id:'audit',label:'Activity log',kinds:[]}
];
export function groupFor(row){return backupGroups.find(g=>g.kinds.includes(row.kind))?.id||'other';}
const safe=s=>String(s||'record').normalize('NFKD').replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,100)||'record';
export async function makeReadableBackup(backup,selected,onProgress=()=>{},assets=null){
 const [{default:JSZip},{default:ExcelJS},{Document,Packer,Paragraph,TextRun},{jsPDF}]=await Promise.all([import('jszip'),import('exceljs'),import('docx'),import('jspdf')]);
 assets=assets||await loadExportAssets();
 const groups=backupGroups.filter(g=>selected.includes(g.id));if(!groups.length)throw Error('Select at least one backup category.');
 const records=backup.records.filter(r=>selected.includes(groupFor(r))),audit=selected.includes('audit')?backup.audit:[];
 const zip=new JSZip(),manifest={school:'GHS MBONJO LIMBE',startedAt:backup.startedAt,finishedAt:backup.finishedAt,groups:[],scope:'Selected school records. Excludes Auth passwords, provider keys, hosting settings, private staff messages and untransmitted department drafts. This paged export is not a transactional database snapshot.'};
 zip.file('complete-records.json',JSON.stringify({...backup,records,audit},null,2));
 for(const group of groups){
  onProgress('Preparing '+group.label);const rows=group.id==='audit'?audit:records.filter(r=>groupFor(r)===group.id),folder=zip.folder(group.id),flat=[];
  const walk=(value,path,record,index)=>{
   if(typeof value==='string'&&/^data:[^;,]+;base64,/.test(value)){
    const [,mime,payload]=value.match(/^data:([^;,]+);base64,([\s\S]*)$/)||[];if(!payload)throw Error('An attachment could not be read.');
    const ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','application/pdf':'pdf','image/gif':'gif','application/vnd.openxmlformats-officedocument.wordprocessingml.document':'docx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':'xlsx'}[mime]||'bin';
    const file=`original-files/${index+1}-${safe(record.id)}-${safe(path)}.${ext}`;folder.file(file,payload,{base64:true});flat.push([index+1,record.id||'',record.kind||'audit',path,'Original file: '+file]);return;
   }
   if(value!==null&&typeof value==='object'){
    const entries=Object.entries(value);if(!entries.length)flat.push([index+1,record.id||'',record.kind||'audit',path,Array.isArray(value)?'[]':'{}']);
    for(const [key,v] of entries)walk(v,path?path+'.'+key:key,record,index);return;
   }
   flat.push([index+1,record.id||'',record.kind||'audit',path,value===null?'null':String(value)]);
  };
  rows.forEach((row,i)=>walk(row,'',row,i));
  folder.file('records.json',JSON.stringify(rows,null,2));
  const workbook=new ExcelJS.Workbook();workbook.creator='GHS MBONJO LIMBE';let sheet=workbook.addWorksheet('Records');const headers=['Record number','Record ID','Type','Field','Content','Part'];
  const init=s=>{s.addRow(headers);s.getRow(1).font={bold:true,color:{argb:'FFFFFFFF'}};s.getRow(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF143D52'}};s.views=[{state:'frozen',ySplit:1}];s.columns=[{width:16},{width:38},{width:22},{width:40},{width:90},{width:10}];};init(sheet);
  for(const item of flat){const value=item[4];for(let pos=0;pos<Math.max(1,value.length);pos+=30000){if(sheet.rowCount>=1000000){sheet=workbook.addWorksheet('Records '+workbook.worksheets.length);init(sheet);}const row=sheet.addRow([...item.slice(0,4),value.slice(pos,pos+30000),1+pos/30000]);row.alignment={vertical:'top',wrapText:true};}}
  folder.file('records.xlsx',await workbook.xlsx.writeBuffer());
  const paragraphs=[new Paragraph({text:'GHS MBONJO LIMBE',heading:'Heading1'}),new Paragraph({text:group.label,heading:'Heading2'}),new Paragraph(`${rows.length} records | Export started ${backup.startedAt}`)];
  const pdf=new jsPDF({compress:true});pdf.addFileToVFS('Tinos.ttf',bytesToBase64(assets.font));pdf.addFont('Tinos.ttf','Tinos','normal');pdf.setFont('Tinos');let y=18;const line=s=>{for(const t of pdf.splitTextToSize(String(s),174)){if(y>278){pdf.addPage();y=18;}pdf.text(t,18,y);y+=5;}};pdf.setFontSize(11);line('GHS MBONJO LIMBE');line(group.label);line(`${rows.length} records`);
  for(const item of flat){const text=`Record ${item[0]} | ${item[3]}: ${item[4]}`;paragraphs.push(new Paragraph({children:[new TextRun(text)],spacing:{after:80}}));line(text);}
  folder.file('records.docx',new Uint8Array(await (await Packer.toBlob(new Document({creator:'GHS MBONJO LIMBE',sections:[{children:paragraphs}]}))).arrayBuffer()));
  folder.file('records.pdf',pdf.output('arraybuffer'));
  manifest.groups.push({id:group.id,label:group.label,records:rows.length,fields:flat.length});
 }
 zip.file('manifest.json',JSON.stringify(manifest,null,2));zip.file('READ-ME.txt',`GHS MBONJO LIMBE SCHOOL BACKUP\n\nEach selected folder contains PDF and Word reading copies, an Excel field register and complete JSON records. Original embedded photographs and attachments are in original-files. Long Excel values continue on numbered parts. Complete JSON retains every selected record field, including original embedded files. Remote file links are recorded as links and are not downloaded.\n\n${manifest.scope}\n\nThe ZIP is readable without a password. Keep it in a safe place. Save it directly to an external drive when your browser offers a save location, or copy the downloaded ZIP to your USB drive. This ZIP is an archive, not an automatic restore package.\n`);
 return zip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:6}},m=>onProgress(`Compressing backup: ${Math.round(m.percent)}%`));
}
