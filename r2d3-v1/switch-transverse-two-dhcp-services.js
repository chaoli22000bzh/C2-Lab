import {createAssetRegistry} from "./asset-profiles.js";
import {createEngine} from "./r2d3-core.js";
import {addSwitchVlan,setSwitchAccessPort} from "./vlan-v1.js";
import {setSwitchVlanInterface,setSwitchInterVlanRouting} from "./inter-vlan-routing-v1.js";
import {configureSwitchDhcp,createSwitchDhcpCoreObject,requestSwitchDhcp} from "./switch-dhcp-service-v1.js";
import {setVlanIpHelper,observeRegisteredRelayedDhcp} from "./ip-helper-v1.js";
const $=id=>document.getElementById(id),good=v=>{if(!v?.success)throw Error(v?.message||v?.code||v?.reason||"Action refusée");return v;};
let r,sw,pc10,pc20,srv,engine;
function wire(a,b){const c=good(r.createCable()).cable;good(r.connectCableEnd(c.id,0,a));good(r.connectCableEnd(c.id,1,b));return c;}
function pool(v,id){return {id,start:"192.168."+v+".100",end:"192.168."+v+".105",prefix:24,gateway:"192.168."+v+".1",dns:[],leaseSeconds:3600};}
function boot(){
 r=createAssetRegistry();
 const pp=good(r.createProfile("PC Windows")).profile,dp=good(r.createProfile("Serveur DHCP")).profile,sp=good(r.createProfile("Switch L3")).profile;
 for(const p of [pp,dp])good(r.addPortGroup(p.id,{type:"ethernet-rj45",prefix:"LAN",start:1,count:1}));
 good(r.addPortGroup(sp.id,{type:"ethernet-rj45",prefix:"P",start:1,count:6}));
 for(const cap of ["ethernet-switching","vlan","inter-vlan-routing","ip-helper","dhcp-server"])good(r.setProfileNetworkCapability(sp.id,cap,true));
 sw=good(r.createAsset(sp.id,{name:"SW-L3"})).asset;
 pc10=good(r.createAsset(pp.id,{name:"PC10"})).asset;pc20=good(r.createAsset(pp.id,{name:"PC20"})).asset;
 srv=good(r.createAsset(dp.id,{name:"SRV-DHCP"})).asset;
 const c10=wire(pc10.ports[0].id,sw.ports[0].id);
 const c20=wire(pc20.ports[0].id,sw.ports[1].id);
 const c30=wire(srv.ports[0].id,sw.ports[2].id);
 for(const v of [10,20,30]){good(addSwitchVlan(r,sw.id,v,"VLAN "+v));good(setSwitchVlanInterface(r,sw.id,v,"192.168."+v+".1",24,true));}
 for(const [i,v] of [10,20,30].entries())good(setSwitchAccessPort(r,sw.id,sw.ports[i].id,v));
 good(setSwitchInterVlanRouting(r,sw.id,true));
 good(setVlanIpHelper(r,sw.id,20,"192.168.30.2",true));
 good(configureSwitchDhcp(r,sw.id,{enabled:true,pools:[{...pool(10,"local10"),vlanNumber:10}]}));
 const pcObject=p=>({id:p.id,kind:"pc-windows",name:p.name,ports:[{id:p.ports[0].id,type:"rj45"}],
  config:{ipv4:{interfaceId:p.ports[0].id,mode:"dhcp",address:null,prefix:null,lease:null},networkOptions:{gateway:null,dns:[]}}});
 const serverObject={id:srv.id,kind:"dhcp-server",name:srv.name,ports:[{id:srv.ports[0].id,type:"rj45"}],
  config:{ipv4:{interfaceId:srv.ports[0].id,mode:"static",address:"192.168.30.2",prefix:24},
   dhcpEnabled:true,dhcpPools:[pool(20,"remote20")]}};
 const links=[[c10,pc10,0],[c20,pc20,1],[c30,srv,2]].map(([c,obj,i])=>({
  id:c.id,kind:"ethernet-cable",connected:true,endpoints:[
   {objectId:obj.id,portId:obj.ports[0].id},{objectId:sw.id,portId:sw.ports[i].id}]}));
 links.push({id:"relay-service",kind:"relay-service",connected:true,endpoints:[
  {objectId:pc20.id,portId:pc20.ports[0].id},{objectId:srv.id,portId:srv.ports[0].id}]});
 engine=createEngine({format:"r2d3-scenario",schemaVersion:1,scenarioId:"two-dhcp-services",scenarioVersion:"1",capabilities:{network:true},
  objects:[pcObject(pc10),pcObject(pc20),createSwitchDhcpCoreObject(r,sw.id),serverObject],links});
 $("local").disabled=false;$("remote").disabled=true;$("failure").disabled=true;
 $("verdict").hidden=true;$("verdict").textContent="";$("result").textContent="Scénario initial chargé.";render();
}
function address(p){return engine.getSnapshot().objectsById[p.id].config.ipv4.address;}
function leaseCount(serverId){const res=engine.query({type:"dhcp.leases",serverId});return res.leases?.length??-1;}
function render(){
 const a=r.getAsset(sw.id),x=a.ipHelperConfig.helpers["vlan:20"];
 $("state").textContent=[
 "SW-L3 : routage inter-VLAN ACTIF ; DHCP intégré ACTIF (VLAN 10)",
 "IP Helper sur VLAN 20 : "+(x?.enabled?"ACTIF":"INACTIF")+" → "+(x?.serverAddress||"aucun"),
 "PC10 / VLAN 10 : "+(address(pc10)||"aucune IPv4"),
 "PC20 / VLAN 20 : "+(address(pc20)||"aucune IPv4"),
 "Serveur externe / VLAN 30 : 192.168.30.2",
 "Baux du DHCP intégré : "+leaseCount(sw.id),
 "Baux du serveur externe : "+leaseCount(srv.id)
 ].join("\n");
}
$("local").onclick=()=>{try{
 const res=requestSwitchDhcp({registry:r,switchId:sw.id,clientId:pc10.id,dhcpEngine:engine});
 const pass=res.success&&address(pc10)==="192.168.10.100"&&leaseCount(sw.id)===1&&leaseCount(srv.id)===0;
 $("result").textContent=(pass?"CONFORME. ":"ANOMALIE. ")+"DHCP intégré : PC10 = "+(address(pc10)||res.code)+
  ". Baux local/externe : "+leaseCount(sw.id)+"/"+leaseCount(srv.id)+".";
 $("remote").disabled=!pass;render();
 }catch(e){$("result").textContent="Erreur : "+e.message;}};
