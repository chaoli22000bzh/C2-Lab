import {createAssetRegistry} from "./asset-profiles.js";
import {createBoxInternetSession} from "https://chaoli22000bzh.github.io/R2D3/src/box-internet-v1.js?lot=378ed91";
const output=document.getElementById("out");
const good=r=>{if(!r.success)throw Error(r.message||r.code);return r;};
function fixture(){
 const registry=createAssetRegistry(),box=good(registry.createBoxComposite("BOX-01"));
 const p=good(registry.createProfile("PC clients")).profile;
 good(registry.addPortGroup(p.id,{type:"ethernet-rj45",prefix:"ETH",start:1,count:1}));
 const a=good(registry.createAsset(p.id,{name:"PC-01"})).asset;
 const b=good(registry.createAsset(p.id,{name:"PC-02"})).asset;
 const cables=[];
 for(const [pc,i] of [[a,0],[b,1]]){
  const c=good(registry.createCable()).cable;cables.push(c.id);
  good(registry.connectCableEnd(c.id,0,pc.ports[0].id));
  good(registry.connectCableEnd(c.id,1,box.config.ports.lanPortIds[i]));
 }
 const services=[{id:"site-web-internet",address:"80.10.246.50",kind:"http",available:true},
  {id:"dns-orange",address:"80.10.246.2",kind:"dns",available:true}];
 const start=()=>good(createBoxInternetSession({registry,boxId:box.asset.id,
  clients:[{assetId:a.id,medium:"ethernet"},{assetId:b.id,medium:"ethernet"}],services}));
 return {registry,box,a,b,cables,services,start};
}
const describe=r=>r.success?
 "OK | "+r.nat.internalAddress+":"+r.nat.internalPort+" → "+r.nat.externalAddress+":"+r.nat.externalPort+
 " → "+r.target.address+":"+r.target.port+" | passerelle WAN "+r.route.wanGateway:
 "REFUS | "+r.code+" | "+(r.message||"");
function run(test){
 try{
  const f=fixture(),s=f.start();
  const request=id=>s.request({clientId:id,targetAddress:"80.10.246.50",service:"http"});
  let a,b,valid=false,notes="";
  if(test==="normal"){
   a=request(f.a.id);b=request(f.b.id);
   valid=a.success&&b.success&&a.nat.externalAddress===b.nat.externalAddress&&
    a.nat.externalPort!==b.nat.externalPort;
   notes="Deux PC LAN utilisent une même IPv4 publique et deux ports PAT différents.";
  }else if(test==="cut"){
   a=request(f.a.id);
   good(f.registry.disconnectCableEnd(f.cables[0],1));
   a=request(f.a.id);b=request(f.b.id);
   valid===false;
   valid=!a.success&&a.code==="link_down"&&b.success;
   notes="Le PC-01 perd son accès après débranchement LAN, PC-02 reste connecté.";
  }else if(test==="service"){
   f.services[0].available=false;
   a=request(f.a.id);b=null;
   valid=!a.success&&a.code==="service_offline";
   notes="Le serveur web externe est déclaré arrêté.";
  }else if(test==="dns"){
   a=s.request({clientId:f.a.id,targetAddress:"80.10.246.2",service:"dns"});b=null;
   valid=a.success&&a.nat.protocol==="udp";
   notes="Requête DNS vers le service simulé Orange.";
  }
  output.className=valid?"good":"bad";
  output.textContent=(valid?"TEST CONFORME":"ÉCHEC")+"\n"+notes+
   "\n\nPC-01 : "+describe(a)+(b?"\nPC-02 : "+describe(b):"")+
   "\n\nTranslations PAT actives : "+s.listNat().length;
 }catch(e){output.className="bad";output.textContent="ERREUR : "+e.message;}
}
for(const [id,mode] of [["normal","normal"],["cut","cut"],["service","service"],["dns","dns"]])
 document.getElementById(id).onclick=()=>run(mode);
