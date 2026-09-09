if(location.protocol==='https:'&&!globalThis.SCHOOL_PREVIEW){
 navigator.serviceWorker?.register('/sw.js').catch(()=>{});
 let promptEvent;
 const installed=()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone;
 const button=document.createElement('button');button.textContent='Install app / Installer';button.className='install-app';button.hidden=installed();document.body.append(button);
 addEventListener('beforeinstallprompt',e=>{e.preventDefault();promptEvent=e;button.hidden=installed();});
 addEventListener('appinstalled',()=>{button.hidden=true;promptEvent=null;});
 button.addEventListener('click',async()=>{if(promptEvent){await promptEvent.prompt();await promptEvent.userChoice;promptEvent=null;return;}
 const dialog=document.createElement('dialog');dialog.innerHTML='<h2>Install GHS Mbonjo</h2><p>Android or computer: open this website in Chrome or Edge. Use the browser menu and choose Install app or Add to Home screen.</p><p>iPhone or iPad: open in Safari, tap Share, then Add to Home Screen.</p><p>Internet access is required for login and school records.</p><p>Sur iPhone : Safari → Partager → Sur l’écran d’accueil. Sur Android ou ordinateur : menu Chrome ou Edge → Installer l’application.</p><form method="dialog"><button>Close / Fermer</button></form>';document.body.append(dialog);dialog.addEventListener('close',()=>dialog.remove());dialog.showModal();});
}
