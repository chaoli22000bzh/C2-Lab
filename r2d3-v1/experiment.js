import {formatIpconfig} from "../shared-ui/v1/ipconfig.js";
import {createPingAnimator} from "../shared-ui/v1/ping-animation.js";
import {createWindowsFieldFormatter} from "../shared-ui/v1/windows-fields.js";
import {createEngine} from "./r2d3-core.js";
const $=id=>document.getElementById(id);
const devices={"pc-01":"PC 1","pc-02":"PC 2","printer-01":"Imprimante"};
const cables={"cable-pc":"PC 1","cable-pc2":"PC 2","cable-printer":"Imprimante"};
let engine, defaults, seq=0;
function setFeedback(msg,ok=true){$("feedback").textContent=msg;$("feedback").style.color=ok?"#14623b":"#ae3f29";}
function dispatch(type,targetId,params){
 const response=engine.dispatch({commandVersion:1,id:"atelier-"+(++seq),type,targetId,params,expectedRevision:engine.getSnapshot().revision});
 setFeedback(response.status==="applied"?"Modification appliquée (révision "+response.revision+").":"Opération refusée : "+(response.message||response.code),response.status==="applied");
 return response;
}
function refreshForm(){const obj=engine.getSnapshot().objectsById[$("device").value];$("address").value=obj.config.ipv4.address;$("prefix").value=obj.config.ipv4.prefix;const opts=obj.config.networkOptions??{gateway:null,dns:[]};$("gateway").value=opts.gateway??"";$("dns1").value=opts.dns[0]??"";$("dns2").value=opts.dns[1]??"";}
function update(){
 const s=engine.getSnapshot();
 for(const [id,el] of [["pc-01","ip-pc1"],["pc-02","ip-pc2"],["printer-01","ip-printer"]]){
  const v=s.objectsById[id].config.ipv4;$(el).textContent=v.address+"/"+v.prefix;
 }
 const root=$("cables");root.replaceChildren();
 const summary=$("links");summary.replaceChildren();
 for(const [id,label] of Object.entries(cables)){
  const attached=s.linksById[id].connected;
  const item=document.createElement("div");item.className="row";
  const b=document.createElement("button");b.type="button";b.className="secondary";b.textContent=(attached?"Débrancher ":"Rebrancher ")+label;b.addEventListener("click",()=>dispatch("network.setLinkConnected",id,{connected:!attached}));
  const text=document.createElement("span");text.textContent=label+" : "+(attached?"branché":"débranché")+" ";item.append(text,b);root.append(item);
  const row=document.createElement("div");row.className="row";row.textContent=(attached?"🟢 ":"🔴 ")+label+" connecté au switch : "+(attached?"oui":"non");summary.append(row);
 }
 refreshForm();
 const q=engine.query({type:"network.ping",sourceId:$("source").value,targetId:$("target").value});
 $("connectivity").className="state "+(q.success?"good":"bad");
 $("connectivity").textContent=(q.success?"Communication possible":"Communication impossible")+" : "+q.reason;
}

function subnetMask(prefix) {
  if (!Number.isInteger(prefix) || prefix<0 || prefix>32) return "Non renseigné";
  const mask=prefix===0?0:(0xffffffff << (32-prefix))>>>0;
  return [24,16,8,0].map(shift=>(mask>>>shift)&255).join(".");
}
function showIpconfig(full) {
  const id=$("console-pc").value;
  const snapshot=engine.getSnapshot();
  const station=snapshot.objectsById[id];
  const ip=station.config.ipv4;
  const cable=id==="pc-01"?"cable-pc":"cable-pc2";
  const connected=snapshot.linksById[cable].connected;
  const options=station.config.networkOptions??{gateway:null,dns:[]};
  if(!full){
    $("windows-console").textContent=formatIpconfig({ipv4:ip,connected,gateway:options.gateway});
    return;
  }
  const lines=["C:\\Users\\technicien>ipconfig"+(full?" /all":""),"","Configuration IP de Windows",""];
  const labelWidth=Math.max(...["Nom de l'hôte","DHCP activé","Config. automatique","Adresse IPv4","Masque de sous-réseau","Passerelle par défaut","Serveurs DNS","Statut du média"].map(label=>label.length));
  const field=createWindowsFieldFormatter(["Nom de l'hôte","DHCP activé","Config. automatique","Adresse IPv4","Masque de sous-réseau","Passerelle par défaut","Serveurs DNS","Statut du média"]);
  if(full) lines.push(
    field("Nom de l'hôte",station.name),
    field("DHCP activé","Non"),
    field("Config. automatique","Oui")
  );
  if(!connected) {
    lines.push(field("Statut du média","Média déconnecté"));
  } else {
    lines.push(
      field("Adresse IPv4",ip.address+" (préféré)"),
      field("Masque de sous-réseau",subnetMask(ip.prefix)),
      field("Passerelle par défaut",options.gateway??"")
    );
    if(full) {
      lines.push(field("Serveurs DNS",options.dns[0]??""));
      if(options.dns[1])lines.push("  "+" ".repeat(labelWidth+4)+options.dns[1]);
    }
  }
  lines.push("","C:\\Users\\technicien>");
  $("windows-console").textContent=lines.join("\n");
}

