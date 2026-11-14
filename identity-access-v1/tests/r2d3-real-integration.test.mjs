import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createAssetRegistry} from '../../r2d3-source/src/asset-profiles.js';
import {createEngine} from '../../r2d3-source/src/r2d3-core.js';
import {createR2D3IdentityHost} from '../adapters/r2d3-adapter.js';
import {createIdentityAccessEngine} from '../src/identity-access-core.js';
import {scenario as original} from './fixture.mjs';

// Real R2D3 scenario and actual constructors. No copied registry or network engine.
const base=JSON.parse(readFileSync(new URL('../../r2d3-source/scenarios/atelier-2pc-imprimante-exp.json',import.meta.url),'utf8'));
const names=['PC01','PC02','SRV-FICHIERS','DC01','DC02'];
const netIds=['pc-01','pc-02','srv-files','dc-01','dc-02'];
const identityIds=['asset-pc01','asset-pc02','asset-files','asset-dc01','asset-dc02'];
const ip=['192.168.10.20','192.168.10.30','192.168.10.40','192.168.10.41','192.168.10.42'];
function setup(disconnected=false) {
 const registry=createAssetRegistry();
 const pc=registry.createProfile('Poste Windows'),server=registry.createProfile('Serveur Windows');
 assert.equal(pc.success,true);assert.equal(server.success,true);
 const assetIds=names.map((name,i)=>{
  const created=registry.createAsset(i<2?pc.profile.id:server.profile.id,{name});
  assert.equal(created.success,true);return created.asset.id;
 });
 const source=structuredClone(base);
 const template=source.objects.find(x=>x.id==='pc-01');
 source.objects=source.objects.filter(x=>x.id!=='printer-01');
 source.links=source.links.filter(x=>x.id!=='cable-printer');
 for(let i=0;i<netIds.length;i++){
  if(i<2){const existing=source.objects.find(x=>x.id===netIds[i]);existing.name=names[i];}
  else source.objects.push({...structuredClone(template),id:netIds[i],name:names[i],kind:i===2?'file-server':'domain-controller',config:{ipv4:{interfaceId:'eth0',mode:'static',address:ip[i],prefix:24}}});
 }
 source.objects.find(x=>x.id==='sw-01').ports.push({id:'3',type:'rj45'},{id:'4',type:'rj45'});
 for(const [i,port] of [[2,'1'],[3,'3'],[4,'4']])source.links.push({
  id:'cable-'+netIds[i],kind:'ethernet-cable',
  endpoints:[{objectId:netIds[i],portId:'eth0'},{objectId:'sw-01',portId:port}],connected:!(disconnected&&i===4)
 });
 const network=createEngine(source);
 const mapping=Object.fromEntries(assetIds.map((id,i)=>[id,netIds[i]]));
 const kinds=Object.fromEntries(assetIds.map((id,i)=>[id,i<2?'computer':'server']));
 // Verify identity of mapped objects against authoritative registry values.
 for(let i=0;i<assetIds.length;i++){
  assert.equal(registry.getAsset(assetIds[i]).name,network.getSnapshot().objectsById[mapping[assetIds[i]]].name);
 }
 const raw=JSON.stringify(original);
 let replaced=raw;
 for(let i=0;i<assetIds.length;i++)replaced=replaced.replaceAll('"'+identityIds[i]+'"','"'+assetIds[i]+'"');
 const scenario=JSON.parse(replaced);
 assert.equal(scenario.state.sessions[0].machineId,assetIds[0]);
 return {registry,network,mapping,kinds,scenario,assetIds};
}
const makeHost=(x,extras={})=>createR2D3IdentityHost({
 assetRegistry:x.registry,networkEngine:x.network,assetToNetworkId:x.mapping,assetKinds:x.kinds,...extras
});
test('R1 vrai registre et vrai moteur R2D3, sans répertoire parallèle',()=>{
 const x=setup();const host=makeHost(x);const engine=createIdentityAccessEngine({scenario:x.scenario,host});
 assert.equal(x.registry.listAssets().length,5);
 assert.equal(host.getMachine(x.assetIds[0]).machine.id,x.assetIds[0]);
 assert.equal(host.getSimulationTime().value,x.network.getSnapshot().simulationClock);
 assert.equal(engine.getSnapshot().accounts[2].ownerId,x.assetIds[0]);
 assert.equal(host.getServiceStatus(x.assetIds[2],'smb').status,'unknown');
 assert.equal(host.getReachability(x.assetIds[0],x.assetIds[2],'smb').status,'unknown');
 assert.equal(engine.query({type:'access.evaluateSmb',sessionId:'session-1',shareId:'share-1',credentialAccountId:'account-2',operation:'read'}).code,'service_status_unknown');
 assert.equal(x.network.query({type:'network.ping',sourceId:x.mapping[x.assetIds[0]],targetId:x.mapping[x.assetIds[2]]}).success,true);
});
test('R1 observations explicites AD et SMB + ping réellement obtenu du moteur',()=>{
 const x=setup();const services=new Map([[x.assetIds[3]+'|ad-ds','unavailable']]);
 const applicationEvidence=new Set(['domain','smb']);
 const host=makeHost(x,{
  serviceEvidence:(id,service)=>services.get(id+'|'+service)??'available',
  reachabilityEvidence:(from,to,purpose)=>{
   if(!applicationEvidence.has(purpose))return 'unknown';
   const ping=x.network.query({type:'network.ping',sourceId:x.mapping[from],targetId:x.mapping[to]});
   return ping.status==='ok'?(ping.success?'reachable':'unreachable'):'unknown';
  }
 });
 const engine=createIdentityAccessEngine({scenario:x.scenario,host});
 assert.equal(engine.query({type:'domain.status',sourceMachineId:x.assetIds[0]}).data.controllerAssetId,x.assetIds[4]);
 assert.equal(engine.query({type:'access.evaluateSmb',sessionId:'session-1',shareId:'share-1',credentialAccountId:'account-2',operation:'write'}).success,true);
 services.set(x.assetIds[4]+'|ad-ds','unavailable');
 assert.equal(engine.command({type:'session.open',params:{machineId:x.assetIds[1],accountId:'account-2'}}).code,'domain_controller_unavailable');
});
test('R1 liaison réelle débranchée : pas de joignabilité déduite',()=>{
 const x=setup(true);
 const host=makeHost(x,{serviceEvidence:()=> 'available',reachabilityEvidence:(from,to,purpose)=>{
  if(!['domain','smb'].includes(purpose))return 'unknown';
  const ping=x.network.query({type:'network.ping',sourceId:x.mapping[from],targetId:x.mapping[to]});
  return ping.status==='ok'?(ping.success?'reachable':'unreachable'):'unknown';
 }});
 const engine=createIdentityAccessEngine({scenario:x.scenario,host});
 assert.equal(host.getReachability(x.assetIds[0],x.assetIds[4],'domain').status,'unreachable');
 assert.equal(engine.query({type:'domain.status',sourceMachineId:x.assetIds[0]}).data.controllerAssetId,x.assetIds[3]);
});
