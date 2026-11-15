import {createAssetRegistry} from "./asset-profiles.js";
const $=id=>document.getElementById(id);
const tests={
 1:{title:"Switch non administrable",desc:"Le switch ne possède que la commutation Ethernet. La tentative d'ajout d'IP Helper doit être refusée.",name:"Switch non administrable",caps:["ethernet-switching"],expected:false},
 2:{title:"Switch L2",desc:"Les VLAN ne suffisent pas à autoriser IP Helper. Le switch L2 ne route pas entre VLAN.",name:"Switch L2",caps:["ethernet-switching","vlan"],expected:false},
 3:{title:"Switch L3",desc:"Le switch L3 possède la capacité de routage inter-VLAN : IP Helper peut être ajouté.",name:"Switch L3",caps:["ethernet-switching","vlan","inter-vlan-routing"],expected:true},
 4:{title:"Profil de routeur futur",desc:"Un profil non-switch muni de ports Ethernet doit continuer à pouvoir recevoir la capacité IP Helper. Ceci ne constitue pas une recette du routeur.",name:"Routeur générique (profil seulement)",caps:[],expected:true}
};
let registry,profile,selected;
function checked(result){if(!result?.success)throw Error(result?.message||result?.code||"Création impossible");return result;}
function setup(n){
 selected=n;registry=createAssetRegistry();
 const t=tests[n];
 profile=checked(registry.createProfile(t.name)).profile;
 checked(registry.addPortGroup(profile.id,{type:"ethernet-rj45",prefix:"P",start:1,count:4}));
 for(const cap of t.caps)checked(registry.setProfileNetworkCapability(profile.id,cap,true));
 $("title").textContent="Test "+n+" : "+t.title;
 $("instruction").textContent=t.desc;
 $("action").textContent="Essayer d'ajouter IP Helper";
 $("action").disabled=false;
 $("result").textContent="Configuration initiale chargée.";
 for(const b of $("tests").querySelectorAll("button")){
  b.classList.toggle("selected",Number(b.dataset.test)===n);
  b.setAttribute("aria-pressed",String(Number(b.dataset.test)===n));
 }
 render();
}
function render(){
 const p=registry.getProfile(profile.id);
 $("state").textContent=[
  "Profil : "+p.name,
  "Capacités : "+(p.networkCapabilities.join(", ")||"aucune"),
  "Ports Ethernet : "+p.portGroups.reduce((sum,g)=>sum+g.count,0),
  "PoE : "+(p.poe?"oui":"non"),
  "IP Helper : "+(p.networkCapabilities.includes("ip-helper")?"autorisé":"absent")
 ].join("\n");
}
$("action").onclick=()=>{
 const t=tests[selected];
 const before=registry.exportState();
 const response=registry.setProfileNetworkCapability(profile.id,"ip-helper",true);
 const now=registry.getProfile(profile.id);
 const correct=response.success===t.expected &&
  now.networkCapabilities.includes("ip-helper")===t.expected &&
  (t.expected||JSON.stringify(registry.exportState())===JSON.stringify(before));
 $("result").textContent=(correct?"Conforme. ":"ÉCHEC DU CONTRÔLE. ")+
  "Réponse du registre : "+(response.success?"acceptée":"refusée")+" ("+response.code+").";
 $("action").disabled=true;
 render();
};
$("reset").onclick=()=>setup(selected);
$("tests").onclick=e=>{const b=e.target.closest("button[data-test]");if(b)setup(Number(b.dataset.test));};
setup(1);
