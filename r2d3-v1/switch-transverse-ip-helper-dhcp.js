import {createAssetRegistry} from "./asset-profiles.js";
import {createEngine} from "./r2d3-core.js";
import {addSwitchVlan,setSwitchAccessPort} from "./vlan-v1.js";
import {setSwitchVlanInterface,setSwitchInterVlanRouting} from "./inter-vlan-routing-v1.js";
import {getAssetIpHelperConfig,setVlanIpHelper,observeRegisteredRelayedDhcp} from "./ip-helper-v1.js";
const $=id=>document.getElementById(id),ok=v=>{if(!v?.success)throw Error(v?.message||v?.reason||v?.code||"Action refusée");return v};
let r,sw,pc,srv,engine,step=0;
function cable(a,b){const c=ok(r.createCable()).cable;ok(r.connectCableEnd(c.id,0,a));ok(r.connectCableEnd(c.id,1,b));}
function createCore(){return createEngine({format:"r2d3-scenario",schemaVersion:1,scenarioId:"transverse-helper-dhcp",scenarioVersion:"1",capabilities:{network:true},
 objects:[{id:pc.id,kind:"pc-windows",name:"PC10",ports:[{id:"eth0",type:"rj45"}],
 config:{ipv4:{interfaceId:"eth0",mode:"dhcp",address:null,prefix:null,lease:null},networkOptions:{gateway:null,dns:[]}}},
 {id:srv.id,kind:"dhcp-server",name:"SRV-DHCP",ports:[{id:"eth0",type:"rj45"}],
 config:{ipv4:{interfaceId:"eth0",mode:"static",address:"192.168.20.2",prefix:24},
 dhcpEnabled:true,dhcpPools:[{id:"plage10",start:"192.168.10.100",end:"192.168.10.110",prefix:24,gateway:"192.168.10.1",dns:[],leaseSeconds:3600}]}}],
 links:[{id:"service-relay",kind:"relay-service",connected:false,endpoints:[{objectId:pc.id,portId:"eth0"},{objectId:srv.id,portId:"eth0"}]}]});}
