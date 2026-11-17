import {createAssetRegistry} from "./asset-profiles.js";
import {mountCablingFrontpanel} from "../shared-ui/v1/cabling-frontpanel.js";
const $=id=>document.getElementById(id);
const must=(r)=>{if(!r.success)throw Error(r.message);return r};
let registry,view,pcPort,switchPorts;
function addCable(a,b){
 const c=must(registry.createCable({connectors:["rj45-male","rj45-male"]})).cable;
 must(registry.connectCableEnd(c.id,0,a));
 must(registry.connectCableEnd(c.id,1,b));
 return c.id;
}
function setup(){
 view?.destroy();
 registry=createAssetRegistry();
 const site=must(registry.createPlace({name:"Site de recette"})).place.id;
 const local=must(registry.createPlace({name:"Local technique",parentId:site})).place.id;
 const lab=must(registry.createPlace({name:"Bureau",parentId:site})).place.id;
 const panel=must(registry.createPanel({name:"Panneau P1",placeId:local,count:6,prefix:"",start:1})).panel;
 const outlet=must(registry.createWallOutlet({name:"F",location:"Bureau"})).outlet;
 const pcProfile=must(registry.createProfile("PC")).profile.id;
 must(registry.addPortGroup(pcProfile,{type:"ethernet-rj45",prefix:"LAN",start:1,count:1,digits:2}));
 const swProfile=must(registry.createProfile("Switch 24 ports")).profile.id;
 must(registry.addPortGroup(swProfile,{type:"ethernet-rj45",prefix:"LAN",start:1,count:24,digits:2}));
 const pc=must(registry.createAsset(pcProfile,{name:"PC élève"})).asset;
 const sw=must(registry.createAsset(swProfile,{name:"SW01"})).asset;
 must(registry.moveAssetToPlace(pc.id,lab));
 must(registry.moveAssetToPlace(sw.id,local));
 pcPort=pc.ports[0].id;switchPorts=sw.ports.map(p=>p.id);
 // PC relié à la prise murale ; arrière de la prise relié à l'arrière du panneau.
 addCable(pcPort,outlet.ports[0].front.id);
 addCable(outlet.ports[0].back.id,panel.ports[0].back.id);
 // Exemples d'occupations existantes sur la façade du switch.
 addCable(sw.ports[2].id,panel.ports[2].front.id);
 view=mountCablingFrontpanel({
  root:$("frontpanel"),registry,
  layout:{"Panneau P1":{columns:6},"SW01":{columns:12,switchPairs:true},"PC élève":{columns:1},"F":{columns:1}},
 });
 $("verdict").textContent="Scénario réinitialisé. Branche la prise murale F au panneau 1, puis le panneau 1 à un port libre du switch.";
}
$("reset").onclick=()=>{try{setup()}catch(e){$("verdict").textContent="Erreur : "+e.message}};
$("test").onclick=()=>{
 try{
  const results=switchPorts.map(port=>registry.explorePhysicalPath(pcPort,port));
  const ok=results.some(r=>r.success&&r.connected);
  $("verdict").textContent=ok?"Continuité PC → switch : valide.":"Continuité interrompue. Vérifie les cordons entre la prise F, P1 et SW01.";
 }catch(e){$("verdict").textContent="Erreur : "+e.message}
};
try{setup()}catch(e){console.error(e);$("verdict").textContent="Échec de l'initialisation R2D3 : "+e.message}
