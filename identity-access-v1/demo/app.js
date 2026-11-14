import scenario from './cybernet-scenario.js';
import {createIdentityAccessEngine,restoreIdentityAccessEngine} from '../src/identity-access-core.js';
const ids=['asset-pc01','asset-pc02','asset-files','asset-dc01','asset-dc02'];
const statuses=new Map();
const host={
 getMachine(id){return ids.includes(id)?{status:'ok',machine:{id,kind:id.includes('pc')?'computer':'server'}}:{status:'not_found'}},
 getServiceStatus(id,service){return {status:statuses.get(id+'|'+service)??'available'}},
 getReachability(){return {status:'reachable'}},
 getSimulationTime(){return {status:'ok',value:0}}
};
let engine=createIdentityAccessEngine({scenario,host});
const el=id=>document.getElementById(id);
const msg=(id,r)=>{const x=el(id);x.classList.remove('ok','bad');x.classList.add(r.success?'ok':'bad');x.textContent=(r.success?'✓ ':'✗ ')+r.code+'\n'+JSON.stringify(r.data,null,2)};
const cmd=(type,params,actorSessionId='session-1')=>engine.command({type,params,actorSessionId});
function accounts(){el('accounts').replaceChildren();for(const a of engine.query({type:'account.list'}).data.items){const card=document.createElement('div'),title=document.createElement('strong'),info=document.createElement('small');title.textContent=a.kind==='local'?a.ownerId+'\\'+a.login:'CYBERNET\\'+a.login;info.textContent=a.displayName;card.append(title,info);el('accounts').append(card);}}
function permissions(){const root=el('permissions');root.replaceChildren();const folders=engine.getSnapshot().folders;for(const f of folders.filter(x=>x.id==='folder-1'||x.id==='folder-2')){const x=document.createElement('div'),b=document.createElement('strong'),small=document.createElement('small');b.textContent=f.name;const effective=engine.query({type:'ntfs.effectivePermission',accountId:'account-2',folderId:f.id});small.textContent='Julie : '+(effective.data?.level||effective.code)+' | héritage : '+(f.inheritanceEnabled?'activé':'désactivé');x.append(b,small);root.append(x);}}
el('test-smb').onclick=()=>msg('smb-out',engine.query({type:'access.evaluateSmb',sessionId:'session-1',credentialAccountId:el('identity').value,shareId:'share-1',operation:el('operation').value}));
el('read-perms').onclick=permissions;
el('block-smb').onclick=()=>{msg('smb-out',cmd('share.setPermission',{shareId:'share-1',principalId:'group-2',level:'read'}));permissions();};
el('allow-smb').onclick=()=>{msg('smb-out',cmd('share.setPermission',{shareId:'share-1',principalId:'group-2',level:'write'}));permissions();};
function syncDcs(){statuses.set('asset-dc01|ad-ds',el('dc01').checked?'available':'unavailable');statuses.set('asset-dc02|ad-ds',el('dc02').checked?'available':'unavailable');msg('domain-out',engine.query({type:'domain.status',sourceMachineId:'asset-pc02'}));}
el('dc01').onchange=syncDcs;el('dc02').onchange=syncDcs;
el('login-julie').onclick=()=>msg('domain-out',engine.command({type:'session.open',params:{machineId:'asset-pc02',accountId:'account-2'}}));
function serverAdminSession(){const existing=engine.getSnapshot().sessions.find(x=>x.machineId==='asset-files'&&x.accountId==='account-1'&&x.active);if(existing)return existing.id;const r=engine.command({type:'session.open',params:{machineId:'asset-files',accountId:'account-1'}});return r.success?r.data.session.id:null;}
const inherit=(mode)=>{const id=serverAdminSession();if(!id){el('inherit-out').textContent='Impossible d’ouvrir la session du serveur.';return;}msg('inherit-out',cmd(mode==='enable'?'ntfs.enableInheritance':'ntfs.disableInheritance',mode==='enable'?{folderId:'folder-2'}:{folderId:'folder-2',mode},id));permissions();};
el('inherit-preserve').onclick=()=>inherit('preserve');el('inherit-remove').onclick=()=>inherit('removeInherited');el('inherit-enable').onclick=()=>inherit('enable');
el('export').onclick=()=>{const blob=new Blob([JSON.stringify(engine.exportState(),null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='cybernet-identites.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);el('state-out').textContent='État exporté : '+engine.getSnapshot().revision+' révisions.';};
el('reset').onclick=()=>{statuses.clear();el('dc01').checked=true;el('dc02').checked=true;engine=createIdentityAccessEngine({scenario,host});accounts();permissions();el('state-out').textContent='Scénario initial restauré.';el('smb-out').textContent='Choisis une identité et une opération.';el('domain-out').textContent='Les deux contrôleurs sont disponibles.';el('inherit-out').textContent='L’héritage est actif au départ.';};
accounts();permissions();