import {readFileSync} from 'node:fs';
import {createIdentityAccessEngine} from '../src/identity-access-core.js';
export const scenario=JSON.parse(readFileSync(new URL('../scenarios/cybernet.json',import.meta.url),'utf8'));
export function makeHost(){
 const machines=new Map(['asset-pc01','asset-pc02','asset-files','asset-dc01','asset-dc02'].map(id=>[id,{id,kind:id.includes('pc')?'computer':'server'}]));
 const services=new Map();const paths=new Map();
 return {machines,services,paths,
  getMachine(id){return machines.has(id)?{status:'ok',machine:machines.get(id)}:{status:'not_found'};},
  getServiceStatus(id,name){return {status:services.get(id+'|'+name)??'available'};},
  getReachability(from,to,purpose){return {status:paths.get(from+'|'+to+'|'+purpose)??'reachable'};},
  getSimulationTime(){return {status:'ok',value:0};}
 };
}
export const start=(host=makeHost())=>({host,engine:createIdentityAccessEngine({scenario,host})});
export function cmd(engine,type,params={},actorSessionId='session-1') {return engine.command({type,params,actorSessionId});}