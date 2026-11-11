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
 renderFields();renderAsset();
}
function renderFields(){
 const p=selectedProfile(),host=id("fields");host.replaceChildren();
 if(!p){host.textContent="Crée un profil pour commencer.";return}
 if(!p.fields.length){host.textContent="Aucun champ personnalisé.";return}
 p.fields.forEach((f,i)=>{
  const wrap=document.createElement("div");wrap.className="item";
  const label=document.createElement("span");label.textContent=f.label+" ("+f.type+(f.unit?", "+f.unit:"")+")";
  const controls=document.createElement("span");
  for(const [caption,action,disabled] of [["↑",()=>engine.moveField(p.id,f.key,i-1),i===0],["↓",()=>engine.moveField(p.id,f.key,i+1),i===p.fields.length-1],["Supprimer",()=>engine.removeField(p.id,f.key),false]]){
   const b=document.createElement("button");b.className="subtle";b.textContent=caption;b.disabled=disabled;b.onclick=()=>{status("profile-status",action());refresh()};controls.append(b);
  }
  wrap.append(label,controls);host.append(wrap);
 });
}
function renderAsset(){
 const a=selectedAsset(),host=id("asset-values");host.replaceChildren();
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
id("profile-create").onsubmit=e=>{e.preventDefault();const r=engine.createProfile(new FormData(e.currentTarget).get("name"));status("profile-status",r);refresh();if(r.success){id("profiles").value=r.profile.id;renderFields()}};
id("duplicate").onclick=()=>{const p=selectedProfile();if(!p)return;const r=engine.duplicateProfile(p.id,p.name+" (copie)");status("profile-status",r);refresh();if(r.success){id("profiles").value=r.profile.id;renderFields()}};
id("field-create").onsubmit=e=>{e.preventDefault();const data=Object.fromEntries(new FormData(e.currentTarget));if(data.type==="select")data.options=data.options.split(",").map(x=>x.trim()).filter(Boolean);const r=engine.addField(id("profiles").value,data);status("profile-status",r);refresh()};
id("asset-create").onsubmit=e=>{e.preventDefault();const data=Object.fromEntries(new FormData(e.currentTarget));const r=engine.createAsset(data.profileId,data);status("asset-status",r);refresh();if(r.success){id("assets").value=r.asset.id;renderAsset()}};
id("profiles").onchange=renderFields;id("assets").onchange=renderAsset;
id("reset").onclick=()=>{engine=createAssetRegistry();refresh();id("asset-status").textContent="";id("profile-status").textContent=""};
window.__assetProfilesLab={snapshot:()=>engine.exportState()};refresh();