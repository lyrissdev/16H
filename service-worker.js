const CACHE='16h-local-v15-3-lessons-1';
const FILES=['./','./index.html','./style.css','./app.mjs','./repository.mjs','./model.mjs','./colors.mjs','./deepwork.mjs','./deepwork-engine.mjs','./deepwork.css','./toolbox.css','./mindmap.html','./manifest.webmanifest','./icon-192.png','./icon-512.png'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE&&(k.startsWith('16h-local-')||k.startsWith('16h-pwa-'))).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==location.origin||u.pathname.includes('/v1/')||u.pathname.includes('/mcp'))return;e.respondWith(fetch(e.request).catch(()=>caches.match(e.request,{ignoreSearch:true})));});
