import {createAssetRegistry} from "./asset-profiles.js";
import {observePhysicalPing} from "./lot0-physical-ping.js";

const $=id=>document.getElementById(id);
let registry,pc,printer,cable,addresses;
function reset(){
  registry=createAssetRegistry();
  const p=registry.createProfile("Équipement Ethernet").profile;
  const group=registry.addPortGroup(p.id,{type:"ethernet-rj45",prefix:"LAN",start:1,count:1});
  if(!group.success)throw new Error(group.message);
  pc=registry.createAsset(p.id,{name:"PC1"}).asset;
  printer=registry.createAsset(p.id,{name:"Imprimante"}).asset;
  cable=registry.createCable().cable;
  addresses={
    [pc.id]:{address:"192.168.10.20",prefix:24},
    [printer.id]:{address:"192.168.10.50",prefix:24}
  };
  registry.connectCableEnd(cable.id,0,pc.ports[0].id);
  registry.connectCableEnd(cable.id,1,printer.ports[0].id);
  render();
}
function render(){
  const current=registry.getCable(cable.id);
  const link=current.ends[0]&&current.ends[1];
  const result=observePhysicalPing(registry,pc.id,printer.id,addresses);
  $("wire").textContent=link?"PC1 —— câble Ethernet —— Imprimante":"PC1 —— câble débranché     Imprimante";
  $("wire").className=link?"connected":"disconnected";
  $("cable-state").textContent=link?"Les deux extrémités du câble sont raccordées.":"Une extrémité du câble est libre.";
  $("ping").textContent=(result.success?"Communication possible : ":"Communication impossible : ")+result.reason;
  $("ping").className=result.success?"good":"bad";
  $("revision").textContent=registry.exportState().revision;
  $("disconnect").disabled=!current.ends[1];
  $("reconnect").disabled=!!current.ends[1];
}
$("disconnect").onclick=()=>{
  const r=registry.disconnectCableEnd(cable.id,1);
  if(!r.success)throw new Error(r.message);
  render();
};
$("reconnect").onclick=()=>{
  const r=registry.connectCableEnd(cable.id,1,printer.ports[0].id);
  if(!r.success)throw new Error(r.message);
  render();
};
$("reset").onclick=reset;
reset();
