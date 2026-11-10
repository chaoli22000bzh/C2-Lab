import {createEngine} from "./r2d3-core.js";
import {formatTypedNslookup} from "../shared-ui/v1/nslookup.js";

const $=id=>document.getElementById(id);
let scenario,engine,sequence=0;
const pc="pc-dhcp-01",server="srv-dns";
const state=()=>engine.getSnapshot();
const zone=()=>state().objectsById[server].config.dnsZone;
function operation(type,targetId,params={}){
 const outcome=engine.dispatch({id:"dns-advanced-"+(++sequence),commandVersion:1,type,targetId,params,expectedRevision:state().revision});
 $("status").textContent=outcome.status==="applied"?"Opération effectuée.":"Opération refusée : "+(outcome.message??outcome.code);
 if(outcome.status==="applied")render();
 return outcome;
}
function render(){
 const s=state(),client=s.objectsById[pc],dns=s.objectsById[server];
 $("network").textContent="PC : "+(client.config.ipv4.address??"aucune IPv4")+
   " | DNS : "+(client.config.networkOptions?.dns?.join(", ")||"aucun")+
   " | Service DNS : "+(dns.config.dnsEnabled?"actif":"arrêté")+
   " | Temps simulé : "+s.simulationClock+" s";
 $("toggle").textContent=dns.config.dnsEnabled?"Arrêter le service DNS":"Démarrer le service DNS";
 const records=zone().records;
 $("records").replaceChildren(...records.map(record=>{
   const row=document.createElement("tr");
   const fields=[record.name,record.type,record.type==="MX"?String(record.priority):"",""+record.value,String(record.ttl??300)+" s"];
   for(const field of fields){const cell=document.createElement("td");cell.textContent=field;row.appendChild(cell);}
   return row;
 }));
 const select=$("delete-record"),chosen=select.value;
 select.replaceChildren(...records.map((r,index)=>{
   const opt=document.createElement("option");opt.value=String(index);
   opt.textContent=r.name+" ["+r.type+"] "+(r.type==="MX"?r.priority+" ":"")+r.value;
   return opt;
 }));
 if(chosen!==""&&Number(chosen)<records.length)select.value=chosen;
 const cache=engine.query({type:"dns.cache",sourceId:pc});
 $("cache").replaceChildren(...(cache.entries??[]).map(entry=>{
   const row=document.createElement("tr");
   for(const text of [entry.name,entry.recordType??"A",entry.found?"Réponse":"Absence",String(entry.remainingTtl)+" s"]){
     const cell=document.createElement("td");cell.textContent=text;row.appendChild(cell);
   }
   return row;
 }));
 $("priority-row").hidden=$("edit-type").value!=="MX";
}
function lookup(asWindows){
 const name=$("lookup-name").value.trim(),recordType=$("lookup-type").value;
 if(!name){$("answer").textContent="Saisir un nom ou une adresse IPv4.";return;}
 let result;
 if(asWindows){
   const response=operation("dns.clientResolve",pc,{name,recordType});
   if(response.status!=="applied")return;
   result=response.dnsResult;
 }else result=engine.query({type:"dns.resolve",sourceId:pc,name,recordType});
 $("answer").textContent=formatTypedNslookup({name,recordType,result});
 $("origin").textContent=asWindows?(result.fromCache?"Réponse depuis le cache du PC":"Interrogation du serveur DNS"):"Interrogation directe du serveur (nslookup, sans cache Windows)";
}
function recordData(){
 const type=$("edit-type").value,value=$("edit-value").value.trim();
 const record={name:$("edit-name").value.trim().toLowerCase(),type,value};
 if(type==="MX")record.priority=Number($("edit-priority").value);
 const ttl=Number($("edit-ttl").value);
 if(Number.isInteger(ttl))record.ttl=ttl;
 return record;
}
async function start(){
 try{
   const res=await fetch("./dns-enregistrements-scenario.json",{cache:"no-store"});
   if(!res.ok)throw Error("Scénario DNS indisponible");
   scenario=await res.json();engine=createEngine(scenario);
   $("dhcp").addEventListener("click",()=>operation("dhcp.request",pc));
   $("toggle").addEventListener("click",()=>operation("dns.setServerEnabled",server,{enabled:!state().objectsById[server].config.dnsEnabled}));
   $("reset").addEventListener("click",()=>{engine=createEngine(scenario);sequence=0;$("answer").textContent="Aucune requête.";$("origin").textContent="";$("status").textContent="Scénario réinitialisé.";render();});
   $("lookup").addEventListener("click",()=>lookup(false));
   $("windows").addEventListener("click",()=>lookup(true));
   $("flush").addEventListener("click",()=>operation("dns.flushCache",pc));
   $("advance").addEventListener("click",()=>operation("simulation.advanceTime","simulation-clock",{seconds:300}));
   $("edit-type").addEventListener("change",render);
   $("add").addEventListener("click",()=>operation("dns.upsertRecord",server,{record:recordData()}));
   $("remove").addEventListener("click",()=>{
     const selected=zone().records[Number($("delete-record").value)];
     if(!selected)return void($("status").textContent="Sélectionner un enregistrement.");
     operation("dns.removeRecord",server,{name:selected.name,recordType:selected.type,value:selected.value});
   });
   render();$("status").textContent="Laboratoire prêt. Obtenir d'abord une configuration DHCP.";
 }catch(error){$("status").textContent="Erreur : "+error.message;}
}
start();
