import {createAssetRegistry,installScreenProfile,installDesktopProfile} from "./asset-profiles.js?computer-tabs-v1=ec692d9";
import {buildCablingViewModel, renderCablingVisual} from "../shared-ui/v1/cabling-visual.js";
import {connectNewCable,attachExistingCable,detachExistingCable} from "../shared-ui/v1/cabling-actions.js?connectique-v1=6e89bdd";
let engine=createAssetRegistry();
installScreenProfile(engine);
installDesktopProfile(engine);
const id=x=>document.getElementById(x);
const opt=(label,value)=>{const e=document.createElement("option");e.value=value;e.textContent=label;return e};
const status=(who,r)=>{id(who).textContent=r.message;id(who).className="notice "+(r.success?"good":"bad")};
const selectedProfile=()=>engine.getProfile(id("profiles").value);
const selectedAsset=()=>engine.getAsset(id("assets").value);
function refresh(){
 const ps=engine.listProfiles(),as=engine.listAssets(),oldP=id("profiles").value,oldCreateP=id("asset-profile").value,oldA=id("assets").value;
 id("profiles").replaceChildren(...ps.map(p=>opt(p.name,p.id)));
 if(ps.some(p=>p.id===oldP))id("profiles").value=oldP;
 id("asset-profile").replaceChildren(...ps.map(p=>opt(p.name,p.id)));
 if(ps.some(p=>p.id===oldCreateP))id("asset-profile").value=oldCreateP;
 else if(ps.some(p=>p.id===oldP))id("asset-profile").value=oldP;
 id("assets").replaceChildren(...as.map(a=>opt(a.name+" ("+(ps.find(p=>p.id===a.profileId)?.name||"?")+")",a.id)));
 if(as.some(a=>a.id===oldA))id("assets").value=oldA;
 renderPlaces();renderInfrastructure();renderCables();renderPathChoices();renderFields();renderAsset();renderBoxInternetChoices();refreshCablingVisual();
 if(networkAdmin&&networkAdminKind==="box")networkAdmin.render();
}
let visualSelectedPort=null,visualSelectedCable=null,visualPendingAttach=null;
let visualPathMode=false,visualPathPorts=[],visualPathCableIds=[];
function visualMessage(message,success=true){
 const out=id("cabling-visual-status");
 out.textContent=message;
 out.className="notice "+(success?"good":"bad");
}
function drawCablingVisual(){
 const picker=id("cabling-visual-place");
 const model=buildCablingViewModel(engine,picker.value);
 const currentPorts=new Set(engine.listCablePoints().map(p=>p.portId));
 if(visualSelectedPort&&!currentPorts.has(visualSelectedPort))visualSelectedPort=null;
 if(visualSelectedCable&&!engine.getCable(visualSelectedCable))visualSelectedCable=null;
 if(visualPendingAttach&&!engine.getCable(visualPendingAttach.cableId))visualPendingAttach=null;
 renderCablingVisual(id("cabling-visual"),model,{
  selectedPortId:visualSelectedPort,selectedCableId:visualSelectedCable,
  highlightedPortIds:visualPathPorts,highlightedCableIds:visualPathCableIds,
  onPortClick:visualPortClick,
  onPortDrop:(from,to)=>{
   if(visualPathMode){visualMessage("Le glisser-déposer est réservé au mode Branchement.",false);return;}
   visualConnect(from,to);
  },
  onCableSelect:cableId=>{
   visualSelectedCable=visualSelectedCable===cableId?null:cableId;
   visualSelectedPort=null;visualPendingAttach=null;
   visualMessage(visualSelectedCable?"Câble "+cableId+" sélectionné.":"Sélection annulée.");
   drawCablingVisual();
  },
  onDisconnect:(cableId,end)=>{
   const r=detachExistingCable(engine,cableId,end);
   visualMessage(r.message,r.success);if(r.success)refresh();else drawCablingVisual();
  },
  onAttach:(cableId,end)=>{
   visualPendingAttach={cableId,end};visualSelectedPort=null;
   visualMessage("Clique sur le port où raccorder l'extrémité "+(end?"B":"A")+" de "+cableId+".");
   drawCablingVisual();
  },
  onDelete:cableId=>{
   const r=engine.deleteCable(cableId);
   if(r.success){visualSelectedCable=null;visualPendingAttach=null;}
   visualMessage(r.message,r.success);refresh();
  }
 });
}
function visualConnect(from,to){
 if(visualPathMode){visualMessage("Sélectionne le mode Branchement pour connecter des ports.",false);return;}
 visualPathPorts=[];visualPathCableIds=[];
 const r=connectNewCable(engine,from,to);
 if(r.success){visualSelectedCable=r.cableId;visualSelectedPort=null;visualPendingAttach=null;}
 visualMessage(r.message,r.success);
 if(r.success)refresh();else drawCablingVisual();
}
function visualPortClick(portId){
 if(visualPathMode){
  if(visualPathPorts.length!==1){visualPathPorts=[portId];visualPathCableIds=[];visualMessage("Point de départ sélectionné. Choisis le point d’arrivée.");drawCablingVisual();return;}
  const from=visualPathPorts[0],result=engine.explorePhysicalPath(from,portId);
  visualPathPorts=result.success&&result.connected?result.path.map(p=>p.portId):[from,portId];
  visualPathCableIds=result.success&&result.connected?result.segments.filter(s=>s.kind==="cable").map(s=>s.id):[];
  visualMessage(result.message,result.success&&result.connected);
  drawCablingVisual();return;
 }
 const p=engine.listCablePoints().find(x=>x.portId===portId);
 if(!p)return;
 if(visualPendingAttach){
  const {cableId,end}=visualPendingAttach;
  const r=attachExistingCable(engine,cableId,end,portId);
  if(r.success){visualPendingAttach=null;visualSelectedCable=cableId;}
  visualMessage(r.message,r.success);
  if(r.success)refresh();else drawCablingVisual();
  return;
 }
 if(p.occupied){
  if(visualSelectedPort){visualMessage("Port déjà occupé. Choisis un port libre.",false);drawCablingVisual();return;}
  const c=engine.listCables().find(c=>c.ends.some(end=>end?.portId===portId));
  visualSelectedPort=null;visualSelectedCable=c?.id??null;
  visualMessage(c?"Port raccordé à "+c.id+". Sélectionne une extrémité du câble pour la débrancher.":"Port occupé.");
  drawCablingVisual();return;
 }
 if(visualSelectedPort===portId){
  visualSelectedPort=null;visualMessage("Sélection du port annulée.");drawCablingVisual();return;
 }
 if(visualSelectedPort){visualConnect(visualSelectedPort,portId);return;}
 visualSelectedPort=portId;visualSelectedCable=null;
 visualMessage("Premier port sélectionné. Clique sur un second port libre pour créer le câble, ou fais glisser un port vers l'autre.");
 drawCablingVisual();
}
function refreshCablingVisual() {
 const picker=id("cabling-visual-place"), previous=picker.value, places=engine.listPlaces();
 picker.replaceChildren(opt("Tous les lieux",""),...places.map(p=>opt(placeLabel(p,places),p.id)));
 if(places.some(p=>p.id===previous))picker.value=previous;
 drawCablingVisual();
}
function placeLabel(place,all){
 const names=[place.name];let current=place,seen=new Set([place.id]);
 while(current.parentId){
  current=all.find(x=>x.id===current.parentId);
  if(!current||seen.has(current.id))break;
  seen.add(current.id);names.unshift(current.name);
 }
 return names.join(" / ");
}
function renderPlaces(){
 const all=engine.listPlaces(),parent=id("place-parent"),old=parent.value;
 parent.replaceChildren(opt("Aucun (racine)",""),...all.map(p=>opt(placeLabel(p,all),p.id)));
 if(old===""||all.some(p=>p.id===old))parent.value=old;
 const host=id("place-list");host.replaceChildren();
 const summary=document.createElement("p");summary.textContent=all.length+" lieu(x) disponible(s).";host.append(summary);
 for(const place of all){
  const p=document.createElement("p");p.textContent=placeLabel(place,all);host.append(p);
 }
 const panelPlace=id("panel-place"),previousPanelPlace=panelPlace.value;
 panelPlace.replaceChildren(...all.map(p=>opt(placeLabel(p,all),p.id)));
 if(all.some(p=>p.id===previousPanelPlace))panelPlace.value=previousPanelPlace;
 id("panel-create").querySelector("button").disabled=!all.length;
 const select=id("asset-place"),a=selectedAsset();
 select.replaceChildren(opt("Aucun lieu",""),...all.map(p=>opt(placeLabel(p,all),p.id)));
 select.value=a?.placeId||"";
 id("asset-place-change").querySelectorAll("select,button").forEach(control=>control.disabled=!a);
 id("asset-current-place").textContent=a?"Lieu actuel : "+(all.find(p=>p.id===a.placeId)?placeLabel(all.find(p=>p.id===a.placeId),all):"Aucun lieu"):"";
}
function renderInfrastructure(){
 const host=id("infrastructure-list");host.replaceChildren();
 const outlets=engine.listWallOutlets(),panels=engine.listPanels(),places=engine.listPlaces();
 const summary=document.createElement("p");
 summary.textContent=outlets.length+" prise(s), "+panels.length+" panneau(x) de brassage.";
 host.append(summary);
 for(const outlet of outlets){
  const p=document.createElement("p");p.textContent="Prise "+outlet.name+" ("+outlet.location+") : avant / arrière";
  host.append(p);
 }
 for(const panel of panels){
  const place=places.find(p=>p.id===panel.placeId);
  const p=document.createElement("p");
  p.textContent="Panneau "+panel.name+" ("+(place?placeLabel(place,places):"lieu inconnu")+") : "+
   panel.ports.length+" port(s), avant / arrière";
  host.append(p);
 }
 const selected=id("panels"),old=selected.value;
 selected.replaceChildren(...panels.map(p=>opt(p.name+" ("+placeLabel(places.find(x=>x.id===p.placeId),places)+")",p.id)));
 if(panels.some(p=>p.id===old))selected.value=old;
 const panel=engine.getPanel(selected.value),destination=id("panel-destination"),previous=destination.value;
 destination.replaceChildren(...places.map(p=>opt(placeLabel(p,places),p.id)));
 if(panel)destination.value=panel.placeId;
 else if(places.some(p=>p.id===previous))destination.value=previous;
 id("panel-move").querySelectorAll("select,button").forEach(control=>control.disabled=!panel);
 id("panel-delete").disabled=!panel;
}

