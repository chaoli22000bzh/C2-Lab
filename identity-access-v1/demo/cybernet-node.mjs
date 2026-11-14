import {readFileSync} from 'node:fs';
import {createIdentityAccessEngine} from '../src/identity-access-core.js';
const scenario=JSON.parse(readFileSync(new URL('../scenarios/cybernet.json',import.meta.url),'utf8'));
const ids=new Set(['asset-pc01','asset-pc02','asset-dc01','asset-dc02','asset-files']);
const host={getMachine:id=>ids.has(id)?{status:'ok',machine:{id,kind:id.includes('pc')?'computer':'server'}}:{status:'not_found'},getServiceStatus:()=>({status:'available'}),getReachability:()=>({status:'reachable'}),getSimulationTime:()=>({status:'ok',value:0})};
const e=createIdentityAccessEngine({scenario,host});
console.log('AGDLP:',e.query({type:'identity.groups',accountId:'account-2',machineId:'asset-files'}).data.groupIds);
console.log('Accès SMB:',e.query({type:'smb.evaluateAccess',sessionId:'session-1',credentialAccountId:'account-2',shareId:'share-1',operation:'write'}));
console.log('Export JSON:',JSON.stringify(e.exportState()).length,'octets');