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
async function start(){
 try{
  const r=await fetch("./experiment-scenario.json",{cache:"no-store"});if(!r.ok)throw Error("Scénario non disponible");
  const scenario=await r.json();defaults=Object.fromEntries(scenario.objects.filter(x=>x.config.ipv4).map(x=>[x.id,x.config.ipv4]));
  engine=createEngine(scenario);
  engine.subscribe(()=>{$("terminal").textContent="Configuration modifiée. Relancez le ping pour obtenir un diagnostic à jour.";update();});
  $("device").addEventListener("change",refreshForm);
  $("ip-form").addEventListener("submit",e=>{e.preventDefault();dispatch("network.setIPv4",$("device").value,{interfaceId:"eth0",mode:"static",address:$("address").value.trim(),prefix:Number($("prefix").value)});});
  $("wrong-ip").addEventListener("click",()=>{ $("device").value="pc-02";dispatch("network.setIPv4","pc-02",{interfaceId:"eth0",mode:"static",address:"192.168.22.30",prefix:24});});
  $("reset-ip").addEventListener("click",()=>{const id=$("device").value;dispatch("network.setIPv4",id,{...defaults[id]});});
  $("source").addEventListener("change",update);$("target").addEventListener("change",update);
  $("ping").addEventListener("click",()=>{const source=$("source").value,target=$("target").value;const a=engine.getSnapshot().objectsById[source].config.ipv4.address,b=engine.getSnapshot().objectsById[target].config.ipv4.address;const q=engine.query({type:"network.ping",sourceId:source,targetId:target});$("terminal").textContent="> "+devices[source]+" ("+a+") : ping "+b+"\n"+(q.success?"Réponse simulée reçue.":"Échec : "+q.reason);});
  $("defaults").addEventListener("click",()=>window.location.reload());
  setFeedback("Scénario chargé.");update();
 }catch(error){setFeedback("Chargement impossible : "+error.message,false);}
}
start();
