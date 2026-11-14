import {createAssetRegistry} from "./asset-profiles.js";
import {createDefaultVlanSwitchConfig,createVlan,configureVlanAccess,configureVlanTrunk,observeVlanPing} from "./vlan-v01.js";
const $=id=>document.getElementById(id);
const texts={
 1:["Création de VLAN","Clique sur « Créer VLAN 10 et 20 ». Vérifie qu'ils apparaissent sur SW01. Les deux postes restent en VLAN 1."],
 2:["Isolation des VLAN Access","PC1 appartient au VLAN 10 et PC2 au VLAN 20, sur le même switch. Le ping doit échouer."],
 3:["Changer l'affectation d'un port","Le ping échoue au départ. Place le port de PC2 dans le VLAN 10 et teste à nouveau."],
 4:["Trunk autorisé sur deux switchs","PC1 et PC2 sont dans le VLAN 10, chaque switch possède son VLAN 10 et la liaison Trunk autorise ce VLAN des deux côtés. Le ping doit réussir."],
 5:["Trunk qui bloque le VLAN 10","Le VLAN 10 n'est pas autorisé sur le port Trunk de SW02. Le ping doit échouer. Autorise le VLAN 10 sur SW02, puis reteste."]
};
let testId=1,registry,pcs,switches,configs,addresses,created=false;
function ok(result){if(!result?.success)throw Error(result?.reason||result?.message||"Opération refusée");return result;}
function newCable(a,b){
 const c=ok(registry.createCable()).cable;
 ok(registry.connectCableEnd(c.id,0,a));
 ok(registry.connectCableEnd(c.id,1,b));
 return c;
}
function createOn(sw,n){
 const r=ok(createVlan(configs[sw.id],n,"VLAN "+n));
 configs[sw.id]=r.config;return r.vlanId;
}
function access(sw,p,n){
 const vlan=configs[sw.id].vlans.find(v=>v.number===n);
 configs[sw.id]=ok(configureVlanAccess(configs[sw.id],sw.ports[p].id,vlan.id)).config;
}
function trunk(sw,p,nums){
 const ids=nums.map(n=>configs[sw.id].vlans.find(v=>v.number===n).id);
 configs[sw.id]=ok(configureVlanTrunk(configs[sw.id],sw.ports[p].id,ids)).config;
}
function load(id){
 testId=id;created=false;registry=createAssetRegistry();
 const pcProfile=ok(registry.createProfile("PC Ethernet")).profile;
 ok(registry.addPortGroup(pcProfile.id,{type:"ethernet-rj45",prefix:"LAN",start:1,count:1}));
 const swProfile=ok(registry.createProfile("Switch L2 (V0.1)")).profile;
 ok(registry.addPortGroup(swProfile.id,{type:"ethernet-rj45",prefix:"P",start:1,count:5}));
 ok(registry.setProfileNetworkCapability(swProfile.id,"ethernet-switching",true));
 pcs=[1,2].map(n=>ok(registry.createAsset(pcProfile.id,{name:"PC"+n})).asset);
 switches=[1,2].map(n=>ok(registry.createAsset(swProfile.id,{name:"SW0"+n})).asset);
 configs=Object.fromEntries(switches.map(sw=>[sw.id,createDefaultVlanSwitchConfig(sw)]));
 addresses={
  [pcs[0].id]:{address:"192.168.10.11",prefix:24},
  [pcs[1].id]:{address:"192.168.10.12",prefix:24}
 };
 const a=switches[0],b=switches[1];
 newCable(pcs[0].ports[0].id,a.ports[0].id);
 if(id<=3){
  newCable(pcs[1].ports[0].id,a.ports[1].id);
  if(id===2||id===3){
   createOn(a,10);createOn(a,20);
   access(a,0,10);access(a,1,20);
  }
 }else{
  newCable(a.ports[1].id,b.ports[1].id);
  newCable(pcs[1].ports[0].id,b.ports[0].id);
  createOn(a,10);createOn(b,10);
  access(a,0,10);access(b,0,10);
  trunk(a,1,[10]);
  trunk(b,1,id===4?[10]:[1]);
 }
 for(const button of $("tests").querySelectorAll("button")){
  button.classList.toggle("selected",Number(button.dataset.test)===testId);
  button.setAttribute("aria-pressed",String(Number(button.dataset.test)===testId));
 }
 $("title").textContent="Test "+id+" : "+texts[id][0];
 $("instruction").textContent=texts[id][1];
 $("action").hidden=id===2||id===4;
 $("action").textContent=({1:"Créer VLAN 10 et 20",3:"Passer PC2 en VLAN 10",5:"Autoriser VLAN 10 sur SW02"})[id]||"";
 render();
 $("feedback").textContent="Scénario prêt. Suis les consignes du test.";
 $("feedback").className="";
}
function render(){
 const relevant=testId<=3?[switches[0]]:switches;
 const lines=[];
 for(const sw of relevant){
  const c=configs[sw.id];
  lines.push(sw.name+" : VLAN "+c.vlans.map(v=>v.number+" (« "+v.name+" »)").join(", "));
  for(const p of sw.ports.filter(p=>registry.listCables().some(w=>w.ends.some(e=>e?.portId===p.id)))){
   const state=c.ports[p.id],suffix=state.mode==="access"?
     "Access VLAN "+c.vlans.find(v=>v.id===state.vlanId).number:
     "Trunk VLAN "+state.allowedVlanIds.map(id=>c.vlans.find(v=>v.id===id).number).join(", ");
   lines.push("  "+p.name+" : "+suffix);
  }
 }
 lines.push("");
 lines.push("Câblage physique :");
 const points=registry.listCablePoints();
 const desc=end=>{
  if(!end)return "Libre";
  const p=points.find(x=>x.portId===end.portId);
  return p?p.assetName+" / "+p.portName:"Port inconnu";
 };
 for(const c of registry.listCables())lines.push("  "+desc(c.ends[0])+" ↔ "+desc(c.ends[1]));
 $("network").textContent=lines.join("\n");
 $("settings").textContent="PC1 : 192.168.10.11/24   |   PC2 : 192.168.10.12/24";
 $("action").disabled=created;
}
$("action").onclick=()=>{
 try{
  if(testId===1){createOn(switches[0],10);createOn(switches[0],20);}
  if(testId===3){access(switches[0],1,10);}
  if(testId===5){trunk(switches[1],1,[10]);}
  created=true;render();
  $("feedback").textContent="Modification appliquée. Tu peux maintenant lancer le ping.";
  $("feedback").className="";
 }catch(e){$("feedback").textContent=e.message;$("feedback").className="bad";}
};
$("ping").onclick=()=>{
 const result=observeVlanPing(registry,configs,pcs[0].id,pcs[1].id,addresses);
 $("feedback").textContent=(result.success?"PING RÉUSSI : ":"PING ÉCHOUÉ : ")+(result.reason||result.status);
 $("feedback").className=result.success?"good":"bad";
};
$("reset").onclick=()=>load(testId);
$("tests").onclick=e=>{
 const b=e.target.closest("button[data-test]");
 if(b)load(Number(b.dataset.test));
};
load(1);
