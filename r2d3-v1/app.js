import {createEngine} from "./r2d3-core.js";
const $=id=>document.getElementById(id);
let engine, seq=0, initialIP;
const result=(message,success=true)=>{$("command-result").textContent=message;$("command-result").style.color=success?"#24643e":"#a4382b"};
function cmd(type,targetId,params){
 const commandVersion=1,id="demo-"+(++seq),expectedRevision=engine.getSnapshot().revision;
 const response=engine.dispatch({commandVersion,id,type,targetId,params,origin:"demo",expectedRevision});
 result(response.status==="applied"?"Modification appliquée (révision "+response.revision+").":"Opération refusée : "+response.message,response.status==="applied");
 return response;
}
function render(){
 const state=engine.getSnapshot(),pc=state.objectsById["pc-01"],printer=state.objectsById["printer-01"];
 const ip=pc.config.ipv4,pi=printer.config.ipv4,connected=state.linksById["cable-printer"].connected;
 $("pc-summary").innerHTML="<b>Équipement :</b> "+pc.name+"<br><b>Interface :</b> eth0 / RJ45<br><b>Révision :</b> "+state.revision;
 $("address").value=ip.address;$("prefix").value=ip.prefix;
 $("pc-address").textContent=ip.address+"/"+ip.prefix;
 $("printer-address").textContent=pi.address+"/"+pi.prefix;
 $("link-summary").innerHTML="<b>Câble PC :</b> "+(state.linksById["cable-pc"].connected?"branché":"débranché")+"<br><b>Câble imprimante :</b> "+(connected?"branché":"débranché");
 $("wire-pc").classList.toggle("off",!state.linksById["cable-pc"].connected);
 $("wire-printer").classList.toggle("off",!connected);
 $("toggle-wire").textContent=connected?"Débrancher le câble imprimante":"Rebrancher le câble imprimante";
 const ping=engine.query({type:"network.ping",sourceId:"pc-01",targetId:"printer-01"});
 $("connectivity").className="state "+(ping.success?"ok":"bad");
 $("connectivity").textContent=(ping.success?"Connectivité disponible":"Connectivité indisponible")+" : "+ping.reason;
}
function setIP(address,prefix){cmd("network.setIPv4","pc-01",{interfaceId:"eth0",mode:"static",address,prefix:Number(prefix)})}
async function start(){
 try{
  const response=await fetch("./scenario.json",{cache:"no-store"});
  if(!response.ok)throw Error("Scénario non disponible");
  const scenario=await response.json();
  engine=createEngine(scenario);initialIP=engine.getSnapshot().objectsById["pc-01"].config.ipv4;
  engine.subscribe(render);render();
  $("ip-form").addEventListener("submit",event=>{event.preventDefault();setIP($("address").value.trim(),$("prefix").value)});
  $("wrong-ip").addEventListener("click",()=>setIP("192.168.22.20",24));
  $("fix-ip").addEventListener("click",()=>setIP(initialIP.address,initialIP.prefix));
  $("toggle-wire").addEventListener("click",()=>{const connected=engine.getSnapshot().linksById["cable-printer"].connected;cmd("network.setLinkConnected","cable-printer",{connected:!connected})});
  $("ping").addEventListener("click",()=>{
   const pc=engine.getSnapshot().objectsById["pc-01"].config.ipv4;
   const printer=engine.getSnapshot().objectsById["printer-01"].config.ipv4;
   const outcome=engine.query({type:"network.ping",sourceId:"pc-01",targetId:"printer-01"});
   $("terminal").textContent="> ping "+printer.address+"\n"+(outcome.success?"Réponse de "+printer.address+" : simulation réussie":"Échec : "+outcome.reason)+"\nSource : "+pc.address+"/"+pc.prefix;
  });
 }catch(e){result("Chargement impossible : "+e.message,false);$("connectivity").textContent="Démonstration indisponible"}
}
start();
