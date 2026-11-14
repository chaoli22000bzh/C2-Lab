import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const load = async relative => import("data:text/javascript;base64,"+
 Buffer.from(await readFile(new URL(relative,import.meta.url))).toString("base64"));
const {createAssetRegistry}=await load("../r2d3-v1/asset-profiles.js");
const {buildCablingViewModel}=await load("../shared-ui/v1/cabling-visual.js");
const {connectNewCable,attachExistingCable,detachExistingCable,connectorsForPoints}=await load("../shared-ui/v1/cabling-actions.js");

function fixture(){
 const engine=createAssetRegistry();
 const place=engine.createPlace({name:"Rennes"}).place;
 const remote=engine.createPlace({name:"Redon"}).place;
 const panel=engine.createPanel({name:"P1",placeId:place.id,count:3,start:1}).panel;
 const remotePanel=engine.createPanel({name:"P2",placeId:remote.id,count:3,start:1}).panel;
 const points=engine.listCablePoints();
 const a=points.find(x=>x.infrastructureId===panel.id&&x.side==="front");
 const b=points.find(x=>x.infrastructureId===remotePanel.id&&x.side==="front");
 const back=points.find(x=>x.infrastructureId===panel.id&&x.side==="back");
 return {engine,place,remote,a,b,back};
}

test("crée un câble raccordé aux deux ports depuis l'interface graphique",()=>{
 const {engine,a,b}=fixture();
 assert.deepEqual(connectorsForPoints(engine,a.portId,b.portId),["rj45-male","rj45-male"]);
 const result=connectNewCable(engine,a.portId,b.portId);
 assert.equal(result.success,true);
 assert.deepEqual(engine.getCable(result.cableId).ends,[{portId:a.portId},{portId:b.portId}]);
});

test("refuse le même port sans créer de câble",()=>{
 const {engine,a}=fixture();
 assert.equal(connectNewCable(engine,a.portId,a.portId).code,"same_port");
 assert.equal(engine.listCables().length,0);
});

test("refuse un port occupé sans modifier le registre",()=>{
 const {engine,a,b,back}=fixture();
 assert.equal(connectNewCable(engine,a.portId,b.portId).success,true);
 const before=JSON.stringify(engine.exportState());
 assert.equal(connectNewCable(engine,a.portId,back.portId).code,"port_occupied");
 assert.equal(JSON.stringify(engine.exportState()),before);
});

test("débranche puis rebranche une extrémité libre",()=>{
 const {engine,a,b,place}=fixture();
 const created=connectNewCable(engine,a.portId,b.portId);
 assert.equal(detachExistingCable(engine,created.cableId,1).success,true);
 let model=buildCablingViewModel(engine,place.id);
 assert.equal(model.connections[0].complete,false);
 assert.equal(model.connections[0].ends[1].free,true);
 assert.equal(attachExistingCable(engine,created.cableId,1,b.portId).success,true);
 model=buildCablingViewModel(engine,place.id);
 assert.equal(model.connections[0].complete,true);
});

test("refuse de raccorder une extrémité déjà branchée",()=>{
 const {engine,a,b,back}=fixture();
 const created=connectNewCable(engine,a.portId,b.portId);
 const before=JSON.stringify(engine.exportState());
 assert.equal(attachExistingCable(engine,created.cableId,1,back.portId).code,"end_connected");
 assert.equal(JSON.stringify(engine.exportState()),before);
});

test("le graphique montre les extrémités hors du lieu filtré",()=>{
 const {engine,a,b,place}=fixture();
 assert.equal(connectNewCable(engine,a.portId,b.portId).success,true);
 const model=buildCablingViewModel(engine,place.id);
 assert.equal(model.connections.length,1);
 assert.equal(model.connections[0].ends[1].outside,true);
});
