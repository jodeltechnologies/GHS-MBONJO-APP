const CACHE='ghs-public-__VERSION__';
const ASSETS=['/','/index.html','/style.css','/app.js','/install.js','/crest.jpg','/campus.jpg','/icon-192.png','/icon-512.png','/manifest.webmanifest','/fonts/Outfit.ttf','/fonts/Tinos-Regular.ttf','/fonts/Tinos-Bold.ttf'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('ghs-public-')&&k!==CACHE).map(k=>caches.delete(k))))));
self.addEventListener('fetch',event=>{const url=new URL(event.request.url);if(event.request.method!=='GET'||url.origin!==self.location.origin||url.search||(!ASSETS.includes(url.pathname)&&event.request.mode!=='navigate'))return;
 event.respondWith(fetch(event.request).then(response=>{if(response.ok&&ASSETS.includes(url.pathname)){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(event.request,copy)));}return response;}).catch(async()=>{const cached=await caches.match(event.request)||(event.request.mode==='navigate'?await caches.match('/index.html'):null);return cached||Response.error();}));
});


self.addEventListener('push',event=>{let data={title:'GHS MBONJO',body:'Open the school app for your update.',url:'/portal'};try{data={...data,...event.data.json()};}catch{}event.waitUntil(self.registration.showNotification(data.title,{body:data.body,icon:'/icon-192.png',badge:'/icon-192.png',data:{url:'/portal'}}));});
self.addEventListener('notificationclick',event=>{event.notification.close();event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(async windows=>{for(const w of windows){if(new URL(w.url).origin===self.location.origin){await w.focus();return w.navigate('/portal');}}return clients.openWindow('/portal');}));});
