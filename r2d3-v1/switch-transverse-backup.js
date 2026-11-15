import {createAssetRegistry,restoreAssetRegistry} from "./asset-profiles.js";
import {addSwitchVlan,setSwitchAccessPort} from "./vlan-v1.js";
import {setSwitchVlanInterface,setSwitchInterVlanRouting} from "./inter-vlan-routing-v1.js";
import {setVlanIpHelper} from "./ip-helper-v1.js";
import {configureSwitchDhcp} from "./switch-dhcp-service-v1.js";
import {configureSwitchManagementStatic} from "./switch-management-ip-v01.js";
const $=id=>document.getElementById(id),good=x=>{if(!x?.success)throw Error(x?.message||x?.code||x?.reason||"Opération refusée");return x;};
let r,sw,profile,backup,original;
function boot(){
 r=createAssetRegistry();backup=null;original=null;
 profile=good(r.createProfile("Modèle switch L3")).profile;
 good(r.addPortGroup(profile.id,{type:"ethernet-rj45",prefix:"P",start:1,count:6}));
 for(const c of ["ethernet-switching","vlan","inter-vlan-routing","ip-helper","dhcp-server"])good(r.setProfileNetworkCapability(profile.id,c,true));
 good(r.setProfilePoe(profile.id,true));
 sw=good(r.createAsset(profile.id,{name:"SW-L3"})).asset;
 for(const n of [10,20]){good(addSwitchVlan(r,sw.id,n,"VLAN "+n));good(setSwitchVlanInterface(r,sw.id,n,"192.168."+n+".1",24));}
 good(setSwitchAccessPort(r,sw.id,sw.ports[0].id,10));
 good(setSwitchAccessPort(r,sw.id,sw.ports[1].id,20));
 good(setSwitchInterVlanRouting(r,sw.id,true));
 good(setVlanIpHelper(r,sw.id,10,"192.168.20.2",true));
 good(configureSwitchManagementStatic(r,sw.id,"192.168.1.2",24,"192.168.1.1"));
 good(configureSwitchDhcp(r,sw.id,{enabled:true,pools:[{id:"pool20",vlanNumber:20,start:"192.168.20.100",end:"192.168.20.105",prefix:24,gateway:"192.168.20.1",dns:[],leaseSeconds:3600}]}));
 $("first").disabled=false;$("second").disabled=true;$("verdict").hidden=true;$("verdict").textContent="";
 $("result").textContent="Scénario chargé, prêt à exporter.";render();
}
function config(){const a=r.getAsset(sw.id);return {poe:a.poe,networkCapabilities:a.networkCapabilities,vlanConfig:a.vlanConfig,routingConfig:a.routingConfig,ipHelperConfig:a.ipHelperConfig,dhcpServerConfig:a.dhcpServerConfig,managementConfig:a.managementConfig};}
function render(){
 const a=r.getAsset(sw.id),p=r.getProfile(profile.id);
 const rows=["SW-L3 | "+a.ports.length+" ports Ethernet | PoE "+(a.poe?"oui":"non"),
  "Capacités : "+a.networkCapabilities.join(", "),
  "VLAN : "+a.vlanConfig.vlans.map(v=>v.number).join(", "),
  "Routage L3 : "+(a.routingConfig.routingEnabled?"ACTIF":"ARRÊTÉ"),
  "IP Helper VLAN 10 : "+(a.ipHelperConfig.helpers["vlan:10"]?.serverAddress||"absent"),
  "DHCP sur switch : "+(a.dhcpServerConfig.enabled?"ACTIF":"ARRÊTÉ")+" / "+a.dhcpServerConfig.pools.length+" plage(s)",
  "IP de gestion : "+a.managementConfig.address+"/"+a.managementConfig.prefix,
  "Modèle PoE : "+(p.poe?"oui":"non")];
 $("state").textContent=rows.join("\n");
}
$("first").onclick=()=>{try{
 original=config();backup=r.exportState();
 const restored=restoreAssetRegistry(backup);
 const a=restored.getAsset(sw.id),p=restored.getProfile(profile.id);
 const pass=JSON.stringify(config())===JSON.stringify({
  poe:a.poe,networkCapabilities:a.networkCapabilities,vlanConfig:a.vlanConfig,
  routingConfig:a.routingConfig,ipHelperConfig:a.ipHelperConfig,
  dhcpServerConfig:a.dhcpServerConfig,managementConfig:a.managementConfig
 })&&a.poe===true&&p.poe===true&&a.networkCapabilities.length===5&&
 a.vlanConfig.vlans.some(v=>v.number===10)&&a.vlanConfig.vlans.some(v=>v.number===20)&&
 a.routingConfig.routingEnabled&&a.ipHelperConfig.helpers["vlan:10"]?.enabled&&
 a.dhcpServerConfig.enabled&&a.managementConfig.address==="192.168.1.2";
 $("result").textContent=(pass?"CONFORME. ":"ANOMALIE. ")+"Sauvegarde et restauration de toutes les configurations du switch L3.";
 $("second").disabled=!pass;render();
 }catch(e){$("result").textContent="Erreur : "+e.message;}};
$("second").onclick=()=>{try{
 good(setSwitchInterVlanRouting(r,sw.id,false));
 good(setVlanIpHelper(r,sw.id,10,"192.168.20.99",true));
 good(configureSwitchManagementStatic(r,sw.id,"192.168.1.99",24,"192.168.1.1"));
 const modified=JSON.stringify(config())!==JSON.stringify(original);
 r=restoreAssetRegistry(backup);
 const pass=modified&&JSON.stringify(config())===JSON.stringify(original);
 $("verdict").textContent=(pass?"CONFORME. ":"ANOMALIE. ")+"Après modification et restauration : routage, IP Helper, DHCP, VLAN, IP de gestion et PoE "+(pass?"retrouvés.":"incohérents.");
 $("verdict").hidden=false;$("second").disabled=true;render();
 }catch(e){$("verdict").textContent="Erreur : "+e.message;$("verdict").hidden=false;}};
$("reset").onclick=()=>{try{boot()}catch(e){$("result").textContent="Erreur de préparation : "+e.message;}};
try{boot()}catch(e){$("result").textContent="Erreur de préparation : "+e.message;}