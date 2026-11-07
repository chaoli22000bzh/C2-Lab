import {createEngine} from "./r2d3-core.js";
const $=id=>document.getElementById(id);
let engine,scenario,seq=0;
const state=()=>engine.getSnapshot();
const ids=["pc-dhcp-01","pc-dhcp-02"];
const selected=()=>$("console-pc").value;
const other=id=>ids.find(x=>x!==id);
const ip=id=>state().objectsById[id].config.ipv4;
const command=(type,targetId,params)=>engine.dispatch({id:"conflict-"+(++seq),commandVersion:1,type,targetId,params,expectedRevision:state().revision});
const mask=prefix=>{const n=prefix===0?0:(0xffffffff<<(32-prefix))>>>0;return [24,16,8,0].map(k=>(n>>>k)&255).join(".");};
const field=(label,value="")=>"  "+label+" "+".".repeat(Math.max(0,32-label.length))+" : "+value;
function showIpconfig(all){
 const id=selected(),c=state().objectsById[id],v=c.config.ipv4,opts=c.config.networkOptions;
 const output=["C:\\Users\\technicien>ipconfig"+(all?" /all":""),"","Configuration IP de Windows",""];
 if(all)output.push(field("Nom de l'hôte",c.name),field("DHCP activé","Non"));
 output.push(field("Adresse IPv4",v.address+" (préféré)"),field("Masque de sous-réseau",mask(v.prefix)));
 if(all)output.push(field("Passerelle par défaut",opts.gateway??""),field("Serveurs DNS",opts.dns[0]??""));
 output.push("","C:\\Users\\technicien>");
 $("console").textContent=output.join("\n");
}
function update(){
 for(const id of ids)$("ip-"+id).textContent=ip(id).address;
 if($("console").textContent.includes("Configuration IP de Windows"))showIpconfig($("console").textContent.includes(">ipconfig /all"));
}
function ping(targetId){
 const id=selected(),result=engine.query({type:"network.ping",sourceId:id,targetId});
 const target=ip(targetId).address;
 const lines=["C:\\Users\\technicien>ping "+target,""];
 if(result.conflict){
  lines.push("Simulation : communication non fiable, conflit d'adresses IPv4.","Les réponses ICMP réelles peuvent varier selon le système et l'état ARP.");
 }else if(result.success){
  for(let i=0;i<4;i++)lines.push("Réponse de "+target+" : octets=32 temps<1 ms TTL=128");
  lines.push("","Paquets : envoyés = 4, reçus = 4, perdus = 0 (0 % de perte)");
 }else{
  for(let i=0;i<4;i++)lines.push("Délai d'attente de la demande dépassé.");
  lines.push("","Paquets : envoyés = 4, reçus = 0, perdus = 4 (100 % de perte)");
 }
 lines.push("",result.reason);
 $("ping-console").textContent=lines.join("\n");
 $("feedback").textContent=result.conflict?"Conflit IPv4 détecté : résultat du ping non déterministe dans la réalité.":result.success?"Ping réussi.":"Ping en échec.";
}
async function start(){
 try{
  const r=await fetch("./conflit-ipv4-scenario.json",{cache:"no-store"});
  if(!r.ok)throw Error("Scénario non disponible");
  scenario=await r.json();engine=createEngine(scenario);
  $("ipconfig").addEventListener("click",()=>showIpconfig(false));
  $("ipconfig-all").addEventListener("click",()=>showIpconfig(true));
  $("console-pc").addEventListener("change",()=>{
   if($("console").textContent.includes("Configuration IP de Windows"))showIpconfig($("console").textContent.includes(">ipconfig /all"));
  });
  $("ping").addEventListener("click",()=>ping("printer-dhcp"));
  $("ping-peer").addEventListener("click",()=>ping(other(selected())));
  $("diagnose").addEventListener("click",()=>{
   const q=engine.query({type:"network.ipv4Conflicts"});
   $("diagnosis").textContent=q.conflicts.length?q.conflicts.map(c=>"Adresse "+c.address+" utilisée par "+c.ids.map(id=>state().objectsById[id].name).join(" et ")+".").join(" "):"Aucune adresse IPv4 en double détectée sur le segment.";
   $("diagnosis").className=q.conflicts.length?"status bad":"status good";
  });
  $("address-form").addEventListener("submit",e=>{
   e.preventDefault();
   const address=$("new-address").value.trim();
   const result=command("network.setIPv4","pc-dhcp-02",{mode:"static",interfaceId:"eth0",address,prefix:24});
   $("feedback").textContent=result.status==="applied"?"Adresse IPv4 du PC 2 appliquée. Vérifie le diagnostic et les pings.":"Adresse refusée : "+(result.message??result.code);
   if(result.status==="applied")$("diagnosis").textContent="Configuration modifiée. Relancer le contrôle des doublons.";
   update();
  });
  $("reset").addEventListener("click",()=>{
   engine=createEngine(scenario);
   $("new-address").value="192.168.10.20";
   $("diagnosis").textContent="Aucun contrôle des doublons effectué.";
   $("diagnosis").className="small";
   $("console").textContent="C:\\Users\\technicien>";
   $("ping-console").textContent="Aucun ping effectué.";
   $("feedback").textContent="Scénario réinitialisé.";update();
  });
  update();$("feedback").textContent="Scénario chargé.";
 }catch(e){$("feedback").textContent="Erreur : "+e.message;}
}
start();