function showDhcpExample() {
  const area=$("dhcp-example");
  const button=$("dhcp-preview");
  const open=area.hidden;
  area.hidden=!open;
  button.setAttribute("aria-expanded",String(open));
  button.textContent=open?"Masquer l'exemple DHCP":"Afficher ipconfig /all en DHCP";
  if(!open)return;
  area.textContent=[
    "C:\\Users\\technicien>ipconfig /all",
    "",
    "Configuration IP de Windows",
    "",
    "Nom de l'hôte ........ : REN-PC-01",
    "DHCP activé .......... : Oui",
    "Config. automatique .. : Oui",
    "Adresse IPv4 ......... : 192.168.1.26",
    "                         (préféré)",
    "Masque de sous-réseau  : 255.255.255.0",
    "",
    "Bail obtenu .......... :",
    "  06/11/2026 à 09:15:00",
    "Bail expirant ........ :",
    "  07/11/2026 à 09:15:00",
    "",
    "Passerelle par défaut  : 192.168.1.1",
    "Serveur DHCP ......... : 192.168.1.1",
    "Serveurs DNS ......... : 192.168.1.10",
    "                         1.1.1.1",
    "",
    "C:\\Users\\technicien>"
  ].join("\n");
}

const pingAnimator=createPingAnimator($("terminal"));
async function start(){
 try{
  const r=await fetch("./experiment-scenario.json",{cache:"no-store"});if(!r.ok)throw Error("Scénario non disponible");
  const scenario=await r.json();defaults=Object.fromEntries(scenario.objects.filter(x=>x.config.ipv4).map(x=>[x.id,x.config.ipv4]));
  engine=createEngine(scenario);
  engine.subscribe(()=>{pingAnimator.cancel("Configuration modifiée. Relancez le ping pour obtenir un diagnostic à jour.");update();if($("windows-console").textContent.includes("Configuration IP de Windows"))showIpconfig($("windows-console").textContent.includes(">ipconfig /all"));});
  $("device").addEventListener("change",refreshForm);
  $("ip-form").addEventListener("submit",e=>{e.preventDefault();dispatch("network.setIPv4",$("device").value,{interfaceId:"eth0",mode:"static",address:$("address").value.trim(),prefix:Number($("prefix").value)});});
  $("options-form").addEventListener("submit",e=>{
    e.preventDefault();
    const gateway=$("gateway").value.trim()||null;
    const dns=[$("dns1").value.trim(),$("dns2").value.trim()].filter(Boolean);
    dispatch("network.setNetworkOptions",$("device").value,{gateway,dns});
  });
  $("wrong-ip").addEventListener("click",()=>{ $("device").value="pc-02";dispatch("network.setIPv4","pc-02",{interfaceId:"eth0",mode:"static",address:"192.168.22.30",prefix:24});});
  $("reset-ip").addEventListener("click",()=>{const id=$("device").value;dispatch("network.setIPv4",id,{...defaults[id]});});
  $("source").addEventListener("change",()=>{pingAnimator.cancel();update();});$("target").addEventListener("change",()=>{pingAnimator.cancel();update();});
  $("ipconfig").addEventListener("click",()=>showIpconfig(false));
  $("ipconfig-all").addEventListener("click",()=>showIpconfig(true));
  $("dhcp-preview").addEventListener("click",showDhcpExample);
  window.addEventListener("resize",()=>{const text=$("windows-console").textContent;if(text.includes("Configuration IP de Windows"))showIpconfig(text.includes(">ipconfig /all"));});
  $("ping").addEventListener("click",()=>{
    const sourceId=$("source").value,targetId=$("target").value;
    const current=engine.getSnapshot(),src=current.objectsById[sourceId],dst=current.objectsById[targetId];
    const outcome=engine.query({type:"network.ping",sourceId:sourceId,targetId:targetId});
    pingAnimator.run({
      sourceName:devices[sourceId]+(src.name&&src.name!==devices[sourceId]?" - "+src.name:""),sourceAddress:src.config.ipv4.address,
      targetAddress:dst.config.ipv4.address,outcome
    });
  });
  $("defaults").addEventListener("click",()=>window.location.reload());
  setFeedback("Scénario chargé.");update();
 }catch(error){setFeedback("Chargement impossible : "+error.message,false);}
}
start();
