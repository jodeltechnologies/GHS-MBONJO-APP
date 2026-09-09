export const documentTitles={assumption:'CERTIFICATE OF ASSUMPTION OF DUTY',resumption:'CERTIFICATE OF RESUMPTION OF DUTY','effective service':'ATTESTATION OF EFFECTIVE SERVICE'};
export const letterheadEN=['REPUBLIC OF CAMEROON','Peace - Work - Fatherland','MINISTRY OF SECONDARY EDUCATION','REGIONAL DELEGATION','FOR THE SOUTH WEST','DIVISIONAL DELEGATION','FOR FAKO','GOV’T HIGH SCHOOL MBONJO','Tel: 677832194'];
export const letterheadFR=['RÉPUBLIQUE DU CAMEROUN','Paix - Travail - Patrie','MINISTÈRE DES ENSEIGNEMENTS','SECONDAIRES','DÉLÉGATION RÉGIONALE','DU SUD-OUEST','DÉLÉGATION DÉPARTEMENTALE','DU FAKO','LYCÉE DE MBONJO, LIMBÉ','Tél: 677832194'];
export const displayDate=value=>/^\d{4}-\d{2}-\d{2}$/.test(value||'')?value.split('-').reverse().join('/'):String(value||'');
export function documentLines(d){const verb=d.kind==='assumption'?'assumed':d.kind==='resumption'?'resumed':d.action;if(!['assumed','resumed'].includes(verb))throw Error('Choose assumed or resumed.');return [
 ...(d.kind==='effective service'?[{en:'I, the undersigned: ',value:d.principal,fr:'Je soussigné'},{en:'Principal of: ',value:'GOVERNMENT HIGH SCHOOL MBONJO-LIMBE',fr:'Proviseur du LYCÉE DE MBONJO-LIMBÉ'}]:[{en:'I, the undersigned, Principal of GHS Mbonjo: ',value:d.principal,fr:'Je soussigné, Proviseur du Lycée de Mbonjo'}]),
 {en:'Certify that: ',value:d.name,fr:'Atteste que M./Mme/Mlle'},
 {en:'Rank: ',value:`${d.rank}     Matricule Number: ${d.matricule}     Index: ${d.salaryIndex}`,fr:'Grade                         Numéro matricule                         Indice de grade'},
 {en:'Appointed/Transferred by Decision No.: ',value:d.decision,fr:'Nommé(e)/Affecté(e) par décision N°'},
 {en:`And ${verb} duty on: `,value:displayDate(d.dutyDate),fr:verb==='assumed'?'Et a pris service le':'Et a repris service le'},
 {en:'Is effectively serving as: ',value:d.position,tail:' in this institution',fr:'Est effectivement en service comme                         dans cette institution'},
 {en:'In testimony whereof, this attestation is issued to serve the purpose for which it is intended.',value:'',fr:'En foi de quoi la présente attestation est délivrée pour servir et valoir ce que de droit.'}
 ];}