function setup(){
 step=0;r=createAssetRegistry();
 const p=ok(r.createProfile("PC")).profile,d=ok(r.createProfile("Serveur DHCP")).profile,s=ok(r.createProfile("Switch L3")).profile;
 for(const x of [p,d])ok(r.addPortGroup(x.id,{type:"ethernet-rj45",prefix:"LAN",start:1,count:1}));
 ok(r.addPortGroup(s.id,{type:"ethernet-rj45",prefix:"P",start:1,count:4}));
 for(const c of ["ethernet-switching","vlan","inter-vlan-routing","ip-helper"])ok(r.setProfileNetworkCapability(s.id,c,true));
 pc=ok(r.createAsset(p.id,{name:"PC10"})).asset;srv=ok(r.createAsset(d.id,{name:"SRV-DHCP"})).asset;sw=ok(r.createAsset(s.id,{name:"SW-L3"})).asset;
 cable(pc.ports[0].id,sw.ports[0].id);cable(srv.ports[0].id,sw.ports[1].id);
 for(const n of [10,20]){ok(addSwitchVlan(r,sw.id,n,"VLAN "+n));ok(setSwitchVlanInterface(r,sw.id,n,"192.168."+n+".1",24));}
 ok(setSwitchAccessPort(r,sw.id,sw.ports[0].id,10));ok(setSwitchAccessPort(r,sw.id,sw.ports[1].id,20));
 ok(setSwitchInterVlanRouting(r,sw.id,true));engine=createCore();
 $("t1").disabled=false;$("t2").disabled=true;$("t3").disabled=true;$("verdict").hidden=true;$("verdict").textContent="";
 $("result").textContent="Installation initialisée, IP Helper non configuré.";render();
}
function request(){return observeRegisteredRelayedDhcp({registry:r,switchId:sw.id,clientId:pc.id,serverId:srv.id,serverAddress:"192.168.20.2",dhcpEngine:engine});}
// Liaison de service logique du banc d'essai, indépendante des câbles R2.
// Sans IP Helper, le Core ne voit aucun chemin DHCP et peut attribuer une APIPA.
function setRelayPath(connected){
 const result=engine.dispatch({commandVersion:1,id:"service-link-"+engine.getSnapshot().revision,
  type:"network.setLinkConnected",targetId:"service-relay",params:{connected}});
 if(result.status!=="applied")throw Error(result.message||result.code||"Impossible de mettre à jour le chemin DHCP");
}
function coreRequestWithoutRelay(){
 const result=engine.dispatch({commandVersion:1,id:"core-dhcp-no-helper-"+engine.getSnapshot().revision,
  type:"dhcp.request",targetId:pc.id,params:{serverId:srv.id}});
 if(result.status!=="applied")throw Error(result.message||result.code||"Requête DHCP Core refusée");
 return engine.getSnapshot();
}
function render(){
 const v=getAssetIpHelperConfig(r,sw.id).helpers["vlan:10"],cfg=engine.getSnapshot().objectsById[pc.id].config.ipv4;
 $("state").textContent=["SW-L3 : routage inter-VLAN ACTIF, interfaces VLAN 10 et 20 configurées",
 "PC10 : VLAN 10, "+(cfg.address||"aucune IPv4"),
 "SRV-DHCP : VLAN 20, 192.168.20.2",
 "Plage du serveur : 192.168.10.100 à 192.168.10.110",
 "IP Helper VLAN 10 : "+(!v?"ABSENT":(v.enabled?"ACTIF":"INACTIF")+" / "+v.serverAddress)].join("\n");
}
$("t1").onclick=()=>{try{
 const before=engine.getSnapshot().objectsById[pc.id].config.ipv4.address;
 const x=request();
 if(x.success)throw Error("Le relais DHCP a fonctionné sans IP Helper.");
 const state=coreRequestWithoutRelay();
 const current=state.objectsById[pc.id].config.ipv4;
 const after=current.address,status=state.runtime[pc.id]?.dhcpStatus;
 const pass=!before&&x.reason==="IP Helper absent ou désactivé sur le VLAN client"&&
   status==="apipa"&&/^169\\.254\\./.test(after||"")&&current.prefix===16&&current.lease===null;
 $("result").textContent=(pass?"CONFORME. ":"ANOMALIE. ")+"Sans IP Helper : "+x.reason+
  ". Échec DHCP traité par le Core : "+(after||"aucune IPv4")+
  (current.prefix!=null?"/"+current.prefix:"")+" (état "+status+").";
 $("t2").disabled=!pass;render();
 }catch(e){$("result").textContent="Erreur : "+e.message;}};
$("t2").onclick=()=>{try{
 ok(setVlanIpHelper(r,sw.id,10,"192.168.20.2",true));setRelayPath(true);const x=request();
 const addr=engine.getSnapshot().objectsById[pc.id].config.ipv4.address;
 const pass=x.success&&x.address==="192.168.10.100"&&addr==="192.168.10.100";
 $("result").textContent=(pass?"CONFORME. ":"ANOMALIE. ")+"IP Helper actif : "+(x.reason||x.status)+" ; bail "+(addr||"aucun")+".";
 $("t3").disabled=!pass;render();
 }catch(e){$("result").textContent="Erreur : "+e.message;}};
$("t3").onclick=()=>{try{
 ok(setVlanIpHelper(r,sw.id,10,"192.168.20.99",true));
 const before=engine.getSnapshot().objectsById[pc.id].config.ipv4.address;
 const x=request(),after=engine.getSnapshot().objectsById[pc.id].config.ipv4.address;
 const pass=!x.success&&x.reason==="Adresse IP Helper incorrecte"&&before==="192.168.10.100"&&after===before;
 $("verdict").textContent=(pass?"CONFORME. ":"ANOMALIE. ")+"Relais vers mauvaise adresse : "+x.reason+". Bail précédent "+(after===before?"conservé.":"modifié.");
 $("verdict").hidden=false;$("t3").disabled=true;render();
 }catch(e){$("verdict").textContent="Erreur : "+e.message;$("verdict").hidden=false;}};
$("reset").onclick=()=>{try{setup()}catch(e){$("result").textContent="Erreur de préparation : "+e.message;}};
try{setup()}catch(e){$("result").textContent="Erreur de préparation : "+e.message;}