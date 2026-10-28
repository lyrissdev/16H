import {empty,validate,clone,mapId,applyMap} from './model.mjs';
const DB='16h-local-v15', STORE='documents';
let connection;
const listeners=new BroadcastChannel('16h-v15');
export const onChange=fn=>{listeners.addEventListener('message',fn); window.addEventListener('16h-change',fn);};
const settings=()=>JSON.parse(sessionStorage.getItem('16h-bridge') || 'null');
async function db(){if(connection)return connection; connection=await new Promise((res,rej)=>{const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>r.result.createObjectStore(STORE);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);}); return connection;}
async function request(config,method='GET',value){const response=await fetch(config.url+'/v1/state',{method,headers:{Authorization:`Bearer ${config.token}`,'Content-Type':'application/json'},body:value?JSON.stringify(value):undefined,signal:AbortSignal.timeout(8000)}); const data=await response.json(); if(!response.ok)throw Error(data.error || 'Pont indisponible.'); return data;}
export async function getState(){const remote=settings(); if(remote)return validate(await request(remote)); const database=await db(); return new Promise((res,rej)=>{const r=database.transaction(STORE).objectStore(STORE).get('state');r.onsuccess=()=>{try{res(validate(r.result || empty()));}catch(e){rej(e);}};r.onerror=()=>rej(r.error);});}
function notify(){listeners.postMessage('changed');window.dispatchEvent(new Event('16h-change'));}
export async function mutate(fn) {
  const remote=settings();
  if(remote) {const before=await getState(),s=clone(before);fn(s);validate(s);s.revision=before.revision+1;const saved=await request(remote,'PUT',{expectedRevision:before.revision,state:s});notify();return saved;}
  const database=await db();const saved=await new Promise((res,rej)=>{const tx=database.transaction(STORE,'readwrite'),store=tx.objectStore(STORE),r=store.get('state');let next,error;r.onsuccess=()=>{try {next=validate(clone(r.result || empty()));fn(next);validate(next);next.revision=(r.result?.revision || 0)+1;store.put(next,'state');}catch(e){error=e;tx.abort();}};tx.oncomplete=()=>res(next);tx.onabort=tx.onerror=()=>rej(error || tx.error || Error('Sauvegarde impossible.'));});notify();return saved;
}
export async function connect(url,token,useLocal){url=url.replace(/\/$/,'');if(!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(url))throw Error('Le pont doit être une adresse locale http://127.0.0.1:PORT.');const config={url,token};const remote=await request(config);if(useLocal) {const local=await getState();if(remote.projects.length || remote.events.length || remote.mindmaps.length || (remote.lessons||[]).length)throw Error('Le pont contient déjà des données. Choisissez « Utiliser les données du pont ».');await request(config,'PUT',{expectedRevision:remote.revision,state:local});}sessionStorage.setItem('16h-bridge',JSON.stringify(config));notify();}
export const disconnect=()=>{sessionStorage.removeItem('16h-bridge');notify();};
export const isConnected=()=>!!settings();
export async function saveMap(scope,pid,owner,doc,expected,baseline){let saved;await mutate(s=>{const id=mapId(scope,pid,owner),old=s.mindmaps.find(m=>m.id===id),project=(scope==='lesson'?s.lessons:s.projects).find(p=>p.id===pid);if(!project)throw Error(scope==='lesson'?'Leçon supprimée.':'Projet supprimé.');if((old?.revision || 0)!==expected || (baseline && JSON.stringify(project.subprojects)!==baseline))throw Error('Cette carte ou ses tâches ont changé ailleurs. Exportez votre carte puis rechargez avant de poursuivre.');
  saved={...applyMap(s,scope,pid,owner,doc),baseline:JSON.stringify(project.subprojects)};
});return saved;}
export async function putAsset(id,blob){const data=await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=()=>rej(r.error);r.readAsDataURL(blob);});await mutate(s=>{s.assets=s.assets.filter(a=>a.id!==id);s.assets.push({id,data});});}
export async function getAsset(id){const a=(await getState()).assets.find(a=>a.id===id);return a ? await (await fetch(a.data)).blob():null;}
export async function legacyAssets(){
 if(indexedDB.databases && !(await indexedDB.databases()).some(d=>d.name==='homeMindmapLocalAssets'))return [];
 const database=await new Promise((res,rej)=>{const r=indexedDB.open('homeMindmapLocalAssets');r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});
 if(!database.objectStoreNames.contains('images')){database.close();return [];}
 const records=await new Promise((res,rej)=>{const tx=database.transaction('images'),store=tx.objectStore('images'),values=store.getAll(),keys=store.getAllKeys();tx.oncomplete=()=>res(keys.result.map((id,i)=>({id:String(id),blob:values.result[i]})));tx.onerror=()=>rej(tx.error);});database.close();
 return Promise.all(records.map(async({id,blob})=>({id,data:await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=()=>rej(r.error);r.readAsDataURL(blob);})})));
}
