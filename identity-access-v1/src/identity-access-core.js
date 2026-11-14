/** Identity Access Core 1.0.0 - moteur pédagogique indépendant, sans I/O. */
export const FORMAT = 'identity-access-state';
export const SCHEMA_VERSION = 1;
export const PERMISSIONS = Object.freeze(['none','read','write','admin']);
const ranks = Object.freeze({none:0,read:1,write:2,admin:3});
const copy = x => structuredClone(x);
const has = (x,k) => Object.hasOwn(x,k);
const obj = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const str = x => typeof x === 'string' && x.trim().length > 0;
const key = x => str(x) && x.length < 160 && !/[\\/\u0000-\u001f]/.test(x);
const permission = x => has(ranks,x);
const success = (code,data={},revision=0) => ({success:true,code,revision,data:copy(data)});
const fail = (code,detail={},revision=0) => ({success:false,code,revision,data:copy(detail)});
const noDup = xs => new Set(xs).size === xs.length;
const arr = x => Array.isArray(x) ? x : [];
const seedState = () => ({format:FORMAT,schemaVersion:SCHEMA_VERSION,revision:0, nextIds:{},domain:null,machineMemberships:[],organizationalUnits:[],accounts:[],groups:[],groupMemberships:[],administratorAssignments:[],folders:[],files:[],shares:[],sessions:[],profiles:[],driveMappingRules:[]});
const requiredHost = ['getMachine','getServiceStatus','getReachability','getSimulationTime'];
function validateHost(host){if(!obj(host)||requiredHost.some(n=>typeof host[n]!=='function'))throw new TypeError('Host incomplet');}
function lookupMachine(host,id){
 if(!str(id))return {ok:false,code:'machine_not_found'};
 let r;try{r=host.getMachine(id)}catch{return {ok:false,code:'host_failure'}}
 if(r?.status==='not_found')return {ok:false,code:'machine_not_found'};
 if(r?.status!=='ok'||!obj(r.machine)||r.machine.id!==id||!['computer','server'].includes(r.machine.kind))return {ok:false,code:'machine_unknown'};
 return {ok:true,machine:r.machine};
}
function service(host,id,type){
 let r;try{r=host.getServiceStatus(id,type)}catch{return 'unknown'}
 return ['available','unavailable'].includes(r?.status)?r.status:'unknown';
}
function reachable(host,from,to,purpose){
 let r;try{r=host.getReachability(from,to,purpose)}catch{return 'unknown'}
 return ['reachable','unreachable'].includes(r?.status)?r.status:'unknown';
}
function idRef(xs,id){return xs.find(x=>x.id===id)}
function isDomainAccount(s,id){const a=idRef(s.accounts,id);return a?.kind==='domain'}
function ownerAccount(s,a){return a.kind==='domain' ? s.domain?.id===a.ownerId : str(a.ownerId)}
function domainReady(s,host,sourceId){
 if(!s.domain)return {ok:false,code:'domain_not_configured'};
 let unknown=false,offline=false;
 for(const dc of s.domain.controllerAssetIds){
  const m=lookupMachine(host,dc);if(!m.ok){unknown=true;continue;}
  const sv=service(host,dc,'ad-ds');const net=reachable(host,sourceId??dc,dc,'domain');
  if(sv==='available'&&net==='reachable')return {ok:true,controllerAssetId:dc};
  if(sv==='unknown'||net==='unknown')unknown=true;else offline=true;
 }
 return {ok:false,code:unknown?'domain_status_unknown':'domain_controller_unavailable',offline};
}
function getAccount(s,id){return idRef(s.accounts,id)}
function getGroup(s,id){return idRef(s.groups,id)}
function getFolder(s,id){return idRef(s.folders,id)}
function applicableGroups(s,accountId,machineId){
 const a=getAccount(s,accountId);if(!a)return [];
 const reached=new Set(),queue=[{memberType:'account',memberId:accountId}];
 while(queue.length){const current=queue.shift();
  for(const rel of s.groupMemberships){if(rel.memberType!==current.memberType||rel.memberId!==current.memberId)continue;
   const g=getGroup(s,rel.groupId);if(!g||reached.has(g.id))continue;
   if(g.kind==='machine-local'&&(g.ownerId!==machineId||(a.kind==='domain'&&!s.machineMemberships.some(x=>x.machineId===machineId&&x.joined))))continue;
   if(g.kind!=='machine-local'&&a.kind!=='domain')continue;
   reached.add(g.id);queue.push({memberType:'group',memberId:g.id});
  }
 }
 return [...reached].sort();
}
function principals(s,accountId,machineId){return new Set([accountId,...applicableGroups(s,accountId,machineId)]);}
function permissionMax(entries,who){let best=0;for(const e of entries)if(who.has(e.principalId))best=Math.max(best,ranks[e.level]);return PERMISSIONS[best];}
function inheritedEntries(s,folderId,visited=new Set()){
 const f=getFolder(s,folderId);if(!f||visited.has(f.id))return [];
 visited.add(f.id);
 if(!f.inheritanceEnabled||!f.parentId)return [];
 const parent=getFolder(s,f.parentId);if(!parent)return [];
 return [...arr(parent.acl),...inheritedEntries(s,parent.id,visited)].filter(x=>x.inheritable!==false).map(x=>({...x,inherited:true}));
}
function effectiveNtfs(s,accountId,folderId){
 const f=getFolder(s,folderId);if(!f)return {ok:false,code:'folder_not_found'};
 const a=getAccount(s,accountId);if(!a)return {ok:false,code:'account_not_found'};
 if(!a.enabled||a.locked)return {ok:false,code:a.locked?'account_locked':'account_disabled'};
 // Un compte local ne s'applique que sur la machine qui le possède.
 if(a.kind==='local'&&a.ownerId!==f.machineId)return {ok:false,code:'identity_not_recognized'};
 const groups=applicableGroups(s,accountId,f.machineId),who=new Set([accountId,...groups]);
 const explicit=arr(f.acl),inherited=inheritedEntries(s,folderId);
 return {ok:true,level:permissionMax([...explicit,...inherited],who),groups,explicit:copy(explicit),inherited:copy(inherited)};
}
function adminFor(s,accountId,machineId,scope){
 if(!accountId)return false;
 const a=getAccount(s,accountId);if(!a||!a.enabled||a.locked)return false;
 const who=principals(s,accountId,machineId);
 const domainAdmin=s.administratorAssignments.some(x=>x.scope==='domain'&&who.has(x.principalId));
 if(scope==='domain')return a.kind==='domain'&&domainAdmin;
 if(a.kind==='domain'&&s.machineMemberships.some(x=>x.machineId===machineId&&x.joined)&&domainAdmin)return true;
 return s.administratorAssignments.some(x=>x.scope==='machine'&&x.machineId===machineId&&who.has(x.principalId));
}
function sessionIdentity(s,id){const ses=idRef(s.sessions,id);if(!ses)return null;const a=getAccount(s,ses.accountId);return a?{session:ses,account:a}:null;}
function validPrincipal(s,id){return !!getAccount(s,id)||!!getGroup(s,id);}
function validateAcl(s,acl){return Array.isArray(acl)&&acl.every(e=>obj(e)&&validPrincipal(s,e.principalId)&&permission(e.level)&&typeof e.inheritable==='boolean')&&noDup(acl.map(x=>x.principalId));}
function normalizeAcl(s,acl){if(!Array.isArray(acl))return null;const v=acl.map(e=>({principalId:e.principalId,level:e.level,inheritable:e.inheritable!==false}));return validateAcl(s,v)?v:null;}
function validMembership(s,m){const g=getGroup(s,m.groupId);if(!g)return false;
 if(m.memberType==='account'){
  const a=getAccount(s,m.memberId);if(!a)return false;
  if(g.kind==='domain-global'||g.kind==='domain-local')return a.kind==='domain'&&a.ownerId===g.ownerId&&g.kind==='domain-global';
  return (a.kind==='local'&&a.ownerId===g.ownerId)||(a.kind==='domain'&&a.ownerId===s.domain?.id);
 }
 if(m.memberType==='group'){
  const child=getGroup(s,m.memberId);if(!child||child.id===g.id)return false;
  if(g.kind==='domain-local')return child.kind==='domain-global'&&child.ownerId===g.ownerId;
  if(g.kind==='machine-local')return ['domain-global','domain-local'].includes(child.kind)&&child.ownerId===s.domain?.id;
 }
 return false;
}
function validateState(s,host){
 if(!obj(s)||s.format!==FORMAT||s.schemaVersion!==SCHEMA_VERSION||!Number.isSafeInteger(s.revision)||s.revision<0||!obj(s.nextIds))throw Error('invalid_state_version');
 const cols=['machineMemberships','organizationalUnits','accounts','groups','groupMemberships','administratorAssignments','folders','files','shares','sessions','profiles','driveMappingRules'];
 if(cols.some(k=>!Array.isArray(s[k])))throw Error('invalid_state_collections');
 const allIds=[...cols.filter(k=>!['machineMemberships','groupMemberships','administratorAssignments'].includes(k)).flatMap(k=>s[k].map(x=>x.id))];
 if(allIds.some(x=>!str(x))||!noDup(allIds))throw Error('invalid_state_identifiers');
 for(const [kind,num] of Object.entries(s.nextIds)){if(!Number.isSafeInteger(num)||num<0)throw Error('invalid_counter');if(allIds.some(id=>{const m=id.match(new RegExp('^'+kind+'-(\\d+)$'));return m&&Number(m[1])>num;}))throw Error('invalid_counter');}
 if(s.domain&&(!str(s.domain.id)||!str(s.domain.dnsName)||!str(s.domain.shortName)||!Array.isArray(s.domain.controllerAssetIds)||!s.domain.controllerAssetIds.length||!noDup(s.domain.controllerAssetIds)))throw Error('invalid_domain');
 if(s.domain&&s.domain.controllerAssetIds.some(id=>{const m=lookupMachine(host,id);return !m.ok||m.machine.kind!=='server';}))throw Error('invalid_controller_ref');
 const ids=new Set(s.machineMemberships.map(x=>x.machineId));if(ids.size!==s.machineMemberships.length)throw Error('duplicate_machine_membership');
 for(const m of s.machineMemberships)if(!lookupMachine(host,m.machineId).ok||typeof m.joined!=='boolean')throw Error('invalid_machine_membership');
 for(const m of s.machineMemberships)if(m.ouId&&!idRef(s.organizationalUnits,m.ouId))throw Error('invalid_machine_ou');
 for(const a of s.accounts){if(!['local','domain'].includes(a.kind)||!key(a.login)||!ownerAccount(s,a)||typeof a.enabled!=='boolean'||typeof a.locked!=='boolean'||!Number.isSafeInteger(a.credentialRevision)||a.credentialRevision<0)throw Error('invalid_account');if(a.kind==='local'&&!lookupMachine(host,a.ownerId).ok)throw Error('invalid_account_machine');if(a.ouId&&!idRef(s.organizationalUnits,a.ouId))throw Error('invalid_account_ou');}
 if(!noDup(s.accounts.map(a=>a.kind+'|'+a.ownerId+'|'+a.login.toLowerCase())))throw Error('duplicate_account');
 for(const g of s.groups){if(!['machine-local','domain-global','domain-local'].includes(g.kind)||!key(g.name)||(g.kind==='machine-local'?!lookupMachine(host,g.ownerId).ok:g.ownerId!==s.domain?.id))throw Error('invalid_group');if(g.ouId&&!idRef(s.organizationalUnits,g.ouId))throw Error('invalid_group_ou');}
 if(!noDup(s.groups.map(g=>g.kind+'|'+g.ownerId+'|'+g.name.toLowerCase())))throw Error('duplicate_group');
 for(const ou of s.organizationalUnits){if(!key(ou.name)||ou.parentId&&!idRef(s.organizationalUnits,ou.parentId))throw Error('invalid_ou');let cursor=ou,seen=new Set();while(cursor){if(seen.has(cursor.id))throw Error('ou_cycle');seen.add(cursor.id);cursor=cursor.parentId?idRef(s.organizationalUnits,cursor.parentId):null;}}
 if(!noDup(s.groupMemberships.map(x=>x.groupId+'|'+x.memberType+'|'+x.memberId))||s.groupMemberships.some(x=>!validMembership(s,x)))throw Error('invalid_membership');
 for(const a of s.administratorAssignments)if(!validPrincipal(s,a.principalId)||!['machine','domain'].includes(a.scope)||(a.scope==='machine'&&!lookupMachine(host,a.machineId).ok)||(a.scope==='domain'&&(!s.domain||getAccount(s,a.principalId)?.kind==='local'||getGroup(s,a.principalId)?.kind==='machine-local')))throw Error('invalid_administrator');
 for(const f of s.folders){if(!lookupMachine(host,f.machineId).ok||!key(f.name)||typeof f.inheritanceEnabled!=='boolean'||!validateAcl(s,f.acl))throw Error('invalid_folder');if(f.parentId){const parent=getFolder(s,f.parentId);if(!parent||parent.machineId!==f.machineId)throw Error('invalid_parent_folder');}let cur=f,seen=new Set();while(cur){if(seen.has(cur.id))throw Error('folder_cycle');seen.add(cur.id);cur=cur.parentId?getFolder(s,cur.parentId):null;}}
 if(!noDup(s.folders.map(f=>f.machineId+'|'+f.parentId+'|'+f.name.toLowerCase())))throw Error('duplicate_folder');
 for(const f of s.files)if(!getFolder(s,f.folderId)||!key(f.name)||typeof f.content!=='string'||f.content.length>20000)throw Error('invalid_file');
 if(!noDup(s.files.map(f=>f.folderId+'|'+f.name.toLowerCase())))throw Error('duplicate_file');
 for(const share of s.shares){const f=getFolder(s,share.folderId);if(!f||f.machineId!==share.machineId||!key(share.name)||!validateAcl(s,share.acl))throw Error('invalid_share');}
 if(!noDup(s.shares.map(x=>x.machineId+'|'+x.name.toLowerCase())))throw Error('duplicate_share');
 for(const session of s.sessions)if(!getAccount(s,session.accountId)||getAccount(s,session.accountId).kind!==session.kind||!lookupMachine(host,session.machineId).ok||!['local','domain'].includes(session.kind)||typeof session.active!=='boolean'||!idRef(s.profiles,session.profileId)||!Array.isArray(session.mappedDrives)||session.mappedDrives.some(x=>!idRef(s.shares,x.shareId)||!/^[A-Z]$/.test(x.letter))||idRef(s.profiles,session.profileId).accountId!==session.accountId||idRef(s.profiles,session.profileId).machineId!==session.machineId)throw Error('invalid_session');
 for(const p of s.profiles)if(!getAccount(s,p.accountId)||!lookupMachine(host,p.machineId).ok)throw Error('invalid_profile');
 if(!noDup(s.profiles.map(x=>x.accountId+'|'+x.machineId)))throw Error('duplicate_profile');
 for(const rule of s.driveMappingRules)if(!s.domain||!validPrincipal(s,rule.principalId)||!/^[A-Z]$/.test(rule.letter)||!idRef(s.shares,rule.shareId))throw Error('invalid_drive_rule');
}
export function createIdentityAccessEngine({scenario,host}){
 validateHost(host);if(!obj(scenario)||scenario.schemaVersion!==SCHEMA_VERSION||scenario.format!=='identity-access-scenario')throw Error('invalid_scenario');
 const initial=copy(scenario.state??seedState());validateState(initial,host);return buildEngine(initial,host);
}
export function restoreIdentityAccessEngine({scenario,savedState,host}){
 validateHost(host);if(!obj(scenario)||scenario.format!=='identity-access-scenario'||scenario.schemaVersion!==SCHEMA_VERSION)throw Error('invalid_scenario');
 const state=copy(typeof savedState==='string'?JSON.parse(savedState):savedState);validateState(state,host);return buildEngine(state,host);
}
function buildEngine(initial,host){let s=initial;
 const nextId=(state,what)=>{state.nextIds[what]=(state.nextIds[what]||0)+1;return what+'-'+state.nextIds[what]};
 const sessionActor=(state,command)=>{const id=command.actorSessionId;if(!str(id))return {ok:false,code:'actor_session_required'};const value=sessionIdentity(state,id);if(!value||!value.session.active)return {ok:false,code:'actor_session_invalid'};if(!value.account.enabled||value.account.locked)return {ok:false,code:value.account.locked?'account_locked':'account_disabled'};return {ok:true,...value};};
 const authority=(state,actor,scope,machineId)=>{
  if(scope==='domain'){
   if(!adminFor(state,actor.account.id,null,'domain'))return {ok:false,code:'administrator_required'};
   return domainReady(state,host,actor.session.machineId);
  }
  return adminFor(state,actor.account.id,machineId,'machine')?{ok:true}:{ok:false,code:'administrator_required'};
 };
 function command(c){
  if(!obj(c)||!str(c.type)||!obj(c.params))return fail('invalid_command',{},s.revision);
  if(c.expectedRevision!==undefined&&c.expectedRevision!==s.revision)return fail('revision_conflict',{},s.revision);
  const actor=c.type==='session.open'?null:sessionActor(s,c);if(actor&&!actor.ok)return fail(actor.code,{},s.revision);
  const p=c.params;const next=copy(s);const get=(type,id)=>idRef(next[type],id);let code='updated',data={};
  const deny=(err,extra={})=>fail(err,extra,s.revision);
  const requireMachine=id=>lookupMachine(host,id);
  const checkScope=(scope,id)=>authority(next,actor,scope,id);
  const domainOperation=()=>checkScope('domain');
  const forAccount=id=>{const a=get('accounts',id);if(!a)return {ok:false,code:'account_not_found'};const allowed=a.kind==='domain'?domainOperation():checkScope('machine',a.ownerId);return allowed.ok?{ok:true,account:a}:allowed;};
  const forGroup=id=>{const g=get('groups',id);if(!g)return {ok:false,code:'group_not_found'};const allowed=g.kind==='machine-local'?checkScope('machine',g.ownerId):domainOperation();return allowed.ok?{ok:true,group:g}:allowed;};
  const pathPerm=(folderId,needed)=>{const f=get('folders',folderId);if(!f)return {ok:false,code:'folder_not_found'};const x=effectiveNtfs(next,actor.account.id,folderId);if(!x.ok)return x;return ranks[x.level]>=ranks[needed]?{ok:true,folder:f}:{ok:false,code:'ntfs_insufficient_permission',level:x.level};};
  const app=(folderId,needed)=>{const v=pathPerm(folderId,needed);return v.ok?v:deny(v.code,{level:v.level})};
  const removeReferencedPrincipal=id=>{
   next.groupMemberships=next.groupMemberships.filter(x=>x.memberId!==id&&x.groupId!==id);
   next.administratorAssignments=next.administratorAssignments.filter(x=>x.principalId!==id);
   // Les ACL et règles ne sont pas silencieusement effacées : suppression bloquée si elles référencent l'objet.
  };
  switch(c.type){
   case 'domain.configure': {
    if(next.domain)return deny('domain_already_configured');const old=checkScope('machine',actor.session.machineId);if(!old.ok)return deny(old.code);
    if(!key(p.shortName)||!str(p.dnsName)||!Array.isArray(p.controllerAssetIds)||!p.controllerAssetIds.length||!noDup(p.controllerAssetIds))return deny('invalid_domain');
    if(p.controllerAssetIds.some(id=>!requireMachine(id).ok))return deny('machine_not_found');
    next.domain={id:nextId(next,'domain'),shortName:p.shortName,dnsName:p.dnsName,controllerAssetIds:copy(p.controllerAssetIds)};code='domain_configured';data={domain:next.domain};break;
   }
   case 'domain.joinMachine':case 'domain.leaveMachine': {
    if(!next.domain)return deny('domain_not_configured');const m=requireMachine(p.machineId);if(!m.ok)return deny(m.code);const a=checkScope('machine',p.machineId);if(!a.ok)return deny(a.code);
    const d=domainOperation();if(!d.ok)return deny(d.code);
    const exists=next.machineMemberships.find(x=>x.machineId===p.machineId);const joined=c.type==='domain.joinMachine';
    if(exists){if(exists.joined===joined)return deny('membership_unchanged');exists.joined=joined;}else next.machineMemberships.push({machineId:p.machineId,joined});code=joined?'machine_joined':'machine_left_domain';break;
   }
   case 'account.create': {
    if(!['local','domain'].includes(p.kind)||!key(p.login))return deny('invalid_account');const scope=p.kind==='domain'?'domain':'machine';if(p.kind==='domain'&&p.ownerId!==next.domain?.id)return deny('invalid_account_owner');if(p.kind==='local'&&!requireMachine(p.ownerId).ok)return deny('machine_not_found');
    const a=checkScope(scope,p.ownerId);if(!a.ok)return deny(a.code);
    if(next.accounts.some(x=>x.kind===p.kind&&x.ownerId===p.ownerId&&x.login.toLowerCase()===p.login.toLowerCase()))return deny('duplicate_account');
    if(p.ouId&&(!get('organizationalUnits',p.ouId)||p.kind!=='domain'))return deny('invalid_ou');
    const account={id:nextId(next,'account'),kind:p.kind,ownerId:p.ownerId,login:p.login,displayName:str(p.displayName)?p.displayName:p.login,enabled:true,locked:false,credentialRevision:0,ouId:p.ouId||null};next.accounts.push(account);code='account_created';data={account};break;
   }
   case 'account.rename':case 'account.setEnabled':case 'account.setLocked':case 'account.resetCredential':case 'account.delete': {
    const a=forAccount(p.accountId);if(!a.ok)return deny(a.code);const x=a.account;
    if(c.type==='account.rename'){if(!key(p.login)||next.accounts.some(y=>y.id!==x.id&&y.kind===x.kind&&y.ownerId===x.ownerId&&y.login.toLowerCase()===p.login.toLowerCase()))return deny('invalid_or_duplicate_account');x.login=p.login;if(str(p.displayName))x.displayName=p.displayName;code='account_renamed';}
    else if(c.type==='account.setEnabled'){if(typeof p.enabled!=='boolean')return deny('invalid_flag');x.enabled=p.enabled;code='account_updated';}
    else if(c.type==='account.setLocked'){if(typeof p.locked!=='boolean')return deny('invalid_flag');x.locked=p.locked;code='account_updated';}
    else if(c.type==='account.resetCredential'){x.credentialRevision++;code='credential_reset';}
    else {if(next.sessions.some(y=>y.accountId===x.id&&y.active)||next.groupMemberships.some(y=>y.memberId===x.id)||next.administratorAssignments.some(y=>y.principalId===x.id)||next.folders.some(y=>y.acl.some(z=>z.principalId===x.id))||next.shares.some(y=>y.acl.some(z=>z.principalId===x.id))||next.driveMappingRules.some(y=>y.principalId===x.id))return deny('account_referenced');next.accounts=next.accounts.filter(y=>y.id!==x.id);next.sessions=next.sessions.filter(y=>y.accountId!==x.id);next.profiles=next.profiles.filter(y=>y.accountId!==x.id);code='account_deleted';}break;
   }
   case 'group.create': {
    if(!['machine-local','domain-global','domain-local'].includes(p.kind)||!key(p.name))return deny('invalid_group');const scope=p.kind==='machine-local'?'machine':'domain';if(scope==='machine'&&!requireMachine(p.ownerId).ok)return deny('machine_not_found');if(scope==='domain'&&p.ownerId!==next.domain?.id)return deny('invalid_group_owner');const a=checkScope(scope,p.ownerId);if(!a.ok)return deny(a.code);
    if(next.groups.some(x=>x.kind===p.kind&&x.ownerId===p.ownerId&&x.name.toLowerCase()===p.name.toLowerCase()))return deny('duplicate_group');if(p.ouId&&(!get('organizationalUnits',p.ouId)||scope!=='domain'))return deny('invalid_ou');
    const group={id:nextId(next,'group'),kind:p.kind,ownerId:p.ownerId,name:p.name,ouId:p.ouId||null};next.groups.push(group);code='group_created';data={group};break;
   }
   case 'group.rename':case 'group.delete':case 'group.addMember':case 'group.removeMember': {
    const a=forGroup(p.groupId);if(!a.ok)return deny(a.code);const g=a.group;
    if(c.type==='group.rename'){if(!key(p.name)||next.groups.some(x=>x.id!==g.id&&x.kind===g.kind&&x.ownerId===g.ownerId&&x.name.toLowerCase()===p.name.toLowerCase()))return deny('invalid_or_duplicate_group');g.name=p.name;code='group_renamed';}
    else if(c.type==='group.delete'){if(next.groupMemberships.some(x=>x.groupId===g.id||x.memberId===g.id)||next.administratorAssignments.some(x=>x.principalId===g.id)||next.folders.some(x=>x.acl.some(a=>a.principalId===g.id))||next.shares.some(x=>x.acl.some(a=>a.principalId===g.id))||next.driveMappingRules.some(x=>x.principalId===g.id))return deny('group_referenced');next.groups=next.groups.filter(x=>x.id!==g.id);code='group_deleted';}
    else {const m={groupId:g.id,memberType:p.memberType,memberId:p.memberId};if(!validMembership(next,m)||(g.kind==='machine-local'&&m.memberType==='group'&&!next.machineMemberships.some(x=>x.machineId===g.ownerId&&x.joined)))return deny('membership_scope_invalid');const found=next.groupMemberships.find(x=>x.groupId===m.groupId&&x.memberType===m.memberType&&x.memberId===m.memberId);if(c.type==='group.addMember'){if(found)return deny('membership_exists');next.groupMemberships.push(m);code='group_member_added';}else{if(!found)return deny('membership_not_found');next.groupMemberships=next.groupMemberships.filter(x=>x!==found);code='group_member_removed';}}break;
   }
   case 'ou.create':case 'ou.rename':case 'ou.move':case 'ou.delete':case 'ou.assignObject': {
    const d=domainOperation();if(!d.ok)return deny(d.code);
    if(c.type==='ou.create'){if(!key(p.name)||p.parentId&&!get('organizationalUnits',p.parentId))return deny('invalid_ou');const unit={id:nextId(next,'ou'),name:p.name,parentId:p.parentId||null};next.organizationalUnits.push(unit);data={ou:unit};code='ou_created';}
    else if(c.type==='ou.assignObject'){if(p.ouId!==null&&!get('organizationalUnits',p.ouId))return deny('ou_not_found');const kind=p.kind;const target=kind==='account'?get('accounts',p.objectId):kind==='group'?get('groups',p.objectId):null;if(kind==='machine'){if(!requireMachine(p.objectId).ok)return deny('machine_not_found');const m=next.machineMemberships.find(x=>x.machineId===p.objectId);if(!m?.joined)return deny('machine_not_domain_member');m.ouId=p.ouId||null;}else if(!target||target.kind==='local'||target.kind==='machine-local')return deny('invalid_ou_object');else target.ouId=p.ouId||null;code='ou_assigned';}
    else {const unit=get('organizationalUnits',p.ouId);if(!unit)return deny('ou_not_found');if(c.type==='ou.rename'){if(!key(p.name))return deny('invalid_ou');unit.name=p.name;code='ou_renamed';}
    else if(c.type==='ou.move'){if(p.parentId===unit.id||p.parentId&&!get('organizationalUnits',p.parentId))return deny('invalid_parent_ou');let parent=p.parentId?get('organizationalUnits',p.parentId):null;while(parent){if(parent.id===unit.id)return deny('ou_cycle');parent=parent.parentId?get('organizationalUnits',parent.parentId):null;}unit.parentId=p.parentId||null;code='ou_moved';}
    else {if(next.organizationalUnits.some(x=>x.parentId===unit.id)||next.accounts.some(x=>x.ouId===unit.id)||next.groups.some(x=>x.ouId===unit.id)||next.machineMemberships.some(x=>x.ouId===unit.id))return deny('organizational_unit_not_empty');next.organizationalUnits=next.organizationalUnits.filter(x=>x.id!==unit.id);code='ou_deleted';}}break;
   }
   case 'administrator.grant':case 'administrator.revoke': {
    if(!['machine','domain'].includes(p.scope)||!validPrincipal(next,p.principalId))return deny('invalid_administrator');if(p.scope==='domain'&&(getAccount(next,p.principalId)?.kind==='local'||getGroup(next,p.principalId)?.kind==='machine-local'))return deny('invalid_administrator');const a=checkScope(p.scope,p.machineId);if(!a.ok)return deny(a.code);if(p.scope==='machine'&&!requireMachine(p.machineId).ok)return deny('machine_not_found');const item={principalId:p.principalId,scope:p.scope,...(p.scope==='machine'?{machineId:p.machineId}:{})};const index=next.administratorAssignments.findIndex(x=>JSON.stringify(x)===JSON.stringify(item));if(c.type==='administrator.grant'){if(index>=0)return deny('administrator_already_granted');next.administratorAssignments.push(item);code='administrator_granted';}else{if(index<0)return deny('administrator_not_found');next.administratorAssignments.splice(index,1);code='administrator_revoked';}break;
   }
   case 'folder.create': {
    if(!key(p.name))return deny('invalid_folder');const m=requireMachine(p.machineId);if(!m.ok)return deny(m.code);if(p.parentId){const parent=get('folders',p.parentId);if(!parent||parent.machineId!==p.machineId)return deny('invalid_parent_folder');if(actor.session.machineId!==p.machineId)return deny('local_machine_mismatch');const a=app(parent.id,'write');if(!a.ok)return a;}
    else {if(actor.session.machineId!==p.machineId)return deny('local_machine_mismatch');const a=checkScope('machine',p.machineId);if(!a.ok)return deny(a.code);}
    if(next.folders.some(x=>x.machineId===p.machineId&&x.parentId===(p.parentId||null)&&x.name.toLowerCase()===p.name.toLowerCase()))return deny('duplicate_folder');
    const folder={id:nextId(next,'folder'),machineId:p.machineId,parentId:p.parentId||null,name:p.name,inheritanceEnabled:true,acl:[]};next.folders.push(folder);data={folder};code='folder_created';break;
   }
   case 'folder.rename':case 'folder.delete': {
    const f=get('folders',p.folderId);if(!f)return deny('folder_not_found');if(actor.session.machineId!==f.machineId)return deny('local_machine_mismatch');const a=app(f.parentId||f.id,'write');if(!a.ok)return a;
    if(c.type==='folder.rename'){if(!key(p.name)||next.folders.some(x=>x.id!==f.id&&x.parentId===f.parentId&&x.machineId===f.machineId&&x.name.toLowerCase()===p.name.toLowerCase()))return deny('invalid_or_duplicate_folder');f.name=p.name;code='folder_renamed';}
    else{if(next.folders.some(x=>x.parentId===f.id)||next.files.some(x=>x.folderId===f.id)||next.shares.some(x=>x.folderId===f.id))return deny('folder_not_empty');next.folders=next.folders.filter(x=>x.id!==f.id);code='folder_deleted';}break;
   }
   case 'ntfs.setPermission':case 'ntfs.removePermission':case 'ntfs.disableInheritance':case 'ntfs.enableInheritance': {
    const f=get('folders',p.folderId);if(!f)return deny('folder_not_found');if(actor.session.machineId!==f.machineId)return deny('local_machine_mismatch');const a=app(f.id,'admin');if(!a.ok)return a;
    if(c.type==='ntfs.setPermission'){if(!validPrincipal(next,p.principalId)||!permission(p.level))return deny('invalid_permission');if(getAccount(next,p.principalId)?.kind==='local'&&getAccount(next,p.principalId).ownerId!==f.machineId)return deny('invalid_principal_scope');if(getGroup(next,p.principalId)?.kind==='machine-local'&&getGroup(next,p.principalId).ownerId!==f.machineId)return deny('invalid_principal_scope');const entry={principalId:p.principalId,level:p.level,inheritable:p.inheritable!==false};const ix=f.acl.findIndex(x=>x.principalId===p.principalId);if(ix>=0)f.acl[ix]=entry;else f.acl.push(entry);code='ntfs_permission_set';}
    else if(c.type==='ntfs.removePermission'){const ix=f.acl.findIndex(x=>x.principalId===p.principalId);if(ix<0)return deny('permission_not_found');f.acl.splice(ix,1);code='ntfs_permission_removed';}
    else if(c.type==='ntfs.disableInheritance'){if(!['preserve','removeInherited'].includes(p.mode))return deny('invalid_inheritance_mode');if(!f.inheritanceEnabled)return deny('inheritance_already_disabled');if(p.mode==='preserve'){for(const entry of inheritedEntries(next,f.id)){const existing=f.acl.find(x=>x.principalId===entry.principalId);if(existing){if(ranks[entry.level]>ranks[existing.level])existing.level=entry.level;}else f.acl.push({principalId:entry.principalId,level:entry.level,inheritable:entry.inheritable});}}f.inheritanceEnabled=false;code='inheritance_disabled';}
    else {if(f.inheritanceEnabled)return deny('inheritance_already_enabled');f.inheritanceEnabled=true;code='inheritance_enabled';}break;
   }
   case 'file.create':case 'file.update':case 'file.rename':case 'file.delete': {
    const f=c.type==='file.create'?get('folders',p.folderId):get('files',p.fileId)&&get('folders',get('files',p.fileId).folderId);if(!f)return deny('folder_or_file_not_found');if(actor.session.machineId!==f.machineId)return deny('local_machine_mismatch');const a=app(f.id,'write');if(!a.ok)return a;
    if(c.type==='file.create'){if(!key(p.name)||typeof p.content!=='string'||p.content.length>20000||next.files.some(x=>x.folderId===f.id&&x.name.toLowerCase()===p.name.toLowerCase()))return deny('invalid_file');const file={id:nextId(next,'file'),folderId:f.id,name:p.name,content:p.content};next.files.push(file);data={file};code='file_created';}
    else{const file=get('files',p.fileId);if(c.type==='file.update'){if(typeof p.content!=='string'||p.content.length>20000)return deny('invalid_file');file.content=p.content;code='file_updated';}else if(c.type==='file.rename'){if(!key(p.name)||next.files.some(x=>x.id!==file.id&&x.folderId===file.folderId&&x.name.toLowerCase()===p.name.toLowerCase()))return deny('invalid_file_name');file.name=p.name;code='file_renamed';}else{next.files=next.files.filter(x=>x.id!==file.id);code='file_deleted';}}break;
   }
   case 'smb.fileUpdate':case 'smb.fileCreate':case 'smb.fileDelete': {
    const access=query({type:'access.evaluateSmb',sessionId:actor.session.id,credentialAccountId:p.credentialAccountId,shareId:p.shareId,operation:'write'});
    if(!access.success)return deny(access.code,access.data);
    const share=get('shares',p.shareId);const root=get('folders',share.folderId);
    let file=c.type==='smb.fileCreate'?null:get('files',p.fileId);
    if(c.type!=='smb.fileCreate'&&!file)return deny('file_not_found');
    let folder=c.type==='smb.fileCreate'?get('folders',p.folderId??root.id):get('folders',file.folderId);
    if(!folder||folder.machineId!==root.machineId)return deny('folder_not_found');
    let parent=folder,underRoot=false;while(parent){if(parent.id===root.id){underRoot=true;break;}parent=parent.parentId?get('folders',parent.parentId):null;}
    if(!underRoot)return deny('folder_outside_share');
    const networkAccountId=p.credentialAccountId||actor.account.id;
    const accessFolder=effectiveNtfs(next,networkAccountId,folder.id);
    if(!accessFolder.ok||ranks[accessFolder.level]<ranks.write)return deny('ntfs_insufficient_permission');
    if(c.type==='smb.fileCreate'){
     if(!key(p.name)||typeof p.content!=='string'||p.content.length>20000||next.files.some(x=>x.folderId===folder.id&&x.name.toLowerCase()===p.name.toLowerCase()))return deny('invalid_file');
     file={id:nextId(next,'file'),folderId:folder.id,name:p.name,content:p.content};next.files.push(file);data={file};code='smb_file_created';
    }else if(c.type==='smb.fileUpdate'){
     if(typeof p.content!=='string'||p.content.length>20000)return deny('invalid_file');file.content=p.content;code='smb_file_updated';
    }else{next.files=next.files.filter(x=>x.id!==file.id);code='smb_file_deleted';}
    break;
   }
   case 'share.create':case 'share.rename':case 'share.delete':case 'share.setPermission':case 'share.removePermission': {
    const isNew=c.type==='share.create';const share=isNew?null:get('shares',p.shareId);if(!isNew&&!share)return deny('share_not_found');const machineId=isNew?p.machineId:share.machineId;const a=checkScope('machine',machineId);if(!a.ok)return deny(a.code);
    if(isNew){const f=get('folders',p.folderId);if(!f||f.machineId!==machineId||!key(p.name)||next.shares.some(x=>x.machineId===machineId&&x.name.toLowerCase()===p.name.toLowerCase()))return deny('invalid_share');const newShare={id:nextId(next,'share'),machineId,folderId:f.id,name:p.name,acl:[]};next.shares.push(newShare);data={share:newShare};code='share_created';}
    else if(c.type==='share.rename'){if(!key(p.name)||next.shares.some(x=>x.id!==share.id&&x.machineId===machineId&&x.name.toLowerCase()===p.name.toLowerCase()))return deny('invalid_share');share.name=p.name;code='share_renamed';}
    else if(c.type==='share.delete'){if(next.driveMappingRules.some(x=>x.shareId===share.id))return deny('share_referenced');next.shares=next.shares.filter(x=>x.id!==share.id);for(const ses of next.sessions)ses.mappedDrives=ses.mappedDrives.filter(x=>x.shareId!==share.id);code='share_deleted';}
    else if(c.type==='share.setPermission'){if(!validPrincipal(next,p.principalId)||!permission(p.level))return deny('invalid_permission');const entry={principalId:p.principalId,level:p.level,inheritable:false};const ix=share.acl.findIndex(x=>x.principalId===p.principalId);if(ix>=0)share.acl[ix]=entry;else share.acl.push(entry);code='share_permission_set';}
    else {const ix=share.acl.findIndex(x=>x.principalId===p.principalId);if(ix<0)return deny('permission_not_found');share.acl.splice(ix,1);code='share_permission_removed';}break;
   }
   case 'driveRule.create':case 'driveRule.update':case 'driveRule.delete': {
    const d=domainOperation();if(!d.ok)return deny(d.code);
    if(c.type==='driveRule.delete'){const i=next.driveMappingRules.findIndex(x=>x.id===p.ruleId);if(i<0)return deny('drive_rule_not_found');next.driveMappingRules.splice(i,1);code='drive_rule_deleted';break;}
    let rule=null;if(c.type==='driveRule.update'){rule=get('driveMappingRules',p.ruleId);if(!rule)return deny('drive_rule_not_found');}
    if(!validPrincipal(next,p.principalId)||!get('shares',p.shareId)||!/^[A-Z]$/.test(p.letter))return deny('invalid_drive_rule');
    if(rule){Object.assign(rule,{principalId:p.principalId,shareId:p.shareId,letter:p.letter});code='drive_rule_updated';}
    else {rule={id:nextId(next,'driveRule'),principalId:p.principalId,shareId:p.shareId,letter:p.letter};next.driveMappingRules.push(rule);code='drive_rule_created';data={rule};}break;
   }
   case 'session.open': {
    const machine=requireMachine(p.machineId);if(!machine.ok)return deny(machine.code);const account=get('accounts',p.accountId);if(!account)return deny('account_not_found');if(!account.enabled)return deny('account_disabled');if(account.locked)return deny('account_locked');if((p.credentialRevision??0)!==account.credentialRevision)return deny('credential_rejected');
    if(account.kind==='local'&&account.ownerId!==p.machineId)return deny('identity_not_recognized');
    if(account.kind==='domain'){if(!next.machineMemberships.some(x=>x.machineId===p.machineId&&x.joined))return deny('machine_not_domain_member');const dc=domainReady(next,host,p.machineId);if(!dc.ok)return deny(dc.code);}
    // Les ouvertures de session sont des opérations utilisateur, non des opérations administrateur.
    const profile=next.profiles.find(x=>x.accountId===p.accountId&&x.machineId===p.machineId)||{id:nextId(next,'profile'),accountId:p.accountId,machineId:p.machineId};if(!next.profiles.some(x=>x.id===profile.id))next.profiles.push(profile);
    const mappedDrives=account.kind==='domain'?next.driveMappingRules.filter(x=>principals(next,account.id,p.machineId).has(x.principalId)).map(x=>({letter:x.letter,shareId:x.shareId})):[];
    const session={id:nextId(next,'session'),machineId:p.machineId,accountId:p.accountId,kind:account.kind,active:true,profileId:profile.id,mappedDrives};next.sessions.push(session);code='session_opened';data={session};break;
   }
   case 'session.close': {
    const ses=get('sessions',p.sessionId);if(!ses)return deny('session_not_found');if(ses.id!==actor.session.id&&!adminFor(next,actor.account.id,ses.machineId,'machine'))return deny('administrator_required');ses.active=false;code='session_closed';break;
   }
   default:return deny('unsupported_command');
  }
  next.revision++;try{validateState(next,host)}catch(e){return deny('invalid_resulting_state',{reason:e.message})}
  s=next;return success(code,data,s.revision);
 }
 function query(q){
  if(!obj(q)||!str(q.type))return fail('invalid_query',{},s.revision);
  const p=q;const rev=s.revision;
  switch(q.type){
   case 'state.summary':return success('ok',{revision:rev,counts:Object.fromEntries(['accounts','groups','folders','files','shares','sessions'].map(k=>[k,s[k].length]))},rev);
   case 'account.list':case 'group.list':case 'ou.list':case 'folder.list':case 'file.list':case 'share.list':case 'session.list':case 'driveRule.list':{
    const k=({'account.list':'accounts','group.list':'groups','ou.list':'organizationalUnits','folder.list':'folders','file.list':'files','share.list':'shares','session.list':'sessions','driveRule.list':'driveMappingRules'})[q.type];
    return success('ok',{items:s[k].filter(x=>!p.ownerId||x.ownerId===p.ownerId).filter(x=>!p.machineId||x.machineId===p.machineId)},rev);
   }
   case 'domain.status':{const dc=domainReady(s,host,p.sourceMachineId);return success('ok',{domain:copy(s.domain),directoryAvailable:dc.ok,code:dc.ok?'ok':dc.code,controllerAssetId:dc.controllerAssetId??null},rev);}
   case 'identity.groups':{const a=getAccount(s,p.accountId);if(!a)return fail('account_not_found',{},rev);return success('ok',{accountId:a.id,groupIds:applicableGroups(s,a.id,p.machineId)},rev);}
   case 'group.members':{if(!getGroup(s,p.groupId))return fail('group_not_found',{},rev);return success('ok',{members:s.groupMemberships.filter(x=>x.groupId===p.groupId)},rev);}
   case 'ntfs.effectivePermission':{const x=effectiveNtfs(s,p.accountId,p.folderId);return x.ok?success('ok',x,rev):fail(x.code,{},rev);}
   case 'file.read':{const ses=idRef(s.sessions,p.sessionId);if(!ses||!ses.active)return fail('actor_session_invalid',{},rev);const f=idRef(s.files,p.fileId);if(!f||getFolder(s,f.folderId)?.machineId!==ses.machineId)return fail('file_not_found',{},rev);const x=effectiveNtfs(s,ses.accountId,f.folderId);if(!x.ok)return fail(x.code,{},rev);if(ranks[x.level]<1)return fail('ntfs_insufficient_permission',{level:x.level},rev);return success('ok',{file:f},rev);}
   case 'session.profile':{const ses=idRef(s.sessions,p.sessionId);if(!ses)return fail('session_not_found',{},rev);return success('ok',{profile:idRef(s.profiles,ses.profileId)},rev);}
   case 'session.mappedDrives':{const ses=idRef(s.sessions,p.sessionId);if(!ses)return fail('session_not_found',{},rev);return success('ok',{items:arr(ses.mappedDrives)},rev);}
   case 'access.evaluateLocal':{
    const ses=idRef(s.sessions,p.sessionId);if(!ses||!ses.active)return fail('actor_session_invalid',{},rev);const f=getFolder(s,p.folderId);if(!f||f.machineId!==ses.machineId)return fail('folder_not_found',{},rev);
    const x=effectiveNtfs(s,ses.accountId,f.id);if(!x.ok)return fail(x.code,{},rev);const needed=p.operation==='read'?'read':p.operation==='write'?'write':p.operation==='admin'?'admin':null;if(!needed)return fail('invalid_operation',{},rev);
    return ranks[x.level]>=ranks[needed]?success('access_granted',{level:x.level,groups:x.groups},rev):fail('ntfs_insufficient_permission',{level:x.level,needed},rev);
   }
   case 'smb.evaluateAccess':case 'access.evaluateSmb':{
    const ses=idRef(s.sessions,p.sessionId);if(!ses||!ses.active)return fail('actor_session_invalid',{},rev);const share=idRef(s.shares,p.shareId);if(!share)return fail('share_not_found',{},rev);
    const m=lookupMachine(host,share.machineId);if(!m.ok)return fail(m.code,{},rev);
    const status=service(host,share.machineId,'smb');if(status!=='available')return fail(status==='unknown'?'service_status_unknown':'service_unavailable',{},rev);
    const link=reachable(host,ses.machineId,share.machineId,'smb');if(link!=='reachable')return fail(link==='unknown'?'network_status_unknown':'server_unreachable',{},rev);
    const acct=getAccount(s,p.credentialAccountId||ses.accountId);if(!acct||!acct.enabled||acct.locked)return fail('identity_not_recognized',{},rev);
    if(acct.kind==='local'&&acct.ownerId!==share.machineId)return fail('identity_not_recognized',{},rev);
    if(acct.kind==='domain'){const d=domainReady(s,host,share.machineId);if(!d.ok)return fail(d.code,{},rev);if(!s.machineMemberships.some(x=>x.machineId===share.machineId&&x.joined))return fail('identity_not_recognized',{},rev);}
    const who=principals(s,acct.id,share.machineId);const shareLevel=permissionMax(share.acl,who),ntfs=effectiveNtfs(s,acct.id,share.folderId);if(!ntfs.ok)return fail(ntfs.code,{},rev);const effective=PERMISSIONS[Math.min(ranks[shareLevel],ranks[ntfs.level])];
    const needed=p.operation==='read'?'read':p.operation==='write'?'write':p.operation==='admin'?'admin':null;if(!needed)return fail('invalid_operation',{},rev);
    const data={sessionAccountId:ses.accountId,networkAccountId:acct.id,shareLevel,ntfsLevel:ntfs.level,effectiveLevel:effective,needed};
    if(ranks[shareLevel]<ranks[needed])return fail('share_insufficient_permission',data,rev);
    if(ranks[ntfs.level]<ranks[needed])return fail('ntfs_insufficient_permission',data,rev);
    return success('access_granted',data,rev);
   }
   default:return fail('unsupported_query',{},rev);
  }
 }
 return {command,query,getSnapshot:()=>copy(s),exportState:()=>copy(s)};
}