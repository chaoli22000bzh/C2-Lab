import {createAssetRegistry,restoreAssetRegistry} from "./asset-profiles.js";
import {createEngine} from "./r2d3-core.js";
import {getSwitchManagement,configureSwitchManagementStatic,configureSwitchManagementDhcp,acquireSwitchManagementDhcp,syncSwitchManagementDhcp} from "./switch-management-ip-v01.js";

const $=id=>document.getElementById(id);
const scenarios={
 1:["Configuration initiale","Les deux switchs administrables sont clients DHCP. Le serveur DHCP n'est pas encore démarré : le Core R2D3 doit leur attribuer une adresse APIPA."],
 2:["Adresse IPv4 statique","Passe SW01 en IPv4 statique, sans modifier SW02 ni les VLAN."],
 3:["Refus d'une mauvaise adresse","Essaie de configurer une IPv4 impossible : le registre doit rester inchangé."],
 4:["Acquisition DHCP, conservation du bail et APIPA","Démarre le serveur, acquiers un bail, coupe le câble, puis fais avancer l'horloge aux échéances T1, T2 et expiration du bail."],
 5:["Export et restauration","Sauvegarde SW01 en statique, repasse en DHCP, puis restaure la configuration d'origine."]
};
let registry,sw1,sw2,sw3,server,cable,engine,testNumber=1,backup=null,phase=0;
const good=r=>{if(!r?.success)throw Error(r?.message||r?.reason||r?.code||"Action refusée");return r;};
const apply=(type,targetId,params)=> {
 const snapshot=engine.getSnapshot();
 const r=engine.dispatch({commandVersion:1,id:"lab-"+(snapshot.revision+1)+"-"+type,
  type,targetId,params});
 if(r.status!=="applied")throw Error(r.message||r.code||"Commande refusée");
 return r;
};
function setScenario(n){
 testNumber=n;backup=null;phase=0;registry=createAssetRegistry();
 const managed=good(registry.createProfile("Switch administrable L2")).profile;
 good(registry.addPortGroup(managed.id,{type:"ethernet-rj45",prefix:"P",start:1,count:5}));
 good(registry.setProfileNetworkCapability(managed.id,"ethernet-switching",true));
 good(registry.setProfileNetworkCapability(managed.id,"vlan",true));
 const unmanaged=good(registry.createProfile("Switch non administrable")).profile;
 good(registry.addPortGroup(unmanaged.id,{type:"ethernet-rj45",prefix:"P",start:1,count:5}));
 good(registry.setProfileNetworkCapability(unmanaged.id,"ethernet-switching",true));
 const dhcp=good(registry.createProfile("Serveur DHCP")).profile;
 good(registry.addPortGroup(dhcp.id,{type:"ethernet-rj45",prefix:"LAN",start:1,count:1}));
 sw1=good(registry.createAsset(managed.id,{name:"SW01"})).asset;
 sw2=good(registry.createAsset(managed.id,{name:"SW02"})).asset;
 sw3=good(registry.createAsset(unmanaged.id,{name:"SW03"})).asset;
 server=good(registry.createAsset(dhcp.id,{name:"SRV-DHCP"})).asset;
 cable=good(registry.createCable()).cable;
 good(registry.connectCableEnd(cable.id,0,sw1.ports[0].id));
 good(registry.connectCableEnd(cable.id,1,server.ports[0].id));

 const client=asset=>({
  id:asset.id,kind:"pc-windows",name:"Administration de "+asset.name,
  ports:[{id:"eth0",type:"rj45"}],
  config:{ipv4:{interfaceId:"eth0",mode:"dhcp",address:null,prefix:null,lease:null},
    networkOptions:{gateway:null,dns:[]}}
 });
 const dhcpScenario={
  format:"r2d3-scenario",schemaVersion:1,scenarioId:"switch-mgmt-v01",
  scenarioVersion:"1",capabilities:{network:true},
  objects:[client(sw1),client(sw2),{
   id:server.id,kind:"dhcp-server",name:"SRV-DHCP",
   ports:[{id:"eth0",type:"rj45"}],
   config:{ipv4:{interfaceId:"eth0",mode:"static",address:"192.168.1.2",prefix:24},
    dhcpEnabled:false,dhcpPools:[{id:"gestion",start:"192.168.1.100",
     end:"192.168.1.110",prefix:24,gateway:"192.168.1.1",
     dns:[],leaseSeconds:3600}]}
  }],
  links:[{id:"dhcp-link",kind:"ethernet-cable",connected:true,
   endpoints:[{objectId:sw1.id,portId:"eth0"},{objectId:server.id,portId:"eth0"}]}]
 };
 engine=createEngine(dhcpScenario);
 // Requêtes réelles du Core : serveur DHCP arrêté, donc les deux switchs
 // passent en APIPA. Ni adresse ni résultat DHCP fabriqués par le laboratoire.
 for(const sw of [sw1,sw2]){
  apply("dhcp.request",sw.id,{});
  good(syncSwitchManagementDhcp(registry,sw.id,engine));
 }
 $("title").textContent="Test "+n+" : "+scenarios[n][0];
 $("instruction").textContent=scenarios[n][1];
 $("second").hidden=true;$("second").disabled=false;
 $("action").textContent={
  1:"Afficher les adresses initiales",
  2:"Configurer SW01 en statique",
  3:"Essayer 999.1.1.1",
  4:"Démarrer le serveur et demander une adresse DHCP",
  5:"Configurer SW01 en statique"
 }[n];
 for(const b of $("tests").querySelectorAll("button")){
  const selected=Number(b.dataset.test)===n;
  b.classList.toggle("selected",selected);
  b.setAttribute("aria-pressed",String(selected));
 }
 render();notice("Scénario initialisé par le Core DHCP R2D3.");
}
function notice(message,status=""){
 $("result").textContent=message;$("result").className=status;
}
function describe(a){
 const c=getSwitchManagement(registry,a.id);
 if(!c)return a.name+" : non administrable, aucune IPv4 de gestion";
 const state=c.mode==="static"?"Statique":c.lease?
  "DHCP, bail valide":c.address?.startsWith("169.254.")?"APIPA (DHCP indisponible)":"DHCP, adresse non attribuée";
 return a.name+" : "+state+" | IPv4 "+(c.address??"non attribuée")+
  (c.prefix!==null?"/"+c.prefix:"")+
  " | passerelle "+(c.gateway??"aucune")+
  " | bail "+(c.lease?.poolId??"aucun");
}
function render(){
 const snap=engine.getSnapshot();
 const c=registry.getCable(cable.id);
 const lines=[
  describe(sw1),describe(sw2),describe(sw3),"",
  "Horloge DHCP R2D3 : "+snap.simulationClock+" s",
  "Serveur DHCP : "+(snap.objectsById[server.id].config.dhcpEnabled?"EN SERVICE":"ARRÊTÉ"),
  "Plage de gestion : 192.168.1.100 à 192.168.1.110 /24",
  "Câble SW01 / SRV-DHCP : "+(c.ends[0]&&c.ends[1]?"branché":"débranché"),
  "Liaison dans le Core : "+(snap.linksById["dhcp-link"].connected?"active":"interrompue")
 ];
 if(testNumber===4){
  const st=snap.runtime?.[sw1.id];
  lines.push("État DHCP SW01 (Core) : "+(st?.dhcpStatus??"inconnu"),
   "Phase du bail : "+(st?.dhcpLeasePhase??"aucune"),
   "Expiration du bail : "+(snap.objectsById[sw1.id].config.ipv4.lease?.expires??"aucune")+" s");
 }
 $("network").textContent=lines.join("\n");
}
function clock(seconds){
 apply("simulation.advanceTime","simulation-clock",{seconds});
 good(syncSwitchManagementDhcp(registry,sw1.id,engine));
 render();
 const status=engine.getSnapshot().runtime?.[sw1.id];
 notice("Horloge avancée de "+seconds+" s. État du Core : "+
  (status?.dhcpStatus??"inconnu")+
  (status?.dhcpLeasePhase?" ("+status.dhcpLeasePhase+")":"")+".","good");
}
$("action").onclick=()=>{
 try{
  if(testNumber===1){
   render();notice("SW01 et SW02 : APIPA calculée par R2D3 ; SW03 : pas d'IP de gestion.","good");
  }else if(testNumber===2){
   good(configureSwitchManagementStatic(registry,sw1.id,"192.168.1.10",24,"192.168.1.1"));
   render();notice("Adresse IPv4 statique enregistrée dans R2.","good");
  }else if(testNumber===3){
   const before=JSON.stringify(registry.exportState());
   const result=configureSwitchManagementStatic(registry,sw1.id,"999.1.1.1",24,"192.168.1.1");
   const passed=!result.success&&before===JSON.stringify(registry.exportState());
   render();notice(passed?"Configuration refusée, registre inchangé.":"Anomalie : "+JSON.stringify(result),
    passed?"good":"bad");
  }else if(testNumber===4){
   if(phase===0){
    apply("dhcp.setServerEnabled",server.id,{enabled:true});
    // Une APIPA peut demander à nouveau un bail sans devoir changer de mode.
    const result=acquireSwitchManagementDhcp({registry,switchId:sw1.id,
     serverId:server.id,dhcpEngine:engine,poolId:"gestion"});
    good(result);phase=1;
    $("action").textContent="Avancer jusqu'à T1 (1 800 s)";
    $("second").hidden=false;
    $("second").textContent="Débrancher le câble du serveur";
    render();notice("Bail DHCP obtenu : "+result.address+". Débranche maintenant le serveur.","good");
   }else if(phase===2){
    clock(1800);phase=3;$("action").textContent="Avancer jusqu'à T2 (+1 350 s)";
   }else if(phase===3){
    clock(1350);phase=4;$("action").textContent="Avancer jusqu'à expiration (+450 s)";
   }else if(phase===4){
    clock(450);phase=5;$("action").disabled=true;
   }else notice("Débranche d'abord le câble du serveur.");
  }else if(testNumber===5){
   if(!backup){
    good(configureSwitchManagementStatic(registry,sw1.id,"192.168.1.10",24,"192.168.1.1"));
    render();notice("IP statique enregistrée. Sauvegarde le registre.");
    $("second").hidden=false;$("second").textContent="Exporter le registre R2";
   }else{
    registry=restoreAssetRegistry(backup);
    render();notice("Configuration restaurée : 192.168.1.10/24.","good");
   }
  }
 }catch(e){notice(e.message,"bad");}
};
$("second").onclick=()=>{
 try{
  if(testNumber===4&&phase===1){
   good(registry.disconnectCableEnd(cable.id,1));
   apply("network.setLinkConnected","dhcp-link",{connected:false});
   // Ne pas libérer le bail et ne pas changer le mode DHCP.
   good(syncSwitchManagementDhcp(registry,sw1.id,engine));
   phase=2;$("second").hidden=true;
   render();notice("Lien coupé. Le bail et l'IPv4 de SW01 sont conservés.","good");
  }else if(testNumber===5&&!backup){
   backup=registry.exportState();
   good(configureSwitchManagementDhcp(registry,sw1.id));
   good(syncSwitchManagementDhcp(registry,sw1.id,engine));
   $("second").hidden=true;$("action").textContent="Restaurer le registre R2";
   render();notice("État sauvegardé. SW01 est repassé en mode DHCP.");
  }
 }catch(e){notice(e.message,"bad");}
};
$("reset").onclick=()=>{$("action").disabled=false;setScenario(testNumber);};
$("tests").onclick=e=>{
 const button=e.target.closest("button[data-test]");
 if(button){$("action").disabled=false;setScenario(Number(button.dataset.test));}
};
setScenario(1);