function renderPathChoices(){
 const form=id("path-search"),points=engine.listCablePoints();
 for(const key of ["from","to"]){
  const select=form.elements[key],old=select.value;
  select.replaceChildren(...points.map(p=>opt(p.assetName+" / "+p.portName,p.portId)));
  if(points.some(p=>p.portId===old))select.value=old;
 }
}
function pathLabel(p){
 return p.assetName+" / "+p.portName;
}
function showPathResult(r){
 const host=id("path-result");
 if(!r.success){status("path-result",r);return}
 host.className="notice "+(r.connected?"good":"bad");
 if(r.connected){
  host.textContent=r.message+" "+r.path.map(pathLabel).join(" → ")+
   " ; câbles : "+r.segments.filter(x=>x.kind==="cable").map(x=>x.id).join(", ");
 }else{
  host.textContent=r.message+
   " Depuis le départ : "+r.fromReachable.map(pathLabel).join(" → ")+
   " ; depuis l'arrivée : "+r.toReachable.map(pathLabel).join(" → ")+
   ". Aucun tronçon manquant n'est proposé automatiquement.";
 }
}
function renderCables(){
 const all=engine.listCables(),select=id("cables"),was=select.value;
 select.replaceChildren(...all.map(c=>opt(c.id,c.id)));
 if(all.some(c=>c.id===was))select.value=was;
 const cable=engine.getCable(select.value);
 const ports=engine.listCablePoints();
 for(let i=0;i<2;i++){
  const form=id(i?"cable-end-b":"cable-end-a"),choice=form.elements.port,prior=choice.value;
  choice.replaceChildren(...ports.map(p=>opt(p.assetName+" / "+p.portName+(p.occupied?" (occupé)":""),p.portId)));
  if(ports.some(p=>p.portId===prior))choice.value=prior;
  const disabled=!cable;form.querySelectorAll("select,button").forEach(e=>e.disabled=disabled);
 }
 id("cable-delete").disabled=!cable;
 id("cable-info").textContent=cable
  ?"Câble "+cable.id+" : A ("+cable.connectors[0]+") → "+describePoint(cable.ends[0],ports)
   +" ; B ("+cable.connectors[1]+") → "+describePoint(cable.ends[1],ports)
  :"Aucun câble.";
}
function describePoint(end,ports){
 if(!end)return "libre";
 const p=ports.find(x=>x.portId===end.portId);
 return p?p.assetName+" / "+p.portName:"port absent";
}
const capabilityChoices=[
 ["ethernet-switching","Commutation Ethernet"],
 ["vlan","VLAN"],
 ["inter-vlan-routing","Routage inter-VLAN"],
 ["ip-helper","IP Helper"],
 ["dhcp-server","Serveur DHCP"],
 ["ipv4-router","Routeur IPv4"],
 ["wifi-ap","Point d'accès Wi-Fi"]
];
function renderCapabilities(){
 const profile=selectedProfile(),host=id("profile-capabilities"),poe=id("profile-poe");
 host.replaceChildren();
 for(const [value,title] of capabilityChoices){
  const label=document.createElement("label"),control=document.createElement("input");
  control.type="checkbox";control.value=value;
  control.checked=!!profile?.networkCapabilities?.includes(value);
  control.disabled=!profile;
  control.onchange=()=>{
   const r=engine.setProfileNetworkCapability(profile.id,value,control.checked);
   status("profile-status",r);refresh();
  };
  label.append(control,document.createTextNode(title));host.append(label);
 }
 poe.disabled=!profile;
 poe.checked=!!profile?.poe;
}
id("profile-poe").onchange=e=>{
 const profile=selectedProfile();
 if(!profile)return;
 const r=engine.setProfilePoe(profile.id,e.currentTarget.checked);
 status("profile-status",r);refresh();
};
function renderPortGroups(){
 const p=selectedProfile(),host=id("port-groups");host.replaceChildren();
 if(!p)return;
 for(const g of p.portGroups||[]){
  const row=document.createElement("div");row.className="item";
  const label=document.createElement("span");
  label.textContent=g.prefix+String(g.start).padStart(g.digits,"0")+
    " à "+g.prefix+String(g.start+g.count-1).padStart(g.digits,"0")+
    " ("+g.count+", "+g.type+")";
  const remove=document.createElement("button");remove.type="button";remove.className="subtle";remove.textContent="Retirer du profil";
  remove.onclick=()=>{status("profile-status",engine.removePortGroup(p.id,g.id));refresh()};
  row.append(label,remove);host.append(row);
 }
}
function renderAssetPorts(){
 const a=selectedAsset(),host=id("asset-ports");host.replaceChildren();
 if(!a){host.textContent="Crée un actif pour afficher ses ports.";return}
 if(!a.ports.length){host.textContent="Aucun port ni interface.";return}
 const extensions=new Map();
 for(const p of a.ports.filter(p=>!a.boxConfig?.internalPortIds?.includes(p.id)&&p.type!=="wifi")){
  const row=document.createElement("div");row.className="item";
  const caption=document.createElement("span");
  caption.textContent=p.name+" : "+p.type+(p.origin==="integrated"?" (intégré)":" (extension)");
  row.append(caption);host.append(row);
  if(p.origin==="extension")extensions.set(p.groupId,true);
 }
 for(const extId of extensions.keys()){
  const button=document.createElement("button");button.className="subtle";button.textContent="Retirer l’extension "+extId;
  button.onclick=()=>{status("asset-status",engine.removeExtension(a.id,extId));refresh()};
  host.append(button);
 }
}
function renderFieldEditor(){
 const p=selectedProfile(),fieldSelect=id("edit-field-key"),previous=fieldSelect.value;
 fieldSelect.replaceChildren(...(p?.fields||[]).map(f=>opt(f.label,f.key)));
 if(p?.fields.some(f=>f.key===previous))fieldSelect.value=previous;
 const f=p?.fields.find(x=>x.key===fieldSelect.value);
 const form=id("field-edit");
 form.querySelectorAll("input,select,button").forEach(control=>{if(control!==fieldSelect)control.disabled=!f});
 form.elements.label.value=f?.label||"";
 form.elements.type.value=f?.type||"text";
 form.elements.unit.value=f?.unit||"";
 form.elements.options.value=f?.options?.join(", ")||"";
}
function renderFields(){
 const p=selectedProfile(),host=id("fields");host.replaceChildren();
 renderCapabilities();
 id("profile-rename").elements.name.value=p?.name||"";
 if(!p){host.textContent="Crée un profil pour commencer.";renderFieldEditor();renderPortGroups();return}
 if(!p.fields.length){host.textContent="Aucun champ personnalisé.";renderFieldEditor();renderPortGroups();return}
 p.fields.forEach((f,i)=>{
  const wrap=document.createElement("div");wrap.className="item";
  const label=document.createElement("span");label.textContent=f.label+" ("+f.type+(f.unit?", "+f.unit:"")+")";
  const controls=document.createElement("span");
  for(const [caption,action,disabled] of [["↑",()=>engine.moveField(p.id,f.key,i-1),i===0],["↓",()=>engine.moveField(p.id,f.key,i+1),i===p.fields.length-1],["Supprimer",()=>engine.removeField(p.id,f.key),false]]){
   const b=document.createElement("button");b.className="subtle";b.textContent=caption;b.disabled=disabled;b.onclick=()=>{status("profile-status",action());refresh()};controls.append(b);
  }
  wrap.append(label,controls);host.append(wrap);
 });
 renderFieldEditor();renderPortGroups();
}
// Recette d'intégration Internet sur les actifs du même registre R2D3.
const internetServices={
 http:{id:"http-internet",address:"80.10.246.50",kind:"http",available:true},
 dns:{id:"dns-orange",address:"80.10.246.2",kind:"dns",available:true}
};
let internetModule=null;
const verifiedInternet=new Map();
function internetObservation(boxId){
 const evidence=verifiedInternet.get(boxId);
 if(!evidence||evidence.revision!==engine.exportState().revision)return null;
 const box=engine.getAsset(boxId);
 if(!box||box.status!=="En service")return null;
 const wan=engine.getBoxWanEffective?.(boxId);
 if(!wan||wan.address!==evidence.wanAddress)return null;
 return {connected:true,wanAddress:evidence.wanAddress};
}
function updateInternetAdmin(boxId){
 if(networkAdmin&&networkAdminAssetId===boxId&&networkAdminKind==="box")networkAdmin.render();
}
function renderBoxInternetChoices(){
 const boxes=engine.listAssets().filter(a=>a.boxConfig);
 const clients=engine.listAssets().filter(a=>!a.boxConfig&&
  a.ports.some(p=>["ethernet-rj45","wifi"].includes(p.type)));
 for(const [target,values] of [["box-internet-box",boxes],["box-internet-client",clients]]){
  const select=id(target),previous=select.value;
  select.replaceChildren(...values.map(a=>opt(a.name,a.id)));
  if(values.some(a=>a.id===previous))select.value=previous;
 }
 refreshInternetClientConfig();
 id("box-internet-integration-form").querySelector("button").disabled=!boxes.length||!clients.length;
}
function refreshInternetClientConfig(){
 const client=engine.getAsset(id("box-internet-client").value);
 const medium=id("box-internet-medium"),previous=medium.value;
 const optionsMedium=[];
 if(client?.ports.some(p=>p.type==="ethernet-rj45"))optionsMedium.push(["ethernet","Ethernet"]);
 if(client?.ports.some(p=>p.type==="wifi"))optionsMedium.push(["wifi","Wi-Fi"]);
 medium.replaceChildren(...optionsMedium.map(([value,label])=>opt(label,value)));
 if(optionsMedium.some(([value])=>value===previous))medium.value=previous;
 refreshInternetWifiConfig();
}
function refreshInternetWifiConfig(){
 const isWifi=id("box-internet-medium").value==="wifi";
 id("box-internet-ssid-field").hidden=!isWifi;
 id("box-internet-password-field").hidden=!isWifi;
 const box=engine.getAsset(id("box-internet-box").value);
 const ssids=box?.boxConfig?.wifi?.ssids??[];
 const field=id("box-internet-ssid"),previous=field.value;
 field.replaceChildren(...ssids.map(ssid=>opt(ssid.name+(ssid.enabled?"":" (désactivé)"),ssid.id)));
 if(ssids.some(x=>x.id===previous))field.value=previous;
 id("box-internet-password").disabled=!isWifi;
 field.disabled=!isWifi;
 const bridge=box?.boxConfig?.mode==="bridge";
 const medium=id("box-internet-medium");
 if(bridge&&[...medium.options].some(o=>o.value==="ethernet"))medium.value="ethernet";
 id("box-internet-ssid-field").hidden=bridge||medium.value!=="wifi";
 id("box-internet-password-field").hidden=bridge||medium.value!=="wifi";
 const staticBridge=bridge&&box.boxConfig.wan.mode==="static";
 id("box-internet-bridge-fields").hidden=!bridge;
 id("box-internet-bridge-static-fields").hidden=!staticBridge;
 id("box-internet-bridge-dhcp-note").hidden=!bridge||staticBridge;
 if(staticBridge){
  const wan=engine.getBoxWanEffective?.(box.id);
  const expected={
   "box-internet-bridge-address":wan?.address??"",
   "box-internet-bridge-prefix":wan?.prefix??"",
   "box-internet-bridge-gateway":wan?.gateway??"",
   "box-internet-bridge-dns1":wan?.dns?.[0]??"",
   "box-internet-bridge-dns2":wan?.dns?.[1]??""
  };
  for(const [name,value] of Object.entries(expected))id(name).value=String(value);
 }
 for(const name of ["box-internet-bridge-address","box-internet-bridge-prefix","box-internet-bridge-gateway","box-internet-bridge-dns1","box-internet-bridge-dns2"]){
  id(name).required=staticBridge;
  id(name).disabled=!staticBridge;
 }
}
id("box-internet-box").onchange=refreshInternetWifiConfig;
id("box-internet-client").onchange=refreshInternetClientConfig;
id("box-internet-medium").onchange=refreshInternetWifiConfig;
id("box-internet-integration-form").onsubmit=async e=>{
 e.preventDefault();
 const form=e.currentTarget,boxId=form.elements.boxId.value,clientId=form.elements.clientId.value;
 const type=form.elements.service.value,service=internetServices[type];
 const medium=form.elements.medium.value;
 const clientEntry={assetId:clientId,medium};
 if(medium==="wifi"){
  clientEntry.ssidId=form.elements.ssidId.value;
  clientEntry.password=form.elements.wifiPassword.value;
 }
 verifiedInternet.delete(boxId);
 updateInternetAdmin(boxId);
 const output=id("box-internet-integration-result");
 output.textContent="Vérification des paramètres et du raccordement réseau…";
 if(!engine.getAsset(boxId)?.boxConfig||!engine.getAsset(clientId)||!service){
  output.textContent="Sélection de box, PC ou service invalide.";output.className="notice bad";return;
 }
 try{
  internetModule??=await import("https://chaoli22000bzh.github.io/R2D3/src/box-internet-v1.js?dhcp-bridge=eb57b13");
  // Aucun faux câble Wi-Fi : association à la vraie borne interne et contrôle
  // des radios/SSID/sécurité par le module partagé, puis bail du Core DHCP.
  const bridge=engine.getAsset(boxId).boxConfig.mode==="bridge";
  const session=bridge?
   internetModule.createBoxBridgeInternetSession({registry:engine,boxId,
    clients:[clientEntry],services:Object.values(internetServices)}):
   internetModule.createBoxInternetSession({registry:engine,boxId,
    clients:[clientEntry],services:Object.values(internetServices)});
  if(!session.success){output.textContent="ÉCHEC : "+(session.message||session.code);output.className="notice bad";updateInternetAdmin(boxId);return;}
  const result=session.request({clientId,targetAddress:service.address,service:service.kind,
   ...(bridge&&engine.getAsset(boxId).boxConfig.wan.mode==="static"?{clientIpv4:{
    mode:"static",address:form.elements.bridgeAddress.value.trim(),
    prefix:Number(form.elements.bridgePrefix.value),
    gateway:form.elements.bridgeGateway.value.trim(),
    dns:[form.elements.bridgeDns1.value.trim(),form.elements.bridgeDns2.value.trim()].filter(Boolean)}}:{})});
  if(!result.success){
   output.textContent="ACCÈS REFUSÉ : "+result.code+" : "+(result.message||"Communication impossible.");
   output.className="notice bad";updateInternetAdmin(boxId);return;
  }
  verifiedInternet.set(boxId,{revision:engine.exportState().revision,wanAddress:bridge?engine.getBoxWanEffective(boxId)?.address:result.nat.externalAddress});
  updateInternetAdmin(boxId);
  if(bridge){
   output.textContent="ACCÈS INTERNET BRIDGE CONFORME\n"+
    "Connexion du PC : Ethernet, LAN 1 vers WAN\n"+
    "PC : "+result.client.address+"/"+result.client.prefix+" ("+(result.client.mode==="dhcp"?"DHCP Internet":"IPv4 statique")+")\n"+
    "Passerelle : "+result.route.gateway+"\n"+
    "DNS : "+result.client.dns.join(", ")+"\n"+
    "Service Internet : "+result.target.address+":"+result.target.port+" ("+result.service+")\n"+
    "NAT/PAT : inactif, aucune translation\n"+
    "Translations de cette session : "+session.listNat().length;
  }else{
   output.textContent="ACCÈS INTERNET SIMULÉ CONFORME\n"+
    "Connexion du PC : "+(medium==="wifi"?"Wi-Fi (SSID "+(session.lanSession.clients[0]?.association?.ssid??"?")+")":"Ethernet")+"\n"+
    "PC : "+result.nat.internalAddress+":"+result.nat.internalPort+"\n"+
    "Passerelle LAN : "+result.route.gateway+"\n"+
    "PAT : "+result.nat.externalAddress+":"+result.nat.externalPort+"\n"+
    "Service Internet : "+result.target.address+":"+result.target.port+" ("+result.service+")\n"+
    "Passerelle WAN : "+result.route.wanGateway+"\n"+
    "Translations de cette session : "+session.listNat().length;
  }
  output.className="notice good";
 }catch(error){
  output.textContent="Impossible d'exécuter le moteur Internet : "+(error?.message||String(error));
  output.className="notice bad";updateInternetAdmin(boxId);
 }
};
// Administrations réseau : mêmes composants publiés R2D3, même registre métier.
const administrationKinds={
 box:{title:"Administration de la box Internet",moduleUrl:"https://chaoli22000bzh.github.io/R2D3/src/box-admin-ui-v1.js?ssid-v1=5211727",mount:"mountBoxAdmin"},
 switch:{title:"Administration du switch",moduleUrl:"https://chaoli22000bzh.github.io/R2D3/src/switch-admin-ui-v1.js",mount:"mountSwitchAdmin"},
 router:{title:"Administration du routeur",moduleUrl:"https://chaoli22000bzh.github.io/R2D3/src/router-admin-ui-v1.js?pat-actions=28454a0",mount:"mountRouterAdmin"},
 wifi:{title:"Administration de la borne Wi-Fi",moduleUrl:"https://chaoli22000bzh.github.io/R2D3/src/wifi-admin-ui-v1.js",mount:"mountWifiAdmin"}
};
let networkAdmin=null,networkAdminAssetId=null,networkAdminKind=null;
const adminModules={};
const networkAdminRoot=()=>id("switch-admin-root");
function kindForAsset(asset){
 if(asset?.boxConfig)return "box";
 if(asset?.networkCapabilities?.includes("ipv4-router"))return "router";
 if(asset?.networkCapabilities?.includes("vlan"))return "switch";
 if(asset?.networkCapabilities?.includes("wifi-ap"))return "wifi";
 return null;
}
function closeNetworkAdmin(){
 if(networkAdmin){
  if(typeof networkAdmin.destroy==="function")networkAdmin.destroy();
  else { // L'interface Wi-Fi V1 expose render/save mais pas destroy.
   networkAdminRoot().onclick=null;
   networkAdminRoot().replaceChildren();
   networkAdminRoot().classList.remove("wifi-admin");
  }
  networkAdmin=null;
 }
 networkAdminAssetId=null;networkAdminKind=null;
 id("switch-admin-section").hidden=true;
 id("switch-admin-open").textContent="Ouvrir l'administration";
 id("switch-admin-message").textContent="";
}
function updateNetworkAdminSelection(asset){
 const kind=kindForAsset(asset);
 id("switch-admin-controls").hidden=!kind;
 if(kind)id("network-admin-control-title").textContent=administrationKinds[kind].title;
 if(!kind||networkAdminAssetId!==asset?.id||networkAdminKind!==kind)closeNetworkAdmin();
}
id("switch-admin-open").onclick=async()=>{
 const asset=selectedAsset(),kind=kindForAsset(asset);
 if(!kind)return;
 if(networkAdmin&&networkAdminAssetId===asset.id&&networkAdminKind===kind){closeNetworkAdmin();return;}
 const button=id("switch-admin-open"),config=administrationKinds[kind];
 button.disabled=true;
 id("switch-admin-message").textContent="Chargement de l'interface R2D3…";
 try{
  adminModules[kind]??=await import(config.moduleUrl);
  if(selectedAsset()?.id!==asset.id)return;
  closeNetworkAdmin();
  networkAdmin=adminModules[kind][config.mount]({root:networkAdminRoot(),registry:engine,assetId:asset.id,
   getInternetStatus:internetObservation,onChange:()=>{
     refreshInternetWifiConfig();
     verifiedInternet.delete(asset.id);
    }});
  networkAdminAssetId=asset.id;networkAdminKind=kind;
  id("switch-admin-section").hidden=false;
  id("switch-admin-section").scrollIntoView({behavior:"smooth",block:"start"});
  button.textContent="Fermer l'administration";
 }catch(error){
  closeNetworkAdmin();
  id("switch-admin-message").textContent="Impossible d'ouvrir l'interface : "+(error?.message||String(error));
 }finally{button.disabled=false;}
};
function renderAsset(){
 const a=selectedAsset(),host=id("asset-values"),form=id("asset-edit");host.replaceChildren();
 form.querySelectorAll("input,select,button").forEach(control=>control.disabled=!a);
 id("asset-remove").disabled=!a;
 id("extension-create").querySelectorAll("input,select,button").forEach(control=>control.disabled=!a);
 renderAssetPorts();renderPlaces();
 updateNetworkAdminSelection(a);
 if(a){
  for(const key of ["name","manufacturer","model","serialNumber","status","location"])form.elements[key].value=a[key]??"";
  form.elements.reservable.checked=!!a.reservable;
 }else{
  form.reset();
 }
 if(!a){host.textContent="Crée un actif.";renderComputerTabs();return}
 const p=engine.getProfile(a.profileId);
 for(const f of p.fields){
  if(computerProfile(p)){
   const cpu=a.processors||[],ram=a.ramModules||[],disks=a.disks||[];
   if(f.key==="processeur_modele"&&cpu.length)continue;
   const summary=f.key==="processeur_marque"&&cpu.length?cpu.map(c=>(c.marque+" "+c.modele).trim()).join(" ; "):
    f.key==="ram_go"&&ram.length?ram.reduce((sum,c)=>sum+c.capaciteGo*c.quantite,0)+" Go":
    f.key==="stockage_go"&&disks.length?disks.reduce((sum,c)=>sum+c.capaciteGo*c.quantite,0)+" Go":null;
   if(summary!==null){
    const wrap=document.createElement("label");wrap.textContent=f.key==="processeur_marque"?"Processeur":f.label;
    const line=document.createElement("span");line.textContent=summary;line.className="component-derived";
    wrap.append(line);host.append(wrap);continue;
   }
  }
  const label=document.createElement("label");label.textContent=f.label+(f.unit?" ("+f.unit+")":"");
  let input;if(f.type==="select"||f.type==="boolean"){
   input=document.createElement("select");input.append(opt("Non renseigné",""));
   const options=f.type==="boolean"?[["Oui","true"],["Non","false"]]:f.options.map(v=>[v,v]);
   options.forEach(([name,value])=>input.append(opt(name,value)));
   input.value=a.values[f.key]===null?"":String(a.values[f.key]);
  }else{
   input=document.createElement("input");input.type=f.type==="number"?"number":f.type==="date"?"date":"text";
   input.value=a.values[f.key]??"";if(f.type==="number")input.step="any";
   if(p.name==="Écran"){
    const examples={resolution:"1920 × 1080",haut_parleurs:"Non ou 2x3W",pied_reglable:"Non ou 150mm",vesa:"Non ou 150x150mm"};
    if(examples[f.key])input.placeholder=examples[f.key];
   }
  }
  input.onchange=()=>{
   const v=input.value===""?null:f.type==="number"?Number(input.value):f.type==="boolean"?input.value==="true":input.value;
   status("asset-status",engine.setAssetField(a.id,f.key,v));
  };
  label.append(input);host.append(label);
 }
 renderComputerTabs();
}


