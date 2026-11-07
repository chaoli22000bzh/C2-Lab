import {createPingAnimator} from "../shared-ui/v1/ping-animation.js";
import {createEngine} from "./r2d3-core.js";
const $=id=>document.getElementById(id);
const ids=["pc-dhcp-01","pc-dhcp-02"];
const mask="255.255.255.0";
// Seul le libellé le plus long est sans points, les autres sont alignés sur lui.
const ipconfigFields=["Adresse IPv4","Masque de sous-réseau","Passerelle par défaut"];
const fieldWidth=Math.max(...ipconfigFields.map(label=>label.length));
const field=(label,value)=>"   "+label+".".repeat(fieldWidth-label.length)+" : "+value;
let engine,scenario,seq=0;
const snap=()=>engine.getSnapshot();
const selected=()=>$("console-pc").value;
const other=id=>ids.find(x=>x!==id);
const command=(type,targetId,params={})=>engine.dispatch({id:"arp-lab-"+(++seq),type,targetId,params,commandVersion:1,expectedRevision:snap().revision});
const pingAnimator=createPingAnimator($("ping-console"));
function showArp(){
 const id=selected(),pc=snap().objectsById[id];
 const table=engine.query({type:"network.arpTable",sourceId:id}).entries;
 const rows=table.map(r=>"  "+r.address.padEnd(24)+r.mac.padEnd(23)+r.type);
 $("console").textContent=[
  "C:\\Users\\technicien>arp -a","",
  "Interface : "+pc.config.ipv4.address+" --- 0x2",
  "  Adresse Internet         Adresse physique       Type",
  ...rows,
  "","C:\\Users\\technicien>"
 ].join("\n");
}
function showConfig(){
 const p=snap().objectsById[selected()];
 $("console").textContent=[
 "C:\\Users\\technicien>ipconfig","","Configuration IP de Windows","",
 "Carte Ethernet Ethernet :","",field("Adresse IPv4",p.config.ipv4.address),
 field("Masque de sous-réseau",mask),
 field("Passerelle par défaut",p.config.networkOptions?.gateway??""),
 "","C:\\Users\\technicien>"
 ].join("\n");
}
function ping(targetId){
 const sourceId=selected(),st=snap(),from=st.objectsById[sourceId],to=st.objectsById[targetId];
 const outcome=engine.query({type:"network.ping",sourceId,targetId});
 pingAnimator.run({sourceName:from.name,sourceAddress:from.config.ipv4.address,targetAddress:to.config.ipv4.address,
  outcome,onComplete:({success})=>{
   if(!success)return;
   const result=command("network.arpLearn",sourceId,{peerId:targetId});
   if(result.status!=="applied")$("feedback").textContent="Erreur : "+result.message;
  }
 });
}
function reset(){
 pingAnimator.cancel();engine=createEngine(scenario);
 $("console").textContent="C:\\Users\\technicien>";
 $("new-address").value="192.168.10.21";
 $("pc2-ip").textContent="192.168.10.21";
 $("feedback").textContent="";
}
async function start(){
 try{
  const r=await fetch("./arp-windows-scenario.json",{cache:"no-store"});
  if(!r.ok)throw Error("Scénario inaccessible");
  scenario=await r.json();engine=createEngine(scenario);
  $("console-pc").addEventListener("change",()=>{
   pingAnimator.cancel();$("console").textContent="C:\\Users\\technicien>";
  });
  $("arp-a").addEventListener("click",showArp);
  $("arp-d").addEventListener("click",()=>{
   const res=command("network.arpClear",selected());
   if(res.status==="applied")$("console").textContent="C:\\Users\\technicien>arp -d *\n\nC:\\Users\\technicien>";
  });
  $("ipconfig").addEventListener("click",showConfig);
  $("ping-printer").addEventListener("click",()=>ping("printer-dhcp"));
  $("ping-peer").addEventListener("click",()=>ping(other(selected())));
  $("address-form").addEventListener("submit",e=>{
   e.preventDefault();
   const address=$("new-address").value.trim();
   const result=command("network.setIPv4","pc-dhcp-02",{interfaceId:"eth0",mode:"static",address,prefix:24});
   if(result.status==="applied"){
    $("pc2-ip").textContent=address;
    pingAnimator.cancel();$("console").textContent="C:\\Users\\technicien>";
    $("feedback").textContent="";
   }else{$("feedback").textContent="Adresse invalide.";}
  });
  $("reset").addEventListener("click",reset);
  $("feedback").textContent="Scénario chargé.";
 }catch(err){$("feedback").textContent="Erreur : "+err.message;}
}
start();
