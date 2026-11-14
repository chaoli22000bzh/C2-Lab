import {createAssetRegistry} from "./asset-profiles.js";
import {observeSimpleEthernetSwitch} from "./ethernet-switching-v01.js";
const $=id=>document.getElementById(id);
let registry,pc1,pc2,sw,c1,c2,addresses;
const ok=r=>{if(!r.success)throw Error(r.message);return r;};
function cable(from,to){
 const c=ok(registry.createCable()).cable;
 ok(registry.connectCableEnd(c.id,0,from));
 ok(registry.connectCableEnd(c.id,1,to));
 return c;
}
function reset(){
 registry=createAssetRegistry();
 const client=ok(registry.createProfile("Poste Ethernet")).profile;
 ok(registry.addPortGroup(client.id,{type:"ethernet-rj45",prefix:"LAN",start:1,count:1}));
 const profile=ok(registry.createProfile("Switch non administrable")).profile;
 ok(registry.addPortGroup(profile.id,{type:"ethernet-rj45",prefix:"Port",start:1,count:5}));
 pc1=ok(registry.createAsset(client.id,{name:"PC1"})).asset;
 pc2=ok(registry.createAsset(client.id,{name:"PC2"})).asset;
 sw=ok(registry.createAsset(profile.id,{name:"SW01"})).asset;
 c1=cable(pc1.ports[0].id,sw.ports[0].id);
 c2=cable(pc2.ports[0].id,sw.ports[1].id);
 addresses={[pc1.id]:{address:"192.168.10.20",prefix:24},[pc2.id]:{address:"192.168.10.30",prefix:24}};
 $("ip").value="192.168.10.30";$("port").value="1";
 $("feedback").textContent="Scénario réinitialisé. Lance le ping.";
 $("feedback").className="stage";
 draw();
}
function isWired(c){return registry.getCable(c.id).ends.every(Boolean)}
function draw(){
 const wired1=isWired(c1),wired2=isWired(c2);
 $("wire1").className="wire"+(wired1?"":" down");
 $("wire2").className="wire"+(wired2?"":" down");
 $("wiring").textContent="PC1 → port 1 : "+(wired1?"raccordé":"débranché")+" | PC2 → "+(wired2?sw.ports.find(p=>p.id===registry.getCable(c2.id).ends[1]?.portId)?.name:"câble libre")+" : "+(wired2?"raccordé":"débranché");
 $("pc2ip").textContent=addresses[pc2.id].address;
 $("disconnect").disabled=!wired2;
 $("reconnect").disabled=wired2;
}
function ping(){
 const result=observeSimpleEthernetSwitch(registry,pc1.id,pc2.id,sw.id,addresses);
 $("feedback").textContent=(result.success?"Ping réussi : ":"Ping échoué : ")+(result.reason||result.status);
 $("feedback").className="stage "+(result.success?"good":"bad");
}
$("ping").onclick=ping;
$("reset").onclick=reset;
$("disconnect").onclick=()=>{
 const end=registry.getCable(c2.id).ends[1]?1:0;
 ok(registry.disconnectCableEnd(c2.id,end));draw();ping();
};
$("reconnect").onclick=()=>{
 const p=sw.ports[Number($("port").value)];
 ok(registry.connectCableEnd(c2.id,1,p.id));draw();ping();
};
$("move").onclick=()=>{
 const port=sw.ports[Number($("port").value)];
 const current=registry.getCable(c2.id);
 if(current.ends[1]?.portId!==port.id){
   if(current.ends[1])ok(registry.disconnectCableEnd(c2.id,1));
   ok(registry.connectCableEnd(c2.id,1,port.id));
 }
 draw();ping();
};
$("ip").onchange=()=>{
 addresses[pc2.id]={address:$("ip").value,prefix:24};
 draw();ping();
};
reset();
