import {createAssetRegistry} from "./asset-profiles.js";
import {mountCablingFrontpanel} from "../shared-ui/v1/cabling-frontpanel.js?v=1.4";
const $=id=>document.getElementById(id);
const must=r=>{if(!r.success)throw Error(r.message);return r;};
const miniLabels=["A","B","C","D","E","F","A","B","C","D"];
const mainLabels=Array.from({length:28},(_,i)=>"ABCD"[i%4]+(Math.floor(i/4)+1));
let registry,miniView,mainView,pcPort,switchPorts;
function addCable(a,b){
 const c=must(registry.createCable({connectors:["rj45-male","rj45-male"]})).cable;
 must(registry.connectCableEnd(c.id,0,a));
 must(registry.connectCableEnd(c.id,1,b));
 return c.id;
}
function setup(){
 miniView?.destroy();mainView?.destroy();
 registry=createAssetRegistry();
 const site=must(registry.createPlace({name:"Établissement"})).place.id;
 const classroom=must(registry.createPlace({name:"Salle de cours",parentId:site})).place.id;
 const miniPlace=must(registry.createPlace({name:"Mini-baie 5",parentId:classroom})).place.id;
 const mainPlace=must(registry.createPlace({name:"Grande baie",parentId:site})).place.id;
 const mini=must(registry.createPanel({name:"Panneau mini-baie",placeId:miniPlace,count:10,prefix:"",start:1})).panel;
 const main=must(registry.createPanel({name:"Panneau grande baie",placeId:mainPlace,count:28,prefix:"",start:1})).panel;
 const wall=must(registry.createWallOutlet({name:"F",location:"Salle de cours"})).outlet;
 const pcProfile=must(registry.createProfile("PC")).profile.id;
 must(registry.addPortGroup(pcProfile,{type:"ethernet-rj45",prefix:"LAN",start:1,count:1,digits:2}));
 const swProfile=must(registry.createProfile("Switch 24 ports")).profile.id;
 must(registry.addPortGroup(swProfile,{type:"ethernet-rj45",prefix:"LAN",start:1,count:24,digits:2}));
 const pc=must(registry.createAsset(pcProfile,{name:"PC élève"})).asset;
 const sw=must(registry.createAsset(swProfile,{name:"SW01"})).asset;
 must(registry.moveAssetToPlace(pc.id,classroom));
 must(registry.moveAssetToPlace(sw.id,mainPlace));
 pcPort=pc.ports[0].id;switchPorts=sw.ports.map(p=>p.id);
 // Câbles existants : PC -> prise murale F -> arrière prise F de la mini-baie.
 addCable(pcPort,wall.ports[0].front.id);
 addCable(wall.ports[0].back.id,mini.ports[5].back.id);
 // Quatre départs A..D de mini-baie vers A5..D5 de grande baie.
 for(let i=0;i<4;i++)addCable(mini.ports[6+i].back.id,main.ports[16+i].back.id);
 // Cordons déjà présents dans la grande baie ; ils occupent vraiment leurs prises.
 addCable(main.ports[0].front.id,sw.ports[2].id); // A1 -> 03
 addCable(main.ports[5].front.id,sw.ports[4].id); // B2 -> 05
 const internetProfile=must(registry.createProfile("Accès Internet")).profile.id;
 must(registry.addPortGroup(internetProfile,{type:"ethernet-rj45",prefix:"WAN",start:1,count:1,digits:2}));
 const internet=must(registry.createAsset(internetProfile,{name:"Accès Internet"})).asset;
 addCable(sw.ports[0].id,internet.ports[0].id); // Port 01 occupé, hors façade.
 miniView=mountCablingFrontpanel({
  root:$("mini-frontpanel"),registry,devices:["Panneau mini-baie"],
  layout:{"Panneau mini-baie":{
   columns:12,slots:["1","2","3","4","5","6",null,null,"7","8","9","10"],labels:miniLabels
  }}
 });
 mainView=mountCablingFrontpanel({
  root:$("main-frontpanel"),registry,devices:["Panneau grande baie","SW01"],
  layout:{"Panneau grande baie":{columns:12,labels:mainLabels},
          "SW01":{columns:12,switchPairs:true,switchGroups:true,kindLabel:"Switch"}}
 });
 $("verdict").textContent="À réaliser : mini-baie, F vers un départ A à D ; puis grande baie, prise correspondante de la ligne 5 vers un port libre du switch.";
}
$("reset").onclick=()=>{try{setup()}catch(e){$("verdict").textContent="Erreur : "+e.message;}};
$("test").onclick=()=>{
 try{
  const results=switchPorts.map(port=>registry.explorePhysicalPath(pcPort,port));
  $("verdict").textContent=results.some(r=>r.success&&r.connected)
   ?"Continuité physique PC → switch : valide."
   :"Continuité interrompue. Vérifie le brassage de la mini-baie et celui de la grande baie.";
 }catch(e){$("verdict").textContent="Erreur : "+e.message;}
};
try{setup()}catch(e){console.error(e);$("verdict").textContent="Échec de l'initialisation R2D3 : "+e.message;}