$("remote").onclick=()=>{try{
 const res=observeRegisteredRelayedDhcp({registry:r,switchId:sw.id,clientId:pc20.id,serverId:srv.id,serverAddress:"192.168.30.2",dhcpEngine:engine});
 const pass=res.success&&address(pc20)==="192.168.20.100"&&address(pc10)==="192.168.10.100"&&
  leaseCount(sw.id)===1&&leaseCount(srv.id)===1;
 $("result").textContent=(pass?"CONFORME. ":"ANOMALIE. ")+"IP Helper : PC20 = "+(address(pc20)||res.reason)+
  ". Baux local/externe : "+leaseCount(sw.id)+"/"+leaseCount(srv.id)+".";
 $("failure").disabled=!pass;render();
 }catch(e){$("result").textContent="Erreur : "+e.message;}};
$("failure").onclick=()=>{try{
 good(setVlanIpHelper(r,sw.id,20,"192.168.30.2",false));
 const before10=address(pc10),before20=address(pc20);
 const res=observeRegisteredRelayedDhcp({registry:r,switchId:sw.id,clientId:pc20.id,serverId:srv.id,serverAddress:"192.168.30.2",dhcpEngine:engine});
 const pass=!res.success&&res.reason==="IP Helper absent ou désactivé sur le VLAN client"&&
  address(pc10)===before10&&address(pc20)===before20&&leaseCount(sw.id)===1&&leaseCount(srv.id)===1;
 $("verdict").textContent=(pass?"CONFORME. ":"ANOMALIE. ")+"Relais désactivé : nouvelle demande refusée, "+
  (address(pc10)===before10&&address(pc20)===before20?"baux existants conservés.":"baux modifiés.");
 $("verdict").hidden=false;$("failure").disabled=true;render();
 }catch(e){$("verdict").textContent="Erreur : "+e.message;$("verdict").hidden=false;}};
$("reset").onclick=()=>{try{boot()}catch(e){$("result").textContent="Erreur de préparation : "+e.message;}};
try{boot()}catch(e){$("result").textContent="Erreur de préparation : "+e.message;}