import {createAssetRegistry} from "./asset-profiles.js";
import {addSwitchVlan,setSwitchAccessPort,setSwitchTrunkPort} from "./vlan-v1.js";
import {observeStpV1} from "./stp-v1.js";
const $=id=>document.getElementById(id),good=r=>{if(!r?.success)throw Error(r?.message||r?.reason||r?.code||"Opération refusée");return r;};
let r,pcs,switches,addresses,loopCableIds=[];
function wire(a,b){const c=good(r.createCable()).cable;good(r.connectCableEnd(c.id,0,a));good(r.connectCableEnd(c.id,1,b));return c;}
function setup(){
 r=createAssetRegistry();
 const pp=good(r.createProfile("PC Ethernet")).profile;
 good(r.addPortGroup(pp.id,{type:"ethernet-rj45",prefix:"LAN",start:1,count:1}));
 const sp=good(r.createProfile("Switch administrable L3")).profile;
 good(r.addPortGroup(sp.id,{type:"ethernet-rj45",prefix:"P",start:1,count:6}));
 for(const c of ["ethernet-switching","vlan","inter-vlan-routing"])good(r.setProfileNetworkCapability(sp.id,c,true));
 switches=[1,2,3].map(i=>good(r.createAsset(sp.id,{name:"SW0"+i})).asset);
 pcs=["PC10-A","PC10-B","PC20"].map(name=>good(r.createAsset(pp.id,{name})).asset);
 const [a,b,c]=switches;
 for(const sw of switches){
  good(addSwitchVlan(r,sw.id,10,"VLAN 10"));good(addSwitchVlan(r,sw.id,20,"VLAN 20"));
  for(const idx of [1,2])good(setSwitchTrunkPort(r,sw.id,sw.ports[idx].id,[10,20]));
 }
 wire(pcs[0].ports[0].id,a.ports[0].id);
 wire(pcs[1].ports[0].id,c.ports[0].id);
 wire(pcs[2].ports[0].id,b.ports[0].id);
 good(setSwitchAccessPort(r,a.id,a.ports[0].id,10));
 good(setSwitchAccessPort(r,c.id,c.ports[0].id,10));
 good(setSwitchAccessPort(r,b.id,b.ports[0].id,20));
 loopCableIds=[wire(a.ports[1].id,b.ports[1].id).id,wire(b.ports[2].id,c.ports[1].id).id,wire(c.ports[2].id,a.ports[2].id).id];
 addresses={
  [pcs[0].id]:{address:"192.168.10.11",prefix:24},
  [pcs[1].id]:{address:"192.168.10.12",prefix:24},
  [pcs[2].id]:{address:"192.168.10.13",prefix:24}
 };
 $("step1").disabled=false;$("step2").disabled=true;$("verdict").hidden=true;$("verdict").textContent="";
 $("result").textContent="Installation prête. Lance le premier contrôle.";render();
}
function render(obs){
 const lines=[
 "SW01, SW02, SW03 : switchs L3 ; routage inter-VLAN DÉSACTIVÉ",
 "Liaisons : SW01 ↔ SW02 ↔ SW03 ↔ SW01 (triangle)",
 "Trunks entre switchs : VLAN 10 et VLAN 20 autorisés",
 "PC10-A : SW01 / Access VLAN 10 / 192.168.10.11/24",
 "PC10-B : SW03 / Access VLAN 10 / 192.168.10.12/24",
 "PC20 : SW02 / Access VLAN 20 / adresse de test 192.168.10.13/24",
 "Câbles entre switchs : "+loopCableIds.join(", ")
 ];
 if(obs){lines.push("VLAN observé : "+(obs.vlan??"indéterminé"),"Boucle : "+(obs.loop?"OUI":"NON"),
  "Tempête : "+(obs.storm?"OUI":"NON"),"Câble(s) bloqué(s) : "+(obs.blockedCableIds?.join(", ")||"aucun"));}
 $("state").textContent=lines.join("\n");
}
$("step1").onclick=()=>{try{
 const obs=observeStpV1(r,pcs[0].id,pcs[1].id,addresses);
 const pass=obs.success===true&&obs.loop===true&&obs.storm===false&&obs.blockedCableIds?.length>=1&&obs.vlan===10&&obs.stpActive===true;
 render(obs);
 $("result").textContent=(pass?"CONFORME. ":"ANOMALIE. ")+"VLAN 10 : "+(obs.reason||obs.status)+
  ". Boucle "+(obs.loop?"présente":"absente")+", "+(obs.blockedCableIds?.length??0)+" lien(s) bloqué(s), aucune tempête attendue.";
 $("step2").disabled=!pass;
 }catch(e){$("result").textContent="Erreur : "+e.message;}};
$("step2").onclick=()=>{try{
 const obs=observeStpV1(r,pcs[0].id,pcs[2].id,addresses);
 const pass=obs.success===false&&obs.status==="ok"&&obs.reason==="Postes isolés dans des VLAN différents"&&obs.storm===false;
 $("verdict").textContent=(pass?"CONFORME. ":"ANOMALIE. ")+"PC10-A (VLAN 10) et PC20 (VLAN 20) restent isolés. "+(obs.reason||obs.status);
 $("verdict").hidden=false;$("step2").disabled=true;
 }catch(e){$("verdict").textContent="Erreur : "+e.message;$("verdict").hidden=false;}};
$("reset").onclick=()=>{try{setup();}catch(e){$("result").textContent="Erreur de préparation : "+e.message;}};
try{setup();}catch(e){$("result").textContent="Erreur de préparation : "+e.message;}