const componentFields={
 cpu:[["marque","Marque","text"],["modele","Modèle","text"],["frequenceMHz","Fréquence (MHz)","number"],["coeurs","Cœurs","number"],["threads","Threads","number"]],
 ram:[["marque","Marque","text"],["modele","Modèle","text"],["type","Type (DDR4, DDR5...)","text"],["frequenceMHz","Fréquence (MHz)","number"],["capaciteGo","Capacité unitaire (Go)","number"],["quantite","Quantité","number"]],
 disk:[["marque","Marque","text"],["modele","Modèle","text"],["type","Type (SSD, HDD...)","text"],["interface","Interface (SATA, NVMe...)","text"],["capaciteGo","Capacité unitaire (Go)","number"],["quantite","Quantité","number"],["numeroSerie","N° de série","text"]]
};
let computerTab="general",componentSelected=null,componentEditing=null;
const computerProfile=p=>!!p&&(p.name==="PC fixe"||p.name.startsWith("PC fixe -"));
const componentItems=(a,kind)=>kind==="cpu"?(a.processors||[]):kind==="ram"?(a.ramModules||[]):(a.disks||[]);
const componentSummary=(c,kind)=>{
 const main=(c.marque+" "+c.modele).trim();
 if(kind==="cpu")return main+" · "+(c.frequenceMHz??"—")+" MHz · "+(c.coeurs??"—")+" cœurs · "+(c.threads??"—")+" threads";
 if(kind==="ram")return main+" · "+c.quantite+" × "+c.capaciteGo+" Go · "+c.type+" · "+(c.frequenceMHz??"—")+" MHz";
 return main+" · "+c.quantite+" × "+c.capaciteGo+" Go · "+c.type+" · "+c.interface+(c.numeroSerie?" · S/N "+c.numeroSerie:"");
};
function renderComputerTabs(){
 const a=selectedAsset(),p=a&&engine.getProfile(a.profileId),eligible=computerProfile(p);
 id("computer-tabs").hidden=!eligible;
 id("computer-general").hidden=eligible&&computerTab!=="general";
 id("computer-components").hidden=!eligible||computerTab!=="components";
 for(const tab of ["general","components"])id("computer-tab-"+tab).setAttribute("aria-pressed",String(computerTab===tab));
 if(eligible)renderComponents();
}
function renderComponents(){
 const a=selectedAsset(),kind=id("component-kind").value,list=id("component-list");
 list.replaceChildren();
 if(!a)return;
 const items=componentItems(a,kind);
 if(!items.some(x=>x.id===componentSelected))componentSelected=null;
 if(items.length===0){const p=document.createElement("p");p.textContent="Aucun composant renseigné.";list.append(p);}
 for(const component of items){
  const button=document.createElement("button");button.type="button";button.className="component-row";
  button.setAttribute("role","radio");button.setAttribute("aria-checked",String(component.id===componentSelected));
  const symbol=document.createElement("span");symbol.textContent=component.id===componentSelected?"◉":"○";
  const details=document.createElement("span");details.textContent=componentSummary(component,kind);
  button.append(symbol,details);
  button.onclick=()=>{componentSelected=component.id;hideComponentForms();renderComponents();};
  list.append(button);
 }
 id("component-edit").disabled=!componentSelected;
 id("component-delete").disabled=!componentSelected;
}
function hideComponentForms(){
 id("component-form").hidden=true;id("component-confirm").hidden=true;componentEditing=null;
}
function componentOpenForm(edit=false){
 const a=selectedAsset();if(!a)return;
 const kind=id("component-kind").value;
 const current=edit?componentItems(a,kind).find(x=>x.id===componentSelected):null;
 if(edit&&!current)return;
 hideComponentForms();
 componentEditing=current?.id??null;
 id("component-form-title").textContent=edit?"Modifier le composant":"Ajouter un composant";
 const host=id("component-form-fields");host.replaceChildren();
 for(const [key,title,type] of componentFields[kind]){
  const label=document.createElement("label");label.textContent=title;
  const input=document.createElement("input");input.name=key;input.type=type;input.value=current?.[key]??(key==="quantite"?"1":"");
  if(type==="number"){input.min="1";input.step=["frequenceMHz","capaciteGo"].includes(key)?"any":"1";}
  if(["marque","modele"].includes(key)||["quantite","capaciteGo"].includes(key))input.required=true;
  label.append(input);host.append(label);
 }
 id("component-form").hidden=false;
}
id("computer-tab-general").onclick=()=>{computerTab="general";hideComponentForms();renderAsset();};
id("computer-tab-components").onclick=()=>{computerTab="components";hideComponentForms();renderAsset();};
id("component-kind").onchange=()=>{componentSelected=null;hideComponentForms();renderComponents();};
id("component-add").onclick=()=>componentOpenForm(false);
id("component-edit").onclick=()=>componentOpenForm(true);
id("component-cancel").onclick=hideComponentForms;
id("component-delete").onclick=()=>{
 const a=selectedAsset(),kind=id("component-kind").value;
 const component=a&&componentItems(a,kind).find(x=>x.id===componentSelected);if(!component)return;
 hideComponentForms();id("component-confirm-label").textContent="Supprimer « "+componentSummary(component,kind)+" » ?";
 id("component-confirm").hidden=false;
};
id("component-delete-cancel").onclick=hideComponentForms;
id("component-delete-confirm").onclick=()=>{
 const a=selectedAsset(),kind=id("component-kind").value;if(!a||!componentSelected)return;
 const r=kind==="cpu"?engine.removeAssetProcessor(a.id,componentSelected):engine.removeAssetComponent(a.id,kind,componentSelected);
 status("asset-status",r);
 if(r.success){componentSelected=null;hideComponentForms();renderAsset();}
};
id("component-form").onsubmit=e=>{
 e.preventDefault();
 const a=selectedAsset();if(!a)return;
 const kind=id("component-kind").value,raw=Object.fromEntries(new FormData(e.currentTarget));
 const r=kind==="cpu"?(componentEditing?engine.updateAssetProcessor(a.id,componentEditing,raw):engine.addAssetProcessor(a.id,raw)):
    (componentEditing?engine.updateAssetComponent(a.id,kind,componentEditing,raw):engine.addAssetComponent(a.id,kind,raw));
 status("asset-status",r);
 if(r.success){hideComponentForms();renderAsset();}
};

