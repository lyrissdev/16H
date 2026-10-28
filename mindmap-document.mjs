// A complete 18.6 document is owned by exactly one project/stage/task/lesson map.
// Top-level elements always describe the root, even while a nested map is being edited.
const copy=x=>JSON.parse(JSON.stringify(x));
export function canvasViewport(v){return {x:Number.isFinite(v?.x)?v.x:120,y:Number.isFinite(v?.y)?v.y:40,zoom:Number.isFinite(v?.zoom)&&v.zoom>0?v.zoom:.9};}
export function restoreCanvas(doc,title='Carte principale',preferRootFields=true){
 const maps=copy(doc?.maps||{}),old=maps.root||{};
 const root=preferRootFields||!maps.root?{...old,viewport:copy(doc?.viewport||old.viewport||{x:120,y:40,zoom:.9}),elements:copy(doc?.elements||old.elements||[]),connectors:copy(doc?.connectors||old.connectors||[])}:old;
 maps.root={id:'root',title,parentMapId:null,sourceBlockId:null,...root};
 for(const m of Object.values(maps)){if(!m||!Array.isArray(m.elements)||!Array.isArray(m.connectors))throw Error('Sous-carte mentale invalide.');m.viewport=canvasViewport(m.viewport);}
 return maps;
}
export function canvasDocument(maps,currentId,current,meta={}){
 if(!maps.root||!maps[currentId])throw Error('Carte mentale introuvable.');
 maps[currentId]={...maps[currentId],viewport:canvasViewport(current.viewport),elements:copy(current.elements),connectors:copy(current.connectors)};
 const root=maps.root;
 return {...meta,version:'18.6',viewport:copy(root.viewport),elements:copy(root.elements),connectors:copy(root.connectors),maps:copy(maps),currentMapId:currentId};
}
export function syncNestedRoot(doc){
 if(doc.maps?.root){doc.maps.root.viewport=copy(doc.viewport||doc.maps.root.viewport||{x:0,y:0,zoom:1});doc.maps.root.elements=copy(doc.elements);doc.maps.root.connectors=copy(doc.connectors);}
 return doc;
}
