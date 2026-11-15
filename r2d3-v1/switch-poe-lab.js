import {createAssetRegistry,restoreAssetRegistry} from "./asset-profiles.js";
const $=id=>document.getElementById(id),good=x=>{if(!x?.success)throw Error(x?.message||"Action refusée");return x;};
let r,profiles,assets,selected=1,step=0;
const desc={
 1:["Switch non administrable","Observe le modèle non PoE. Active la propriété du modèle, puis crée un nouveau switch."],
 2:["Switchs administrables L2 et L3","La propriété PoE est indépendante du niveau d'administration. Un switch L2 et un L3 peuvent être PoE."],
 3:["Propriété du modèle, sauvegarde","La caractéristique matérielle est copiée à la création. Modifier le modèle n'altère pas les switchs déjà enregistrés."]
};
function makeProfile(name,caps){
 const p=good(r.createProfile(name)).profile;
 good(r.addPortGroup(p.id,{type:"ethernet-rj45",prefix:"P",start:1,count:4}));
 for(const c of caps)good(r.setProfileNetworkCapability(p.id,c,true));
 return p;
}
function setup(test){
 selected=test;step=0;r=createAssetRegistry();
 profiles=[
  makeProfile("Switch non administrable",["ethernet-switching"]),
  makeProfile("Switch administrable L2",["ethernet-switching","vlan"]),
  makeProfile("Switch administrable L3",["ethernet-switching","vlan","inter-vlan-routing"])
 ];assets=[];
 if(test===1)assets.push(good(r.createAsset(profiles[0].id,{name:"SW01"})).asset);
 if(test===2){
  good(r.setProfilePoe(profiles[1].id,true));
  good(r.setProfilePoe(profiles[2].id,true));
  assets.push(good(r.createAsset(profiles[1].id,{name:"SW02"})).asset,
   good(r.createAsset(profiles[2].id,{name:"SW03"})).asset);
 }
 if(test===3)assets.push(good(r.createAsset(profiles[0].id,{name:"SW01"})).asset);
 $("title").textContent="Test "+test+" : "+desc[test][0];
 $("instruction").textContent=desc[test][1];
 $("action").textContent=test===1?"Définir PoE : oui et créer SW04":
  test===2?"Exporter et restaurer le registre":"Définir PoE : oui et créer SW04";
 for(const b of $("tests").querySelectorAll("button")){
  b.classList.toggle("selected",Number(b.dataset.test)===test);
  b.setAttribute("aria-pressed",String(Number(b.dataset.test)===test));
 }
 render();$("result").textContent="Scénario chargé.";
}
function render(){
 const rows=["MODÈLES DE SWITCHS",...profiles.map(p=>{
  const a=r.getProfile(p.id);
  return a.name+" : PoE "+(a.poe?"oui":"non");
 }),"","ÉQUIPEMENTS DANS R2"];
 for(const a of r.listAssets())rows.push(a.name+" : "+r.getProfile(a.profileId).name+
  " | PoE "+(a.poe?"oui":"non")+
  " | ports Ethernet "+a.ports.length);
 $("state").textContent=rows.join("\n");
}
$("action").onclick=()=>{
 try{
  if(selected===1||selected===3){
   if(step===0){
    good(r.setProfilePoe(profiles[0].id,true));
    good(r.createAsset(profiles[0].id,{name:"SW04"}));
    step=1;
    $("action").textContent=selected===3?"Exporter et restaurer le registre":"Constater l'indépendance";
    $("result").textContent="SW01 reste non PoE ; SW04 est PoE. Aucun réglage par port.";
   }else if(selected===3){
    const state=r.exportState();
    r=restoreAssetRegistry(state);
    $("result").textContent="Export et restauration réussis : PoE conservé sur les modèles et équipements.";
   }else $("result").textContent="SW01 n'a pas changé. SW04 est PoE.";
  }else{
   const state=r.exportState();r=restoreAssetRegistry(state);
   $("result").textContent="Switch L2 et L3 : PoE oui, après export/restauration.";
  }
  render();
 }catch(e){$("result").textContent="Erreur : "+e.message;}
};
$("reset").onclick=()=>setup(selected);
$("tests").onclick=e=>{const b=e.target.closest("button[data-test]");if(b)setup(Number(b.dataset.test));};
setup(1);
