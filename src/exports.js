import {attestationText} from './domain.js';
import QRCode from 'qrcode';
export const titles={assumption:'ATTESTATION OF ASSUMPTION OF DUTY',resumption:'ATTESTATION OF RESUMPTION OF DUTY','effective service':'ATTESTATION OF EFFECTIVE SERVICE'};
export const letterheadEN=['REPUBLIC OF CAMEROON','Peace - Work - Fatherland','MINISTRY OF SECONDARY EDUCATION','REGIONAL DELEGATION FOR THE SOUTH WEST','DIVISIONAL DELEGATION FOR FAKO','GOV’T HIGH SCHOOL MBONJO'];
export const letterheadFR=['RÉPUBLIQUE DU CAMEROUN','Paix - Travail - Patrie','MINISTÈRE DES ENSEIGNEMENTS SECONDAIRES','DÉLÉGATION RÉGIONALE DU SUD-OUEST','DÉLÉGATION DÉPARTEMENTALE DU FAKO','LYCÉE DE MBONJO, LIMBÉ'];
export const bytesToBase64=bytes=>{let s='';for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(s);};
export function exportModel(d,origin){if(d.kind==='letter')return {...d,title:d.title||'School message',body:d.body};if(!titles[d.kind]||!d.token)throw Error('Choose a registered attestation.');return {...d,title:titles[d.kind],body:attestationText(d),url:origin+'/#verify/'+d.token};}
export async function loadExportAssets(){const paths=['/crest.jpg','/document-font.ttf'];const a=await Promise.all(paths.map(async path=>{const r=await fetch(path);if(!r.ok)throw Error('A document asset failed to load.');return new Uint8Array(await r.arrayBuffer());}));return {crest:a[0],font:a[1]};}
export async function makeDocx(models,assets){const {Document,Packer,Paragraph,TextRun,ImageRun,Table,TableRow,TableCell,WidthType,AlignmentType,BorderStyle}=await import('docx');
 const para=(text,extra={})=>new Paragraph({children:[new TextRun({text:String(text),font:'Times New Roman',size:22})],spacing:{after:180,line:300},...extra});
 const border={style:BorderStyle.NONE,size:0,color:'FFFFFF'};
 const sections=[];
 for(const d of models){const headcell=(lines,width)=>new TableCell({width:{size:width,type:WidthType.DXA},borders:{top:border,bottom:border,left:border,right:border},children:lines.map(text=>new Paragraph({alignment:AlignmentType.CENTER,spacing:{after:40},children:[new TextRun({text,font:'Arial',size:15})]}))});
  const crestcell=new TableCell({width:{size:1100,type:WidthType.DXA},borders:{top:border,bottom:border,left:border,right:border},children:[new Paragraph({alignment:AlignmentType.CENTER,children:[new ImageRun({type:'jpg',data:assets.crest,transformation:{width:64,height:64},altText:{title:'School crest',description:'GHS Mbonjo Limbe crest',name:'crest'}})]})]});
  const children=[new Table({width:{size:9600,type:WidthType.DXA},columnWidths:[4250,1100,4250],rows:[new TableRow({children:[headcell(letterheadEN,4250),crestcell,headcell(letterheadFR,4250)]})]}),para(`Ref. No. ${d.reference||''}                                           Limbe, ${d.issueDate||''}`,{spacing:{before:300,after:300}}),new Paragraph({style:'Title',alignment:AlignmentType.CENTER,spacing:{after:360},children:[new TextRun({text:d.title,bold:true,size:26,color:'000000'})]})];
  if(d.status==='revoked')children.push(para('REVOKED / RÉVOQUÉ',{alignment:AlignmentType.CENTER}));
  for(const text of d.body.split(/\n\s*\n/))children.push(new Paragraph({spacing:{after:220,line:320},children:text.split('\n').flatMap((line,i)=>[...(i?[new TextRun({break:1})]:[]),new TextRun({text:line,font:'Times New Roman',size:24})])}));
  if(d.principal)children.push(para(d.kind==='letter'?d.principal:'The Principal / Le Proviseur',{alignment:AlignmentType.RIGHT,spacing:{before:400,after:120}}),...(d.kind==='letter'?[]:[para(d.principal,{alignment:AlignmentType.RIGHT}),para('Signature and official stamp',{alignment:AlignmentType.RIGHT,spacing:{before:850,after:200}})]));
  if(d.url){const qr=await QRCode.toDataURL(d.url,{width:180,margin:1});children.push(new Paragraph({children:[new ImageRun({type:'png',data:Uint8Array.from(atob(qr.split(',')[1]),c=>c.charCodeAt(0)),transformation:{width:85,height:85},altText:{title:'Verification QR',description:'Scan to verify the school document',name:'qr'}})],spacing:{before:200,after:80}}),new Paragraph({children:[new TextRun({text:d.url,size:16})]}));}
  sections.push({properties:{page:{size:{width:11906,height:16838},margin:{top:900,bottom:900,left:1100,right:1100}}},children});
 }
 return Packer.toBlob(new Document({creator:'GHS Mbonjo Limbe',title:models.length===1?models[0].title:'School documents',styles:{default:{document:{run:{font:'Times New Roman',size:24,color:'000000'}}}},sections}));
}
export async function makePdf(models,assets){const {jsPDF}=await import('jspdf');const pdf=new jsPDF({unit:'mm',format:'a4',compress:true});pdf.addFileToVFS('school.ttf',bytesToBase64(assets.font));pdf.addFont('school.ttf','School','normal');pdf.setFont('School','normal');let y=20;
 const next=()=>{pdf.addPage();pdf.setFontSize(9);pdf.text('GHS Mbonjo Limbe',20,15);y=28;};
 const lines=(text,size=11,width=170,center=false)=>{pdf.setFontSize(size);const a=pdf.splitTextToSize(String(text),width);for(const line of a){if(y>270)next();pdf.text(line,center?105:20,y,center?{align:'center'}:undefined);y+=size*.48;}y+=4;};
 for(let i=0;i<models.length;i++){const d=models[i];if(i)pdf.addPage();pdf.setFontSize(7);letterheadEN.forEach((s,n)=>pdf.text(s,55,18+n*4,{align:'center',maxWidth:73}));letterheadFR.forEach((s,n)=>pdf.text(s,155,18+n*4,{align:'center',maxWidth:73}));pdf.addImage(assets.crest,'JPEG',94,18,22,22);pdf.setDrawColor(70);pdf.line(20,47,190,47);y=58;
  lines(`Ref. No. ${d.reference||''}                 Limbe, ${d.issueDate||''}`,9);y+=4;lines(d.title,13,170,true);if(d.status==='revoked')lines('REVOKED / RÉVOQUÉ',13,170,true);y+=6;
  for(const paragraph of String(d.body).split(/\n\s*\n/))lines(paragraph,11);
  if(d.principal){if(y+75>275)next();y+=8;lines(d.kind==='letter'?d.principal:'The Principal / Le Proviseur',10);if(d.kind!=='letter'){lines(d.principal,11);y+=20;lines('Signature and official stamp',9);}}
  if(d.url){if(y+45>275)next();const qr=await QRCode.toDataURL(d.url,{width:180,margin:1});pdf.addImage(qr,'PNG',20,y,28,28);pdf.setFontSize(8);pdf.text('Verify this document',55,y+7);const wrapped=pdf.splitTextToSize(d.url,130);pdf.text(wrapped,55,y+13);y+=40;}
 }
 const count=pdf.getNumberOfPages();for(let i=1;i<=count;i++){pdf.setPage(i);pdf.setFontSize(8);pdf.text(`${i} / ${count}`,190,286,{align:'right'});}return pdf.output('blob');
}
export function downloadBlob(blob,filename){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
