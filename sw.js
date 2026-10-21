'use strict';
// Scope-specific prefix keeps other GitHub Pages applications' caches intact.
const PREFIX='betano-'+self.registration.scope+'-',CACHE=PREFIX+'a1690d49015f5168';
const FILES=['./','./index.html','./panel.css','./panel.js','./static.js','./insights.js','./pwa.js','./manifest.webmanifest','./icon-192.png','./icon-512.png',...["./datos/football.json", "./datos/tennis.json", "./datos/nba.json", "./datos/nfl.json"]];
const URLS=new Set(FILES.map(file=>new URL(file,self.registration.scope).href));
self.addEventListener('install',event=>event.waitUntil((async()=>{const cache=await caches.open(CACHE);await cache.addAll(FILES);await self.skipWaiting();})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{for(const name of await caches.keys())if(name.startsWith(PREFIX)&&name!==CACHE)await caches.delete(name);await self.clients.claim();})()));
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET')return;
 const url=new URL(event.request.url);url.search='';
 if(!URLS.has(url.href))return;
 event.respondWith((async()=>{
  const cache=await caches.open(CACHE);
  try{const response=await fetch(event.request);if(response.ok)await cache.put(url.href,response.clone());return response;}
  catch{const cached=await cache.match(url.href);if(!cached)return new Response('Sin datos guardados para esta vista.',{status:503});const headers=new Headers(cached.headers);headers.set('X-Betano-Offline','1');return new Response(cached.body,{status:cached.status,statusText:cached.statusText,headers});}
 })());
});
