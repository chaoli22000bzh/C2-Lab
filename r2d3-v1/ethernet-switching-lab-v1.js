import {createAssetRegistry,restoreAssetRegistry} from "./asset-profiles.js";
import {observeEthernetNetworkPing} from "./ethernet-switching-v1.js";
const $=id=>document.getElementById(id);
let registry,pcs,sw1,sw2,cables,focusCable,focusPort,addresses,saved=null,selected=1;
const instructions={
 1:["Deux switchs en série","PC1 → SW01 → SW02 → PC2. Le ping doit réussir : les deux profils possèdent la capacité de commutation."],
 2:["Trois PC sur un switch","Teste PC1 → PC2 et PC1 → PC3, puis débranche PC2. Seul le ping vers PC2 doit échouer."],
 3:["Matériel sans commutation","Les deux câbles sont présents, mais le profil de SW01 n'autorise pas la commutation : ping impossible."],
 4:["Coupure entre deux switchs","Teste les deux pings, puis débranche le câble entre SW01 et SW02. PC1 → PC2 échoue, PC1 → PC3 fonctionne."],
 5:["Export et restauration","Exporte l'état, débranche le câble ciblé et vérifie l'échec, puis restaure l'état : le ping doit réussir."]
};
const ok=r=>{if(!r?.success)throw Error(r?.message||"Opération refusée");return r;};
function connect(from,to){
 const c=ok(registry.createCable()).cable;
 ok(registry.connectCableEnd(c.id,0,from));
 ok(registry.connectCableEnd(c.id,1,to));
 cables.push(c.id);
 return c;
}
function topology(test){
 registry=createAssetRegistry();cables=[];saved=null;
 const pcProf=ok(registry.createProfile("PC Ethernet")).profile;
 ok(registry.addPortGroup(pcProf.id,{type:"ethernet-rj45",prefix:"LAN",start:1,count:1}));
 const swProf=ok(registry.createProfile("Switch non administrable")).profile;
 ok(registry.addPortGroup(swProf.id,{type:"ethernet-rj45",prefix:"P",start:1,count:5}));
 if(test!==3)ok(registry.setProfileNetworkCapability(swProf.id,"ethernet-switching",true));
 pcs=[1,2,3].map(n=>ok(registry.createAsset(pcProf.id,{name:"PC"+n})).asset);
 sw1=ok(registry.createAsset(swProf.id,{name:"SW01"})).asset;
 sw2=ok(registry.createAsset(swProf.id,{name:"SW02"})).asset;
 addresses={
  [pcs[0].id]:{address:"192.168.10.20",prefix:24},
  [pcs[1].id]:{address:"192.168.10.30",prefix:24},
  [pcs[2].id]:{address:"192.168.10.40",prefix:24}
 };
 const p=n=>pcs[n].ports[0].id, a=n=>sw1.ports[n].id, b=n=>sw2.ports[n].id;
 if(test===2||test===3){
  connect(p(0),a(0));
  const c=connect(p(1),a(1));focusCable=c.id;focusPort=a(1);
  if(test===2)connect(p(2),a(2));
 }else{
  connect(p(0),a(0));
  const bridge=connect(a(1),b(0));
  connect(p(1),b(1));
  if(test===4)connect(p(2),a(2));
  focusCable=bridge.id;focusPort=b(0);
 }
}
function show(message,type=""){
 $("result").textContent=message;$("result").className=type;
}
function render(){
 const title=instructions[selected];
 $("test-title").textContent="Test "+selected+" : "+title[0];
 $("instructions").textContent=title[1];
 const assets=registry.listAssets();
 const switches=assets.filter(a=>a.name.startsWith("SW"));
 let active=switches.map(s=>s.name+": "+(s.networkCapabilities?.includes("ethernet-switching")?"commutation active":"aucune commutation")).join("\n");
 let wires=registry.listCables().map(c=>{
  const ports=registry.listCablePoints();
  const description=end=>end?ports.find(p=>p.portId===end.portId)?.assetName+" / "+ports.find(p=>p.portId===end.portId)?.portName:"extrémité libre";
  return description(c.ends[0])+" ↔ "+description(c.ends[1]);
 }).join("\n");
 $("network").textContent=active+"\n\nCâblage physique :\n"+wires;
 $("ping13").disabled=![2,4].includes(selected);
 $("disconnect").disabled=selected===3||!registry.getCable(focusCable).ends[1];
 $("reconnect").disabled=selected===3||!!registry.getCable(focusCable).ends[1];
 $("export").disabled=selected!==5;
 $("restore").disabled=selected!==5||saved===null;
 for(const b of $("tests").querySelectorAll("button")){
  b.classList.toggle("selected",Number(b.dataset.test)===selected);
  b.setAttribute("aria-pressed",String(Number(b.dataset.test)===selected));
 }
}
function ping(i,j){
 const result=observeEthernetNetworkPing(registry,pcs[i].id,pcs[j].id,addresses);
 show("PC"+(i+1)+" → PC"+(j+1)+" : "+(result.success?"PING RÉUSSI":"PING ÉCHOUÉ")+". "+(result.reason||result.status),result.success?"ok":"bad");
}
function select(test){
 selected=test;topology(selected);render();
 show("Scénario chargé : "+instructions[selected][0]+".");
}
$("tests").onclick=event=>{
 const button=event.target.closest("button[data-test]");
 if(button)select(Number(button.dataset.test));
};
$("ping12").onclick=()=>ping(0,1);
$("ping13").onclick=()=>ping(0,2);
$("disconnect").onclick=()=>{
 try{ok(registry.disconnectCableEnd(focusCable,1));render();show("Câble débranché. Lance un ping.");}
 catch(e){show(e.message,"bad");}
};
$("reconnect").onclick=()=>{
 try{ok(registry.connectCableEnd(focusCable,1,focusPort));render();show("Câble rebranché. Lance un ping.");}
 catch(e){show(e.message,"bad");}
};
$("export").onclick=()=>{saved=registry.exportState();render();show("État exporté dans cette séance. Tu peux débrancher le câble.");};
$("restore").onclick=()=>{
 try{registry=restoreAssetRegistry(saved);render();show("État restauré. Vérifie le ping.");}
 catch(e){show(e.message,"bad");}
};
$("reset").onclick=()=>select(selected);
select(1);
