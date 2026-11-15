import {createAssetRegistry,restoreAssetRegistry} from "./asset-profiles.js";
import {addSwitchVlan,setSwitchAccessPort,setSwitchTrunkPort} from "./vlan-v1.js";
import {observeStpV1} from "./stp-v1.js";
const $=id=>document.getElementById(id);
const cases={
 1:["Anneau de trois switchs administrables","Trois switchs sont reliés en triangle. STP doit bloquer un câble redondant et permettre la communication."],
 2:["Anneau de trois switchs sans STP","Avec trois switchs non administrables reliés en triangle, une tempête perturbe le réseau. Débranche le lien redondant pour réparer."],
 3:["Basculement automatique sur un lien de secours","Sur trois switchs administrables, STP bloque un lien. Débranche le premier lien actif : le chemin de secours doit fonctionner sans modification des câbles restants."],
 4:["Boucle sur Trunks VLAN 10","PC1 et PC2 appartiennent au VLAN 10. Trois Trunks transportent le VLAN 10 : STP bloque le lien redondant et conserve la communication."],
 5:["Isolation des VLAN malgré STP","PC1 appartient au VLAN 10 et PC2 au VLAN 20. Les Trunks autorisent les deux VLAN, mais le routage n'est pas activé : le ping doit échouer."]
};
let r,pc1,pc2,sw,addresses,firstCable,extraCable,which=1,changed=false,saved;
const ok=x=>{if(!x?.success)throw Error(x?.message||x?.reason||"Opération refusée");return x;};
function wire(a,b){
 const c=ok(r.createCable()).cable;ok(r.connectCableEnd(c.id,0,a));
 ok(r.connectCableEnd(c.id,1,b));return c;
}
function setup(n){
 which=n;changed=false;saved=null;r=createAssetRegistry();
 const pp=ok(r.createProfile("Poste")).profile;
 ok(r.addPortGroup(pp.id,{type:"ethernet-rj45",prefix:"LAN",start:1,count:1}));
 const sp=ok(r.createProfile(n===2?"Switch non administrable":"Switch administrable")).profile;
 ok(r.addPortGroup(sp.id,{type:"ethernet-rj45",prefix:"P",start:1,count:6}));
 ok(r.setProfileNetworkCapability(sp.id,"ethernet-switching",true));
 if(n!==2)ok(r.setProfileNetworkCapability(sp.id,"vlan",true));
 pc1=ok(r.createAsset(pp.id,{name:"PC1"})).asset;
 pc2=ok(r.createAsset(pp.id,{name:"PC2"})).asset;
 sw=[1,2,3].map(i=>ok(r.createAsset(sp.id,{name:"SW0"+i})).asset);
 addresses={[pc1.id]:{address:"192.168.10.11",prefix:24},
            [pc2.id]:{address:"192.168.10.12",prefix:24}};
 wire(pc1.ports[0].id,sw[0].ports[0].id);
 wire(pc2.ports[0].id,sw[2].ports[0].id);
 if(n>=4){
  for(const a of sw)ok(addSwitchVlan(r,a.id,10,"VLAN 10"));
  for(const a of sw)ok(addSwitchVlan(r,a.id,20,"VLAN 20"));
  ok(setSwitchAccessPort(r,sw[0].id,sw[0].ports[0].id,10));
  ok(setSwitchAccessPort(r,sw[2].id,sw[2].ports[0].id,n===4?10:20));
  for(const [a,i] of [[sw[0],1],[sw[1],1],[sw[1],2],[sw[2],1],[sw[2],2],[sw[0],2]])
   ok(setSwitchTrunkPort(r,a.id,a.ports[i].id,n===4?[10]:[10,20]));
 }
 firstCable=wire(sw[0].ports[1].id,sw[1].ports[1].id);
 wire(sw[1].ports[2].id,sw[2].ports[1].id);
 extraCable=wire(sw[2].ports[2].id,sw[0].ports[2].id);
 $("title").textContent="Test "+n+" : "+cases[n][0];
 $("instruction").textContent=cases[n][1];
 $("change").hidden=![2,3].includes(n);
 $("change").disabled=false;
 $("change").textContent=n===2?"Débrancher le câble du triangle SW03 vers SW01":"Débrancher le premier lien SW01 vers SW02";
 for(const b of $("tests").querySelectorAll("button")){
  b.classList.toggle("selected",Number(b.dataset.test)===n);
  b.setAttribute("aria-pressed",String(Number(b.dataset.test)===n));
 }
 render(null);note("Scénario chargé. Vérifie les câbles et lance un ping.");
}
function evaluate(){return observeStpV1(r,pc1.id,pc2.id,addresses);}
function note(s,cls=""){$("result").className=cls;$("result").textContent=s;}
function render(observation){
 const portName=id=>{
  for(const a of [pc1,pc2,...sw]){
   const p=a.ports.find(p=>p.id===id);
   if(p)return a.name+":"+p.name;
  }
  return id;
 };
 const lines=[
  "PC1 : 192.168.10.11/24 | PC2 : 192.168.10.12/24",
  "Type : "+(which===2?"non administrable, sans STP":"administrable, STP permanent"),
  "VLAN : "+(which<4?"Access VLAN 1 sur tous les ports":
   which===4?"PC1/PC2 en VLAN 10 | Trunks VLAN 10":
   "PC1 VLAN 10, PC2 VLAN 20 | Trunks VLAN 10 et 20"),
  "",
  "Câbles physiques (registre R2) :"
 ];
 for(const c of r.listCables()){
  const ends=c.ends.map(e=>e?.portId?portName(e.portId):"extrémité libre");
  const block=observation?.blockedCableIds?.includes(c.id)?" [BLOQUÉ LOGIQUEMENT PAR STP]":"";
  lines.push("  "+c.id+" : "+ends.join(" ↔ ")+block);
 }
 if(observation){
  lines.push("","VLAN observé : "+(observation.vlan??"non déterminé"),
   "Boucle détectée : "+(observation.loop?"OUI":"NON"),
   "Tempête de broadcast simulée : "+(observation.storm?"OUI":"NON"),
   "Câbles bloqués par STP : "+(observation.blockedCableIds?.join(", ")||"aucun"));
 }
 $("network").textContent=lines.join("\n");
 $("change").disabled=changed;
}
$("check").onclick=()=>{
 try{
  const o=evaluate();render(o);
  note((o.success?"PING RÉUSSI":"PING ÉCHOUÉ")+" : "+o.reason,o.success?"good":"bad");
 }catch(e){note(e.message,"bad");}
};
$("change").onclick=()=>{
 try{
  ok(r.disconnectCableEnd((which===2?extraCable:firstCable).id,1));
  changed=true;render(evaluate());
  note("Câble débranché. Relance le ping pour vérifier le réseau.");
 }catch(e){note(e.message,"bad");}
};
$("reset").onclick=()=>setup(which);
$("tests").onclick=e=>{const b=e.target.closest("button[data-test]");if(b)setup(Number(b.dataset.test));};
setup(1);
