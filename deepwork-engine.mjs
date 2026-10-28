import {syncNestedRoot} from './mindmap-document.mjs';
export const MINUTE=60000;
const copy=x=>JSON.parse(JSON.stringify(x));
export function createSession(projectId,projectName,totalMinutes,tasks,now=Date.now()) {
 if(!Number.isFinite(totalMinutes)||totalMinutes<1||totalMinutes>480)throw Error('Choisissez une durée de session entre 1 et 480 minutes.');
 if(!tasks.length)throw Error('Sélectionnez au moins une tâche.');
 const ids=new Set();const items=tasks.map(t=>{if(ids.has(t.key))throw Error('Tâche sélectionnée en double.');ids.add(t.key);if(!Number.isFinite(t.minutes)||t.minutes<=0)throw Error('Chaque tâche doit avoir une durée positive.');return {...copy(t),budget:t.minutes*MINUTE,spent:0,done:false,deferred:false};});
 const total=totalMinutes*MINUTE,sum=items.reduce((n,t)=>n+t.budget,0);if(sum>total)throw Error('Le total des tâches dépasse la durée de la session.');
 return {version:1,id:globalThis.crypto.randomUUID(),projectId,projectName,total,tasks:items,index:0,elapsed:0,segmentStartedAt:now,status:'running',remainingReserve:total-sum,createdAt:now,revision:1};
}
export function progress(s,now=Date.now()) {
 const delta=s.status==='running'?Math.max(0,now-s.segmentStartedAt):0,t=s.tasks[s.index];
 return {totalRemaining:Math.max(0,s.total-s.elapsed-delta),taskRemaining:t?Math.max(0,t.budget-t.spent-delta):0,delta};
}
export function tick(input,now=Date.now()) {
 const s=copy(input);if(s.status!=='running')return s;
 const t=s.tasks[s.index],p=progress(s,now),limit=Math.min(s.total-s.elapsed,t?t.budget-t.spent:Infinity);
 if(p.delta>=limit){s.elapsed+=Math.max(0,limit);if(t)t.spent+=Math.max(0,limit);s.status=t?'checkpoint':'finished';s.segmentStartedAt=null;s.revision++;}
 return s;
}
export function canExtend(s){return s.status==='checkpoint' && s.total-s.elapsed>=15*MINUTE && s.remainingReserve+s.tasks.slice(s.index+1).reduce((n,t)=>n+t.budget-t.spent,0)>=15*MINUTE;}
export function extend(input,now=Date.now()) {
 const s=copy(input);if(!canExtend(s))throw Error('Il reste moins de 15 minutes disponibles dans cette session.');
 const extra=15*MINUTE;let take=extra;
 // Reduce following tasks proportionally, exactly to the millisecond. Free reserve covers any remainder.
 const future=s.tasks.slice(s.index+1),available=future.reduce((n,t)=>n+Math.max(0,t.budget-t.spent),0),fromTasks=Math.min(take,available);let pending=fromTasks;
 future.forEach((t,i)=>{const reduction=i===future.length-1?pending:Math.min(pending,Math.floor(fromTasks*(t.budget-t.spent)/available)||0);t.budget-=reduction;pending-=reduction;if(t.budget<=t.spent)t.deferred=true;});
 take-=fromTasks;s.remainingReserve-=take;s.tasks[s.index].budget+=extra;s.status='running';s.segmentStartedAt=now;s.revision++;return s;
}
export function confirmTask(input,now=Date.now()) {
 const s=copy(input);if(s.status!=='checkpoint')throw Error('Aucune tâche à confirmer.');
 s.tasks[s.index].done=true;s.index++;
 while(s.index<s.tasks.length && s.tasks[s.index].budget<=s.tasks[s.index].spent){s.tasks[s.index].deferred=true;s.index++;}
 if(s.index>=s.tasks.length && s.elapsed>=s.total){s.status='finished';s.segmentStartedAt=null;}else{s.status='running';s.segmentStartedAt=now;}
 s.revision++;return s;
}
export function pause(input,now=Date.now()){const s=tick(input,now);if(s.status==='running'){const p=progress(s,now);s.elapsed+=p.delta;if(s.tasks[s.index])s.tasks[s.index].spent+=p.delta;s.status='paused';s.segmentStartedAt=null;s.revision++;}return s;}
export function resume(input,now=Date.now()){const s=copy(input);if(s.status!=='paused')throw Error('La session n’est pas en pause.');s.status='running';s.segmentStartedAt=now;s.revision++;return s;}
export function stop(input,now=Date.now()){const s=pause(input,now);s.status='stopped';s.segmentStartedAt=null;s.revision++;return s;}
export function resolveSessionStage(state,context){
 const p=state.projects.find(p=>p.id===context?.pid);if(!p)return null;
 if(context.scope==='stage')return p.subprojects.find(s=>s.id===context.owner)||null;
 if(context.scope==='detail'){
  const direct=p.subprojects.find(s=>s.tasks.some(t=>context.owner===`task:${s.id}:${t.id}`));if(direct)return direct;
  if(context.stageId)return p.subprojects.find(s=>s.id===context.stageId)||null;
 }
 return null;
}
export function sessionTasks(state,projectId,stageId=null){
 const p=state.projects.find(p=>p.id===projectId);if(!p)throw Error('Projet introuvable.');
 if(stageId&&!p.subprojects.some(s=>s.id===stageId))throw Error('Étape introuvable.');
 const tasks=[];for(const stage of p.subprojects.filter(s=>!stageId||s.id===stageId))for(const t of stage.tasks)if(!t.done)tasks.push({key:JSON.stringify(['task',stage.id,t.id]),name:t.name,group:stage.name,stageId:stage.id,taskId:t.id,minutes:Number(t.durationMinutes)||25});
 const stage=p.subprojects.find(s=>s.id===stageId);
 const seen=new Set();for(const map of state.mindmaps.filter(m=>m.projectId===projectId&&m.scope!=='lesson'&&(!stageId||(m.scope==='stage'&&m.ownerId===stageId)||(m.scope==='detail'&&stage.tasks.some(t=>m.ownerId===`task:${stageId}:${t.id}`)))))for(const node of map.doc.elements){
  if(node.type==='todo'&&!node.stageId)for(const item of node.items||[]){const key=JSON.stringify(['item',node.id,item.id]);if(!item.done&&!seen.has(key)){seen.add(key);tasks.push({key,name:item.text||'Tâche',group:node.text||'Todo',todoId:node.id,itemId:item.id,minutes:25});}}
  if(node.type==='taskcard'&&!node.done&&!node.sourceTodoId&&!node.external16hTask){const key=JSON.stringify(['card',node.id]);if(!seen.has(key)){seen.add(key);tasks.push({key,name:node.text||'Tâche',group:'Taskcard',cardId:node.id,minutes:25});}}
 }return tasks;
}
export function addStageTask(state,projectId,stageId,name,minutes){
 const stage=state.projects.find(p=>p.id===projectId)?.subprojects.find(s=>s.id===stageId);
 if(!stage)throw Error('Choisissez une étape existante.');
 const title=String(name||'').trim();if(!title)throw Error('Donnez un nom à la tâche.');
 if(!Number.isInteger(minutes)||minutes<1||minutes>480)throw Error('La durée doit être comprise entre 1 et 480 minutes entières.');
 const task={id:globalThis.crypto.randomUUID(),name:title,description:'',durationMinutes:minutes,done:false};stage.tasks.push(task);
 for(const map of state.mindmaps.filter(m=>m.projectId===projectId&&m.scope!=='lesson')){let changed=false;for(const node of map.doc.elements.filter(n=>n.type==='todo'&&n.stageId===stageId)){
  node.items=stage.tasks.map(t=>({...node.items?.find(i=>String(i.id)===String(t.id)),id:t.id,text:t.name,done:!!t.done}));changed=true;
 }if(changed){map.revision++;syncNestedRoot(map.doc);}}
 return task;
}
export function markTaskDone(state,projectId,task){
 const p=state.projects.find(p=>p.id===projectId);if(!p)throw Error('Le projet de cette session a été supprimé.');let found=false;const sourceTodos=new Set(task.todoId?[task.todoId]:[]);if(task.stageId)for(const m of state.mindmaps.filter(m=>m.projectId===projectId&&m.scope!=='lesson'))for(const n of m.doc.elements)if(n.type==='todo'&&n.stageId===task.stageId)sourceTodos.add(n.id);
 if(task.stageId){const t=p.subprojects.find(s=>s.id===task.stageId)?.tasks.find(t=>t.id===task.taskId);if(t){t.done=true;found=true;}}
 for(const map of state.mindmaps.filter(m=>m.projectId===projectId&&m.scope!=='lesson')){let changed=false;
  for(const node of map.doc.elements){
   if(node.type==='todo'&&((task.stageId&&node.stageId===task.stageId)||(task.todoId&&node.id===task.todoId))){const item=node.items?.find(i=>String(i.id)===String(task.taskId||task.itemId));if(item){item.done=true;changed=true;found=true;}}
   if(node.type==='taskcard'&&((task.cardId&&node.id===task.cardId)||(sourceTodos.has(node.sourceTodoId)&&String(node.sourceTodoItemId)===String(task.itemId||task.taskId))||(node.external16hTask&&sourceTodos.has(map.ownerId)&&String(node.taskItemId)===String(task.itemId||task.taskId)))){node.done=true;changed=true;found=true;}
  }if(changed){map.revision++;syncNestedRoot(map.doc);}
 }if(!found)throw Error('Cette tâche a été supprimée ou déplacée. Arrêtez la session pour revoir sa sélection.');
}
