import {createAssetRegistry,restoreAssetRegistry} from "./asset-profiles.js";
import {createEngine} from "./r2d3-core.js";
import {getSwitchManagement,configureSwitchManagementStatic,configureSwitchManagementDhcp,acquireSwitchManagementDhcp} from "./switch-management-ip-v01.js";
const $=id=>document.getElementById(id);
const tasks={
 1:["Configuration initiale","Compare SW01 et SW02 administrables (mode DHCP sans bail) et SW03 non administrable (aucune IP de gestion)."],
 2:["Adresse IPv4 statique","Configure SW01 en 192.168.1.10/24 avec passerelle 192.168.1.1, sans modifier SW02 ni les VLAN."],
 3:["Refus d'une mauvaise adresse","Essaie d'enregistrer une adresse IPv4 impossible. Le registre doit refuser cette configuration sans mutation."],
 4:["Acquisition DHCP","Demande un bail pour l'administration de SW01, sur VLAN 1. Coupe ensuite le câble du serveur et constate qu'une nouvelle acquisition est impossible."],
 5:["Export et restauration","Configure SW01 en statique, sauvegarde le registre, repasse en DHCP, puis restaure le registre : l'IPv4 statique doit revenir."]
};
let r,sw,sw2,sw3,server,serverCable,engine,which=1,backup=null;
const ok=x=>{if(!x?.success)throw Error(x?.message||x?.reason||"Opération refusée");return x;};
function setup(n){
 which=n;backup=null;r=createAssetRegistry();
 const sp=ok(r.createProfile("Switch administrable L2")).profile;
 ok(r.addPortGroup(sp.id,{type:"ethernet-rj45",prefix:"P",start:1,count:5}));
 ok(r.setProfileNetworkCapability(sp.id,"ethernet-switching",true));
 ok(r.setProfileNetworkCapability(sp.id,"vlan",true));
 const np=ok(r.createProfile("Switch non administrable")).profile;
 ok(r.addPortGroup(np.id,{type:"ethernet-rj45",prefix:"P",start:1,count:5}));
 ok(r.setProfileNetworkCapability(np.id,"ethernet-switching",true));
 const dp=ok(r.createProfile("Serveur DHCP")).profile;
 ok(r.addPortGroup(dp.id,{type:"ethernet-rj45",prefix:"LAN",start:1,count:1}));
 sw=ok(r.createAsset(sp.id,{name:"SW01"})).asset;
 sw2=ok(r.createAsset(sp.id,{name:"SW02"})).asset;
 sw3=ok(r.createAsset(np.id,{name:"SW03"})).asset;
 server=ok(r.createAsset(dp.id,{name:"SRV-DHCP"})).asset;
 serverCable=ok(r.createCable()).cable;
 ok(r.connectCableEnd(serverCable.id,0,sw.ports[0].id));
 ok(r.connectCableEnd(serverCable.id,1,server.ports[0].id));
 const scenario={
  format:"r2d3-scenario",schemaVersion:1,scenarioId:"switch-mgmt-v01",
  scenarioVersion:"1",capabilities:{network:true},
  objects:[
   {id:sw.id,kind:"pc-windows",name:"Gestion SW01",ports:[{id:"eth0",type:"rj45"}],
    config:{ipv4:{interfaceId:"eth0",mode:"dhcp",address:null,prefix:null,lease:null},
     networkOptions:{gateway:null,dns:[]}}},
   {id:server.id,kind:"dhcp-server",name:"SRV-DHCP",ports:[{id:"eth0",type:"rj45"}],
    config:{ipv4:{interfaceId:"eth0",mode:"static",address:"192.168.1.2",prefix:24},
     dhcpEnabled:true,dhcpPools:[{id:"gestion",start:"192.168.1.100",end:"192.168.1.110",
      prefix:24,gateway:"192.168.1.1",dns:[],leaseSeconds:3600}]}}
  ],
  links:[{id:"service-mgmt",kind:"ethernet-cable",connected:true,
   endpoints:[{objectId:sw.id,portId:"eth0"},{objectId:server.id,portId:"eth0"}]}]
 };
 engine=createEngine(scenario);
 $("title").textContent="Test "+n+" : "+tasks[n][0];
 $("instruction").textContent=tasks[n][1];
 const actions={1:["Afficher le mode initial",null],
  2:["Configurer SW01 en statique",null],
  3:["Essayer 999.1.1.1",null],
  4:["Demander une adresse DHCP","Débrancher le câble du serveur"],
  5:["Configurer SW01 en statique","Exporter le registre R2"]};
 $("action").textContent=actions[n][0];
 $("second").hidden=!actions[n][1];$("second").textContent=actions[n][1]||"";
 for(const b of $("tests").querySelectorAll("button")){
  b.classList.toggle("selected",Number(b.dataset.test)===n);
  b.setAttribute("aria-pressed",String(Number(b.dataset.test)===n));
 }
 render();feedback("Scénario chargé.");
}
function feedback(msg,cls=""){$("result").className=cls;$("result").textContent=msg;}
function desc(a){
 const data=getSwitchManagement(r,a.id);
 return a.name+" : "+(!data?"non administrable, aucune IPv4 de gestion":
  (data.mode==="static"?"statique":"DHCP")+" | IPv4 "+(data.address||"non attribuée")+
  (data.prefix!==null?"/"+data.prefix:"")+" | passerelle "+(data.gateway||"aucune")+
  " | bail "+(data.lease?.poolId||"aucun"));
}
function render(){
 const cable=r.getCable(serverCable.id);
 const lines=[
  desc(sw),desc(sw2),desc(sw3),"",
  "VLAN 1 : configuration Access initiale sur SW01 et SW02",
  "Serveur DHCP : 192.168.1.2 | VLAN 1",
  "Plage gestion : 192.168.1.100 à 192.168.1.110 /24",
  "Câble SW01 vers DHCP : "+(cable.ends[0]&&cable.ends[1]?"branché":"débranché")
 ];
 $("network").textContent=lines.join("\n");
}
function acquire(){
 const out=acquireSwitchManagementDhcp({
  registry:r,switchId:sw.id,serverId:server.id,dhcpEngine:engine,poolId:"gestion"});
 render();feedback(out.success?"BAIL DHCP OBTENU : "+out.address:
  "ACQUISITION ÉCHOUÉE : "+(out.message||out.code),out.success?"good":"bad");
}
$("action").onclick=()=>{
 try{
  if(which===1){render();feedback("SW01 et SW02 en DHCP sans bail, SW03 sans IP de gestion.","good");return;}
  if(which===2){ok(configureSwitchManagementStatic(r,sw.id,"192.168.1.10",24,"192.168.1.1"));render();feedback("Adresse statique enregistrée.","good");return;}
  if(which===3){
   const before=JSON.stringify(r.exportState());
   const out=configureSwitchManagementStatic(r,sw.id,"999.1.1.1",24,"192.168.1.1");
   render();
   feedback(!out.success&&before===JSON.stringify(r.exportState())?
    "Configuration refusée, registre inchangé.":"Résultat inattendu : "+JSON.stringify(out),
    !out.success&&before===JSON.stringify(r.exportState())?"good":"bad");return;
  }
  if(which===4){acquire();return;}
  if(which===5){
   if(!backup){ok(configureSwitchManagementStatic(r,sw.id,"192.168.1.10",24,"192.168.1.1"));render();feedback("Adresse statique enregistrée. Exporte l'état R2.");}
   else{r=restoreAssetRegistry(backup);render();feedback("État R2 restauré : SW01 retrouve 192.168.1.10.","good");}
  }
 }catch(e){feedback(e.message,"bad");}
};
$("second").onclick=()=>{
 try{
  if(which===4){
   if(r.getCable(serverCable.id).ends[1])ok(r.disconnectCableEnd(serverCable.id,1));
   // Après une acquisition réussie, repasser en DHCP sans bail teste une nouvelle demande.
   ok(configureSwitchManagementDhcp(r,sw.id));
   render();feedback("Câble débranché. Clique à nouveau sur « Demander une adresse DHCP ».");return;
  }
  if(which===5){
   if(!backup){
    backup=r.exportState();ok(configureSwitchManagementDhcp(r,sw.id));
    $("action").textContent="Restaurer l'état R2";$("second").textContent="État sauvegardé";
    $("second").disabled=true;render();feedback("Registre exporté, SW01 est repassé en DHCP. Restaure l'état R2.");
   }
  }
 }catch(e){feedback(e.message,"bad");}
};
$("reset").onclick=()=>{ $("second").disabled=false;setup(which);};
$("tests").onclick=e=>{const b=e.target.closest("button[data-test]");if(b){$("second").disabled=false;setup(Number(b.dataset.test));}};
setup(1);
