import {createAssetRegistry} from "./asset-profiles.js";
import {createRouter,configureRouterPort} from "./router-interfaces-v1.js";
import {createEngine} from "./r2d3-core.js";
import {configureRemoteVpn,getRemoteVpnConfig,setRemoteVpnEnabled,connectRemoteVpn,disconnectRemoteVpn,observeRemoteVpnPing,observeRemoteVpnPingName} from "./router-vpn-remote-v1.js";
const $=id=>document.getElementById(id);
let registry,router,nomad,server,wan,lan,cables,session=null;
const input=id=>$(id).value.trim();
function say(message,ok=null){
 $("result").textContent=message;
 $("result").className=ok===null?"":ok?"success":"failed";
}
function cable(from,to){
 const result=registry.createCable();if(!result.success)throw Error(result.message);
 const c=result.cable;
 for(const [end,port] of [[0,from],[1,to]]){
  const r=registry.connectCableEnd(c.id,end,port);
  if(!r.success)throw Error(r.message);
 }
 return c.id;
}
function addresses(){
 return {
  [nomad.id]:{address:"203.0.113.20",prefix:24,gateway:input("client-gateway")},
  [server.id]:{address:input("target-ip"),prefix:24,gateway:"192.168.10.1"}
 };
}
function configure(){
 return configureRemoteVpn(registry,router.id,{
  wanPortId:wan,lanPortId:lan,vpnNetwork:input("vpn-network"),
  vpnPrefix:Number(input("vpn-prefix")),username:input("server-user"),
  password:input("server-password"),dnsServer:input("dns-server"),enabled:$("server-enabled").checked
 });
}
function paint(){
 const connected=!!session?.connected;
 $("connection-state").textContent=connected?"Connecté":"Déconnecté";
 $("connection-state").className="status "+(connected?"ok":"off");
 $("assigned-ip").textContent=connected?session.vpnAddress:"Aucune";
 $("assigned-dns").textContent=connected?(session.dnsServer||"Aucun"):"Aucun";
 for(const side of ["wan","lan"]){
  const cableData=registry.getCable(cables[side]);
  const linked=!!cableData.ends[1];
  $("wire-"+side).classList.toggle("cut",!linked);
  $("cable-"+side).textContent=linked?"Couper "+side.toUpperCase():"Rétablir "+side.toUpperCase();
 }
 for(const [id,asset,label] of [["router-state",router,"routeur"],["server-state",server,"serveur"]]){
  const on=registry.getAsset(asset.id).status==="En service";
  $(id).textContent=(on?"Arrêter ":"Redémarrer ")+label;
 }
}
function initialize(){
 registry=createAssetRegistry();session=null;
 const r=createRouter(registry,{name:"RTR-01",ports:4});
 if(!r.success)throw Error(r.message);
 router=r.asset;wan=router.ports[0].id;lan=router.ports[1].id;
 const p=registry.createProfile("PC RJ45");if(!p.success)throw Error(p.message);
 registry.addPortGroup(p.profile.id,{type:"ethernet-rj45",prefix:"NIC",start:1,count:1});
 nomad=registry.createAsset(p.profile.id,{name:"PC-NOMADE"}).asset;
 server=registry.createAsset(p.profile.id,{name:"SRV-LOCAL"}).asset;
 cables={wan:cable(nomad.ports[0].id,wan),lan:cable(server.ports[0].id,lan)};
 configureRouterPort(registry,router.id,wan,{role:"wan",mode:"static",address:"203.0.113.10",prefix:24});
 configureRouterPort(registry,router.id,lan,{role:"lan",mode:"static",address:"192.168.10.1",prefix:24});
 for(const [id,value] of Object.entries({
  "vpn-network":"10.8.0.0","vpn-prefix":"24","server-user":"eleve",
  "server-password":"demo","dns-server":"192.168.10.10","client-server":"203.0.113.10",
  "client-user":"eleve","client-password":"demo",
  "target-ip":"192.168.10.10","client-gateway":"203.0.113.10",
  "dns-name":"srv-local.entreprise.test","dns-record-name":"srv-local.entreprise.test"
 }))$(id).value=value;
 $("server-enabled").checked=true;
 const configured=configure();if(!configured.success)throw Error(configured.message);
 paint();say("VPN prêt. Clique sur « Se connecter ».");
}
$("server-form").addEventListener("submit",event=>{
 event.preventDefault();const r=configure();
 if(r.success){session=null;paint();}
 say(r.success?"Serveur VPN enregistré. Reconnecte le PC.":r.message,r.success);
});
$("server-enabled").addEventListener("change",()=>{
 const cfg=getRemoteVpnConfig(registry,router.id);
 if(!cfg)return;
 const r=setRemoteVpnEnabled(registry,router.id,$("server-enabled").checked);
 if(r.success&&!$("server-enabled").checked)session=null;
 say(r.success?($("server-enabled").checked?"VPN activé.":"VPN désactivé."):(r.message||"Erreur VPN"),r.success);
 paint();
});
$("connect").addEventListener("click",()=>{
 const r=connectRemoteVpn(registry,router.id,nomad.id,addresses(),{
  serverAddress:input("client-server"),username:input("client-user"),password:input("client-password")
 });
 if(r.success)session=r.session;
 else session=null;
 paint();
 say(r.success?"VPN connecté. Adresse VPN : "+r.session.vpnAddress:r.message,r.success);
});
$("disconnect").addEventListener("click",()=>{
 session=disconnectRemoteVpn(session);
 paint();say("VPN déconnecté.",true);
});
// Le Core DNS résout les enregistrements sur le LAN. Le moteur VPN
// vérifie d'abord l'accès au serveur DNS à travers le tunnel.
function makeDnsEngine(){
 const clientId="dns-proxy";
 const name=input("dns-record-name");
 const records=name?[{name,type:"A",value:"192.168.10.10",ttl:300}]:[];
 return {clientId,engine:createEngine({
  format:"r2d3-scenario",schemaVersion:1,scenarioId:"vpn-nomad-dns-lab",
  scenarioVersion:"1.0.0",capabilities:{network:true},
  objects:[
   {id:clientId,kind:"ethernet-endpoint",name:"Résolution côté LAN",
    ports:[{id:"eth0",type:"rj45"}],
    config:{ipv4:{interfaceId:"eth0",mode:"static",address:"192.168.10.1",prefix:24},
     networkOptions:{gateway:null,dns:session?.dnsServer?[session.dnsServer]:[]}},runtime:{}},
   {id:"dns-local",kind:"ethernet-endpoint",name:"Serveur DNS",
    ports:[{id:"eth0",type:"rj45"}],
    config:{ipv4:{interfaceId:"eth0",mode:"static",address:"192.168.10.10",prefix:24},
     dnsEnabled:$("dns-enabled").checked,dnsZone:{domain:"entreprise.test",negativeTtl:60,records}},runtime:{}}
  ],
  links:[{id:"lan-dns",kind:"ethernet-cable",connected:true,
   endpoints:[{objectId:clientId,portId:"eth0"},{objectId:"dns-local",portId:"eth0"}]}]
 })};
}
$("probe-name").addEventListener("click",()=>{
 try{
  const dns=makeDnsEngine();
  const r=observeRemoteVpnPingName(registry,session,input("dns-name"),server.id,addresses(),
   {dnsEngine:dns.engine,dnsClientId:dns.clientId,dnsAssetId:server.id});
  say(r.success?"DNS : "+input("dns-name")+" = "+r.resolvedAddress+". Ping réussi.":"Échec : "+(r.message||"Nom DNS non résolu"),r.success);
 }catch(error){say("Configuration DNS invalide : "+error.message,false);}
});
$("probe").addEventListener("click",()=>{
 const r=observeRemoteVpnPing(registry,session,server.id,addresses());
 say(r.success?"Ping réussi : "+input("target-ip")+" répond.":"Ping échoué : "+(r.reason||r.message||"Connexion impossible"),r.success);
});
for(const side of ["wan","lan"])$("cable-"+side).addEventListener("click",()=>{
 const c=registry.getCable(cables[side]),port=side==="wan"?wan:lan;
 const r=c.ends[1]?registry.disconnectCableEnd(c.id,1):registry.connectCableEnd(c.id,1,port);
 paint();say(r.message,r.success);
});
for(const [id,assetName] of [["router-state","router"],["server-state","server"]]){
 $(id).addEventListener("click",()=>{
  const asset=assetName==="router"?router:server,old=registry.getAsset(asset.id);
  const next=old.status==="En service"?"Hors service":"En service";
  const r=registry.updateAsset(asset.id,{status:next});
  // Arrêter le routeur coupe définitivement la session du PC.
  // Son redémarrage ne reconnecte pas automatiquement le client.
  if(r.success&&assetName==="router"&&next==="Hors service")session=null;
  paint();say((assetName==="router"?"Routeur":"Serveur")+(next==="En service"?" redémarré.":" arrêté."),r.success);
 });
}
$("reset").addEventListener("click",initialize);
initialize();
window.__vpnRemoteLab={observe:()=>observeRemoteVpnPing(registry,session,server.id,addresses()),snapshot:()=>registry.exportState()};
