import {createEngine} from "./r2d3-core.js";
const $=id=>document.getElementById(id);
let scenario,engine,serial=0;
const clientId="pc-dhcp-01",serverId="srv-dns";
const state=()=>engine.getSnapshot();
const execute=(type,targetId,params={})=>{
 const result=engine.dispatch({id:"dns-lab-"+(++serial),commandVersion:1,type,targetId,params,expectedRevision:state().revision});
 $("status").textContent=result.status==="applied"?"Opération effectuée.":"Commande refusée : "+(result.message??result.code);
 if(result.status==="applied")render();
 return result;
};
function render(){
 const s=state(),client=s.objectsById[clientId],server=s.objectsById[serverId];
 $("network").textContent="PC1 : "+(client.config.ipv4.address??"aucune IPv4")+" | DNS : "+(client.config.networkOptions?.dns?.join(", ")||"aucun")+" | Serveur local : "+(server.config.dnsEnabled?"actif":"arrêté");
 $("toggle").textContent=server.config.dnsEnabled?"Arrêter le serveur DNS":"Démarrer le serveur DNS";
 $("records").replaceChildren(...server.config.dnsZone.records.map(r=>{
  const tr=document.createElement("tr");
  for(const value of [r.name,r.type,r.value]){const td=document.createElement("td");td.textContent=value;tr.appendChild(td);}
  return tr;
 }));
 const rec=server.config.dnsZone.records.find(r=>r.name===$("record").value);
 $("value").value=rec?.value??"";
}
function lookup(){
 const name=$("name").value.trim();
 const result=engine.query({type:"dns.resolve",sourceId:clientId,name});
 let lines=["C:\\> nslookup "+name,""];
 if(result.status!=="ok")lines.push("*** Requête impossible : "+result.reason);
 else{
  lines.push("Serveur DNS : "+result.serverAddress);
  if(result.found){
   for(const r of result.chain)lines.push(r.name+"  "+r.type+"  "+r.value);
   lines.push("Adresse résolue : "+result.address);
  }else lines.push("*** Aucune réponse DNS : "+result.reason);
 }
 $("answer").textContent=lines.join("\n");
}
async function start(){
 try{
  const res=await fetch("./dns-local-scenario.json",{cache:"no-store"});
  if(!res.ok)throw Error("Scénario indisponible");
  scenario=await res.json();engine=createEngine(scenario);render();
  $("dhcp").addEventListener("click",()=>execute("dhcp.request",clientId));
  $("wrong-dns").addEventListener("click",()=>execute("network.setNetworkOptions",clientId,{gateway:"192.168.10.1",dns:["8.8.8.8"]}));
  $("toggle").addEventListener("click",()=>execute("dns.setServerEnabled",serverId,{enabled:!state().objectsById[serverId].config.dnsEnabled}));
  $("record").addEventListener("change",render);
  $("save").addEventListener("click",()=>{
   const zone=state().objectsById[serverId].config.dnsZone;
   const previous=zone.records.find(r=>r.name===$("record").value);
   if(!previous)return void($("status").textContent="Enregistrement inconnu.");
   execute("dns.upsertRecord",serverId,{record:{name:previous.name,type:previous.type,value:$("value").value.trim()}});
  });
  $("remove").addEventListener("click",()=>execute("dns.removeRecord",serverId,{name:$("record").value}));
  $("lookup").addEventListener("click",lookup);
  $("reset").addEventListener("click",()=>{engine=createEngine(scenario);serial=0;render();$("answer").textContent="Aucune requête.";$("status").textContent="Laboratoire réinitialisé.";});
  $("status").textContent="Scénario chargé. Commence par obtenir la configuration DHCP.";
 }catch(e){$("status").textContent="Erreur : "+e.message;}
}
start();