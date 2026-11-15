import {createAssetRegistry} from "./asset-profiles.js";
import {createEngine} from "./r2d3-core.js";
import {addSwitchVlan,setSwitchAccessPort} from "./vlan-v1.js";
import {setSwitchVlanInterface,setSwitchInterVlanRouting,observeRegisteredInterVlanPing} from "./inter-vlan-routing-v1.js";
import {configureSwitchDhcp,createSwitchDhcpCoreObject,requestSwitchDhcp} from "./switch-dhcp-service-v1.js";
const $=id=>document.getElementById(id);
const good=x=>{if(!x?.success)throw Error(x?.message||x?.reason||x?.code||"Opération refusée");return x};
let r,sw,pcs,engine,addresses,routingVerified=false;
function wire(a,b){const c=good(r.createCable()).cable;good(r.connectCableEnd(c.id,0,a));good(r.connectCableEnd(c.id,1,b));return c;}
function boot(){
 r=createAssetRegistry();engine=null;addresses=null;routingVerified=false;
 const sp=good(r.createProfile("Switch L3")).profile,pp=good(r.createProfile("PC Windows")).profile;
 good(r.addPortGroup(sp.id,{type:"ethernet-rj45",prefix:"P",start:1,count:4}));
 good(r.addPortGroup(pp.id,{type:"ethernet-rj45",prefix:"LAN",start:1,count:1}));
 for(const cap of ["ethernet-switching","vlan","inter-vlan-routing","dhcp-server"])good(r.setProfileNetworkCapability(sp.id,cap,true));
 sw=good(r.createAsset(sp.id,{name:"SW-L3"})).asset;
 pcs=[10,20].map(v=>good(r.createAsset(pp.id,{name:"PC"+v})).asset);
 const cables=pcs.map((pc,i)=>wire(pc.ports[0].id,sw.ports[i].id));
 for(const v of [10,20]){good(addSwitchVlan(r,sw.id,v,"VLAN "+v));good(setSwitchVlanInterface(r,sw.id,v,"192.168."+v+".1",24,true));}
 pcs.forEach((pc,i)=>good(setSwitchAccessPort(r,sw.id,sw.ports[i].id,[10,20][i])));
 good(setSwitchInterVlanRouting(r,sw.id,true));
 const pools=[10,20].map(v=>({id:"vlan"+v,vlanNumber:v,start:"192.168."+v+".100",end:"192.168."+v+".105",prefix:24,gateway:"192.168."+v+".1",dns:["1.1.1.1"],leaseSeconds:3600}));
 good(configureSwitchDhcp(r,sw.id,{enabled:true,pools}));
 const coreClient=pc=>({id:pc.id,kind:"pc-windows",name:pc.name,
  ports:[{id:pc.ports[0].id,type:"rj45"}],config:{ipv4:{interfaceId:pc.ports[0].id,mode:"dhcp",address:null,prefix:null,lease:null},networkOptions:{gateway:null,dns:[]}}});
 engine=createEngine({format:"r2d3-scenario",schemaVersion:1,scenarioId:"switch-transverse-01",scenarioVersion:"1",capabilities:{network:true},
  objects:[...pcs.map(coreClient),createSwitchDhcpCoreObject(r,sw.id)],
  links:cables.map((c,i)=>({id:c.id,kind:"ethernet-cable",connected:true,endpoints:[
   {objectId:pcs[i].id,portId:pcs[i].ports[0].id},{objectId:sw.id,portId:sw.ports[i].id}]}))});
 $("dhcp").disabled=false;$("ping").disabled=true;$("disable").disabled=true;$("result").textContent="Scénario chargé. Lance les demandes DHCP.";render();
}
function snapshotAddress(pc){const cfg=engine.getSnapshot().objectsById[pc.id]?.config;
 return {address:cfg?.ipv4?.address,prefix:cfg?.ipv4?.prefix,gateway:cfg?.networkOptions?.gateway};}
