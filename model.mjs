export const SCHEMA = 1;
export const uid = () => globalThis.crypto.randomUUID();
export const empty = () => ({schemaVersion:SCHEMA, revision:0, events:[], projects:[], lessons:[], mindmaps:[], assets:[], migration:null});
export const clone = x => JSON.parse(JSON.stringify(x));
export function requireText(x, label) { if(typeof x !== 'string' || !x.trim()) throw Error(`${label} manquant.`); return x.trim(); }
export const color = x => /^#[0-9a-f]{6}$/i.test(x || '') ? x : '#7659d6';
export function event(raw) {
  const parse = x => typeof x === 'number' ? x : /^\d{2}:\d{2}$/.test(x || '') ? `${raw.date || raw.plannedDate}T${x}:00` : x;
  const start = new Date(parse(raw.start ?? raw.startTime ?? raw.start_at));
  const endValue = raw.end ?? raw.endTime ?? raw.end_at;
  const end = endValue == null ? new Date(+start + Number(raw.durationMinutes || 60)*60000) : new Date(parse(endValue));
  if(!Number.isFinite(+start) || !Number.isFinite(+end) || +end <= +start) throw Error('Dates de rendez-vous invalides : la fin doit suivre le début.');
  return {id:String(raw.id || `event-${+start}-${raw.title || raw.name}`), title:requireText(raw.title ?? raw.name,'Titre'), start:start.toISOString(), end:end.toISOString(), allDay:!!raw.allDay, address:String(raw.address || ''), description:String(raw.description || ''), color:color(raw.color), projectId:raw.projectId ? String(raw.projectId) : null, updatedAt:new Date().toISOString()};
}
export function project(raw) {
  const p={...clone(raw), id:String(raw.id || uid()), name:requireText(raw.name ?? raw.title,'Projet'), description:String(raw.description || ''), color:color(raw.color)};
  p.subprojects=(raw.subprojects || raw.stages || []).map((s,i)=>({...clone(s),id:String(s.id || uid()),name:requireText(s.name ?? s.title,'Étape'),order:i+1,completed:!!s.completed,tasks:(s.tasks || []).map(t=>({...clone(t),id:String(t.id || uid()),name:requireText(t.name ?? t.text ?? t.title,'Tâche'),done:!!t.done}))}));
  return p;
}
export function lesson(raw){return {id:String(raw.id||uid()),name:requireText(raw.name??raw.title,'Leçon'),description:String(raw.description||''),color:color(raw.color),updatedAt:new Date().toISOString()};}
export function deleteLesson(s,id){s.lessons=s.lessons.filter(l=>l.id!==id);s.mindmaps=s.mindmaps.filter(m=>!(m.scope==='lesson'&&m.projectId===id));}
export function validate(s) {
  if(s.schemaVersion !== SCHEMA) throw Error('Version de données non prise en charge.');
  if(s.lessons===undefined)s.lessons=[];
  for(const k of ['events','projects','lessons','mindmaps','assets']) {
    if(!Array.isArray(s[k])) throw Error(`Collection ${k} invalide.`);
    const ids=new Set(); for(const v of s[k]) { requireText(v.id,'Identifiant'); if(ids.has(v.id)) throw Error(`Identifiant en double : ${v.id}`); ids.add(v.id); }
  }
  for(const e of s.events) event(e);
  for(const l of s.lessons)requireText(l.name,'Leçon');
  for(const p of s.projects) {
    requireText(p.name,'Projet'); const ids=new Set();
    if(!Array.isArray(p.subprojects)) throw Error('Étapes invalides.');
    for(const stage of p.subprojects) {requireText(stage.name,'Étape'); requireText(stage.id,'Identifiant étape'); if(ids.has(stage.id)) throw Error('Étape en double.'); ids.add(stage.id); const tasks=new Set(); for(const t of stage.tasks || []) {requireText(t.id,'Identifiant tâche'); requireText(t.name,'Tâche'); if(tasks.has(t.id)) throw Error('Tâche en double.'); tasks.add(t.id);}}
  }
  for(const m of s.mindmaps) {if(m.scope==='lesson'?!s.lessons.some(l=>l.id===m.projectId):(!['project','stage','detail'].includes(m.scope)||!s.projects.some(p=>p.id===m.projectId))) throw Error('Carte sans projet ou leçon valide.'); if(!Array.isArray(m.doc?.elements) || !Array.isArray(m.doc?.connectors)) throw Error('Document de carte invalide.');}
  return s;
}
export const mapId = (scope,pid,owner='') => JSON.stringify([scope,pid,owner]);
export function applyMap(s,scope,pid,owner,doc) {
  const p=(scope==='lesson'?s.lessons:s.projects).find(p=>p.id===pid);if(!p)throw Error(scope==='lesson'?'Leçon introuvable.':'Projet introuvable.');
  for(const todo of doc.elements.filter(e=>e.type==='todo'&&e.stageId)) {
    const stage=(p.subprojects||[]).find(v=>v.id===String(todo.stageId));if(!stage)continue;
    if(String(todo.text || '').trim())stage.name=String(todo.text).trim();
    stage.tasks=(todo.items||[]).filter(i=>String(i.text||'').trim()).map(i=>({...stage.tasks.find(t=>t.id===String(i.id)),id:String(i.id),name:String(i.text),done:!!i.done}));
  }
  if(scope==='detail')for(const card of doc.elements.filter(e=>e.type==='taskcard'&&e.external16hTask)) {
    for(const other of s.mindmaps.filter(m=>m.scope!=='lesson'&&m.projectId===pid&&m.ownerId!==owner))for(const todo of other.doc.elements.filter(e=>e.type==='todo'&&e.id===owner)) {
      const item=todo.items?.find(i=>String(i.id)===String(card.taskItemId));if(item&&item.done!==!!card.done){item.done=!!card.done;other.revision++;if(todo.stageId){const t=p.subprojects.find(v=>v.id===String(todo.stageId))?.tasks.find(t=>t.id===String(item.id));if(t)t.done=item.done;}}
    }
  }
  const id=mapId(scope,pid,owner),old=s.mindmaps.find(m=>m.id===id),saved={id,scope,projectId:pid,ownerId:owner,doc:clone(doc),revision:(old?.revision||0)+1};
  s.mindmaps=s.mindmaps.filter(m=>m.id!==id);s.mindmaps.push(saved);return saved;
}
export function legacyMapKey(scope,pid,owner='') {return scope==='project' ? `16h.projectmindmap.${pid}` : scope==='stage' ? `16h.stagemindmap.${pid}.${owner}` : `16h.blockdetail.${pid}.${owner}`;}
export function migrate(raw, storage={}) {
  const s=empty(); s.projects=(raw.projects || []).map(project);
  const skipped=[];
  for(const b of raw.blocks || []) {
    // Only fixed appointments survive automatic migration. Work sessions remain in the original backup.
    if(b.floating || !(/rdv|rendez|call|appel/i.test(`${b.typeId || ''} ${b.name || ''}`))) {skipped.push(b.id); continue;}
    try {s.events.push(event(b));} catch {skipped.push(b.id);}
  }
  for(const p of s.projects) {
    const contexts=[['project',''],...p.subprojects.map(t=>['stage',t.id])];
    for(const [key,value] of Object.entries(storage)) {
      const prefix=`16h.blockdetail.${p.id}.`; if(key.startsWith(prefix)) contexts.push(['detail',key.slice(prefix.length)]);
    }
    for(const [scope,ownerId] of contexts) {const value=storage[legacyMapKey(scope,p.id,ownerId)]; if(!value) continue; const doc=typeof value==='string'?JSON.parse(value):value; s.mindmaps.push({id:mapId(scope,p.id,ownerId),scope,projectId:p.id,ownerId,doc,revision:1});}
  }
  s.migration={from:'14.1',at:new Date().toISOString(),skippedBlockIds:skipped,legacyBackup:clone(raw),legacyStorage:clone(storage)};
  return validate(s);
}
export function importPayload(raw) {
  if(raw.schemaVersion != null) return validate(clone(raw));
  if(raw.blocks && raw.projects) return migrate(raw, raw.legacyStorage || {});
  const s=empty();
  if(raw.lesson || raw.lessons) s.lessons=(raw.lessons || [raw.lesson]).map(lesson);
  else if(raw.project || raw.projects || raw.subprojects || raw.stages) s.projects=(raw.projects || [raw.project || raw]).map(project);
  else if(Array.isArray(raw) && raw.some(x=>x.subprojects || x.stages)) s.projects=raw.map(project);
  else {const rows=Array.isArray(raw)?raw:raw.events || raw.planning || raw.blocks; if(!Array.isArray(rows)) throw Error('Format inconnu : sauvegarde 16H, projets ou planning attendus.'); s.events=rows.map(event);}
  return validate(s);
}
function mergeRows(a,b) {const result=clone(a); for(const row of b) {const old=result.find(v=>v.id===row.id); if(old) throw Error(`L’identifiant « ${row.id} » existe déjà. Utilisez Restaurer pour remplacer une sauvegarde complète, ou changez cet identifiant.`); result.push(clone(row));} return result;}
export function mergeState(a,b) {const result=clone(a); for(const k of ['events','projects','lessons','mindmaps','assets']) result[k]=mergeRows(a[k]||[],b[k]||[]); if(b.migration) result.migration=b.migration; return validate(result);}
