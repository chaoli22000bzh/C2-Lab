import {createAssetRegistry} from "./asset-profiles.js";
import {addSwitchVlan,setSwitchAccessPort} from "./vlan-v1.js";
import {setSwitchVlanInterface,setSwitchInterVlanRouting} from "./inter-vlan-routing-v1.js";
import {createEngine} from "./r2d3-core.js";
import {createDefaultIpHelperConfig,configureIpHelper,requestRelayedDhcp} from "./ip-helper-v01.js";

const el=id=>document.getElementById(id);
const cases={
 1:["Sans IP Helper","Le PC du VLAN 10 et le serveur du VLAN 20 sont bien raccordés. Sans IP Helper, aucun bail ne doit être attribué. Active ensuite le relais."],
 2:["Mauvaise adresse IP Helper","Le relais du VLAN 10 pointe vers 192.168.20.99 alors que le serveur est en 192.168.20.2. Corrige cette adresse."],
 3:["IP Helper correct","Le relais du VLAN 10 pointe vers le bon serveur DHCP. Le bail doit provenir de la plage du VLAN 10, pas de celle du VLAN 20."],
 4:["Câble interrompu","Malgré une configuration correcte, le câble du serveur est débranché. Raccorde-le pour rétablir le service DHCP."],
 5:["Serveur DHCP arrêté","IP Helper est correctement configuré, mais le service DHCP est arrêté. Démarre le service pour obtenir un bail."]
};
let registry,pc,sw,server,serverCable,engine,helperConfig,which=1,changed=false;
const ok=value=>{if(!value?.success)throw Error(value?.message||value?.reason||"Opération refusée");return value;};
function wire(a,b){
 const cable=ok(registry.createCable()).cable;
 ok(registry.connectCableEnd(cable.id,0,a));
 ok(registry.connectCableEnd(cable.id,1,b));
 return cable;
}
function makeDhcpScenario(){
 const pool=(id,segment)=>({
  id,start:"192.168."+segment+".100",end:"192.168."+segment+".110",
  prefix:24,gateway:"192.168."+segment+".1",dns:[],leaseSeconds:86400
 });
 return {
  format:"r2d3-scenario",schemaVersion:1,scenarioId:"ip-helper-v01-lab",
  scenarioVersion:"1.0",capabilities:{network:true},
  objects:[
   {id:pc.id,kind:"pc-windows",name:"PC1",ports:[{id:"eth0",type:"rj45"}],
    config:{ipv4:{interfaceId:"eth0",mode:"dhcp",address:null,prefix:null,lease:null},networkOptions:{gateway:null,dns:[]}}},
   {id:server.id,kind:"dhcp-server",name:"Serveur DHCP",ports:[{id:"eth0",type:"rj45"}],
    config:{ipv4:{interfaceId:"eth0",mode:"static",address:"192.168.20.2",prefix:24},
     dhcpEnabled:true,dhcpPools:[pool("plage-vlan20",20),pool("plage-vlan10",10)]}}
  ],
  // Liaison interne au seul service DHCP après contrôles physiques et VLAN sur R2.
  links:[{id:"relay-dhcp-service",kind:"relay-service",connected:true,
   endpoints:[{objectId:pc.id,portId:"eth0"},{objectId:server.id,portId:"eth0"}]}]
 };
}
function setHelper(ip,active=true){
 helperConfig=ok(configureIpHelper(helperConfig,10,ip,active)).config;
}
function setup(n){
 which=n;changed=false;registry=createAssetRegistry();
 const pp=ok(registry.createProfile("PC client")).profile,
  sp=ok(registry.createProfile("Switch L3")).profile,
  dp=ok(registry.createProfile("Serveur DHCP")).profile;
 for(const p of [pp,dp])ok(registry.addPortGroup(p.id,{type:"ethernet-rj45",prefix:"LAN",start:1,count:1}));
 ok(registry.addPortGroup(sp.id,{type:"ethernet-rj45",prefix:"P",start:1,count:4}));
 for(const name of ["ethernet-switching","vlan","inter-vlan-routing"])ok(registry.setProfileNetworkCapability(sp.id,name,true));
 pc=ok(registry.createAsset(pp.id,{name:"PC1"})).asset;
 sw=ok(registry.createAsset(sp.id,{name:"SW-L3"})).asset;
 server=ok(registry.createAsset(dp.id,{name:"SRV-DHCP"})).asset;
 wire(pc.ports[0].id,sw.ports[0].id);
 serverCable=wire(server.ports[0].id,sw.ports[1].id);
 for(const vlan of [10,20])ok(addSwitchVlan(registry,sw.id,vlan,"VLAN "+vlan));
 ok(setSwitchAccessPort(registry,sw.id,sw.ports[0].id,10));
 ok(setSwitchAccessPort(registry,sw.id,sw.ports[1].id,20));
 ok(setSwitchVlanInterface(registry,sw.id,10,"192.168.10.1",24));
 ok(setSwitchVlanInterface(registry,sw.id,20,"192.168.20.1",24));
 ok(setSwitchInterVlanRouting(registry,sw.id,true));
 engine=createEngine(makeDhcpScenario());
 helperConfig=createDefaultIpHelperConfig(sw);
 if(n===2)setHelper("192.168.20.99");
 if(n>=3)setHelper("192.168.20.2");
 if(n===4)ok(registry.disconnectCableEnd(serverCable.id,1));
 if(n===5)stopServer();
 el("title").textContent="Test "+n+" : "+cases[n][0];
 el("instruction").textContent=cases[n][1];
 el("change").hidden=n===3;
 el("change").disabled=false;
 el("change").textContent=({
  1:"Activer IP Helper sur le VLAN 10",
  2:"Corriger l'adresse IP Helper",
  4:"Rebrancher le câble du serveur",
  5:"Démarrer le service DHCP"
 })[n]||"";
 for(const b of el("tests").querySelectorAll("button")){
  b.classList.toggle("selected",Number(b.dataset.test)===n);
  b.setAttribute("aria-pressed",String(Number(b.dataset.test)===n));
 }
 render();feedback("Scénario chargé. Effectue la demande DHCP.");
}
function command(type,params){
 const snap=engine.getSnapshot();
 const result=engine.dispatch({commandVersion:1,id:type+"-"+String(snap.revision+1),
  type,targetId:server.id,params});
 if(result.status!=="applied")throw Error(result.message||result.code||"Commande DHCP refusée");
}
function stopServer(){command("dhcp.setServerEnabled",{enabled:false});}
function startServer(){command("dhcp.setServerEnabled",{enabled:true});}
function feedback(msg,cls=""){el("result").className=cls;el("result").textContent=msg;}
function render(){
 const h=helperConfig.helpers["10"];
 const s=engine.getSnapshot();
 const lease=s.objectsById[pc.id].config.ipv4;
 const pools=engine.query({type:"dhcp.pools",serverId:server.id});
 const cable=registry.getCable(serverCable.id);
 const lines=[
  "PC1 : VLAN 10 | adresse "+(lease.address||"non attribuée"),
  "SW-L3 : VLAN 10 = 192.168.10.1/24 | VLAN 20 = 192.168.20.1/24",
  "Routage L3 : "+(registry.getAsset(sw.id).routingConfig.routingEnabled?"activé":"désactivé"),
  "IP Helper sur VLAN 10 : "+(!h?"non configuré":h.enabled?"activé":"désactivé"),
  "Adresse du serveur dans IP Helper : "+(h?.serverAddress||"aucune"),
  "SRV-DHCP : 192.168.20.2 (VLAN 20)",
  "Service DHCP : "+(pools.enabled?"actif":"arrêté"),
  "Câble serveur : "+(cable.ends[1]?"branché":"débranché"),
  "Plages DHCP : VLAN 20 / VLAN 10",
  "Bail du PC1 : "+(lease.lease?"plage "+(lease.lease.poolId||"défaut"):"aucun")
 ];
 el("network").textContent=lines.join("\n");
 el("change").disabled=changed;
}
el("request").onclick=()=>{
 const result=requestRelayedDhcp({
  registry,switchId:sw.id,clientId:pc.id,serverId:server.id,serverAddress:"192.168.20.2",
  helperConfig,dhcpEngine:engine
 });
 render();
 feedback((result.success?"BAIL OBTENU":"ACQUISITION ÉCHOUÉE")+" : "+
  result.reason+(result.success?" | "+result.address+" ("+result.poolId+")":""),
  result.success?"good":"bad");
};
el("change").onclick=()=>{
 try{
  if(which===1||which===2)setHelper("192.168.20.2");
  if(which===4)ok(registry.connectCableEnd(serverCable.id,1,sw.ports[1].id));
  if(which===5)startServer();
  changed=true;render();feedback("Modification appliquée. Demande de nouveau une adresse DHCP.");
 }catch(e){feedback(e.message,"bad");}
};
el("reset").onclick=()=>setup(which);
el("tests").onclick=e=>{const b=e.target.closest("button[data-test]");if(b)setup(Number(b.dataset.test));};
setup(1);
