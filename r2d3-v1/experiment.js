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
function refreshForm(){const obj=engine.getSnapshot().objectsById[$("device").value];$("address").value=obj.config.ipv4.address;$("prefix").value=obj.config.ipv4.prefix;}
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
  const mobile=window.matchMedia("(max-width: 600px)").matches;
  const lines=["C:\\Users\\Eleve>ipconfig"+(full?" /all":""),"","Configuration IP de Windows",""];
  const mobileLabels=["Nom de l'hôte","Suffixe DNS","Type de nœud","Routage IP","Proxy WINS","Statut du média","Description","Adresse physique","DHCP activé","Config. automatique","Adresse IPv4","Masque","Passerelle","Serveurs DNS"];
  const maxLabelLength=Math.max(...mobileLabels.map(label=>label.length));
  const field=(compact,windows,value="")=>{
    if(mobile) return "  "+compact+" "+ ".".repeat(maxLabelLength-compact.length)+" : "+value;
    return "   "+windows+" : "+value;
  };
  if(full) lines.push(
    field("Nom de l'hôte","Nom de l'hôte . . . . . . . . . .",station.name),
    field("Suffixe DNS","Suffixe DNS principal . . . . . ."),
    field("Type de nœud","Type de nœud. . . . . . . . . .","Hybride"),
    field("Routage IP","Routage IP activé . . . . . . .","Non"),
    field("Proxy WINS","Proxy WINS activé . . . . . . .","Non"),
    ""
  );
  lines.push("Carte Ethernet Ethernet :","");
  if(!connected) lines.push(field("Statut du média","Statut du média. . . . . . . . .","Média déconnecté"));
  if(full) lines.push(
    field("Description","Description. . . . . . . . . .","Carte réseau Ethernet"),
    field("Adresse physique","Adresse physique . . . . . . . .",id==="pc-01"?"02-00-00-00-00-01":"02-00-00-00-00-02"),
    field("DHCP activé","DHCP activé. . . . . . . . . .","Non"),
    field("Config. automatique","Configuration automatique activée","Oui")
  );
  if(connected) lines.push(
    field("Adresse IPv4","Adresse IPv4. . . . . . . . . .",ip.address+" (préféré)"),
    field("Masque","Masque de sous-réseau . . . . .",subnetMask(ip.prefix)),
    field("Passerelle","Passerelle par défaut. . . . . .")
  );
  if(full && connected) lines.push(field("Serveurs DNS","Serveurs DNS . . . . . . . . . ."));
  lines.push("","C:\\Users\\Eleve>");
  $("windows-console").textContent=lines.join("\n");
}

async function start(){
 try{
  const r=await fetch("./experiment-scenario.json",{cache:"no-store"});if(!r.ok)throw Error("Scénario non disponible");
  const scenario=await r.json();defaults=Object.fromEntries(scenario.objects.filter(x=>x.config.ipv4).map(x=>[x.id,x.config.ipv4]));
  engine=createEngine(scenario);
  engine.subscribe(()=>{$("terminal").textContent="Configuration modifiée. Relancez le ping pour obtenir un diagnostic à jour.";update();if($("windows-console").textContent.includes("Configuration IP de Windows"))showIpconfig($("windows-console").textContent.includes(">ipconfig /all"));});
  $("device").addEventListener("change",refreshForm);
  $("ip-form").addEventListener("submit",e=>{e.preventDefault();dispatch("network.setIPv4",$("device").value,{interfaceId:"eth0",mode:"static",address:$("address").value.trim(),prefix:Number($("prefix").value)});});
  $("wrong-ip").addEventListener("click",()=>{ $("device").value="pc-02";dispatch("network.setIPv4","pc-02",{interfaceId:"eth0",mode:"static",address:"192.168.22.30",prefix:24});});
  $("reset-ip").addEventListener("click",()=>{const id=$("device").value;dispatch("network.setIPv4",id,{...defaults[id]});});
  $("source").addEventListener("change",update);$("target").addEventListener("change",update);
  $("ipconfig").addEventListener("click",()=>showIpconfig(false));
  $("ipconfig-all").addEventListener("click",()=>showIpconfig(true));
  window.addEventListener("resize",()=>{const text=$("windows-console").textContent;if(text.includes("Configuration IP de Windows"))showIpconfig(text.includes(">ipconfig /all"));});
  $("ping").addEventListener("click",()=>{
    const source=$("source").value,target=$("target").value;
    const snapshot=engine.getSnapshot();
    const sourceIp=snapshot.objectsById[source].config.ipv4.address;
    const targetIp=snapshot.objectsById[target].config.ipv4.address;
    const outcome=engine.query({type:"network.ping",sourceId:source,targetId:target});
    const received=outcome.success?4:0, lost=4-received;
    const replies=Array.from({length:4},()=>outcome.success
      ?"Réponse de "+targetIp+" : octets=32 temps<1 ms TTL=128"
      :"Délai d'attente de la demande dépassé.");
    $("terminal").textContent=[
      "> "+devices[source]+" ("+sourceIp+") : ping "+targetIp,
      "",
      "Envoi d'une requête 'Ping' "+targetIp+" avec 32 octets de données :",
      ...replies,
      "",
      "Statistiques Ping pour "+targetIp+" :",
      "    Paquets : envoyés = 4, reçus = "+received+", perdus = "+lost+
        " (perte "+(lost?100:0)+" %)",
      ...(outcome.success
        ?["Durées approximatives des boucles en millisecondes :",
          "    Minimum = <1ms, Maximum = <1ms, Moyenne = <1ms"]
        :["Diagnostic : "+outcome.reason])
    ].join("\n");
  });
  $("defaults").addEventListener("click",()=>window.location.reload());
  setFeedback("Scénario chargé.");update();
 }catch(error){setFeedback("Chargement impossible : "+error.message,false);}
}
start();
