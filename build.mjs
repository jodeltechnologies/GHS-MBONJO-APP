import {build} from 'esbuild';
import {readFile,writeFile,readdir,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
await rm('public/chunks',{recursive:true,force:true});
await build({entryPoints:['src/app.js'],bundle:true,minify:true,format:'esm',splitting:true,outdir:'public',chunkNames:'chunks/[name]-[hash]',platform:'browser',target:'es2022'});
// The PDF reader's worker is built as its own file and served from this origin.
// The Content-Security-Policy allows scripts and workers from 'self' only, so a
// worker cannot come from a CDN; and reading a nine-page progression sheet on the
// main thread would freeze the page while it ran.
await build({entryPoints:{'pdf.worker':'node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs'},
 bundle:true,minify:true,format:'esm',outdir:'public',platform:'browser',target:'es2022'});
const chunks=(await readdir('public/chunks')).filter(n=>n.endsWith('.js')).map(n=>'chunks/'+n);
const hash=createHash('sha256');for(const name of ['app.js','style.css','index.html','install.js','sw-template.js','pdf.worker.js',...chunks])hash.update(await readFile('public/'+name));
// Cache only public application assets. Export libraries load when their feature is opened.
const template=await readFile('public/sw-template.js','utf8');
await writeFile('public/sw.js',template.replace('__VERSION__',hash.digest('hex').slice(0,16)).replace('const ASSETS=',`const LAZY=${JSON.stringify([...chunks.map(n=>'/'+n),'/pdf.worker.js'])};\nconst ASSETS=`).replace("(!ASSETS.includes(url.pathname)&&event.request.mode!=='navigate')","(!ASSETS.includes(url.pathname)&&!LAZY.includes(url.pathname)&&event.request.mode!=='navigate')").replace("response.ok&&ASSETS.includes(url.pathname)","response.ok&&(ASSETS.includes(url.pathname)||LAZY.includes(url.pathname))"));
