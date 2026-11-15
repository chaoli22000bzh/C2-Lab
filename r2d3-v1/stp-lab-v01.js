import {createAssetRegistry} from "./asset-profiles.js";
import {observeStpV01} from "./stp-v01.js";
const $=id=>document.getElementById(id);
const titles={
 1:["Boucle sur un switch non administrable","Commence avec deux PC qui communiquent. Branche ensuite un câble entre deux ports libres du même switch : une tempête doit perturber la communication."],
 2:["Boucle sur un switch administrable","Un câble relie deux ports libres d'un switch administrable. STP doit empêcher la tempête en bloquant logiquement le câble."],
 3:["Deux switchs non administrables","Deux liens parallèles relient les switchs. La tempête doit disparaître lorsqu'un des deux câbles est débranché."],
 4:["Deux switchs administrables","Deux câbles relient les switchs. STP doit bloquer un des liens tout en conservant la communication."],
 5:["Chemin de secours STP","Deux liens existent. STP en bloque un. Débranche le lien actif : le lien précédemment bloqué doit devenir utilisable."]
};
let registry,pc1,pc2,sw1,sw2,addresses,loopCable,firstCable,test=1,changed=false;
const ok=v=>{if(!v?.success)throw Error(v?.message||v?.reason||"Opération refusée");return v;};
function wire(a,b){
 const c=ok(registry.createCable()).cable;
 ok(registry.connectCableEnd(c.id,0,a));
 ok(registry.connectCableEnd(c.id,1,b));
 return c;
}
function setup(n){
 test=n;changed=false;registry=createAssetRegistry();
 const pp=ok(registry.createProfile("Poste")).profile;
 ok(registry.addPortGroup(pp.id,{type:"ethernet-rj45",prefix:"LAN",start:1,count:1}));
 const sp=ok(registry.createProfile(n===1||n===3?"Switch non administrable":"Switch administrable")).profile;
 ok(registry.addPortGroup(sp.id,{type:"ethernet-rj45",prefix:"P",start:1,count:6}));
 ok(registry.setProfileNetworkCapability(sp.id,"ethernet-switching",true));
 if(n===2||n>=4)ok(registry.setProfileNetworkCapability(sp.id,"vlan",true));
 pc1=ok(registry.createAsset(pp.id,{name:"PC1"})).asset;
 pc2=ok(registry.createAsset(pp.id,{name:"PC2"})).asset;
 sw1=ok(registry.createAsset(sp.id,{name:"SW01"})).asset;
 sw2=n>=3?ok(registry.createAsset(sp.id,{name:"SW02"})).asset:null;
 addresses={
  [pc1.id]:{address:"192.168.10.11",prefix:24},
  [pc2.id]:{address:"192.168.10.12",prefix:24}
 };
 wire(pc1.ports[0].id,sw1.ports[0].id);
 if(n<=2)wire(pc2.ports[0].id,sw1.ports[1].id);
 else {
  wire(pc2.ports[0].id,sw2.ports[0].id);
  firstCable=wire(sw1.ports[1].id,sw2.ports[1].id);
 }
 loopCable=null;
 if(n===2)loopCable=wire(sw1.ports[2].id,sw1.ports[3].id);
 if(n>=3)loopCable=wire(sw1.ports[2].id,sw2.ports[2].id);
 $("title").textContent="Test "+n+" : "+titles[n][0];
 $("instruction").textContent=titles[n][1];
 $("change").hidden=n===2||n===4;
 $("change").disabled=false;
 $("change").textContent=n===1?"Brancher le câble entre P3 et P4":
  n===3?"Débrancher le second lien entre SW01 et SW02":
  n===5?"Débrancher le premier lien entre SW01 et SW02":"";
 for(const b of $("tests").querySelectorAll("button")){
  b.classList.toggle("selected",Number(b.dataset.test)===n);
  b.setAttribute("aria-pressed",String(Number(b.dataset.test)===n));
 }
 render(null);
 info("Scénario chargé. Vérifie les câbles, puis teste la communication.");
}
function report(){
 return observeStpV01(registry,pc1.id,pc2.id,addresses);
}
function info(text,style=""){$("result").className=style;$("result").textContent=text;}
function render(observation){
 const cables=registry.listCables(),switched=[sw1,sw2].filter(Boolean);
 const findPort=id=>{
  for(const a of [pc1,pc2,...switched]){
   const p=a.ports.find(p=>p.id===id);
   if(p)return a.name+":"+p.name;
  }
  return id;
 };
 const out=[
  "PC1 : 192.168.10.11/24  |  PC2 : 192.168.10.12/24",
  ...switched.map(a=>a.name+" : "+(a.networkCapabilities.includes("vlan")?
   "administrable | STP toujours actif":"non administrable | sans STP")),
  "",
  "Câbles physiques :"
 ];
 for(const c of cables){
  const ends=c.ends.map(e=>e?.portId?findPort(e.portId):"libre");
  const blocked=observation?.blockedCableIds?.includes(c.id);
  out.push("  "+c.id+" : "+ends.join(" ↔ ")+(blocked?" [BLOQUÉ PAR STP]":""));
 }
 if(observation){
  out.push("","Boucle détectée : "+(observation.loop?"OUI":"NON"));
  out.push("Tempête simulée : "+(observation.storm?"OUI":"NON"));
  out.push("Câbles bloqués par STP : "+(observation.blockedCableIds?.join(", ")||"aucun"));
 }
 $("network").textContent=out.join("\n");
 $("change").disabled=changed;
}
$("check").onclick=()=>{
 const o=report();render(o);
 info((o.success?"COMMUNICATION RÉUSSIE":"COMMUNICATION ÉCHOUÉE")+
  " : "+o.reason+(o.status==="unavailable"?" (montage hors périmètre V0.1)":""),
  o.success?"good":"bad");
};
$("change").onclick=()=>{
 try{
  if(test===1)loopCable=wire(sw1.ports[2].id,sw1.ports[3].id);
  if(test===3)ok(registry.disconnectCableEnd(loopCable.id,1));
  if(test===5)ok(registry.disconnectCableEnd(firstCable.id,1));
  changed=true;render(report());info("Câblage modifié. Teste de nouveau la communication.");
 }catch(e){info(e.message,"bad");}
};
$("reset").onclick=()=>setup(test);
$("tests").onclick=e=>{const b=e.target.closest("button[data-test]");if(b)setup(Number(b.dataset.test));};
setup(1);
