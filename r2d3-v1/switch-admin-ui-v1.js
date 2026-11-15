/*
 * Interface d'administration graphique des switchs L2/L3.
 * Uniquement une vue/commande : les configurations restent dans le registre R2,
 * et les mutations utilisent les adaptateurs réseau R2D3 communs.
 */
import {addSwitchVlan,setSwitchAccessPort,setSwitchTrunkPort} from "./vlan-v1.js";
import {configureSwitchManagementStatic,configureSwitchManagementDhcp} from "./switch-management-ip-v01.js";
const esc=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const num=x=>Number(x);
const resultLabel=x=>x?.message||x?.reason||x?.code||"Configuration refusée";
const opts=(items,selected)=>items.map(([v,t])=>'<option value="'+esc(v)+'"'+(String(v)===String(selected)?' selected':'')+'>'+esc(t)+'</option>').join("");
export function mountSwitchAdmin({root,registry,assetId}){
 if(!root||!registry?.getAsset)throw Error("Élément d'affichage ou registre R2 manquant");
 let current=assetId,tab="overview",message="",severity="ok";
 const tabTitle={overview:"Vue d'ensemble",vlans:"VLAN",ports:"Ports Ethernet",management:"Administration IPv4"};
 function asset(){
  const a=registry.getAsset(current);
  if(!a?.networkCapabilities?.includes("vlan"))throw Error("Switch L2/L3 administrable introuvable");
  return a;
 }
 function notify(out){
  severity=out?.success?"ok":"error";message=resultLabel(out);
  if(out?.success)render();
  else render();
 }
 function render(){
  const a=asset(),vlans=a.vlanConfig.vlans,ports=a.ports.filter(p=>p.type==="ethernet-rj45");
  const l3=a.networkCapabilities.includes("inter-vlan-routing"),mg=a.managementConfig;
  const label=v=>vlans.find(x=>x.id===v)?.number??"?";
  const tabs=Object.entries(tabTitle).map(([id,name])=>'<button type="button" role="tab" aria-selected="'+(tab===id)+'" data-tab="'+id+'">'+name+'</button>').join("");
  let content="";
  if(tab==="overview"){
   content='<div class="stats">'+
    '<div><small>Type de switch</small><strong>'+(l3?"Administrable L3":"Administrable L2")+'</strong></div>'+
    '<div><small>Ports Ethernet</small><strong>'+ports.length+'</strong></div>'+
    '<div><small>VLAN définis</small><strong>'+vlans.length+'</strong></div>'+
    '<div><small>PoE</small><strong>'+(a.poe?"Oui, automatique":"Non")+'</strong></div></div>'+
    '<div class="notice"><strong>Spanning Tree (STP)</strong> : actif automatiquement sur les switchs administrables, sans réglage.</div>'+
    '<div class="notice"><strong>PoE</strong> : caractéristique matérielle du modèle ; aucun interrupteur ni réglage par port.</div>'+
    '<div class="notice"><strong>Fonctions L3</strong> : '+(l3?"présentes sur ce switch. Configuration des interfaces VLAN, du routage, d’IP Helper et du DHCP dans le prochain lot.":"non disponibles sur un switch L2.")+'</div>';
  }else if(tab==="vlans"){
   content='<h2>VLAN du switch</h2><div class="vlan-list">'+vlans.map(v=>'<div class="vlan-line"><strong>VLAN '+esc(v.number)+'</strong><span>'+esc(v.name)+'</span></div>').join("")+'</div>'+
    '<h3>Créer un VLAN</h3><form data-form="vlan" class="fields"><label>Numéro de VLAN <input type="number" name="number" min="2" max="4094" required placeholder="10"></label>'+
    '<label>Nom du VLAN <input name="name" required maxlength="50" placeholder="Bureaux"></label><button type="submit" class="primary">Créer le VLAN</button></form>'+
    '<p class="hint">Les VLAN sont enregistrés sur cet équipement uniquement. VLAN 1 existe par défaut.</p>';
  }else if(tab==="ports"){
   content='<h2>Configuration des ports Ethernet</h2><div class="port-list">'+ports.map(p=>{
    const state=a.vlanConfig.ports[p.id],active=state.mode==="access";
    const vlanno=active?label(state.vlanId):null;
    const selected=active?[vlanno]:state.allowedVlanIds.map(label);
    return '<form data-form="port" class="port-line"><input type="hidden" name="portId" value="'+esc(p.id)+'"><div><strong>'+esc(p.name)+'</strong><small>'+esc(p.id)+'</small></div>'+
     '<label>Mode <select name="mode" aria-label="Mode du port '+esc(p.name)+'">'+opts([["access","Access"],["trunk","Trunk"]],state.mode)+'</select></label>'+
     '<label>VLAN (Access) ou VLAN autorisés (Trunk, séparés par des virgules)'+
      '<input name="vlans" value="'+esc(selected.join(", "))+'" aria-label="VLAN du port '+esc(p.name)+'" required></label>'+
     '<button type="submit">Appliquer</button></form>';
   }).join("")+'</div><p class="hint">Access : un VLAN. Trunk : plusieurs VLAN existants (exemple : 10, 20). Aucun port ne peut être désactivé individuellement.</p>';
  }else{
   const staticMode=mg.mode==="static";
   content='<h2>Adresse IPv4 de gestion</h2><p>Indépendante du routage des postes.</p><div class="notice">Mode courant : <strong>'+esc(mg.mode==="dhcp"?"DHCP":"Statique")+'</strong>'+
    (mg.address?' • '+esc(mg.address)+"/"+esc(mg.prefix):"")+'</div>'+
    '<form data-form="management" class="fields"><label>Mode <select name="mode">'+opts([["static","Statique"],["dhcp","DHCP"]],mg.mode)+'</select></label>'+
    '<label>Adresse IPv4 (mode statique)<input name="address" inputmode="decimal" placeholder="192.168.1.2" value="'+esc(staticMode?mg.address:"")+'"></label>'+
    '<label>Préfixe réseau (mode statique)<input type="number" name="prefix" min="1" max="30" placeholder="24" value="'+esc(staticMode?mg.prefix:"")+'"></label>'+
    '<label>Passerelle (facultative)<input name="gateway" inputmode="decimal" placeholder="192.168.1.1" value="'+esc(staticMode?mg.gateway:"")+'"></label>'+
    '<button type="submit" class="primary">Enregistrer</button></form>'+
    '<p class="hint">Le mode DHCP est enregistré sur le switch. L’obtention d’un bail nécessite un vrai serveur DHCP raccordé et sera vérifiée dans un scénario de réseau dédié.</p>';
  }
  root.innerHTML='<div class="switch-admin"><header class="switch-top"><div><span class="eyebrow">R2D3 • Administration réseau</span><h1>'+esc(a.name)+'</h1><p>'+esc(l3?"Switch administrable L3":"Switch administrable L2")+' · '+esc(a.status)+'</p></div><div class="switch-mark">SW</div></header>'+
   '<nav class="switch-tabs" role="tablist" aria-label="Administration du switch">'+tabs+'</nav>'+
   '<main class="switch-content" role="tabpanel"><div class="section-head"><strong>'+esc(tabTitle[tab])+'</strong><span>Configuration enregistrée dans R2D3</span></div>'+
   (message?'<p class="feedback '+severity+'" role="status">'+esc(message)+'</p>':"")+content+'</main></div>';
 }
 const onClick=e=>{const btn=e.target.closest("[data-tab]");if(!btn||!root.contains(btn))return;tab=btn.dataset.tab;message="";render();};
 const onSubmit=e=>{
  const form=e.target.closest("form[data-form]");if(!form||!root.contains(form))return;
  e.preventDefault();const data=new FormData(form),a=asset();let res;
  if(form.dataset.form==="vlan"){
   res=addSwitchVlan(registry,a.id,num(data.get("number")),String(data.get("name")).trim());
  }else if(form.dataset.form==="port"){
   const raw=String(data.get("vlans")).trim();
   const values=raw.split(",").map(v=>v.trim());
   const valid=values.every(v=>/^[0-9]{1,4}$/.test(v)&&Number(v)>=1&&Number(v)<=4094);
   if(!valid||!values.length){notify({success:false,message:"Saisis des numéros de VLAN valides, séparés par des virgules."});return;}
   const nums=values.map(Number);
   res=data.get("mode")==="trunk"?
    setSwitchTrunkPort(registry,a.id,String(data.get("portId")),nums):
    (nums.length===1?setSwitchAccessPort(registry,a.id,String(data.get("portId")),nums[0]):
     {success:false,message:"Un port Access appartient à un seul VLAN."});
  }else if(form.dataset.form==="management"){
   res=data.get("mode")==="dhcp"?configureSwitchManagementDhcp(registry,a.id):
    configureSwitchManagementStatic(registry,a.id,String(data.get("address")).trim(),
      num(data.get("prefix")),String(data.get("gateway")).trim()||null);
  }
  notify(res);
 };
 root.addEventListener("click",onClick);
 root.addEventListener("submit",onSubmit);
 render();
 return {refresh:render,setAssetId(id){current=id;tab="overview";message="";render();},destroy(){root.removeEventListener("click",onClick);root.removeEventListener("submit",onSubmit);root.replaceChildren();}};
}