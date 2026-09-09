const CACHE='ghs-public-__VERSION__';
const ASSETS=['/','/index.html','/style.css','/app.js','/install.js','/crest.jpg','/campus.jpg','/icon-192.png','/icon-512.png','/manifest.webmanifest'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('ghs-public-')&&k!==CACHE).map(k=>caches.delete(k))))));
self.addEventListener('fetch',event=>{const url=new URL(event.request.url);if(event.request.method!=='GET'||url.origin!==self.location.origin||url.search||(!ASSETS.includes(url.pathname)&&event.request.mode!=='navigate'))return;
 event.respondWith(fetch(event.request).then(response=>{if(response.ok&&ASSETS.includes(url.pathname)){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(event.request,copy)));}return response;}).catch(async()=>{const cached=await caches.match(event.request)||(event.request.mode==='navigate'?await caches.match('/index.html'):null);return cached||Response.error();}));
});
