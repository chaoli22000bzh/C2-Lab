import {createAssetRegistry} from "./asset-profiles.js";
import {createRouter,configureRouterPort} from "./router-interfaces-v1.js";
import {observeRouterPing} from "./router-routing-v01.js";
import {mountRouterAdmin} from "./router-admin-ui-v1.js";
const $=id=>document.getElementById(id);
let registry,router,pc1,pc2,cables,admin;
const attach=(p,q)=>{
 const c=registry.createCable();
 if(!c.success)throw Error(c.message);
 const a=registry.connectCableEnd(c.cable.id,0,p),b=registry.connectCableEnd(c.cable.id,1,q);
 if(!a.success||!b.success)throw Error("Impossible de raccorder un câble Ethernet");
 return c.cable.id;
};
function paintCables(){
 for(const [i,pc] of [[1,pc1],[2,pc2]]){
  const c=registry.getCable(cables[i]);
  const linked=!!c.ends[1];
  $("wire"+i).classList.toggle("cut",!linked);
  $("cable"+i).textContent=linked?"Débrancher câble PC"+i:"Rebrancher câble PC"+i;
 }
}
function create(){
 admin?.destroy();
 registry=createAssetRegistry();
 const result=createRouter(registry,{name:"RTR-01",ports:4});
 if(!result.success)throw Error(result.message);
 router=result.asset;
 const p=registry.createProfile("PC de test").profile;
 if(!registry.addPortGroup(p.id,{type:"ethernet-rj45",prefix:"LAN",start:1,count:1}).success)throw Error("Profil PC invalide");
 pc1=registry.createAsset(p.id,{name:"PC1"}).asset;
 pc2=registry.createAsset(p.id,{name:"PC2"}).asset;
 cables={1:attach(pc1.ports[0].id,router.ports[1].id),2:attach(pc2.ports[0].id,router.ports[2].id)};
 for(const [port,addr] of [[router.ports[1],"192.168.10.1"],[router.ports[2],"192.168.20.1"]]){
  const config=configureRouterPort(registry,router.id,port.id,{role:"lan",mode:"static",address:addr,prefix:24,gateway:""});
  if(!config.success)throw Error(config.message);
 }
 for(const [i,address,gateway] of [[1,"192.168.10.10","192.168.10.1"],[2,"192.168.20.10","192.168.20.1"]]){
  $("pc"+i+"-ip").value=address;$("pc"+i+"-prefix").value="24";$("pc"+i+"-gw").value=gateway;
 }
 admin=mountRouterAdmin({root:$("router-admin"),registry,assetId:router.id});
 paintCables();paintLabels();
 resultMessage("Cliquer sur « Ping PC1 → PC2 » pour tester le routage.","");
}
function address(pc){
 const n=pc===pc1?1:2;
 return {address:$("pc"+n+"-ip").value.trim(),prefix:Number($("pc"+n+"-prefix").value),gateway:$("pc"+n+"-gw").value.trim()};
}
function paintLabels(){
 for(const [n,pc] of [[1,pc1],[2,pc2]]){const a=address(pc);$("pc"+n+"-label").textContent=a.address+"/"+a.prefix;}
}
function resultMessage(value,type){
 const el=$("ping-result");el.textContent=value;el.className="lab-result "+type;
}
function ping(reverse=false){
 try{
  paintLabels();
  const ips={[pc1.id]:address(pc1),[pc2.id]:address(pc2)};
  const src=reverse?pc2:pc1,dst=reverse?pc1:pc2;
  const result=observeRouterPing(registry,router.id,src.id,dst.id,ips);
  resultMessage((result.success?"Ping réussi : ":result.status==="unavailable"?"Non simulé : ":"Ping échoué : ")+result.reason,result.success?"success":result.status==="unavailable"?"unsupported":"failed");
 }catch(error){resultMessage("Erreur : "+error.message,"failed");}
}
function toggleCable(n){
 const c=registry.getCable(cables[n]),port=router.ports[n].id;
 const outcome=c.ends[1]?registry.disconnectCableEnd(c.id,1):registry.connectCableEnd(c.id,1,port);
 if(!outcome.success)resultMessage("Erreur câble : "+outcome.message,"failed");
 paintCables();
}
$("ping").addEventListener("click",()=>ping(false));
$("ping-reverse").addEventListener("click",()=>ping(true));
$("cable1").addEventListener("click",()=>toggleCable(1));
$("cable2").addEventListener("click",()=>toggleCable(2));
$("reset").addEventListener("click",create);
for(const n of [1,2])for(const field of ["ip","prefix","gw"])
 $("pc"+n+"-"+field).addEventListener("input",paintLabels);
create();
window.__routerRoutingLab={snapshot:()=>registry.exportState(),observe:()=>observeRouterPing(registry,router.id,pc1.id,pc2.id,{[pc1.id]:address(pc1),[pc2.id]:address(pc2)})};
