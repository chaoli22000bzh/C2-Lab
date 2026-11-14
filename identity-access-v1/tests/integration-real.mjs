import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createR2D3IdentityHost} from '../adapters/r2d3-adapter.js';
import {createIdentityAccessEngine} from '../src/identity-access-core.js';
import {scenario as baseIdentityScenario} from './fixture.mjs';

// Imports directs du dépôt R2D3 checkout par CI, sans double ni moteur substitué.
const source=resolve(process.env.R2D3_SOURCE_ROOT || '../r2d3-source');
const {createAssetRegistry}=await import(pathToFileURL(resolve(source,'src/asset-profiles.js')).href);
const {createEngine}=await import(pathToFileURL(resolve(source,'src/r2d3-core.js')).href);
const networkBase=JSON.parse(readFileSync(resolve(source,'scenarios/atelier-dhcp-deux-pc-v1.json'),'utf8'));

function assembled(){
 const registry=createAssetRegistry();
 const pcProfile=registry.createProfile('Poste Windows');
 const srvProfile=registry.createProfile('Serveur Windows');
 assert.equal(pcProfile.success,true);assert.equal(srvProfile.success,true);
 const labels=['PC01','PC02','SRV-FICHIERS','DC01','DC02'];
 const assetIds=labels.map((label,i)=>{
  const res=registry.createAsset(i<2?pcProfile.profile.id:srvProfile.profile.id,{name:label});
  assert.equal(res.success,true);
  return res.asset.id;
 });
 const network=structuredClone(networkBase);
 network.scenarioId='identity-access-r2d3-real-integration';
 network.scenarioVersion='1.0.0';
 // Reutilise un scénario R2D3 réel : deux PC, son switch et son câblage.
 const oldPc=network.objects.find(x=>x.id==='pc-dhcp-01');
 const oldPc2=network.objects.find(x=>x.id==='pc-dhcp-02');
 const oldSrv=network.objects.find(x=>x.id==='srv-dhcp');
 const switchObj=network.objects.find(x=>x.id==='sw-dhcp');
 const oldPrinter=network.objects.find(x=>x.id==='printer-dhcp');
 const endpoints=[
  structuredClone(oldPc),structuredClone(oldPc2),
  {...structuredClone(oldSrv),id:'srv-files'},
  {...structuredClone(oldSrv),id:'dc-01'},
  {...structuredClone(oldSrv),id:'dc-02'}
 ];
 for(let i=0;i<endpoints.length;i++){
  const item=endpoints[i];item.name=labels[i];item.assetId=assetIds[i];
  item.kind=i<2?'pc-windows':'windows-server';
  item.config={ipv4:{interfaceId:'eth0',mode:'static',address:'192.168.20.'+(10+i),prefix:24}};
 }
 switchObj.ports=Array.from({length:5},(_,i)=>({id:String(i),type:'rj45'}));
 network.objects=[...endpoints,switchObj];
 network.links=endpoints.map((x,i)=>({
  id:'link-'+i,kind:'ethernet-cable',
  endpoints:[{objectId:x.id,portId:'eth0'},{objectId:switchObj.id,portId:String(i)}],
  connected:true
 }));
 // Les vieux objets et le DHCP de la fixture ne sont pas déployés : on utilise
 // seulement leur topologie R2D3 comme point de départ.
 assert.ok(oldPrinter);
 const engine=createEngine(network);
 const assetToNetworkId=Object.fromEntries(endpoints.map((x,i)=>[assetIds[i],x.id]));
 const assetKinds=Object.fromEntries(assetIds.map((id,i)=>[id,i<2?'computer':'server']));
 const scenario=structuredClone(baseIdentityScenario);
 const identityMap=Object.fromEntries(['asset-pc01','asset-pc02','asset-files','asset-dc01','asset-dc02'].map((old,i)=>[old,assetIds[i]]));
 const state=scenario.state;
 state.domain.controllerAssetIds=state.domain.controllerAssetIds.map(id=>identityMap[id]);
 for(const m of state.machineMemberships)m.machineId=identityMap[m.machineId];
 for(const a of state.accounts)if(a.kind==='local')a.ownerId=identityMap[a.ownerId];
 for(const g of state.groups)if(g.kind==='machine-local')g.ownerId=identityMap[g.ownerId];
 for(const a of state.administratorAssignments)if(a.machineId)a.machineId=identityMap[a.machineId];
 for(const f of state.folders)f.machineId=identityMap[f.machineId];
 for(const s of state.shares)s.machineId=identityMap[s.machineId];
 for(const s of state.sessions)s.machineId=identityMap[s.machineId];
 for(const p of state.profiles)p.machineId=identityMap[p.machineId];
 return {registry,engine,scenario,assetIds,assetToNetworkId,assetKinds,network,labels};
}
const hostOf=(x,extra={})=>createR2D3IdentityHost({assetRegistry:x.registry,networkEngine:x.engine,assetToNetworkId:x.assetToNetworkId,assetKinds:x.assetKinds,...extra});

