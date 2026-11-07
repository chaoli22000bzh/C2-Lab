import {createEngine} from "./r2d3-core.js";
const $=id=>document.getElementById(id);
let engine,scenario,seq=0;
const serverId="srv-dhcp",clients=["pc-dhcp-01","pc-dhcp-02"];
const state=()=>engine.getSnapshot();
const send=(type,targetId,params={})=>{
 const result=engine.dispatch({id:"multi-pool-"+(++seq),commandVersion:1,type,targetId,params,expectedRevision:state().revision});
 $("status").textContent=result.status==="applied"?"Modification appliquée.":("Opération refusée : "+(result.message??result.code));
 if(result.status==="applied")render();
 return result;
};
const poolList=()=>engine.query({type:"dhcp.pools",serverId}).pools;
const fmt=seconds=>(seconds/3600).toLocaleString("fr-FR",{maximumFractionDigits:2})+" h";
const displayOptions=(select,values,chosen)=>{
 select.replaceChildren(...values.map(p=>{const op=document.createElement("option");op.value=p.id;op.textContent=p.id+" ("+p.start+" - "+p.end+")";return op;}));
 if(values.some(p=>p.id===chosen))select.value=chosen;
};
function fillPool(){
 const p=poolList().find(x=>x.id===$("pool").value);
 if(!p)return;
 $("start").value=p.start;$("end").value=p.end;$("hours").value=p.leaseSeconds/3600;
 $("exclusions").value=(p.exclusions??[]).join(", ");
}
function render(){
 const s=state(),pools=poolList(),selected=$("pool").value,requested=$("request-pool").value;
 displayOptions($("pool"),pools,selected);displayOptions($("request-pool"),pools,requested);
 $("server").textContent=s.objectsById[serverId].config.dhcpEnabled?"Service actif":"Service arrêté";
 $("toggle").textContent=s.objectsById[serverId].config.dhcpEnabled?"Arrêter le service":"Démarrer le service";
 $("clock").textContent="Temps simulé écoulé : "+fmt(s.simulationClock);
 $("clients").replaceChildren(...clients.map(id=>{
  const obj=s.objectsById[id],ip=obj.config.ipv4,div=document.createElement("p");
  div.textContent=obj.name+" : "+(ip.address??"aucune IPv4")+" | "+(ip.lease?"plage "+(ip.lease.poolId??"default")+", expiration à "+fmt(ip.lease.expires):"aucun bail")+" | "+(s.runtime[id]?.dhcpStatus??"attente");
  return div;
 }));
 $("pools-view").replaceChildren(...pools.map(p=>{
  const el=document.createElement("p");
  el.textContent=p.id+" : "+p.start+" à "+p.end+" | "+fmt(p.leaseSeconds)+" | exclusions : "+(p.exclusions??[]).join(", ");
  return el;
 }));
 const leases=engine.query({type:"dhcp.leases",serverId}).leases;
 $("leases-view").replaceChildren(...(leases.length?leases.map(x=>{
  const p=document.createElement("p");p.textContent=x.clientId+" : "+x.address+" | "+x.poolId+" | bail "+fmt(x.start)+" à "+fmt(x.expires);return p;
 }):[document.createTextNode("Aucun bail actuellement géré.")]));
}
async function start(){
 try{
  const response=await fetch("./dhcp-multi-pool-scenario.json",{cache:"no-store"});
  if(!response.ok)throw Error("Scénario introuvable");
  scenario=await response.json();engine=createEngine(scenario);
  render();fillPool();
  $("pool").addEventListener("change",fillPool);
  $("toggle").addEventListener("click",()=>send("dhcp.setServerEnabled",serverId,{enabled:!state().objectsById[serverId].config.dhcpEnabled}));
  $("save").addEventListener("click",()=>{
   const hours=Number($("hours").value);
   if(!Number.isInteger(hours)||hours<1||hours>720){$("status").textContent="Durée invalide : 1 à 720 heures.";return;}
   const changes={start:$("start").value.trim(),end:$("end").value.trim(),leaseSeconds:hours*3600,
    exclusions:$("exclusions").value.split(",").map(x=>x.trim()).filter(Boolean)};
   send("dhcp.updatePool",serverId,{poolId:$("pool").value,changes});fillPool();
  });
  $("remove").addEventListener("click",()=>{if(send("dhcp.removePool",serverId,{poolId:$("pool").value}).status==="applied")fillPool();});
  $("add").addEventListener("click",()=>{
   const id=$("new-id").value.trim(),net=$("new-net").value.trim(),hours=Number($("new-hours").value);
   if(!/^[a-zA-Z0-9_-]+$/.test(id)||!/^\d{1,3}(\.\d{1,3}){2}$/.test(net)||!Number.isInteger(hours)||hours<1||hours>720){$("status").textContent="Identifiant, préfixe réseau ou durée incorrect.";return;}
   const template=poolList()[0],pool={...template,id,start:net+".100",end:net+".110",gateway:net+".1",
    dns:[net+".10","1.1.1.1"],leaseSeconds:hours*3600,exclusions:[],reservations:[]};
   if(send("dhcp.addPool",serverId,{pool}).status==="applied"){$("pool").value=id;fillPool();}
  });
  $("renew").addEventListener("click",()=>send("dhcp.request",$("client").value,{serverId,poolId:$("request-pool").value}));
  $("release").addEventListener("click",()=>send("dhcp.release",$("client").value));
  $("advance").addEventListener("click",()=>{
   const h=Number($("advance-hours").value);
   if(!Number.isInteger(h)||h<1||h>168){$("status").textContent="Saisir entre 1 et 168 heures.";return;}
   send("dhcp.advanceTime",serverId,{seconds:h*3600});
  });
  $("reset").addEventListener("click",()=>{engine=createEngine(scenario);seq=0;render();fillPool();$("status").textContent="Laboratoire réinitialisé.";});
  $("status").textContent="Scénario chargé.";
 }catch(e){$("status").textContent="Erreur : "+e.message;}
}
start();
