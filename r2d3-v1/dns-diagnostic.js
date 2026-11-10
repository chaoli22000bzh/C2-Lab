import {createEngine} from "./r2d3-core.js?v=diagnostic-ping-20261110";
import {formatNslookup} from "../shared-ui/v1/nslookup.js";
import {formatDisplayDns,formatFlushDns} from "../shared-ui/v1/dns-cache-commands.js";
import {formatIpconfig} from "../shared-ui/v1/ipconfig.js";
import {formatIpconfigAll} from "../shared-ui/v1/ipconfig-all.js";
import {createPingAnimator} from "../shared-ui/v1/ping-animation.js";
const $=id=>document.getElementById(id);
const serverId="srv-dns", clients=["pc-dhcp-01","pc-dhcp-02"];
let scenario,engine,serial=0;
const ping=createPingAnimator($("answer"));
const state=()=>engine.getSnapshot(),selected=()=>$("client").value;
const label=id=>({"pc-dhcp-01":"PC1","pc-dhcp-02":"PC2","srv-dns":"Serveur DNS","srv-dhcp":"Serveur DHCP"})[id]??id;
function execute(type,targetId,params={}){
 const result=engine.dispatch({id:"dns-diag-"+(++serial),commandVersion:1,type,targetId,params,expectedRevision:state().revision});
 $("status").textContent=result.status==="applied"?"Commande exécutée.":"Commande refusée : "+(result.message??result.code);
 if(result.status==="applied")render();
 return result;
}
function connected(id){return Object.values(state().linksById).some(link=>link.connected&&link.endpoints.some(p=>p.objectId===id));}
function recordForm(){const record=state().objectsById[serverId].config.dnsZone.records.find(r=>r.name===$("record").value);$("value").value=record?.value??"";}
function render(){
 const s=state(),pc=s.objectsById[selected()],dns=s.objectsById[serverId],opts=pc.config.networkOptions??{gateway:null,dns:[]},ip=pc.config.ipv4;
 $("network").textContent=label(selected())+" : "+(ip.address??"aucune IPv4")+(ip.prefix!==null&&ip.prefix!==undefined&&ip.address?"/"+ip.prefix:"")+" | Passerelle : "+(opts.gateway??"aucune")+" | DNS : "+(opts.dns.join(", ")||"aucun");
 $("dns-ip").value=opts.dns[0]??"";
 $("dns-secondary").value=opts.dns[1]??"";
 $("toggle-dns").textContent=dns.config.dnsEnabled?"Arrêter le service DNS":"Démarrer le service DNS";
 const link=s.linksById[$("link").value];$("link-state").textContent=link.connected?"Câble branché":"Câble débranché";
 $("toggle-link").textContent=link.connected?"Débrancher le câble":"Rebrancher le câble";
 $("clock").textContent="Temps écoulé : "+s.simulationClock+" secondes | DNS : "+(dns.config.dnsEnabled?"actif":"arrêté");
 $("cache-summary").textContent=clients.map(id=>label(id)+" : "+engine.query({type:"dns.cache",sourceId:id}).entries.length+" entrée(s) en cache").join(" | ");
 const records=dns.config.dnsZone.records;
 const chosenRecord=$("record").value;
 $("record").replaceChildren(...records.map(r=>{const el=document.createElement("option");el.value=r.name;el.textContent=r.name+" ("+r.type+")";return el;}));
 if(records.some(r=>r.name===chosenRecord))$("record").value=chosenRecord;
 $("records").replaceChildren(...records.map(r=>{const tr=document.createElement("tr");for(const v of [r.name,r.type,r.value,r.ttl??300]){const td=document.createElement("td");td.textContent=String(v);tr.appendChild(td);}return tr;}));
}
function showCommand(output){ping.cancel();$("answer").textContent=output;}
function clearOutput(){ping.cancel();$("answer").textContent="Aucune commande.";$("cache-output").textContent="Aucune commande.";}
async function start(){
 try{
  const response=await fetch("./dns-diagnostic-scenario.json",{cache:"no-store"});if(!response.ok)throw Error("Scénario indisponible");
  scenario=await response.json();engine=createEngine(scenario);
  $("client").addEventListener("change",()=>{render();recordForm();clearOutput();});
  $("link").addEventListener("change",render);
  $("record").addEventListener("change",recordForm);
  $("dhcp").addEventListener("click",()=>execute("dhcp.request",selected()));
  $("set-dns").addEventListener("click",()=>{
   const pc=state().objectsById[selected()],preferred=$("dns-ip").value.trim(),secondary=$("dns-secondary").value.trim();
   if(!preferred&&secondary){$("status").textContent="Renseigne d'abord le serveur DNS préféré.";return;}
   const dns=[preferred,secondary].filter(Boolean);
   execute("network.setNetworkOptions",selected(),{gateway:pc.config.networkOptions?.gateway??null,dns});
  });
  $("ipconfig").addEventListener("click",()=>{const pc=state().objectsById[selected()];showCommand(formatIpconfig({ipv4:pc.config.ipv4,connected:connected(selected()),gateway:pc.config.networkOptions?.gateway??null}));});
  $("ipconfig-all").addEventListener("click",()=>{const pc=state().objectsById[selected()],lease=pc.config.ipv4.lease,server=lease?state().objectsById[lease.serverId]:null;
   showCommand(formatIpconfigAll({ipv4:pc.config.ipv4,hostname:pc.name,dhcp:pc.config.ipv4.mode==="dhcp",connected:connected(selected()),mac:pc.config.macAddress,gateway:pc.config.networkOptions?.gateway??null,dns:pc.config.networkOptions?.dns??[],dhcpServer:server?.config.ipv4?.address,leaseStart:lease?lease.start+" s":undefined,leaseEnd:lease?lease.expires+" s":undefined}));});
  $("ping").addEventListener("click",()=>{
   const input=$("ping-target").value.trim(),sourceId=selected(),source=state().objectsById[sourceId];
   if(!input){$("status").textContent="Saisis une adresse IPv4 ou un nom DNS.";return;}
   const ipv4=/^(\\d{1,3}\\.){3}\\d{1,3}$/.test(input);
   let address=input,resolutionFailure=null;
   if(!ipv4){
     const result=execute("dns.clientResolve",sourceId,{name:input});
     if(result.status!=="applied")return;
     const answer=result.dnsResult;
     if(answer.status!=="ok"||!answer.found)resolutionFailure=answer.reason??"Nom introuvable";
     else address=answer.address;
   }
   const outcome=resolutionFailure===null?engine.query({type:"network.pingAddress",sourceId,address}):null;
   if(!ipv4&&resolutionFailure===null)$("status").textContent="Nom résolu en "+address+" ; test de connectivité lancé.";
   ping.run({sourceName:label(sourceId),sourceAddress:source.config.ipv4.address,targetAddress:address,targetInput:input,outcome,resolutionFailure});
  });
  $("windows").addEventListener("click",()=>{const name=$("name").value.trim(),r=execute("dns.clientResolve",selected(),{name});if(r.status!=="applied")return;const d=r.dnsResult,provenance=d.fromCache?"Réponse du cache DNS du PC":d.status==="ok"?"Réponse obtenue du serveur DNS":"Interrogation du serveur DNS : échec";
   const lines=["Résolution Windows : "+name,provenance];if(d.status==="ok"&&d.found)lines.push("Adresse : "+d.address,"TTL restant : "+d.ttl+" s");else if(d.status==="ok")lines.push("Nom inexistant : "+d.reason);else lines.push("Résolution impossible : "+d.reason);showCommand(lines.join("\n"));});
  $("nslookup").addEventListener("click",()=>{const name=$("name").value.trim();showCommand(formatNslookup({name,result:engine.query({type:"dns.resolve",sourceId:selected(),name})}));});
  $("displaydns").addEventListener("click",()=>{$("cache-output").textContent=formatDisplayDns({entries:engine.query({type:"dns.cache",sourceId:selected()}).entries});});
  $("flushdns").addEventListener("click",()=>{if(execute("dns.flushCache",selected()).status==="applied")$("cache-output").textContent=formatFlushDns();});
  $("toggle-dns").addEventListener("click",()=>execute("dns.setServerEnabled",serverId,{enabled:!state().objectsById[serverId].config.dnsEnabled}));
  $("toggle-link").addEventListener("click",()=>{const id=$("link").value;execute("network.setLinkConnected",id,{connected:!state().linksById[id].connected});});
  $("save").addEventListener("click",()=>{const record=state().objectsById[serverId].config.dnsZone.records.find(r=>r.name===$("record").value);if(!record)return;const r=execute("dns.upsertRecord",serverId,{record:{name:record.name,type:record.type,value:$("value").value.trim(),ttl:record.ttl??300}});if(r.status==="applied")recordForm();});
  $("advance").addEventListener("click",()=>execute("simulation.advanceTime","simulation-clock",{seconds:Number($("seconds").value)}));
  $("reset").addEventListener("click",()=>{engine=createEngine(scenario);serial=0;render();recordForm();clearOutput();$("ping-target").value="192.168.10.10";$("status").textContent="Laboratoire réinitialisé.";});
  render();recordForm();$("status").textContent="Scénario chargé. PC1 et PC2 peuvent recevoir leur configuration DHCP.";
 }catch(error){$("status").textContent="Erreur : "+error.message;}
}
start();