test('R1 : vrais createAssetRegistry/createEngine et références asset.id',()=>{
 const x=assembled(),host=hostOf(x),identity=createIdentityAccessEngine({scenario:x.scenario,host});
 assert.equal(x.registry.listAssets().length,5);
 assert.equal(host.getMachine(x.assetIds[2]).machine.id,x.assetIds[2]);
 assert.equal(x.engine.getSnapshot().objectsById['srv-files'].assetId,x.assetIds[2]);
 assert.equal(identity.getSnapshot().folders[0].machineId,x.assetIds[2]);
 assert.deepEqual(identity.getSnapshot().domain.controllerAssetIds,x.assetIds.slice(3));
 assert.equal(x.engine.query({type:'network.ping',sourceId:'pc-dhcp-01',targetId:'srv-files'}).success,true);
 assert.equal(host.getServiceStatus(x.assetIds[2],'smb').status,'unknown');
 assert.equal(identity.query({type:'access.evaluateSmb',sessionId:'session-1',shareId:'share-1',credentialAccountId:'account-2',operation:'read'}).code,'service_status_unknown');
});

test('R1 : preuves de service explicites, jamais inférées du ping ICMP',()=>{
 const x=assembled();
 const services=new Map([[x.assetIds[3]+'|ad-ds','unavailable'],[x.assetIds[4]+'|ad-ds','available'],[x.assetIds[2]+'|smb','available']]);
 const reachabilityEvidence=(from,to,purpose)=>{
  const fromNet=x.assetToNetworkId[from],toNet=x.assetToNetworkId[to];
  const result=x.engine.query({type:'network.ping',sourceId:fromNet,targetId:toNet});
  // Ce banc peut injecter une preuve explicite de service, mais le ping seul
  // n'est jamais interprété comme une preuve positive de port AD DS / SMB.
  if(!result.success)return 'unreachable';
  return purpose==='domain'||purpose==='smb'?'reachable':'unknown';
 };
 const host=hostOf(x,{serviceEvidence:(id,service)=>services.get(id+'|'+service)??'unknown',reachabilityEvidence});
 const identity=createIdentityAccessEngine({scenario:x.scenario,host});
 assert.equal(identity.query({type:'domain.status',sourceMachineId:x.assetIds[0]}).data.controllerAssetId,x.assetIds[4]);
 const allowed=identity.query({type:'access.evaluateSmb',sessionId:'session-1',credentialAccountId:'account-2',shareId:'share-1',operation:'write'});
 assert.equal(allowed.success,true,JSON.stringify(allowed));
 services.set(x.assetIds[4]+'|ad-ds','unavailable');
 assert.equal(identity.command({type:'session.open',params:{machineId:x.assetIds[1],accountId:'account-2'}}).code,'domain_controller_unavailable');
});

test('R1 : faux mapping existant détecté et absence de disponibilité par défaut',()=>{
 const x=assembled(),wrong={...x.assetToNetworkId,[x.assetIds[2]]:x.assetToNetworkId[x.assetIds[3]]};
 // La correspondance n'est plus injective, la création doit échouer.
 assert.throws(()=>hostOf(x,{assetToNetworkId:wrong}),/injective/);
 const swapped={...x.assetToNetworkId,[x.assetIds[2]]:'dc-01',[x.assetIds[3]]:'srv-files'};
 const h=hostOf(x,{assetToNetworkId:swapped});
 assert.equal(h.getMachine(x.assetIds[2]).status,'unknown');
 assert.throws(()=>createIdentityAccessEngine({scenario:x.scenario,host:h}),/invalid/);
});
