const CACHE='ghs-public-fdb99873429ff8bf';
const LAZY=["/chunks/chunk-2RUN43TJ.js","/chunks/chunk-KX3HFV7O.js","/chunks/dist-GWYLXK7M.js","/chunks/exceljs.min-UANE4G3U.js","/chunks/html2canvas-NRGMQH2K.js","/chunks/index.es-6YTEWBBP.js","/chunks/jspdf.es.min-EULL5IBK.js","/chunks/purify.es-DTR4PY74.js"];
const ASSETS=['/','/index.html','/style.css','/app.js','/install.js','/crest.jpg','/campus.jpg','/icon-192.png','/icon-512.png','/manifest.webmanifest','/fonts/Outfit.ttf','/fonts/Tinos-Regular.ttf','/fonts/Tinos-Bold.ttf'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('ghs-public-')&&k!==CACHE).map(k=>caches.delete(k))))));
self.addEventListener('fetch',event=>{const url=new URL(event.request.url);if(event.request.method!=='GET'||url.origin!==self.location.origin||url.search||(!ASSETS.includes(url.pathname)&&!LAZY.includes(url.pathname)&&event.request.mode!=='navigate'))return;
 event.respondWith(fetch(event.request).then(response=>{if(response.ok&&(ASSETS.includes(url.pathname)||LAZY.includes(url.pathname))){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(event.request,copy)));}return response;}).catch(async()=>{const cached=await caches.match(event.request)||(event.request.mode==='navigate'?await caches.match('/index.html'):null);return cached||Response.error();}));
});
