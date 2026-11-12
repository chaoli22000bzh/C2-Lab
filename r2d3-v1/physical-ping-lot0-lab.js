import {createAssetRegistry} from "./asset-profiles.js";
import {openPhysicalPingProbe} from "./physical-ping-lot0.js";

const $=id=>document.getElementById(id);
const inventory=createAssetRegistry();
const profile=inventory.createProfile("Équipement Ethernet").profile;
const portGroup=inventory.addPortGroup(profile.id,{type:"ethernet-rj45",prefix:"LAN",start:1,count:1});
if(!portGroup.success)throw Error(portGroup.message);
const pc=inventory.createAsset(profile.id,{name:"PC"}).asset;
const printer=inventory.createAsset(profile.id,{name:"Imprimante"}).asset;
const cable=inventory.createCable({connectors:["rj45-male","rj45-male"]}).cable;
for(const [end,port] of [[0,pc.ports[0].id],[1,printer.ports[0].id]]){
 const result=inventory.connectCableEnd(cable.id,end,port);
 if(!result.success)throw Error(result.message);
}
const probe=await openPhysicalPingProbe({
 physicalState:inventory.exportState(),
 addressing:{
  [pc.id]:{address:"192.168.10.20",prefix:24},
  [printer.id]:{address:"192.168.10.50",prefix:24}
 }
});
const connection=()=>probe.getSnapshot().physical.cables.find(x=>x.id===cable.id)?.ends[1]?.portId===printer.ports[0].id;
function display(){
 const connected=connection();
 $("wire").textContent=connected?"Câble raccordé aux deux équipements.":"Extrémité B du câble libre : liaison interrompue.";
 $("disconnect").disabled=!connected;
 $("connect").disabled=connected;
}
function ping(){
 const q=probe.queryPing(pc.id,printer.id);
 $("result").textContent=q.status==="ok"
  ?(q.success?"Réponse reçue de 192.168.10.50":("Échec du ping : "+q.reason))
  :("Observation indisponible : "+q.reason);
}
async function act(type,params){
 $("disconnect").disabled=true;$("connect").disabled=true;$("ping").disabled=true;
 try{
  const result=await probe.physicalAction(type,params);
  if(result.status!=="applied"&&result.status!=="unchanged")$("result").textContent=result.message??result.code;
 }catch(error){$("result").textContent="Erreur de la démonstration : "+error.message;}
 display();$("ping").disabled=false;ping();
}
$("disconnect").addEventListener("click",()=>act("disconnectCableEnd",{cableId:cable.id,end:1}));
$("connect").addEventListener("click",()=>act("connectCableEnd",{cableId:cable.id,end:1,portId:printer.ports[0].id}));
$("ping").addEventListener("click",ping);
display();$("ping").disabled=false;ping();
