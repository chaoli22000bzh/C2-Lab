import {createAssetRegistry,restoreAssetRegistry} from "./asset-profiles.js";
import {addSwitchVlan,setSwitchAccessPort} from "./vlan-v1.js";
import {setSwitchInterVlanRouting,setSwitchVlanInterface,getSwitchRoutingConfig,observeRegisteredInterVlanPing} from "./inter-vlan-routing-v1.js";
const $=id=>document.getElementById(id);
const cases={
 1:["Profil L3 et état initial","SW01 possède les capacités Ethernet, VLAN et routage inter-VLAN, mais le routage est désactivé par défaut. Le ping doit échouer."],
 2:["Configurer les interfaces et activer L3","Le routage est désactivé et les interfaces VLAN sont absentes. Le premier ping échoue. Configure les deux interfaces et active le routage : le ping réussit."],
 3:["Deux switchs indépendants","SW01 route entre ses VLAN 10 et 20. SW02 a les mêmes capacités, mais sa configuration L3 est indépendante. Configure SW02 et vérifie que SW01 ne change pas."],
 4:["Passerelle IPv4 incorrecte","Le routage est actif mais la passerelle de PC1 est incorrecte : échec. Corrige-la pour rétablir la communication."],
 5:["Export et restauration","Le ping réussit. Exporte le registre, désactive le routage sur SW01, vérifie l'échec, puis restaure le registre : le ping doit réussir de nouveau."]
};
let registry,pcs,switches,addresses,selected=1,modified=false,snapshot=null;
function ok(value){if(!value?.success)throw Error(value?.message||value?.reason||"Opération refusée");return value;}
function wire(a,b){
 const c=ok(registry.createCable()).cable;
 ok(registry.connectCableEnd(c.id,0,a));ok(registry.connectCableEnd(c.id,1,b));
}
function svi(sw,n,ip){ok(setSwitchVlanInterface(registry,sw.id,n,ip,24));}
function enable(sw,flag){ok(setSwitchInterVlanRouting(registry,sw.id,flag));}
function configureL3(sw){
 svi(sw,10,"192.168.10.1");
 svi(sw,20,"192.168.20.1");
 enable(sw,true);
}
function setup(n){
 selected=n;modified=false;snapshot=null;registry=createAssetRegistry();
 const cp=ok(registry.createProfile("PC Ethernet")).profile;
 ok(registry.addPortGroup(cp.id,{type:"ethernet-rj45",prefix:"LAN",start:1,count:1}));
 const sp=ok(registry.createProfile("Switch L3 administrable")).profile;
 ok(registry.addPortGroup(sp.id,{type:"ethernet-rj45",prefix:"P",start:1,count:5}));
 for(const cap of ["ethernet-switching","vlan","inter-vlan-routing"])
  ok(registry.setProfileNetworkCapability(sp.id,cap,true));
 pcs=[1,2].map(i=>ok(registry.createAsset(cp.id,{name:"PC"+i})).asset);
 switches=[1,2].map(i=>ok(registry.createAsset(sp.id,{name:"SW0"+i})).asset);
 const a=switches[0];
 wire(pcs[0].ports[0].id,a.ports[0].id);
 wire(pcs[1].ports[0].id,a.ports[1].id);
 for(const sw of switches){
  for(const vlan of [10,20])ok(addSwitchVlan(registry,sw.id,vlan,"VLAN "+vlan));
 }
 ok(setSwitchAccessPort(registry,a.id,a.ports[0].id,10));
 ok(setSwitchAccessPort(registry,a.id,a.ports[1].id,20));
 addresses={
  [pcs[0].id]:{address:"192.168.10.20",prefix:24,gateway:n===4?"192.168.10.254":"192.168.10.1"},
  [pcs[1].id]:{address:"192.168.20.30",prefix:24,gateway:"192.168.20.1"}
 };
 if([3,4,5].includes(n))configureL3(a);
 $("title").textContent="Test "+n+" : "+cases[n][0];
 $("instruction").textContent=cases[n][1];
 $("action").hidden=n===1;
 $("action").textContent=({
  2:"Configurer les interfaces et activer L3",
  3:"Configurer le routage sur SW02",
  4:"Corriger la passerelle de PC1",
  5:"Désactiver le routage sur SW01"
 })[n]||"";
 $("export").hidden=n!==5;
 $("restore").hidden=n!==5;
 for(const button of $("tests").querySelectorAll("button")){
  button.classList.toggle("selected",Number(button.dataset.test)===n);
  button.setAttribute("aria-pressed",String(Number(button.dataset.test)===n));
 }
 render();say("Scénario chargé. Vérifie la configuration puis lance le ping.");
}
function say(text,kind=""){$("result").textContent=text;$("result").className=kind;}
function render(){
 const lines=[
  "PC1 : "+addresses[pcs[0].id].address+"/24 | passerelle "+addresses[pcs[0].id].gateway+" | VLAN 10",
  "PC2 : "+addresses[pcs[1].id].address+"/24 | passerelle "+addresses[pcs[1].id].gateway+" | VLAN 20",""
 ];
 for(const sw of switches){
  const asset=registry.getAsset(sw.id),cfg=getSwitchRoutingConfig(registry,sw.id);
  lines.push(sw.name+" | Capacités : "+asset.networkCapabilities.join(", "));
  lines.push("  Routage inter-VLAN : "+(cfg.routingEnabled?"ACTIVÉ":"DÉSACTIVÉ"));
  for(const n of [10,20]){
   const v=cfg.interfaces[String(n)];
   lines.push("  Interface VLAN "+n+" : "+(v?v.address+"/"+v.prefix+(v.enabled?" (active)":" (désactivée)"):"absente"));
  }
  lines.push("");
 }
 lines.push("Câbles réellement branchés : "+registry.listCables().filter(c=>c.ends.every(Boolean)).length);
 $("network").textContent=lines.join("\n");
 $("action").disabled=modified;
 $("restore").disabled=!snapshot;
}
$("ping").onclick=()=>{
 const result=observeRegisteredInterVlanPing(registry,switches[0].id,pcs[0].id,pcs[1].id,addresses);
 say((result.success?"PING RÉUSSI":"PING ÉCHOUÉ")+" : "+(result.reason||result.status),result.success?"good":"bad");
};
$("action").onclick=()=>{
 try{
  if(selected===2)configureL3(switches[0]);
  if(selected===3)configureL3(switches[1]);
  if(selected===4)addresses[pcs[0].id].gateway="192.168.10.1";
  if(selected===5)enable(switches[0],false);
  modified=true;render();say("Modification appliquée dans le registre. Vérifie la configuration et relance le ping.");
 }catch(e){say(e.message,"bad");}
};
$("export").onclick=()=>{snapshot=registry.exportState();render();say("État exporté. Désactive maintenant le routage L3.");};
$("restore").onclick=()=>{
 try{registry=restoreAssetRegistry(snapshot);modified=false;render();say("Registre restauré. Vérifie les interfaces et relance le ping.");}
 catch(e){say(e.message,"bad");}
};
$("reset").onclick=()=>setup(selected);
$("tests").onclick=event=>{const b=event.target.closest("button[data-test]");if(b)setup(Number(b.dataset.test));};
setup(1);
