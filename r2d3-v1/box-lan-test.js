import {createAssetRegistry} from "./asset-profiles.js";
import {createBoxLanDhcpSession} from "https://chaoli22000bzh.github.io/R2D3/src/box-lan-dhcp-v1.js";
const output=document.getElementById("out");
const must=r=>{if(!r.success)throw Error(r.message||r.code);return r};
const client=(r,name,type)=>{
 const profile=must(r.createProfile("Profil "+name)).profile;
 must(r.addPortGroup(profile.id,{type,prefix:"P",start:1,count:1}));
 return must(r.createAsset(profile.id,{name})).asset;
};
function setup(){
 const r=createAssetRegistry(),box=must(r.createBoxComposite("BOX-01"));
 const a=client(r,"PC-LAN-1","ethernet-rj45"),
  b=client(r,"PC-LAN-2","ethernet-rj45"),
  w=client(r,"PC-WIFI","wifi");
 const cables=[];
 for(const [pc,index] of [[a,0],[b,1]]){
  const c=must(r.createCable()).cable;cables.push(c.id);
  must(r.connectCableEnd(c.id,0,pc.ports[0].id));
  must(r.connectCableEnd(c.id,1,box.config.ports.lanPortIds[index]));
 }
 return {r,box,a,b,w,cables,clients:[
  {assetId:a.id,medium:"ethernet"},
  {assetId:b.id,medium:"ethernet"},
  {assetId:w.id,medium:"wifi",ssidId:"ssid-1",password:"12345678"}]};
}
function run(mode){
 try{
  const f=setup();
  if(mode==="off")must(f.r.setBoxLanConfig(f.box.asset.id,{
   ...f.box.config.lan,dhcpEnabled:false}));
  const session=must(createBoxLanDhcpSession({
   registry:f.r,boxId:f.box.asset.id,clients:f.clients}));
  if(mode==="cut")must(f.r.disconnectCableEnd(f.cables[0],1));
  const results=[f.a,f.b,f.w].map(pc=>({
   name:pc.name,...session.request(pc.id)}));
  const leases=session.engine.query({type:"dhcp.leases",serverId:session.routerId});
  const valid=mode==="off"?results.every(x=>x.code==="apipa"):
   mode==="cut"?results[0].code==="apipa"&&results[0].gateway===null&&results.slice(1).every(x=>x.code==="lease")&&leases.leases.length===2:
   results.every(x=>x.code==="lease")&&new Set(results.map(x=>x.address)).size===3&&
    results.every(x=>x.gateway==="192.168.1.1")&&leases.leases.length===3;
  output.textContent=(valid?"VALIDÉ":"ÉCHEC")+"\n\n"+results.map(x=>
   x.name+" : "+(x.success?(x.address+"/"+x.prefix+" · "+x.code+" · passerelle "+(x.gateway??"aucune")):
    "refus · "+x.code)).join("\n")+
   "\n\nBaux actifs Core DHCP : "+leases.leases.length+
   "\nServeur unique : "+session.routerId;
  output.className=valid?"good":"bad";
 }catch(e){output.className="bad";output.textContent="ERREUR : "+e.message;}
}
document.getElementById("run").onclick=()=>run("normal");
document.getElementById("off").onclick=()=>run("off");
document.getElementById("cut").onclick=()=>run("cut");
