import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const load = async relative => import("data:text/javascript;base64," +
  Buffer.from(await readFile(new URL(relative, import.meta.url))).toString("base64"));
const {createAssetRegistry} = await load("../r2d3-v1/asset-profiles.js");
const {buildCablingViewModel} = await load("../shared-ui/v1/cabling-visual.js");

function fixture() {
  const engine=createAssetRegistry();
  const place=engine.createPlace({name:"Salle A"}).place;
  const other=engine.createPlace({name:"Salle B"}).place;
  const panel=engine.createPanel({name:"P1",placeId:place.id,count:2,start:1}).panel;
  const profile=engine.createProfile("Switch").profile;
  assert.equal(engine.addPortGroup(profile.id,{type:"ethernet-rj45",prefix:"Eth",start:1,count:2,digits:1}).success,true);
  const asset=engine.createAsset(profile.id,{name:"SW01"}).asset;
  assert.equal(engine.moveAssetToPlace(asset.id,place.id).success,true);
  const cable=engine.createCable().cable;
  const points=engine.listCablePoints();
  const switchPort=points.find(p=>p.assetId===asset.id);
  const panelFront=points.find(p=>p.infrastructureId===panel.id&&p.side==="front");
  assert.equal(engine.connectCableEnd(cable.id,0,switchPort.portId).success,true);
  assert.equal(engine.connectCableEnd(cable.id,1,panelFront.portId).success,true);
  return {engine,place,other,cable,panel,asset};
}

test("restitue les panneaux, équipements et ports occupés du lieu",()=>{
  const {engine,place,panel,asset}=fixture();
  const model=buildCablingViewModel(engine,place.id);
  assert.deepEqual(new Set(model.devices.map(d=>d.id)),new Set([panel.id,asset.id]));
  assert.equal(model.devices.flatMap(d=>d.ports).filter(p=>p.cableId).length,2);
  assert.equal(model.connections.length,1);
  assert.equal(model.connections[0].complete,true);
});

test("ne modifie pas la révision du moteur métier",()=>{
  const {engine,place}=fixture(),before=JSON.stringify(engine.exportState());
  buildCablingViewModel(engine,place.id);
  assert.equal(JSON.stringify(engine.exportState()),before);
});

test("après débranchement, distingue câble à bout libre et port libéré",()=>{
  const {engine,cable,place}=fixture();
  assert.equal(engine.disconnectCableEnd(cable.id,1).success,true);
  const model=buildCablingViewModel(engine,place.id);
  assert.equal(model.connections[0].complete,false);
  assert.equal(model.connections[0].ends[1].free,true);
  assert.equal(model.devices.flatMap(d=>d.ports).filter(p=>p.cableId).length,1);
});

test("filtre par lieu sans inventer de connexions",()=>{
  const {engine,other}=fixture();
  const model=buildCablingViewModel(engine,other.id);
  assert.equal(model.devices.length,0);
  assert.equal(model.connections.length,0);
});

test("affiche les câbles vers un autre lieu avec extrémité extérieure",()=>{
  const {engine,place,other,cable,asset}=fixture();
  assert.equal(engine.disconnectCableEnd(cable.id,0).success,true);
  assert.equal(engine.moveAssetToPlace(asset.id,other.id).success,true);
  const switchPort=engine.listCablePoints().find(p=>p.assetId===asset.id);
  assert.equal(engine.connectCableEnd(cable.id,0,switchPort.portId).success,true);
  const model=buildCablingViewModel(engine,place.id);
  assert.equal(model.connections.length,1);
  assert.equal(model.connections[0].complete,true);
  assert.equal(model.connections[0].ends[0].outside,true);
});
