import {createAssetRegistry} from "./asset-profiles.js?box-pat=c47f0dc";
import {createEngine} from "https://chaoli22000bzh.github.io/R2D3/src/r2d3-core.js";
import {addBoxPatRule,setBoxPatRuleEnabled,observeBoxInboundPat} from "https://chaoli22000bzh.github.io/R2D3/src/box-pat-v1.js?lot=6a249f3";
const output=document.getElementById("out");
const must=r=>{if(!r?.success)throw Error(r?.message||r?.code||"Opération refusée");return r;};
function fixture(){
 const registry=createAssetRegistry(),box=must(registry.createBoxComposite("BOX-01"));
 const profile=must(registry.createProfile("Serveur Web RJ45")).profile;
 must(registry.addPortGroup(profile.id,{type:"ethernet-rj45",prefix:"ETH",start:1,count:1}));
 const server=must(registry.createAsset(profile.id,{name:"SRV-WEB"})).asset;
 const cable=must(registry.createCable()).cable;
 must(registry.connectCableEnd(cable.id,0,server.ports[0].id));
 must(registry.connectCableEnd(cable.id,1,box.config.ports.lanPortIds[0]));
 const core=createEngine({format:"r2d3-scenario",schemaVersion:1,
  scenarioId:"box-inbound-pat-test",scenarioVersion:"1.0.0",capabilities:{network:true},
  objects:[{id:server.id,kind:"ethernet-endpoint",name:server.name,
   ports:[{id:server.ports[0].id,type:"rj45"}],
   config:{ipv4:{interfaceId:server.ports[0].id,mode:"static",
    address:"192.168.1.110",prefix:24},applicationServices:{http:true}},runtime:{}}],
  links:[]});
 const added=must(addBoxPatRule(registry,box.asset.id,{protocol:"tcp",externalPort:8080,
  internalAddress:"192.168.1.110",internalPort:80,enabled:true}));
 const request={externalAddress:"90.14.20.22",wanAddress:"90.14.10.20",
  protocol:"tcp",port:8080,service:"http",targetId:server.id,
  targetAddress:"192.168.1.110",targetGateway:"192.168.1.1"};
 return {registry,box,server,cable,core,rule:added.rule,request,
  probe:extra=>observeBoxInboundPat(registry,box.asset.id,{...request,...extra},core)};
}
function render(mode){
 try{
  const f=fixture(),lines=[],title={
   normal:"Accès HTTP depuis Internet vers serveur du LAN",
   disabled:"Redirection PAT désactivée",
   wrongport:"Demande sur un port non publié",
   offline:"Serveur Web interne arrêté",
   cable:"Câble LAN du serveur débranché"
  }[mode];
  if(mode==="disabled")must(setBoxPatRuleEnabled(f.registry,f.box.asset.id,f.rule.id,false));
  if(mode==="offline"){
   const d=f.core.dispatch({commandVersion:1,id:"stop-web",type:"network.setApplicationService",
    targetId:f.server.id,params:{service:"http",enabled:false}});
   if(d.status!=="applied")throw Error("Core : impossible d'arrêter le service Web");
  }
  if(mode==="cable")must(f.registry.disconnectCableEnd(f.cable.id,1));
  const result=f.probe(mode==="wrongport"?{port:8081}:{});
  const expected={normal:"inbound_pat_reached",disabled:"pat_rule_missing",
   wrongport:"pat_rule_missing",offline:"service_offline",cable:"link_down"}[mode];
  const passed=result.code===expected&&result.success===(mode==="normal");
  lines.push(passed?"TEST CONFORME":"TEST NON CONFORME",title,"");
  lines.push("Demande : 90.14.20.22 → 90.14.10.20:"+(mode==="wrongport"?"8081":"8080"));
  lines.push("Règle : TCP 8080 → 192.168.1.110:80");
  lines.push("Serveur du parc : SRV-WEB, LAN 1, passerelle 192.168.1.1");
  if(result.success){
   lines.push("PAT : "+result.public.address+":"+result.public.port+" → "+result.destination.address+":"+result.destination.port);
   lines.push("Service HTTP interne : accessible");
  }else lines.push("ACCÈS REFUSÉ : "+result.code+" | "+result.message);
  lines.push("WAN : Internet virtuel, sans câble ni modem");
  output.textContent=lines.join("\n");output.className=passed?"good":"bad";
 }catch(error){output.className="bad";output.textContent="ERREUR : "+(error?.message||String(error));}
}
for(const name of ["normal","disabled","wrongport","offline","cable"])
 document.getElementById(name).onclick=()=>render(name);
