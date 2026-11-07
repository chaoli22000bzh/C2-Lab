import {createPingAnimator} from "../shared-ui/v1/ping-animation.js";
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
const pingAnimator=createPingAnimator($("ping-console"),{intervalMs:330});
function cancelPing(message=""){pingAnimator.cancel(message);}
function ping(targetId){
 const id=selected(),source=state().objectsById[id];
 const result=engine.query({type:"network.ping",sourceId:id,targetId});
 pingAnimator.run({
  sourceName:source.name,sourceAddress:source.config.ipv4.address,
  targetAddress:ip(targetId).address,outcome:result,
 });
}
async function start(){
 try{
  const r=await fetch("./conflit-ipv4-scenario.json",{cache:"no-store"});
  if(!r.ok)throw Error("Scénario non disponible");
  scenario=await r.json();engine=createEngine(scenario);
  $("ipconfig").addEventListener("click",()=>showIpconfig(false));
  $("ipconfig-all").addEventListener("click",()=>showIpconfig(true));
  $("console-pc").addEventListener("change",()=>{
   $("feedback").textContent="";
   cancelPing();
   if($("console").textContent.includes("Configuration IP de Windows"))showIpconfig($("console").textContent.includes(">ipconfig /all"));
  });
  $("ping").addEventListener("click",()=>ping("printer-dhcp"));
  $("ping-peer").addEventListener("click",()=>ping(other(selected())));
  $("address-form").addEventListener("submit",e=>{
   e.preventDefault();
   const address=$("new-address").value.trim();
   const result=command("network.setIPv4","pc-dhcp-02",{mode:"static",interfaceId:"eth0",address,prefix:24});
   $("feedback").textContent=result.status==="applied"?"Adresse IPv4 du PC 2 appliquée.":"Adresse refusée : "+(result.message??result.code);
   if(result.status==="applied")cancelPing();
   update();
  });
  $("reset").addEventListener("click",()=>{
   cancelPing();engine=createEngine(scenario);
   $("new-address").value="192.168.10.20";
   $("console").textContent="C:\\Users\\technicien>";
   pingAnimator.cancel();
   $("feedback").textContent="Scénario réinitialisé.";update();
  });
  update();$("feedback").textContent="Scénario chargé.";
 }catch(e){$("feedback").textContent="Erreur : "+e.message;}
}
start();
