import {createAssetRegistry} from "./asset-profiles.js";
import {observeVlanPing} from "./lot1a-vlan.js";

const $=id=>document.getElementById(id);
let registry,pc1,pc2,switchAsset,scenario;
function connect(a,b){
  const c=registry.createCable().cable;
  for(const [end,portId] of [[0,a],[1,b]]){
    const result=registry.connectCableEnd(c.id,end,portId);
    if(!result.success)throw Error(result.message);
  }
}
function reset(){
  registry=createAssetRegistry();
  const pcProfile=registry.createProfile("PC Ethernet").profile;
  const swProfile=registry.createProfile("Switch L2").profile;
  registry.addPortGroup(pcProfile.id,{type:"ethernet-rj45",prefix:"LAN",start:1,count:1});
  registry.addPortGroup(swProfile.id,{type:"ethernet-rj45",prefix:"ETH",start:1,count:2});
  pc1=registry.createAsset(pcProfile.id,{name:"PC1"}).asset;
  pc2=registry.createAsset(pcProfile.id,{name:"PC2"}).asset;
  switchAsset=registry.createAsset(swProfile.id,{name:"SW01"}).asset;
  connect(pc1.ports[0].id,switchAsset.ports[0].id);
  connect(pc2.ports[0].id,switchAsset.ports[1].id);
  scenario={pc1Id:pc1.id,pc2Id:pc2.id,switchId:switchAsset.id,
    vlans:{[switchAsset.ports[0].id]:10,[switchAsset.ports[1].id]:10},
    addresses:{[pc1.id]:{address:"192.168.10.20",prefix:24},
      [pc2.id]:{address:"192.168.10.30",prefix:24}}};
  render();
}
function render(){
  const v1=scenario.vlans[switchAsset.ports[0].id],v2=scenario.vlans[switchAsset.ports[1].id];
  $("vlan1").textContent=v1;
  $("vlan2").value=String(v2);
  $("ip2").textContent=scenario.addresses[pc2.id].address;
  $("ip-error").checked=scenario.addresses[pc2.id].address==="192.168.20.30";
  const result=observeVlanPing(registry,scenario);
  $("ping").textContent=(result.success?"Communication possible : ":"Communication impossible : ")+result.reason;
  $("ping").className=result.success?"good":"bad";
  $("diag").textContent=v1===v2?"Les ports Access appartiennent au même VLAN.":"Les ports Access appartiennent à deux VLAN distincts.";
}
$("vlan2").onchange=e=>{scenario.vlans[switchAsset.ports[1].id]=Number(e.target.value);render()};
$("ip-error").onchange=e=>{
  scenario.addresses[pc2.id].address=e.target.checked?"192.168.20.30":"192.168.10.30";
  render();
};
$("reset").onclick=reset;
reset();
