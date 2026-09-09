import {build} from 'esbuild';
await build({entryPoints:['src/app.js'],bundle:true,minify:true,outfile:'public/app.js',platform:'browser',target:'es2022'});
