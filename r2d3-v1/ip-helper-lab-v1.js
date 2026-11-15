import {createAssetRegistry,restoreAssetRegistry} from "./asset-profiles.js";
import {addSwitchVlan,setSwitchAccessPort} from "./vlan-v1.js";
import {setSwitchVlanInterface,setSwitchInterVlanRouting} from "./inter-vlan-routing-v1.js";
import {createEngine} from "./r2d3-core.js";
import {getAssetIpHelperConfig,setVlanIpHelper,observeRegisteredRelayedDhcp} from "./ip-helper-v1.js";
const $=id=>document.getElementById(id);
const tasks={
 1:["Profil et état initial","SW01 possède la fonction IP Helper mais aucun relais n'est configuré. La demande DHCP doit échouer."],
 2:["Activation du relais DHCP","Sans configuration IP Helper, la demande DHCP échoue. Configure ensuite le serveur 192.168.20.2 sur le VLAN 10 et réessaie."],
 3:["Configurations indépendantes","SW01 possède un relais VLAN 10 actif. SW02 possède la même capacité, mais ses réglages sont indépendants. Configure un relais différent sur SW02 sans modifier SW01."],
 4:["Désactivation par réseau","SW01 possède deux réglages : VLAN 10 actif, VLAN 20 inactif. Désactive le relais du VLAN 10. Une nouvelle demande DHCP doit échouer."],
 5:["Export et restauration","Sauvegarde les réglages de SW01, désactive son relais VLAN 10 et constate l'échec, puis restaure l'inventaire pour retrouver le relais fonctionnel."]
};
let reg,pc,srv,sw,sw2,engine,which=1,changed=false,snapshot=null;
const ok=v=>{if(!v?.success)throw Error(v?.message||v?.reason||"Opération refusée");return v;};
function cable(a,b){
 const c=ok(reg.createCable()).cable;
 ok(reg.connectCableEnd(c.id,0,a));ok(reg.connectCableEnd(c.id,1,b));
}
function dhcpScenario(){
 const pool=(n)=>({id:"plage-vlan"+n,start:"192.168."+n+".100",end:"192.168."+n+".110",
  prefix:24,gateway:"192.168."+n+".1",dns:[],leaseSeconds:3600});
 return {
  format:"r2d3-scenario",schemaVersion:1,scenarioId:"ip-helper-v1-lab",
  scenarioVersion:"1",capabilities:{network:true},
  objects:[
   {id:pc.id,kind:"pc-windows",name:"PC1",ports:[{id:"eth0",type:"rj45"}],
    config:{ipv4:{interfaceId:"eth0",mode:"dhcp",address:null,prefix:null,lease:null},networkOptions:{gateway:null,dns:[]}}},
   {id:srv.id,kind:"dhcp-server",name:"Serveur",ports:[{id:"eth0",type:"rj45"}],
    config:{ipv4:{interfaceId:"eth0",mode:"static",address:"192.168.20.2",prefix:24},
      dhcpEnabled:true,dhcpPools:[pool(20),pool(10)]}}
  ],
  // La liaison logique sert uniquement au service DHCP du Core.
  // Le chemin physique et VLAN est recalculé par l'adaptateur IP Helper V1.
  links:[{id:"service-relay",kind:"relay-service",connected:true,
   endpoints:[{objectId:pc.id,portId:"eth0"},{objectId:srv.id,portId:"eth0"}]}]
 };
}
function helper(asset,vlan,address,enabled=true){ok(setVlanIpHelper(reg,asset.id,vlan,address,enabled));}
function load(n){
 which=n;changed=false;snapshot=null;reg=createAssetRegistry();
 const pp=ok(reg.createProfile("PC DHCP")).profile;
 const dp=ok(reg.createProfile("Serveur DHCP")).profile;
 const sp=ok(reg.createProfile("Switch L3 avec IP Helper")).profile;
 for(const p of [pp,dp])ok(reg.addPortGroup(p.id,{type:"ethernet-rj45",prefix:"LAN",start:1,count:1}));
 ok(reg.addPortGroup(sp.id,{type:"ethernet-rj45",prefix:"P",start:1,count:5}));
 for(const cap of ["ethernet-switching","vlan","inter-vlan-routing","ip-helper"])
  ok(reg.setProfileNetworkCapability(sp.id,cap,true));
 pc=ok(reg.createAsset(pp.id,{name:"PC1"})).asset;
 srv=ok(reg.createAsset(dp.id,{name:"SRV-DHCP"})).asset;
 sw=ok(reg.createAsset(sp.id,{name:"SW01"})).asset;
 sw2=ok(reg.createAsset(sp.id,{name:"SW02"})).asset;
 cable(pc.ports[0].id,sw.ports[0].id);
 cable(srv.ports[0].id,sw.ports[1].id);
 for(const asset of [sw,sw2]){
  for(const id of [10,20])ok(addSwitchVlan(reg,asset.id,id,"VLAN "+id));
 }
 ok(setSwitchAccessPort(reg,sw.id,sw.ports[0].id,10));
 ok(setSwitchAccessPort(reg,sw.id,sw.ports[1].id,20));
 ok(setSwitchVlanInterface(reg,sw.id,10,"192.168.10.1",24));
 ok(setSwitchVlanInterface(reg,sw.id,20,"192.168.20.1",24));
 ok(setSwitchInterVlanRouting(reg,sw.id,true));
 engine=createEngine(dhcpScenario());
 if(n>=3)helper(sw,10,"192.168.20.2");
 if(n===4)helper(sw,20,"192.168.10.2",false);
 $("title").textContent="Test "+n+" : "+tasks[n][0];
 $("instruction").textContent=tasks[n][1];
 $("change").hidden=n===1;
 $("change").disabled=false;
 $("change").textContent=({
  2:"Activer IP Helper sur VLAN 10",
  3:"Configurer IP Helper sur SW02",
  4:"Désactiver IP Helper sur VLAN 10",
  5:"Désactiver IP Helper sur SW01"
 })[n]||"";
 $("export").hidden=n!==5;$("restore").hidden=n!==5;
 for(const b of $("tests").querySelectorAll("button")){
  b.classList.toggle("selected",Number(b.dataset.test)===n);
  b.setAttribute("aria-pressed",String(Number(b.dataset.test)===n));
 }
 render();say("Scénario chargé. Commence par vérifier l'état affiché.");
}
function say(message,style=""){$("result").className=style;$("result").textContent=message;}
function render(){
 const state=engine.getSnapshot();
 const pools=engine.query({type:"dhcp.pools",serverId:srv.id});
 const current=state.objectsById[pc.id].config.ipv4;
 const lines=[
  "PC1 | VLAN 10 | IPv4 "+(current.address||"non attribuée"),
  "Serveur DHCP | VLAN 20 | 192.168.20.2",
  "SW01 : routage L3 actif | SVI VLAN 10 : 192.168.10.1/24",
  ""
 ];
 for(const asset of [sw,sw2]){
  const a=reg.getAsset(asset.id),cfg=getAssetIpHelperConfig(reg,asset.id);
  lines.push(a.name+" | capacité IP Helper : "+(a.networkCapabilities.includes("ip-helper")?"OUI":"NON"));
  for(const num of [10,20]){
   const h=cfg.helpers["vlan:"+num];
   lines.push("  VLAN "+num+" : "+(!h?"non configuré":(h.enabled?"ACTIF":"INACTIF")+" | serveur "+h.serverAddress));
  }
 }
 lines.push("","Plages DHCP du serveur ("+(pools.enabled?"actif":"arrêté")+") :");
 for(const p of pools.pools)lines.push("  "+p.id+" : "+p.start+" à "+p.end+" /"+p.prefix);
 lines.push("","Bail PC1 : "+(current.lease?current.lease.poolId+" (expire à "+current.lease.expires+" s)":"aucun"));
 $("network").textContent=lines.join("\n");
 $("change").disabled=changed;
 $("restore").disabled=!snapshot;
}
$("request").onclick=()=>{
 const result=observeRegisteredRelayedDhcp({registry:reg,switchId:sw.id,clientId:pc.id,
  serverId:srv.id,serverAddress:"192.168.20.2",dhcpEngine:engine});
 render();
 say((result.success?"BAIL OBTENU":"ACQUISITION ÉCHOUÉE")+" : "+result.reason+
  (result.success?" | "+result.address+" / "+result.poolId:""),result.success?"good":"bad");
};
$("change").onclick=()=>{
 try{
  if(which===2)helper(sw,10,"192.168.20.2");
  if(which===3)helper(sw2,10,"192.168.20.99",false);
  if(which===4||which===5)helper(sw,10,"192.168.20.2",false);
  changed=true;render();say("Configuration modifiée dans le registre R2. Relance la demande DHCP.");
 }catch(e){say(e.message,"bad");}
};
$("export").onclick=()=>{snapshot=reg.exportState();render();say("Registre R2 exporté. Désactive maintenant le relais.");};
$("restore").onclick=()=>{
 try{reg=restoreAssetRegistry(snapshot);changed=false;render();say("Registre restauré. Relance la demande DHCP.");}
 catch(e){say(e.message,"bad");}
};
$("reset").onclick=()=>load(which);
$("tests").onclick=e=>{const b=e.target.closest("button[data-test]");if(b)load(Number(b.dataset.test));};
load(1);
