import {createAssetRegistry} from "./asset-profiles.js";
let engine=createAssetRegistry();
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
 renderPlaces();renderInfrastructure();renderCables();renderPathChoices();renderFields();renderAsset();
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
 const select=id("asset-place"),a=selectedAsset();
 select.replaceChildren(opt("Aucun lieu",""),...all.map(p=>opt(placeLabel(p,all),p.id)));
 select.value=a?.placeId||"";
 id("asset-place-change").querySelectorAll("select,button").forEach(control=>control.disabled=!a);
 id("asset-current-place").textContent=a?"Lieu actuel : "+(all.find(p=>p.id===a.placeId)?placeLabel(all.find(p=>p.id===a.placeId),all):"Aucun lieu"):"";
}
function renderInfrastructure(){
 const host=id("infrastructure-list");host.replaceChildren();
 const outlets=engine.listWallOutlets(),racks=engine.listRacks();
 const summary=document.createElement("p");
 summary.textContent=outlets.length+" prise(s), "+racks.length+" baie(s).";
 host.append(summary);
 for(const outlet of outlets){
  const p=document.createElement("p");p.textContent="Prise "+outlet.name+" ("+outlet.location+") : avant / arrière";
  host.append(p);
 }
 for(const rack of racks){
  const p=document.createElement("p");p.textContent="Baie "+rack.name+" ("+rack.location+") : panneau de "+rack.ports.length+" port(s), avant / arrière";
  host.append(p);
  const contents=engine.listAssets().filter(a=>a.rackId===rack.id).map(a=>a.name);
  const installed=document.createElement("p");installed.textContent="Équipements installés : "+(contents.join(", ")||"aucun");
  host.append(installed);
 }
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
 for(const p of a.ports){
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
function renderAsset(){
 const a=selectedAsset(),host=id("asset-values"),form=id("asset-edit");host.replaceChildren();
 form.querySelectorAll("input,select,button").forEach(control=>control.disabled=!a);
 id("asset-remove").disabled=!a;
 id("extension-create").querySelectorAll("input,select,button").forEach(control=>control.disabled=!a);
 renderAssetPorts();renderPlaces();
 const rackSelect=id("asset-rack"),racks=engine.listRacks();
 rackSelect.replaceChildren(opt("Hors baie",""),...racks.map(r=>opt(r.name+" ("+r.location+")",r.id)));
 rackSelect.value=a?.rackId||"";
 id("asset-rack-change").querySelectorAll("select,button").forEach(control=>control.disabled=!a);
 id("asset-current-rack").textContent=a?"Baie actuelle : "+(racks.find(r=>r.id===a.rackId)?.name||"aucune"):"";
 if(a){
  for(const key of ["name","manufacturer","model","serialNumber","status","location"])form.elements[key].value=a[key]??"";
  form.elements.reservable.checked=!!a.reservable;
 }else{
  form.reset();
 }
 if(!a){host.textContent="Crée un actif.";return}
 const p=engine.getProfile(a.profileId);
 for(const f of p.fields){
  const label=document.createElement("label");label.textContent=f.label+(f.unit?" ("+f.unit+")":"");
  let input;if(f.type==="select"||f.type==="boolean"){
   input=document.createElement("select");input.append(opt("Non renseigné",""));
   const options=f.type==="boolean"?[["Oui","true"],["Non","false"]]:f.options.map(v=>[v,v]);
   options.forEach(([name,value])=>input.append(opt(name,value)));
   input.value=a.values[f.key]===null?"":String(a.values[f.key]);
  }else{
   input=document.createElement("input");input.type=f.type==="number"?"number":f.type==="date"?"date":"text";
   input.value=a.values[f.key]??"";if(f.type==="number")input.step="any";
  }
  input.onchange=()=>{
   const v=input.value===""?null:f.type==="number"?Number(input.value):f.type==="boolean"?input.value==="true":input.value;
   status("asset-status",engine.setAssetField(a.id,f.key,v));
  };
  label.append(input);host.append(label);
 }
}
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
id("asset-rack-change").onsubmit=e=>{
 e.preventDefault();const a=selectedAsset();if(!a)return;
 const r=engine.placeAssetInRack(a.id,e.currentTarget.elements.rackId.value||null);
 status("asset-status",r);refresh();
};
id("rack-create").onsubmit=e=>{
 e.preventDefault();
 const r=engine.createRack(Object.fromEntries(new FormData(e.currentTarget)));
 status("infrastructure-status",r);refresh();
};
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
id("reset").onclick=()=>{engine=createAssetRegistry();refresh();id("asset-status").textContent="";id("profile-status").textContent="";id("cable-status").textContent="";id("infrastructure-status").textContent="";id("place-status").textContent="";id("path-result").textContent=""};
window.__assetProfilesLab={snapshot:()=>engine.exportState()};refresh();