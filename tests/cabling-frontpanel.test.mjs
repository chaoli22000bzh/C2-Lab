import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const load=async path=>import("data:text/javascript;base64,"+Buffer.from(await readFile(new URL(path,import.meta.url))).toString("base64"));
const {createAssetRegistry} = await import("../r2d3-v1/asset-profiles.js");
const {buildCablingViewModel}=await load("../shared-ui/v1/cabling-visual.js");
const {connectNewCable,detachExistingCable,attachExistingCable}=await load("../shared-ui/v1/cabling-actions.js");
// Charger les fonctions de projection sans DOM : l'adaptateur est un composant ESM navigateur.
const source=await readFile(new URL("../shared-ui/v1/cabling-frontpanel.js",import.meta.url),"utf8");
assert.match(source,/export function mountCablingFrontpanel/);
globalThis.__cfBuild=buildCablingViewModel;
const pure="const buildCablingViewModel=globalThis.__cfBuild;\n"+
 source.replace(/^import .*;\s*$/gm,"").replace(/export function mountCablingFrontpanel[\s\S]*$/,"");
const {arrangePorts,buildFrontpanelSnapshot}=await import("data:text/javascript;base64,"+Buffer.from(pure).toString("base64"));
delete globalThis.__cfBuild;
function fixture(){
 const registry=createAssetRegistry();
 const location=registry.createPlace({name:"Local"}).place;
 const panel=registry.createPanel({name:"P1",placeId:location.id,count:4,start:1,prefix:"A"}).panel;
 const swProfile=registry.createProfile("Switch").profile;
 assert.equal(registry.addPortGroup(swProfile.id,{type:"ethernet-rj45",prefix:"LAN",start:1,count:24,digits:2}).success,true);
 const sw=registry.createAsset(swProfile.id,{name:"SW01"}).asset;
 return {registry,panel,sw};
}
test("projette la façade RJ45 à partir du registre sans modification",()=>{
 const {registry}=fixture(),before=JSON.stringify(registry.exportState());
 const snap=buildFrontpanelSnapshot(registry,"front",{"SW01":{columns:12,switchPairs:true}});
 assert.equal(snap.devices.find(d=>d.name==="SW01").slots.length,24);
 assert.equal(JSON.stringify(registry.exportState()),before);
});
test("distingue les deux faces du même panneau",()=>{
 const {registry}=fixture();
 const front=buildFrontpanelSnapshot(registry,"front").devices.find(d=>d.name==="P1");
 const back=buildFrontpanelSnapshot(registry,"back").devices.find(d=>d.name==="P1");
 assert.equal(front.slots.length,4);
 assert.equal(back.slots.length,4);
 assert.ok(front.slots.every(x=>x.label.endsWith("avant")));
 assert.ok(back.slots.every(x=>x.label.endsWith("arrière")));
 assert.notEqual(front.slots[0].id,back.slots[0].id);
});
test("respecte les emplacements vides sans inventer des ports",()=>{
 const {registry}=fixture();
 const panel=buildFrontpanelSnapshot(registry,"front").devices.find(d=>d.name==="P1");
 const slots=arrangePorts(panel,{slots:["A1",null,"A2",null,"A3","A4"]},"front");
 assert.equal(slots.length,6);assert.equal(slots[1],null);assert.equal(slots[3],null);
 assert.equal(slots[2].label,"A2 avant");
});
test("les connexions existantes sont présentes à l'ouverture",()=>{
 const {registry,panel,sw}=fixture();
 const r=connectNewCable(registry,panel.ports[0].front.id,sw.ports[0].id);
 assert.equal(r.success,true);
 const snap=buildFrontpanelSnapshot(registry,"front");
 assert.equal(snap.connections.length,1);
 assert.equal(snap.devices.find(d=>d.name==="P1").slots[0].cableId,r.cableId);
 assert.equal(snap.devices.find(d=>d.name==="SW01").slots[0].cableId,r.cableId);
});
test("refuse le raccordement sur un port occupé",()=>{
 const {registry,panel,sw}=fixture();
 assert.equal(connectNewCable(registry,panel.ports[0].front.id,sw.ports[0].id).success,true);
 assert.equal(connectNewCable(registry,panel.ports[0].front.id,sw.ports[1].id).code,"port_occupied");
});
test("débrancher ne supprime pas le câble, et autorise sa restauration",()=>{
 const {registry,panel,sw}=fixture();
 const r=connectNewCable(registry,panel.ports[0].front.id,sw.ports[0].id);
 assert.equal(detachExistingCable(registry,r.cableId,1).success,true);
 assert.equal(registry.listCables().length,1);
 assert.equal(buildFrontpanelSnapshot(registry).devices.find(d=>d.name==="SW01").slots[0].cableId,null);
 assert.equal(attachExistingCable(registry,r.cableId,1,sw.ports[0].id).success,true);
});
test("un chemin avant/arrière traverse le panneau uniquement si les câbles existent",()=>{
 const {registry,panel,sw}=fixture();
 const another=registry.createPanel({name:"P2",placeId:registry.listPlaces()[0].id,count:1,start:1}).panel;
 const link=connectNewCable(registry,panel.ports[0].back.id,another.ports[0].back.id);
 assert.equal(link.success,true);
 let path=registry.explorePhysicalPath(another.ports[0].front.id,sw.ports[0].id);
 assert.equal(path.connected,false);
 assert.equal(connectNewCable(registry,panel.ports[0].front.id,sw.ports[0].id).success,true);
 path=registry.explorePhysicalPath(another.ports[0].front.id,sw.ports[0].id);
 assert.equal(path.connected,true);
});
