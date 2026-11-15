import {createAssetRegistry,restoreAssetRegistry} from "./asset-profiles.js";
import {addSwitchVlan,setSwitchAccessPort,setSwitchTrunkPort,observeRegisteredVlanPing,vlanSwitchConfig} from "./vlan-v1.js";
const $=id=>document.getElementById(id);
const texts={
 1:["Profil et VLAN 1","Vérifie que SW01 et SW02 ont la capacité VLAN, et que leurs ports sont initialement en Access VLAN 1. Le ping réussit. Ajoute ensuite le VLAN 10 à SW01."],
 2:["Configurations indépendantes","Les deux switchs possèdent le VLAN 10. Ajoute le VLAN 20 à SW01 : SW02 ne doit pas recevoir automatiquement ce VLAN. Le ping sur le VLAN 10 reste fonctionnel."],
 3:["Isolation Access","PC1 est en VLAN 10, PC2 en VLAN 20, sur SW01. Le ping échoue. Passe PC2 en VLAN 10 pour rétablir la communication."],
 4:["Liaison Trunk entre deux switchs","Le VLAN 10 est autorisé sur le Trunk de SW01 mais pas sur celui de SW02 : échec. Autorise-le sur SW02 : ping réussi."],
 5:["Sauvegarde et restauration","Le ping sur le VLAN 10 réussit. Exporte l'état, puis déplace PC2 vers le VLAN 20 : le ping échoue. Restaure l'état et retrouve le ping réussi."]
};
let testId=1,registry,pcs,switches,addresses,changed=false,snapshot=null;
function ok(r){if(!r?.success)throw Error(r?.message||r?.reason||"Opération refusée");return r;}
function cable(a,b){
 const c=ok(registry.createCable()).cable;
 ok(registry.connectCableEnd(c.id,0,a));ok(registry.connectCableEnd(c.id,1,b));
 return c;
}
function vlan(sw,n){ok(addSwitchVlan(registry,sw.id,n,"VLAN "+n));}
function access(sw,p,n){ok(setSwitchAccessPort(registry,sw.id,sw.ports[p].id,n));}
function trunk(sw,p,allowed){ok(setSwitchTrunkPort(registry,sw.id,sw.ports[p].id,allowed));}
function load(id){
 testId=id;changed=false;snapshot=null;registry=createAssetRegistry();
 const pcProfile=ok(registry.createProfile("PC Ethernet")).profile;
 ok(registry.addPortGroup(pcProfile.id,{type:"ethernet-rj45",prefix:"LAN",start:1,count:1}));
 const swProfile=ok(registry.createProfile("Switch administrable L2")).profile;
 ok(registry.addPortGroup(swProfile.id,{type:"ethernet-rj45",prefix:"P",start:1,count:5}));
 ok(registry.setProfileNetworkCapability(swProfile.id,"ethernet-switching",true));
 ok(registry.setProfileNetworkCapability(swProfile.id,"vlan",true));
 pcs=[1,2].map(n=>ok(registry.createAsset(pcProfile.id,{name:"PC"+n})).asset);
 switches=[1,2].map(n=>ok(registry.createAsset(swProfile.id,{name:"SW0"+n})).asset);
 addresses={
  [pcs[0].id]:{address:"192.168.10.11",prefix:24},
  [pcs[1].id]:{address:"192.168.10.12",prefix:24}
 };
 const [a,b]=switches;
 cable(pcs[0].ports[0].id,a.ports[0].id);
 if(id===1||id===3||id===5){
  cable(pcs[1].ports[0].id,a.ports[1].id);
  if(id!==1){
   vlan(a,10);vlan(a,20);
   access(a,0,10);
   access(a,1,id===3?20:10);
  }
 }else{
  cable(a.ports[1].id,b.ports[1].id);
  cable(pcs[1].ports[0].id,b.ports[0].id);
  vlan(a,10);vlan(b,10);
  access(a,0,10);access(b,0,10);
  trunk(a,1,[10]);trunk(b,1,id===2?[10]:[1]);
 }
 $("title").textContent="Test "+id+" : "+texts[id][0];
 $("instruction").textContent=texts[id][1];
 $("action").textContent=({
  1:"Créer VLAN 10 sur SW01",
  2:"Créer VLAN 20 sur SW01",
  3:"Passer PC2 en VLAN 10",
  4:"Autoriser VLAN 10 sur SW02",
  5:"Placer PC2 en VLAN 20"
 })[id];
 for(const button of $("tests").querySelectorAll("button")){
  button.classList.toggle("selected",Number(button.dataset.test)===testId);
  button.setAttribute("aria-pressed",String(Number(button.dataset.test)===testId));
 }
 render();feedback("Scénario chargé. Suis les consignes.");
}
function feedback(message,kind=""){$("feedback").textContent=message;$("feedback").className=kind;}
function render(){
 const used=testId===2||testId===4?switches:[switches[0]];
 const lines=[];
 for(const sw of used){
  const asset=registry.getAsset(sw.id),c=vlanSwitchConfig(registry,sw.id);
  lines.push(sw.name+" : capacités "+asset.networkCapabilities.join(", "));
  lines.push("  VLAN locaux : "+c.vlans.map(v=>v.number).join(", "));
  for(const p of sw.ports){
   const state=c.ports[p.id];
   const detail=state.mode==="access"?
    "Access VLAN "+c.vlans.find(v=>v.id===state.vlanId).number:
    "Trunk VLAN "+state.allowedVlanIds.map(x=>c.vlans.find(v=>v.id===x).number).join(", ");
   lines.push("  "+p.name+" : "+detail);
  }
 }
 const points=registry.listCablePoints();
 const label=end=>{
  if(!end)return "Libre";
  const p=points.find(x=>x.portId===end.portId);
  return p?p.assetName+"/"+p.portName:"Port inconnu";
 };
 lines.push("","Câbles réels :");
 for(const c of registry.listCables())lines.push("  "+label(c.ends[0])+" ↔ "+label(c.ends[1]));
 $("network").textContent=lines.join("\n");
 $("settings").textContent="PC1 : 192.168.10.11/24   |   PC2 : 192.168.10.12/24";
 $("action").disabled=changed;
 $("export").hidden=testId!==5;
 $("restore").hidden=testId!==5;
 $("restore").disabled=!snapshot;
}
$("action").onclick=()=>{
 try{
  const [a,b]=switches;
  if(testId===1)vlan(a,10);
  if(testId===2)vlan(a,20);
  if(testId===3)access(a,1,10);
  if(testId===4)trunk(b,1,[10]);
  if(testId===5)access(a,1,20);
  changed=true;render();feedback("Modification appliquée au registre R2. Vérifie les VLAN et relance le ping.");
 }catch(e){feedback(e.message,"bad");}
};
$("ping").onclick=()=>{
 const r=observeRegisteredVlanPing(registry,pcs[0].id,pcs[1].id,addresses);
 feedback((r.success?"PING RÉUSSI":"PING ÉCHOUÉ")+" : "+(r.reason||r.status),r.success?"good":"bad");
};
$("export").onclick=()=>{
 snapshot=registry.exportState();render();feedback("État exporté. Modifie maintenant le port de PC2.");
};
$("restore").onclick=()=>{
 try{registry=restoreAssetRegistry(snapshot);changed=false;render();feedback("État restauré. Relance le ping.");}
 catch(e){feedback(e.message,"bad");}
};
$("reset").onclick=()=>load(testId);
$("tests").onclick=e=>{
 const b=e.target.closest("button[data-test]");if(b)load(Number(b.dataset.test));
};
load(1);