id("path-search").onsubmit=e=>{
 e.preventDefault();const {from,to}=e.currentTarget.elements;
 showPathResult(engine.explorePhysicalPath(from.value,to.value));
};
id("outlet-create").onsubmit=e=>{
 e.preventDefault();
 const r=engine.createWallOutlet(Object.fromEntries(new FormData(e.currentTarget)));
 status("infrastructure-status",r);refresh();
};
id("place-create").onsubmit=e=>{
 e.preventDefault();const data=Object.fromEntries(new FormData(e.currentTarget));
 const r=engine.createPlace({name:data.name,parentId:data.parentId||null});
 status("place-status",r);refresh();
 if(r.success)e.currentTarget.elements.name.value="";
};
id("asset-place-change").onsubmit=e=>{
 e.preventDefault();const a=selectedAsset();if(!a)return;
 const r=engine.moveAssetToPlace(a.id,e.currentTarget.elements.placeId.value||null);
 status("asset-status",r);refresh();
};
id("panel-create").onsubmit=e=>{
 e.preventDefault();
 const r=engine.createPanel(Object.fromEntries(new FormData(e.currentTarget)));
 status("infrastructure-status",r);refresh();
 if(r.success)id("panels").value=r.panel.id;
 renderInfrastructure();
};
id("panels").onchange=renderInfrastructure;
id("panel-move").onsubmit=e=>{
 e.preventDefault();
 const r=engine.movePanelToPlace(id("panels").value,id("panel-destination").value);
 status("infrastructure-status",r);refresh();
};
id("panel-delete").onclick=()=>{
 const r=engine.removePanel(id("panels").value);
 status("infrastructure-status",r);refresh();
};
const connectorLabels={
 "rj45":"RJ45","usb-a":"USB-A","usb-b":"USB-B","usb-c":"USB-C",
 "hdmi":"HDMI","vga":"VGA","dvi":"DVI","displayport":"DisplayPort",
 "mini-displayport":"Mini DisplayPort","db9":"DB9 (série)",
 "db25":"DB25","lc":"Fibre LC","sc":"Fibre SC"
};
function cableConnectorLabel(code){
 const ending=code.match(/-(male|female|plug|socket)$/)?.[1],family=ending?code.slice(0,-ending.length-1):code;
 const type=ending==="male"||ending==="plug"?"mâle":"femelle";
 return (connectorLabels[family]||family)+" "+type;
}
for(const select of document.querySelectorAll("#cable-create select")){
 const supported=new Set(["rj45","lc","usb-a","usb-b","usb-c","hdmi","vga","dvi","displayport","mini-displayport","db9"]);
 const connectorFamily=c=>c.replace(/-(male|female|plug|socket)$/,"");
 select.replaceChildren(...engine.cableConnectors().filter(c=>supported.has(connectorFamily(c))).map(c=>opt(cableConnectorLabel(c),c)));
 select.value="rj45-male";
}
id("cable-create").onsubmit=e=>{
 e.preventDefault();const data=Object.fromEntries(new FormData(e.currentTarget));
 const r=engine.createCable({connectors:[data.a,data.b]});
 status("cable-status",r);refresh();
 if(r.success){id("cables").value=r.cable.id;renderCables()}
};
for(const [i,suffix] of [[0,"a"],[1,"b"]]){
 const form=id("cable-end-"+suffix);
 form.onsubmit=e=>{
  e.preventDefault();const c=engine.getCable(id("cables").value);
  if(!c)return;
  status("cable-status",engine.connectCableEnd(c.id,i,form.elements.port.value));refresh();
 };
 id("cable-disconnect-"+suffix).onclick=()=>{
  const c=engine.getCable(id("cables").value);if(!c)return;
  status("cable-status",engine.disconnectCableEnd(c.id,i));refresh();
 };
}
id("cables").onchange=renderCables;
id("cable-delete").onclick=()=>{
 const c=engine.getCable(id("cables").value);if(!c)return;
 const r=engine.deleteCable(c.id);
 status("cable-status",r);
 if(r.success){
  // Mettre à jour immédiatement la liste et l’occupation des ports,
  // indépendamment des formulaires profils et actifs.
  renderCables();
  refresh();
 }
};
id("profile-create").onsubmit=e=>{e.preventDefault();const r=engine.createProfile(new FormData(e.currentTarget).get("name"));status("profile-status",r);refresh();if(r.success){id("profiles").value=r.profile.id;renderFields()}};
id("duplicate").onclick=()=>{const p=selectedProfile();if(!p)return;const r=engine.duplicateProfile(p.id,p.name+" (copie)");status("profile-status",r);refresh();if(r.success){id("profiles").value=r.profile.id;renderFields()}};
id("portgroup-create").onsubmit=e=>{
 e.preventDefault();const p=selectedProfile();if(!p)return;
 const raw=Object.fromEntries(new FormData(e.currentTarget));
 const r=engine.addPortGroup(p.id,raw);status("profile-status",r);refresh();
};
id("extension-create").onsubmit=e=>{
 e.preventDefault();const a=selectedAsset();if(!a)return;
 const raw=Object.fromEntries(new FormData(e.currentTarget));
 const r=engine.addExtension(a.id,raw);status("asset-status",r);refresh();
};
id("profile-rename").onsubmit=e=>{
 e.preventDefault();
 const p=selectedProfile();if(!p)return;
 const r=engine.renameProfile(p.id,e.currentTarget.elements.name.value);
 status("profile-status",r);refresh();
};
id("edit-field-key").onchange=renderFieldEditor;
id("field-edit").onsubmit=e=>{
 e.preventDefault();
 const p=selectedProfile();if(!p)return;
 const data=Object.fromEntries(new FormData(e.currentTarget));
 if(data.type==="select")data.options=data.options.split(",").map(x=>x.trim()).filter(Boolean);
 const r=engine.editField(p.id,id("edit-field-key").value,data);
 status("profile-status",r);refresh();
};
id("field-create").onsubmit=e=>{e.preventDefault();const data=Object.fromEntries(new FormData(e.currentTarget));if(data.type==="select")data.options=data.options.split(",").map(x=>x.trim()).filter(Boolean);const r=engine.addField(id("profiles").value,data);status("profile-status",r);refresh()};
id("box-create").onclick=()=>{
 const result=engine.createBoxComposite("BOX-01");
 status("asset-status",result);refresh();
 if(result.success){id("assets").value=result.asset.id;renderAsset();}
};
id("wifi-pc-create").onclick=()=>{
 // Profil dédié et réutilisable ; aucune modification des profils existants.
 let profile=engine.listProfiles().find(p=>p.name==="PC Wi-Fi (recette Internet)"&&
  p.portGroups.some(g=>g.type==="wifi"));
 if(!profile){
  const created=engine.createProfile("PC Wi-Fi (recette Internet)");
  if(!created.success){status("asset-status",created);return;}
  profile=created.profile;
  const port=engine.addPortGroup(profile.id,{type:"wifi",prefix:"WIFI",start:1,count:1});
  if(!port.success){status("asset-status",port);return;}
 }
 const index=engine.listAssets().filter(a=>a.name.startsWith("PC-WIFI-")).length+1;
 const created=engine.createAsset(profile.id,{name:"PC-WIFI-"+String(index).padStart(2,"0")});
 status("asset-status",created);refresh();
 if(created.success){
  id("assets").value=created.asset.id;renderAsset();
  id("box-internet-client").value=created.asset.id;refreshInternetClientConfig();
 }
};
id("asset-create").onsubmit=e=>{e.preventDefault();const data=Object.fromEntries(new FormData(e.currentTarget));const r=engine.createAsset(data.profileId,data);status("asset-status",r);refresh();if(r.success){id("assets").value=r.asset.id;renderAsset()}};
id("asset-remove").onclick=()=>{
 const a=selectedAsset();if(!a)return;
 const r=engine.removeAsset(a.id);
 status("asset-status",r);refresh();
};
id("asset-edit").onsubmit=e=>{
 e.preventDefault();
 const a=selectedAsset();if(!a)return;
 const data=Object.fromEntries(new FormData(e.currentTarget));
 data.reservable=e.currentTarget.elements.reservable.checked;
 const r=engine.updateAsset(a.id,data);
 status("asset-status",r);refresh();
};
id("profiles").onchange=renderFields;id("assets").onchange=renderAsset;
id("reset").onclick=()=>{closeNetworkAdmin();verifiedInternet.clear();engine=createAssetRegistry();installScreenProfile(engine);installDesktopProfile(engine);visualPathPorts=[];visualPathCableIds=[];visualSelectedPort=null;visualSelectedCable=null;visualPendingAttach=null;id("cabling-visual-status").textContent="";refresh();id("asset-status").textContent="";id("profile-status").textContent="";id("cable-status").textContent="";id("infrastructure-status").textContent="";id("place-status").textContent="";id("path-result").textContent=""};
id("cabling-visual-place").onchange=()=>{visualSelectedPort=null;visualPendingAttach=null;drawCablingVisual()};
id("cabling-mode-connect").onclick=()=>{visualPathMode=false;visualPathPorts=[];visualPathCableIds=[];visualSelectedPort=null;id("cabling-mode-connect").setAttribute("aria-pressed","true");id("cabling-mode-path").setAttribute("aria-pressed","false");visualMessage("Mode branchement : sélectionne deux ports libres.");drawCablingVisual()};
id("cabling-mode-path").onclick=()=>{visualPathMode=true;visualPathPorts=[];visualPathCableIds=[];visualSelectedPort=null;visualPendingAttach=null;id("cabling-mode-path").setAttribute("aria-pressed","true");id("cabling-mode-connect").setAttribute("aria-pressed","false");visualMessage("Mode chemin : sélectionne un départ et une arrivée.");drawCablingVisual()};

window.__assetProfilesLab={snapshot:()=>engine.exportState()};refresh();