import {createEngine} from "./r2d3-core.js";
const $=id=>document.getElementById(id);
let engine,scenario,sequence=0;
const cmd=(type,targetId,params={})=>engine.dispatch({commandVersion:1,id:"dhcp-lab-"+(++sequence),type,targetId,params,expectedRevision:engine.getSnapshot().revision});
const state=()=>engine.getSnapshot();
const pc=()=>state().objectsById["pc-dhcp"];
const pool=()=>state().objectsById["srv-dhcp"].config.dhcpPool;
const demoClock=Date.UTC(2026,10,6,9,15,0);
const leaseDate=seconds=>new Intl.DateTimeFormat("fr-FR",{timeZone:"UTC",day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit",second:"2-digit"}).format(new Date(demoClock+seconds*1000));
const mask=prefix=>{
 const n=prefix===null?null:prefix===0?0:(0xffffffff<<(32-prefix))>>>0;
 return n===null?"": [24,16,8,0].map(x=>(n>>>x)&255).join(".");
};
const field=(label,value="")=>{
 const widest="Passerelle par défaut".length;
 return "  "+label+" "+".".repeat(Math.max(0,widest-label.length))+" : "+value;
};
function showIpconfig(full){
 const c=pc(),v=c.config.ipv4,o=c.config.networkOptions;
 const lines=["C:\\Users\\technicien>ipconfig"+(full?" /all":""),"","Configuration IP de Windows",""];
 if(full)lines.push(field("Nom de l'hôte",c.name),field("DHCP activé","Oui"),field("Config. automatique","Oui"));
 if(v.address){
  lines.push(field("Adresse IPv4",v.address+(v.lease?" (préféré)":" (autoconfiguration)")),field("Masque de sous-réseau",mask(v.prefix)));
 }else lines.push(field("Adresse IPv4","Non attribuée"));
 if(full){
  if(v.lease){
   lines.push(field("Bail obtenu",leaseDate(v.lease.start)),field("Bail expirant",leaseDate(v.lease.expires)));
  }
  lines.push(field("Passerelle par défaut",o.gateway??""),field("Serveur DHCP",v.lease?state().objectsById[v.lease.serverId].config.ipv4.address:""),field("Serveurs DNS",o.dns[0]??""));
  if(o.dns[1])lines.push("  "+" ".repeat("Passerelle par défaut".length+4)+o.dns[1]);
 }
 lines.push("","C:\\Users\\technicien>");
 $("console").textContent=lines.join("\n");
}
function update(){
 const snap=state(),sv=snap.objectsById["srv-dhcp"],cl=snap.objectsById["pc-dhcp"];
 const attached=snap.linksById["cable-dhcp-server"].connected;
 $("server-status").textContent=sv.config.dhcpEnabled?"Service actif":"Service arrêté";
 $("server-status").className="status "+(sv.config.dhcpEnabled?"good":"bad");
 $("cable-status").textContent=attached?"Branché":"Débranché";
 $("cable-status").className="status "+(attached?"good":"bad");
 $("toggle-server").textContent=sv.config.dhcpEnabled?"Arrêter le service DHCP":"Démarrer le service DHCP";
 $("toggle-cable").textContent=attached?"Débrancher le serveur":"Rebrancher le serveur";
 $("client-ip").textContent=cl.config.ipv4.address??"Aucune adresse IPv4";
 const mode=snap.runtime["pc-dhcp"]?.dhcpStatus??"waiting";
 const modes={waiting:"En attente de demande DHCP",lease:"Bail DHCP attribué",apipa:"Adresse APIPA obtenue", "lease-retained":"Bail valide conservé (renouvellement impossible)"};
 $("client-status").textContent=modes[mode]??mode;
 $("client-status").className="status "+(mode==="lease"||mode==="lease-retained"?"good":mode==="apipa"?"bad":"");
 const consoleText=$("console").textContent;
 if(consoleText.includes("Configuration IP de Windows"))showIpconfig(consoleText.includes(">ipconfig /all"));
}
function action(type,targetId,params){
 const result=cmd(type,targetId,params);
 $("feedback").textContent=result.status==="applied"?"Modification appliquée.":"Opération refusée : "+result.message;
 update();
 return result;
}
async function start(){
 try{
  const response=await fetch("./dhcp-scenario.json",{cache:"no-store"});
  if(!response.ok)throw Error("Scénario indisponible");
  scenario=await response.json();
  engine=createEngine(scenario);
  $("request").addEventListener("click",()=>{
   action("dhcp.request","pc-dhcp");
   const rt=state().runtime["pc-dhcp"];
   $("feedback").textContent=rt.dhcpStatus==="lease"?"Bail DHCP attribué.":rt.dhcpStatus==="lease-retained"?"Renouvellement impossible. Bail valide conservé.":"Aucune réponse DHCP : adresse APIPA attribuée.";
   showIpconfig(true);
  });
  $("toggle-server").addEventListener("click",()=>action("dhcp.setServerEnabled","srv-dhcp",{enabled:!state().objectsById["srv-dhcp"].config.dhcpEnabled}));
  $("toggle-cable").addEventListener("click",()=>action("network.setLinkConnected","cable-dhcp-server",{connected:!state().linksById["cable-dhcp-server"].connected}));
  $("ipconfig").addEventListener("click",()=>showIpconfig(false));
  $("ipconfig-all").addEventListener("click",()=>showIpconfig(true));
  $("reset").addEventListener("click",()=>{engine=createEngine(scenario);$("ping-console").textContent="Aucun ping effectué.";$("feedback").textContent="Scénario réinitialisé.";update();});
  $("ping").addEventListener("click",()=>{
   const result=engine.query({type:"network.ping",sourceId:"pc-dhcp",targetId:"printer-dhcp"});
   const target="192.168.10.50";
   const replies=Array.from({length:4},()=>result.success?"Réponse de "+target+" : octets=32 temps<1 ms TTL=128":"Délai d'attente de la demande dépassé.");
   $("ping-console").textContent=["C:\\Users\\technicien>ping "+target,"",...replies,"","Paquets : envoyés = 4, reçus = "+(result.success?4:0)+", perdus = "+(result.success?0:4)+" ("+(result.success?0:100)+" % de perte)","",result.reason].join("\n");
  });
  update();
  $("feedback").textContent="Scénario chargé.";
 }catch(err){$("feedback").textContent="Erreur : "+err.message;}
}
start();
