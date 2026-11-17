import {createAssetRegistry} from "./asset-profiles.js";
import {createRouter,configureRouterPort} from "./router-interfaces-v1.js";
import {createEngine} from "./r2d3-core.js";
import {mountRouterAdmin} from "./router-admin-ui-v1.js";
import {addRouterPatRule,setRouterPatRuleEnabled,removeRouterPatRule,getRouterPatRules,observeInboundPat} from "./router-pat-v1.js";
const $=id=>document.getElementById(id);
let registry,router,outside,server,core,cables,admin,serial=0;
const get=(n)=>$(n).value.trim();
const say=(message,type="")=>{$("result").textContent=message;$("result").className="result "+type;};
function cable(x,y){const c=registry.createCable().cable;for(const [i,p] of [[0,x],[1,y]]){const r=registry.connectCableEnd(c.id,i,p);if(!r.success)throw Error(r.message);}return c.id;}
function inputAddresses(){return {
 [outside.id]:{address:get("outside-ip"),prefix:Number(get("outside-prefix")),gateway:get("outside-gw")},
 [server.id]:{address:get("server-ip"),prefix:Number(get("server-prefix")),gateway:get("server-gw")}
};}
function make(){
 admin?.destroy();registry=createAssetRegistry();
 router=createRouter(registry,{name:"RTR-01",ports:4}).asset;
 const p=registry.createProfile("PC RJ45").profile;
 registry.addPortGroup(p.id,{type:"ethernet-rj45",prefix:"NIC",start:1,count:1});
 outside=registry.createAsset(p.id,{name:"PC-EXTERIEUR"}).asset;
 server=registry.createAsset(p.id,{name:"SRV-HTTP"}).asset;
 cables={wan:cable(outside.ports[0].id,router.ports[0].id),lan:cable(server.ports[0].id,router.ports[1].id)};
 configureRouterPort(registry,router.id,router.ports[0].id,{role:"wan",mode:"static",address:"203.0.113.10",prefix:24});
 configureRouterPort(registry,router.id,router.ports[1].id,{role:"lan",mode:"static",address:"192.168.10.1",prefix:24});
 core=createEngine({format:"r2d3-scenario",schemaVersion:1,scenarioId:"pat-lab",scenarioVersion:"1.0.0",capabilities:{network:true},objects:[{id:server.id,kind:"ethernet-endpoint",name:server.name,ports:[{id:server.ports[0].id,type:"rj45"}],config:{ipv4:{interfaceId:server.ports[0].id,mode:"static",address:"192.168.10.10",prefix:24},applicationServices:{http:true}},runtime:{}}],links:[]});
 for(const [id,v] of Object.entries({"outside-ip":"203.0.113.20","outside-prefix":"24","outside-gw":"203.0.113.10","server-ip":"192.168.10.10","server-prefix":"24","server-gw":"192.168.10.1","wan-ip":"203.0.113.10","wan-port":"8080","rule-external":"8080","rule-dest":"192.168.10.10","rule-internal":"80"}))$(id).value=v;
 $("rule-protocol").value="tcp";$("request-protocol").value="tcp";
 $("service-enabled").checked=true;
 admin=mountRouterAdmin({root:$("router-admin"),registry,assetId:router.id});
 paint();say("Créer d'abord la règle PAT, puis tester l'accès HTTP.");
}
function paint(){
 const rules=getRouterPatRules(registry,router.id)||[];
 $("rules").replaceChildren();
 if(!rules.length)$("rules").textContent="Aucune règle PAT.";
 for(const r of rules){
  const box=document.createElement("div");box.className="rule-row";
  const label=document.createElement("span");label.textContent=r.protocol.toUpperCase()+" "+r.externalPort+" → "+r.internalAddress+":"+r.internalPort+" ("+(r.enabled?"active":"inactive")+")";box.append(label);
  for(const [action,title] of [["toggle",r.enabled?"Désactiver":"Activer"],["remove","Supprimer"]]){
   const btn=document.createElement("button");btn.textContent=title;btn.type="button";
   btn.onclick=()=>{
    const o=action==="toggle"?setRouterPatRuleEnabled(registry,router.id,r.id,!r.enabled):removeRouterPatRule(registry,router.id,r.id);
    paint();say(o.success?"Règle mise à jour.":o.message,o.success?"success":"failed");
   };box.append(btn);
  }$("rules").append(box);
 }
 for(const [side,name] of [["wan","WAN"],["lan","LAN"]]){
  const linked=!!registry.getCable(cables[side]).ends[1];
  $("wire-"+side).classList.toggle("cut",!linked);
  $("cable-"+side).textContent=(linked?"Débrancher":"Rebrancher")+" câble "+name;
 }
 $("service-state").textContent=core.query({type:"network.applicationService",targetId:server.id,service:"http"}).status==="available"?"HTTP actif":"HTTP arrêté";
}
$("create-rule").addEventListener("submit",e=>{
 e.preventDefault();
 const r=addRouterPatRule(registry,router.id,{wanPortId:router.ports[0].id,protocol:get("rule-protocol"),externalPort:Number(get("rule-external")),internalAddress:get("rule-dest"),internalPort:Number(get("rule-internal")),enabled:true});
 paint();say(r.success?"Règle PAT créée.":"Règle refusée : "+r.message,r.success?"success":"failed");
});
$("probe").onclick=()=>{
 const a=observeInboundPat(registry,router.id,outside.id,server.id,inputAddresses(),{wanAddress:get("wan-ip"),port:Number(get("wan-port")),protocol:get("request-protocol"),service:"http"},core);
 say(a.success?"HTTP accessible : "+a.reason:(a.status==="unavailable"?"Non simulé : ":"Accès refusé : ")+a.reason,a.success?"success":a.status==="unavailable"?"unsupported":"failed");
};
$("service-enabled").onchange=()=>{
 const enabled=$("service-enabled").checked;
 const r=core.dispatch({commandVersion:1,id:"service-change-"+(++serial),type:"network.setApplicationService",targetId:server.id,params:{service:"http",enabled}});
 paint();say(r.status==="applied"?"État HTTP actualisé dans le Core.":"Modification refusée",r.status==="applied"?"success":"failed");
};
for(const side of ["wan","lan"])$("cable-"+side).onclick=()=>{
 const c=registry.getCable(cables[side]),p=router.ports[side==="wan"?0:1].id;
 const r=c.ends[1]?registry.disconnectCableEnd(c.id,1):registry.connectCableEnd(c.id,1,p);
 paint();say(r.message,r.success?"success":"failed");
};
$("reset").onclick=make;
make();
window.__patLab={observe:()=>observeInboundPat(registry,router.id,outside.id,server.id,inputAddresses(),{wanAddress:get("wan-ip"),port:Number(get("wan-port")),protocol:get("request-protocol"),service:"http"},core),snapshot:()=>registry.exportState()};
