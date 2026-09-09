import {build} from 'esbuild';
await build({entryPoints:['src/app.js'],bundle:true,minify:true,outfile:'public/app.js',platform:'browser',target:'es2022'});
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const hash=createHash('sha256');for(const name of ['app.js','style.css','index.html','install.js','sw-template.js'])hash.update(await readFile('public/'+name));
await writeFile('public/sw.js',(await readFile('public/sw-template.js','utf8')).replace('__VERSION__',hash.digest('hex').slice(0,16)));
