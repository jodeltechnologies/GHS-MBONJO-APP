import {randomInt} from 'node:crypto';
const groups=['ABCDEFGHJKLMNPQRSTUVWXYZ','abcdefghijkmnopqrstuvwxyz','23456789','!@#'];
export function temporaryPassword(){
 const alphabet=groups.join('');
 const chars=groups.map(group=>group[randomInt(group.length)]);
 while(chars.length<9)chars.push(alphabet[randomInt(alphabet.length)]);
 for(let i=chars.length-1;i>0;i--){const j=randomInt(i+1);[chars[i],chars[j]]=[chars[j],chars[i]];}
 return chars.join('');
}
