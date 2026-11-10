import {createEngine} from "./r2d3-core.js?v=dhcp-apipa-20261110";
import {formatNslookup} from "../shared-ui/v1/nslookup.js";
import {formatDisplayDns,formatFlushDns} from "../shared-ui/v1/dns-cache-commands.js";
const $=id=>document.getElementById(id);
const serverId="srv-dns",dhcpId="srv-dhcp",clients=["pc-dhcp-01","pc-dhcp-02"];
let engine,scenario,serial=0;
const snapshot=()=>engine.getSnapshot();
const selected=()=>$("client").value;
function send(type,targetId,params={}){
 const result=engine.dispatch({id:"dns-cache-"+(++serial),commandVersion:1,type,targetId,params,expectedRevision:snapshot().revision});
 $("status").textContent=result.status==="applied"?"Commande exécutée.":"Commande refusée : "+(result.message??result.code);
 if(result.status==="applied")render();
 return result;
}
function fillRecord(){
 const record=snapshot().objectsById[serverId].config.dnsZone.records.find(r=>r.name===$("record").value);
 $("value").value=record?.value??"";
 $("ttl").value=record?.ttl??300;
}
function render(){
 const st=snapshot(),pc=st.objectsById[selected()],server=st.objectsById[serverId];
 $("network").textContent="PC : "+(pc.config.ipv4.address??"aucune IPv4")+" | DNS : "+(pc.config.networkOptions?.dns?.join(", ")||"aucun")+" | Service DNS : "+(server.config.dnsEnabled?"actif":"arrêté");
 $("toggle").textContent=server.config.dnsEnabled?"Arrêter le serveur DNS":"Démarrer le serveur DNS";
 const dhcp=st.objectsById[dhcpId],lease=pc.config.ipv4.lease,rt=st.runtime[selected()]??{};
 $("toggle-dhcp").textContent=dhcp.config.dhcpEnabled?"Arrêter le serveur DHCP":"Démarrer le serveur DHCP";
 $("lease-info").textContent=lease
   ?"Bail DHCP : début "+lease.start+" s | expiration "+lease.expires+" s | état "+(rt.dhcpLeasePhase??rt.dhcpStatus??"actif")
   :"Bail DHCP : aucun | état "+(rt.dhcpStatus??"non attribué");
 $("clock").textContent="Temps écoulé : "+st.simulationClock+" secondes";
 const counts=clients.map(id=>" "+(id==="pc-dhcp-01"?"PC1":"PC2")+" : "+engine.query({type:"dns.cache",sourceId:id}).entries.length+" entrée(s)");
 $("cache-summary").textContent=counts.join(" | ");
 $("records").replaceChildren(...server.config.dnsZone.records.map(r=>{
  const tr=document.createElement("tr");
  for(const v of [r.name,r.type,r.value,r.ttl??300]){const td=document.createElement("td");td.textContent=String(v);tr.appendChild(td);}
  return tr;
 }));
 $("negative").value=server.config.dnsZone.negativeTtl??60;
}
function clearOutputs(){ $("answer").textContent="Aucune requête.";$("cache-output").textContent="Aucune commande.";}
async function start(){
 try{
  const response=await fetch("./dns-cache-scenario.json",{cache:"no-store"});
  if(!response.ok)throw Error("Scénario DNS cache introuvable");
  scenario=await response.json();engine=createEngine(scenario);
  $("client").addEventListener("change",()=>{render();clearOutputs();});
  $("record").addEventListener("change",fillRecord);
  $("dhcp").addEventListener("click",()=>send("dhcp.request",selected()));
  $("toggle").addEventListener("click",()=>send("dns.setServerEnabled",serverId,{enabled:!snapshot().objectsById[serverId].config.dnsEnabled}));
  $("toggle-dhcp").addEventListener("click",()=>send("dhcp.setServerEnabled",dhcpId,{enabled:!snapshot().objectsById[dhcpId].config.dhcpEnabled}));
  $("windows").addEventListener("click",()=>{
   const name=$("name").value.trim();
   const response=send("dns.clientResolve",selected(),{name});
   if(response.status!=="applied")return;
   const result=response.dnsResult;
   const label=result.fromCache?"Réponse du cache DNS du PC":"Réponse obtenue du serveur DNS";
   const lines=["Résolution Windows : "+name,label];
   if(result.status==="ok"&&result.found)lines.push("Adresse : "+result.address,"TTL restant : "+result.ttl+" s");
   else if(result.status==="ok")lines.push("Nom inexistant : "+result.reason);
   else lines.push("Résolution impossible : "+result.reason);
   $("answer").textContent=lines.join("\n");
  });
  $("nslookup").addEventListener("click",()=>{
   const name=$("name").value.trim(),result=engine.query({type:"dns.resolve",sourceId:selected(),name});
   $("answer").textContent=formatNslookup({name,result});
  });
  $("displaydns").addEventListener("click",()=>{
   const entries=engine.query({type:"dns.cache",sourceId:selected()}).entries;
   $("cache-output").textContent=formatDisplayDns({entries});
  });
  $("flushdns").addEventListener("click",()=>{
   if(send("dns.flushCache",selected()).status==="applied")
     $("cache-output").textContent=formatFlushDns();
  });
  $("save").addEventListener("click",()=>{
   const previous=snapshot().objectsById[serverId].config.dnsZone.records.find(r=>r.name===$("record").value);
   if(!previous)return void($("status").textContent="Enregistrement introuvable.");
   const ttl=Number($("ttl").value);
   if(!Number.isInteger(ttl))return void($("status").textContent="TTL invalide.");
   send("dns.upsertRecord",serverId,{record:{name:previous.name,type:previous.type,value:$("value").value.trim(),ttl}});
   fillRecord();
  });
  $("save-negative").addEventListener("click",()=>{
   const negativeTtl=Number($("negative").value);
   send("dns.setNegativeTtl",serverId,{negativeTtl});
  });
  $("advance").addEventListener("click",()=>{
   const seconds=Number($("seconds").value);
   send("simulation.advanceTime","simulation-clock",{seconds});
  });
  $("reset").addEventListener("click",()=>{engine=createEngine(scenario);serial=0;render();fillRecord();clearOutputs();$("status").textContent="Laboratoire réinitialisé.";});
  render();fillRecord();$("status").textContent="Scénario chargé. Commence par obtenir la configuration DHCP.";
 }catch(error){$("status").textContent="Erreur : "+error.message;}
}
start();