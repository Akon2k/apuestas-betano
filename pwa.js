'use strict';
window.addEventListener('DOMContentLoaded',()=>{
 const published=Boolean(document.querySelector('meta[name="panel-static"]'));
 if(!published)return;
 document.querySelector('#install-help').hidden=false;
 let promptEvent=null;
 const button=document.querySelector('#install-app');
 const status=document.querySelector('#install-status');
 window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();promptEvent=event;button.hidden=false;});
 button.onclick=async()=>{if(!promptEvent)return;const event=promptEvent;promptEvent=null;await event.prompt();const choice=await event.userChoice;if(choice.outcome==='accepted')button.hidden=true;};
 window.addEventListener('appinstalled',()=>{button.hidden=true;status.textContent='Aplicación instalada.';});
 if(window.matchMedia('(display-mode: standalone)').matches||navigator.standalone)status.textContent='Abierta como aplicación.';
 if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js',{scope:'./'}).then(async()=>{await navigator.serviceWorker.ready;if(!status.textContent)status.textContent='Lista para consultar la última publicación sin conexión.';}).catch(()=>{status.textContent='No se pudo preparar el modo sin conexión. Puedes seguir usando la página.';});
 window.addEventListener('offline',()=>{document.querySelector('#offline-note').hidden=false;});
 window.addEventListener('online',()=>{if(window.clearStaticData)window.clearStaticData();if(typeof load==='function')load();});
});
