import {createAssetRegistry} from "./asset-profiles.js";
import {mountSwitchAdmin} from "./switch-admin-ui-v1.js?v=6.7";
const $=id=>document.getElementById(id);
const good=r=>{if(!r?.success)throw Error(r?.message||r?.code||"Opération refusée");return r;};
let view,registry,ids;
function boot(){
 view?.destroy();registry=createAssetRegistry();ids={};
 for(const type of ["l2","l3"]){
  const profile=good(registry.createProfile("Switch "+type.toUpperCase()+" • 8 ports")).profile;
  good(registry.addPortGroup(profile.id,{type:"ethernet-rj45",prefix:"GE",start:1,count:8}));
  const caps=type==="l3"?["ethernet-switching","vlan","inter-vlan-routing","ip-helper","dhcp-server"]:["ethernet-switching","vlan"];
  for(const cap of caps)good(registry.setProfileNetworkCapability(profile.id,cap,true));
  good(registry.setProfilePoe(profile.id,type==="l2"));
  ids[type]=good(registry.createAsset(profile.id,{name:"SW-"+type.toUpperCase()})).asset.id;
 }
 $("switch-choice").value="l2";view=mountSwitchAdmin({root:$("host"),registry,assetId:ids.l2});$("lab-error").textContent="";
}
$("switch-choice").addEventListener("change",e=>{try{view.setAssetId(ids[e.target.value])}catch(error){$("lab-error").textContent=error.message;}});

try{boot()}catch(error){$("lab-error").textContent="Erreur de préparation : "+error.message;}