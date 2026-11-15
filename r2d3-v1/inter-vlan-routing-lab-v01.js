import {createAssetRegistry} from "./asset-profiles.js";
import {addSwitchVlan,setSwitchAccessPort} from "./vlan-v1.js";
import {createDefaultInterVlanRoutingConfig,configureInterVlanInterface,configureInterVlanRouting,observeInterVlanPing} from "./inter-vlan-routing-v01.js";
const $=id=>document.getElementById(id);
const scenarios={
 1:["Routage désactivé","Les interfaces VLAN 10 et 20 sont présentes, mais le routage est désactivé. Le ping doit échouer."],
 2:["Interfaces VLAN absentes","Le routage est activé mais aucune interface IPv4 logique n'existe. Le ping doit échouer. Crée les deux interfaces pour rétablir la communication."],
 3:["Routage inter-VLAN activé","Les interfaces VLAN et les passerelles sont correctes. Le ping doit réussir."],
 4:["Mauvaise passerelle","PC1 possède une mauvaise passerelle. Le ping doit échouer. Corrige la passerelle puis recommence."],
 5:["Câble débranché","Commence par un ping réussi. Débranche ensuite le câble PC2 et relance le ping : il doit échouer."]
};
let registry,sw,pc1,pc2,config,addresses,second,test=1,changed=false;
function ok(r){if(!r?.success)throw Error(r?.message||r?.reason||"Opération refusée");return r;}
function wire(a,b){
 const c=ok(registry.createCable()).cable;
 ok(registry.connectCableEnd(c.id,0,a));ok(registry.connectCableEnd(c.id,1,b));return c;
}
function configureSvis(){
 for(const [v,ip] of [[10,"192.168.10.1"],[20,"192.168.20.1"]])
  config=ok(configureInterVlanInterface(config,v,ip,24)).config;
}
function enable(){config=ok(configureInterVlanRouting(config,true)).config;}
function load(i){
 test=i;changed=false;registry=createAssetRegistry();
 const pp=ok(registry.createProfile("PC")).profile;
 ok(registry.addPortGroup(pp.id,{type:"ethernet-rj45",prefix:"LAN",start:1,count:1}));
 const sp=ok(registry.createProfile("Switch L3 de test")).profile;
 ok(registry.addPortGroup(sp.id,{type:"ethernet-rj45",prefix:"P",start:1,count:5}));
 ok(registry.setProfileNetworkCapability(sp.id,"ethernet-switching",true));
 ok(registry.setProfileNetworkCapability(sp.id,"vlan",true));
 pc1=ok(registry.createAsset(pp.id,{name:"PC1"})).asset;
 pc2=ok(registry.createAsset(pp.id,{name:"PC2"})).asset;
 sw=ok(registry.createAsset(sp.id,{name:"SW-L3"})).asset;
 wire(pc1.ports[0].id,sw.ports[0].id);
 second=wire(pc2.ports[0].id,sw.ports[1].id);
 ok(addSwitchVlan(registry,sw.id,10,"VLAN 10"));
 ok(addSwitchVlan(registry,sw.id,20,"VLAN 20"));
 ok(setSwitchAccessPort(registry,sw.id,sw.ports[0].id,10));
 ok(setSwitchAccessPort(registry,sw.id,sw.ports[1].id,20));
 addresses={
  [pc1.id]:{address:"192.168.10.20",prefix:24,gateway:i===4?"192.168.10.254":"192.168.10.1"},
  [pc2.id]:{address:"192.168.20.30",prefix:24,gateway:"192.168.20.1"}
 };
 config=createDefaultInterVlanRoutingConfig(sw);
 if(i!==2)configureSvis();
 if(i>=2)enable();
 $("title").textContent="Test "+i+" : "+scenarios[i][0];
 $("instruction").textContent=scenarios[i][1];
 $("action").hidden=i===1||i===3;
 $("action").textContent=({2:"Créer les interfaces VLAN 10 et 20",4:"Corriger la passerelle PC1",5:"Débrancher le câble PC2"})[i]||"";
 for(const b of $("tests").querySelectorAll("button")){
  b.classList.toggle("selected",Number(b.dataset.test)===i);
  b.setAttribute("aria-pressed",String(Number(b.dataset.test)===i));
 }
 render();feedback("Scénario chargé. Effectue le ping et les manipulations.");
}
function feedback(message,type=""){$("result").textContent=message;$("result").className=type;}
function render(){
 const conf=registry.getAsset(sw.id).vlanConfig;
 const lines=[
 "PC1 : "+addresses[pc1.id].address+"/24, passerelle "+addresses[pc1.id].gateway,
 "       connecté à "+sw.name+" P01, VLAN 10",
 "PC2 : "+addresses[pc2.id].address+"/24, passerelle "+addresses[pc2.id].gateway,
 "       connecté à "+sw.name+" P02, VLAN 20",
 "",
 sw.name+" : VLAN "+conf.vlans.map(v=>v.number).join(", "),
 "Routage inter-VLAN : "+(config.routingEnabled?"ACTIVÉ":"DÉSACTIVÉ")
 ];
 for(const n of [10,20]){
  const svi=config.interfaces[String(n)];
  lines.push("Interface VLAN "+n+" : "+(svi?svi.address+"/"+svi.prefix+" ("+(svi.enabled?"active":"désactivée")+")":"absente"));
 }
 lines.push("Câble PC2 : "+(registry.getCable(second.id).ends[1]?"raccordé":"débranché"));
 $("network").textContent=lines.join("\n");
 $("action").disabled=changed;
}
$("ping").onclick=()=>{
 const r=observeInterVlanPing(registry,sw.id,config,pc1.id,pc2.id,addresses);
 feedback((r.success?"PING RÉUSSI":"PING ÉCHOUÉ")+" : "+r.reason,r.success?"good":"bad");
};
$("action").onclick=()=>{
 try{
  if(test===2)configureSvis();
  if(test===4)addresses[pc1.id].gateway="192.168.10.1";
  if(test===5)ok(registry.disconnectCableEnd(second.id,1));
  changed=true;render();feedback("Modification appliquée. Relance le ping.");
 }catch(e){feedback(e.message,"bad");}
};
$("reset").onclick=()=>load(test);
$("tests").onclick=e=>{const b=e.target.closest("button[data-test]");if(b)load(Number(b.dataset.test));};
load(1);
