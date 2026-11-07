import {createPingAnimator} from "./ping-animation.js";
import {createEngine} from "./r2d3-core.js";
const $=id=>document.getElementById(id);
const clients=["pc-dhcp-01","pc-dhcp-02"];
const labels={"pc-dhcp-01":"PC 1","pc-dhcp-02":"PC 2"};
const cables={"pc-dhcp-01":"cable-dhcp-pc","pc-dhcp-02":"cable-dhcp-pc-02"};
const macs={"pc-dhcp-01":"48-21-0B-5F-8C-90","pc-dhcp-02":"48-21-0B-5F-8C-91"};
let engine,scenario,sequence=0;
const snapshot=()=>engine.getSnapshot();
const command=(type,targetId,params={})=>engine.dispatch({id:"multi-"+(++sequence),commandVersion:1,type,targetId,params,expectedRevision:snapshot().revision});
const demoClock=Date.UTC(2026,10,6,9,15,0);
const leaseDate=seconds=>new Intl.DateTimeFormat("fr-FR",{timeZone:"UTC",day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit",second:"2-digit"}).format(new Date(demoClock+seconds*1000));
const mask=prefix=>{
 if(prefix===null)return "";
 const m=prefix===0?0:(0xffffffff<<(32-prefix))>>>0;
 return [24,16,8,0].map(x=>(m>>>x)&255).join(".");
};
const width="Adresse d'autoconfiguration IPv4".length;
const field=(key,val="")=>"  "+key+" "+".".repeat(Math.max(0,width-key.length))+" : "+val;
const selected=()=>$("console-pc").value;
const pc=id=>snapshot().objectsById[id];
function showIpconfig(full){
 const id=selected(),c=pc(id),v=c.config.ipv4,o=c.config.networkOptions??{gateway:null,dns:[]};
 const apipa=v.address?.startsWith("169.254.")&&!v.lease;
 const out=["C:\\Users\\technicien>ipconfig"+(full?" /all":""),"","Configuration IP de Windows",""];
 if(full){
  out.push(field("Nom de l'hôte",c.name));
  if(apipa){
   out.push(field("Description","Intel(R) Ethernet Controller (3) I225-V"),
    field("Adresse physique",macs[id]),
    field("DHCP activé","Oui"),
    field("Configuration automatique activée","Oui"),
    field("Adresse d'autoconfiguration IPv4",v.address+" (préféré)"),
    field("Masque de sous-réseau",mask(v.prefix)),
    field("Passerelle par défaut",""),
    field("NetBIOS sur Tcpip","Activé"));
  }else{
   out.push(field("DHCP activé","Oui"),field("Config. automatique","Oui"));
  }
 }
 if(!apipa||!full){
  if(v.address){
   out.push(field("Adresse IPv4",v.address+" (préféré)"),field("Masque de sous-réseau",mask(v.prefix)));
  }else out.push(field("Adresse IPv4","Non attribuée"));
  if(full){
   if(v.lease)out.push(field("Bail obtenu",leaseDate(v.lease.start)),field("Bail expirant",leaseDate(v.lease.expires)));
   out.push(field("Passerelle par défaut",o.gateway??""),field("Serveur DHCP",v.lease?snapshot().objectsById[v.lease.serverId].config.ipv4.address:""),field("Serveurs DNS",o.dns[0]??""));
   if(o.dns[1])out.push("  "+" ".repeat(width+4)+o.dns[1]);
  }
 }
 out.push("","C:\\Users\\technicien>");
 $("console").textContent=out.join("\n");
}
function update(){
 const st=snapshot(),sv=st.objectsById["srv-dhcp"];
 $("server-status").textContent=sv.config.dhcpEnabled?"Service actif":"Service arrêté";
 $("server-status").className="status "+(sv.config.dhcpEnabled?"good":"bad");
 $("toggle-server").textContent=sv.config.dhcpEnabled?"Arrêter le service DHCP":"Démarrer le service DHCP";
 for(const id of clients){
  const v=st.objectsById[id].config.ipv4;
  const status=st.runtime[id]?.dhcpStatus??"waiting";
  const modes={waiting:"En attente de bail",released:"Adresse DHCP libérée",lease:"Bail DHCP attribué",apipa:"Adresse APIPA obtenue","lease-retained":"Bail valide conservé"};
  const linked=st.linksById[cables[id]].connected;
  $("ip-"+id).textContent=v.address??"Aucune adresse IPv4";
  $("status-"+id).textContent=modes[status]??status;
  $("status-"+id).className="status "+(["lease","lease-retained"].includes(status)?"good":status==="apipa"?"bad":"");
  $("cable-"+id).textContent=linked?"Branché":"Débranché";
  $("wire-"+id).textContent=linked?"Débrancher le "+labels[id]:"Rebrancher le "+labels[id];
 }
 if($("console").textContent.includes("Configuration IP de Windows"))showIpconfig($("console").textContent.includes(">ipconfig /all"));
}
function apply(type,targetId,params={}){
 const result=command(type,targetId,params);
 if(result.status!=="applied")$("feedback").textContent="Commande refusée : "+(result.message??result.code);
 update();
 return result;
}
function renewalMessage(id){
 const outcome=snapshot().runtime[id]?.dhcpStatus;
 const parts={lease:"bail DHCP attribué",apipa:"aucune réponse DHCP, adresse APIPA obtenue","lease-retained":"renouvellement impossible, bail valide conservé"};
 return labels[id]+" · ipconfig /renew : "+(parts[outcome]??"état indisponible")+".";
}
const pingAnimator=createPingAnimator($("ping-console"));
async function start(){
 try{
  const res=await fetch("./dhcp-deux-pc-scenario.json",{cache:"no-store"});
  if(!res.ok)throw Error("Scénario indisponible");
  scenario=await res.json();engine=createEngine(scenario);
  for(const id of clients){
   $("release-"+id).addEventListener("click",()=>{
    if(apply("dhcp.release",id).status==="applied")$("feedback").textContent=labels[id]+" · ipconfig /release : adresse et bail DHCP abandonnés.";
    $("console-pc").value=id;showIpconfig(true);
   });
   $("renew-"+id).addEventListener("click",()=>{
    const result=apply("dhcp.request",id);
    if(result.status==="applied")$("feedback").textContent=renewalMessage(id);
    $("console-pc").value=id;showIpconfig(true);
   });
   $("wire-"+id).addEventListener("click",()=>{
    const connected=snapshot().linksById[cables[id]].connected;
    if(apply("network.setLinkConnected",cables[id],{connected:!connected}).status==="applied")
     $("feedback").textContent=labels[id]+" : câble "+(connected?"débranché.":"rebranché.");
   });
  }
  $("toggle-server").addEventListener("click",()=>{
   const enabled=snapshot().objectsById["srv-dhcp"].config.dhcpEnabled;
   if(apply("dhcp.setServerEnabled","srv-dhcp",{enabled:!enabled}).status==="applied")
    $("feedback").textContent="Service DHCP "+(enabled?"arrêté.":"démarré.");
  });
  $("reset").addEventListener("click",()=>{
   engine=createEngine(scenario);
   $("console").textContent="C:\\Users\\technicien>";
   pingAnimator.cancel();
   $("feedback").textContent="Laboratoire réinitialisé.";update();
  });
  $("ipconfig").addEventListener("click",()=>showIpconfig(false));
  $("ipconfig-all").addEventListener("click",()=>showIpconfig(true));
  $("console-pc").addEventListener("change",()=>{
   $("feedback").textContent="";
   pingAnimator.cancel();
   if($("console").textContent.includes("Configuration IP de Windows"))showIpconfig($("console").textContent.includes(">ipconfig /all"));
  });
  $("ping").addEventListener("click",()=>{
   const id=selected(),source=pc(id),target=snapshot().objectsById["printer-dhcp"];
   const result=engine.query({type:"network.ping",sourceId:id,targetId:"printer-dhcp"});
   pingAnimator.run({
     sourceName:source.name,sourceAddress:source.config.ipv4.address,
     targetAddress:target.config.ipv4.address,outcome:result,
   });
  });
  update();$("feedback").textContent="Scénario chargé.";
 }catch(err){$("feedback").textContent="Erreur : "+err.message;}
}
start();
