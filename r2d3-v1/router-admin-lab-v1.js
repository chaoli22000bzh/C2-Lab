import {createAssetRegistry} from "./asset-profiles.js";
import {createRouter} from "./router-interfaces-v1.js";
import {mountRouterAdmin} from "./router-admin-ui-v1.js";
let registry,view;
const $=id=>document.getElementById(id);
function boot(){
 try{
  const ports=Number($("port-count").value);
  if(!Number.isInteger(ports))throw Error("Indiquer un nombre entier de ports.");
  view?.destroy();
  registry=createAssetRegistry();
  const created=createRouter(registry,{name:"RTR-01",ports});
  if(!created.success)throw Error(created.message);
  view=mountRouterAdmin({root:$("host"),registry,assetId:created.asset.id});
  $("lab-status").textContent="";
 }catch(e){$("lab-status").textContent=e.message;}
}
$("create").addEventListener("click",boot);
boot();
window.__routerLab={snapshot:()=>registry?.exportState()};