function render(){const swAsset=r.getAsset(sw.id),snap=engine.getSnapshot();
 const rows=["SW-L3 : VLAN 10 et VLAN 20 ; routage inter-VLAN "+(swAsset.routingConfig.routingEnabled?"ACTIVÉ":"DÉSACTIVÉ")+" ; DHCP "+(swAsset.dhcpServerConfig.enabled?"ACTIF":"ARRÊTÉ"),
  "Interfaces : 192.168.10.1/24 et 192.168.20.1/24"];
 for(const [i,pc] of pcs.entries()){const v=[10,20][i],cfg=snap.objectsById[pc.id].config;
  rows.push(pc.name+" | VLAN "+v+" | IPv4 "+(cfg.ipv4.address||"aucune")+(cfg.ipv4.prefix!=null?"/"+cfg.ipv4.prefix:"")+
   " | passerelle "+(cfg.networkOptions?.gateway||"aucune"));}
 rows.push("Capacités du switch : "+swAsset.networkCapabilities.join(", "));$("state").textContent=rows.join("\n");}
$("dhcp").onclick=()=>{try{
 const results=pcs.map(pc=>requestSwitchDhcp({registry:r,switchId:sw.id,clientId:pc.id,dhcpEngine:engine}));
 addresses=Object.fromEntries(pcs.map(pc=>[pc.id,snapshotAddress(pc)]));
 const ok=results.every((out,i)=>out.success&&addresses[pcs[i].id].address==="192.168."+[10,20][i]+".100"&&
  addresses[pcs[i].id].gateway==="192.168."+[10,20][i]+".1");
 $("result").textContent=(ok?"DHCP conforme. ":"ANOMALIE DHCP. ")+
  pcs.map((pc,i)=>pc.name+" : "+(results[i].address||results[i].code)).join(" ; ");
 $("ping").disabled=!ok;$("disable").disabled=true;routingVerified=false;render();
 }catch(err){$("result").textContent="Erreur DHCP : "+err.message;}};
$("ping").onclick=()=>{try{
 if(!addresses)throw Error("Demande DHCP préalable requise");
 const result=observeRegisteredInterVlanPing(r,sw.id,pcs[0].id,pcs[1].id,addresses);
 $("result").textContent=(result.success?"Communication inter-VLAN RÉUSSIE. ":"Communication inter-VLAN ÉCHOUÉE. ")+(result.reason||result.status);
 if(result.success&&r.getAsset(sw.id).routingConfig.routingEnabled){routingVerified=true;$("disable").disabled=false;}
 render();}catch(err){$("result").textContent="Erreur ping : "+err.message;}};
$("disable").onclick=()=>{try{
 if(!routingVerified)throw Error("Valide d'abord la communication entre les VLAN.");
 const before=pcs.map(snapshotAddress);
 good(setSwitchInterVlanRouting(r,sw.id,false));
 const after=pcs.map(snapshotAddress);
 const leasePreserved=before.every((v,i)=>v.address===after[i].address&&v.prefix===after[i].prefix&&v.gateway===after[i].gateway&&!!v.address);
 const observation=observeRegisteredInterVlanPing(r,sw.id,pcs[0].id,pcs[1].id,addresses);
 const expected=leasePreserved&&!observation.success&&observation.status!=="unavailable"&&
  observation.reason==="Routage inter-VLAN désactivé";
 $("result").textContent=(expected?"CONFORME. ":"ANOMALIE. ")+
  "Routage désactivé ; "+(observation.success?"communication encore possible":"communication interrompue")+
  " ("+(observation.reason||observation.status)+"). "+
  (leasePreserved?"Baux DHCP conservés sur les deux PC.":"Au moins un bail DHCP a changé.");
 $("disable").disabled=true;render();
 }catch(err){$("result").textContent="Erreur de vérification : "+err.message;}};
$("reset").onclick=()=>{try{boot()}catch(e){$("result").textContent="Erreur de préparation : "+e.message;}};
try{boot()}catch(e){$("result").textContent="Erreur de préparation : "+e.message;}