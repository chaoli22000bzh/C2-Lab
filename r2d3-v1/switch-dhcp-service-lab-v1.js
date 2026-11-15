import {createAssetRegistry} from "./asset-profiles.js";
import {createEngine} from "./r2d3-core.js";
import {addSwitchVlan,setSwitchAccessPort} from "./vlan-v1.js";
import {setSwitchVlanInterface} from "./inter-vlan-routing-v1.js";
import {getSwitchDhcpConfig,configureSwitchDhcp,createSwitchDhcpCoreObject,requestSwitchDhcp} from "./switch-dhcp-service-v1.js";
const $=id=>document.getElementById(id);
const good=r=>{if(!r?.success)throw Error(r?.message||r?.code||"Opération refusée");return r;};
const tests={
 1:["Service désactivé par défaut","Observe SW-L3 puis configure le service DHCP avec deux plages. L'activation reste explicite."],
 2:["Attribution sur le VLAN 10","Le service DHCP du switch L3 est actif. Demande une adresse pour PC10 sur le VLAN 10."],
 3:["Attribution sur le VLAN 20","Le même service DHCP dessert deux VLAN distincts. Demande une adresse aux deux PC et observe les plages sélectionnées."],
 4:["Service DHCP arrêté","Le serveur DHCP est configuré, mais arrêté. La requête doit produire une APIPA fournie par R2D3."],
 5:["Coupure réseau et conservation du bail","Obtiens un bail pour PC10, débranche ensuite son câble. Le bail doit rester acquis tant qu'il n'a pas expiré."]
};
let r,sw,pc10,pc20,c1,c2,e,test=1,phase=0,pools=[];
const make=(name,ports,caps=[])=>{
 const p=good(r.createProfile(name)).profile;
 good(r.addPortGroup(p.id,{type:"ethernet-rj45",prefix:"P",start:1,count:ports}));
 for(const cap of caps)good(r.setProfileNetworkCapability(p.id,cap,true));
 return p;
};
const connect=(pc,n)=>{
 const c=good(r.createCable()).cable;
 good(r.connectCableEnd(c.id,0,pc.ports[0].id));
 good(r.connectCableEnd(c.id,1,sw.ports[n].id));return c;
};
function boot(number){
 test=number;phase=0;e=null;r=createAssetRegistry();
 const sp=make("Switch administrable L3",4,["ethernet-switching","vlan","inter-vlan-routing","dhcp-server"]);
 const pp=make("PC Windows",1);
 sw=good(r.createAsset(sp.id,{name:"SW-L3"})).asset;
 pc10=good(r.createAsset(pp.id,{name:"PC10"})).asset;
 pc20=good(r.createAsset(pp.id,{name:"PC20"})).asset;
 c1=connect(pc10,0);c2=connect(pc20,1);
 pools=[10,20].map(v=>({id:"vlan"+v,vlanNumber:v,start:"192.168."+v+".100",
  end:"192.168."+v+".105",prefix:24,gateway:"192.168."+v+".1",
  dns:["1.1.1.1","8.8.8.8"],leaseSeconds:3600}));
 for(const [v,address] of [[10,"192.168.10.1"],[20,"192.168.20.1"]]){
  good(addSwitchVlan(r,sw.id,v,"VLAN "+v));
  good(setSwitchVlanInterface(r,sw.id,v,address,24,true));
 }
 good(setSwitchAccessPort(r,sw.id,sw.ports[0].id,10));
 good(setSwitchAccessPort(r,sw.id,sw.ports[1].id,20));
 if(test!==1)configure(test!==4);
 $("title").textContent="Test "+test+" : "+tests[test][0];
 $("instruction").textContent=tests[test][1];
 $("action").textContent=test===1?"Configurer deux plages et activer le DHCP":
  test===2?"PC10 : demander un bail DHCP":
  test===3?"PC10 et PC20 : demander des baux":
  test===4?"PC10 : demander une adresse DHCP":"PC10 : obtenir un bail DHCP";
 $("second").hidden=true;
 for(const b of $("tests").querySelectorAll("button")){
  b.classList.toggle("selected",Number(b.dataset.test)===test);
  b.setAttribute("aria-pressed",String(Number(b.dataset.test)===test));
 }
 $("result").textContent="Scénario réinitialisé.";render();
}
function configure(enabled){good(configureSwitchDhcp(r,sw.id,{enabled,pools}));}
function engine(){
 const client=pc=>({id:pc.id,kind:"pc-windows",name:pc.name,
  ports:[{id:pc.ports[0].id,type:"rj45"}],
  config:{ipv4:{interfaceId:pc.ports[0].id,mode:"dhcp",address:null,prefix:null,lease:null},
   networkOptions:{gateway:null,dns:[]}}});
 return createEngine({format:"r2d3-scenario",schemaVersion:1,
  scenarioId:"l3-dhcp-service",scenarioVersion:"1",capabilities:{network:true},
  objects:[client(pc10),client(pc20),createSwitchDhcpCoreObject(r,sw.id)],
  links:[{id:c1.id,kind:"ethernet-cable",connected:true,endpoints:[
   {objectId:pc10.id,portId:pc10.ports[0].id},{objectId:sw.id,portId:sw.ports[0].id}]},
  {id:c2.id,kind:"ethernet-cable",connected:true,endpoints:[
   {objectId:pc20.id,portId:pc20.ports[0].id},{objectId:sw.id,portId:sw.ports[1].id}]}]});
}
function request(pc){
 const out=requestSwitchDhcp({registry:r,switchId:sw.id,clientId:pc.id,dhcpEngine:e});
 return out;
}
function render(){
 const config=getSwitchDhcpConfig(r,sw.id);
 const rows=[
  "SW-L3 : service DHCP "+(config.enabled?"ACTIF":"ARRÊTÉ"),
  "Plages DHCP : "+config.pools.length,
  ...config.pools.map(p=>"VLAN "+p.vlanNumber+" | "+p.start+" à "+p.end+
   "/"+p.prefix+" | passerelle "+p.gateway+" | durée "+p.leaseSeconds+" s"),
  "Interfaces VLAN : VLAN 10 = 192.168.10.1/24 | VLAN 20 = 192.168.20.1/24",
  "PC10 : VLAN 10 | câble "+(r.getCable(c1.id).ends[1]?"branché":"débranché"),
  "PC20 : VLAN 20 | câble branché"
 ];
 if(e){
  const st=e.getSnapshot();
  for(const pc of [pc10,pc20]){
   const obj=st.objectsById[pc.id];
   rows.push(pc.name+" : "+(obj.config.ipv4.address||"aucune IPv4")+
    (obj.config.ipv4.prefix!=null?"/"+obj.config.ipv4.prefix:"")+
    " | état "+(st.runtime[pc.id]?.dhcpStatus||"non demandé"));
  }
  const leases=e.query({type:"dhcp.leases",serverId:sw.id});
  rows.push("Baux actifs sur SW-L3 : "+(leases.leases?.length??0));
 }
 $("state").textContent=rows.join("\n");
}
$("action").onclick=()=>{
 try{
  if(test===1){
   configure(true);e=engine();
   $("result").textContent="Service activé. Deux plages enregistrées sur SW-L3, sans créer un autre moteur DHCP.";
  }else{
   e??=engine();
   if(test===3){
    const a=request(pc10),b=request(pc20);
    $("result").textContent="PC10 : "+a.address+" ("+a.code+") ; PC20 : "+b.address+" ("+b.code+")";
   }else{
    const out=request(pc10);
    $("result").textContent="PC10 : "+out.address+" ; état Core : "+out.code;
    if(test===5&&out.success){
     phase=1;$("second").hidden=false;$("second").textContent="Débrancher le câble de PC10";
    }
   }
  }
  render();
 }catch(err){$("result").textContent="Erreur : "+err.message;}
};
$("second").onclick=()=>{
 try{
  if(test!==5||phase!==1)return;
  good(r.disconnectCableEnd(c1.id,1));
  const d=e.dispatch({commandVersion:1,id:"couper-cable",type:"network.setLinkConnected",
   targetId:c1.id,params:{connected:false}});
  if(d.status!=="applied")throw Error(d.message||"Lien Core non synchronisé");
  const result=request(pc10),state=e.getSnapshot();
  $("result").textContent="Câble débranché ; nouvelle demande : "+result.code+
   ". IPv4 conservée : "+state.objectsById[pc10.id].config.ipv4.address;
  $("second").hidden=true;render();
 }catch(err){$("result").textContent="Erreur : "+err.message;}
};
$("reset").onclick=()=>boot(test);
$("tests").onclick=ev=>{const b=ev.target.closest("button[data-test]");if(b)boot(Number(b.dataset.test));};
boot(1);
