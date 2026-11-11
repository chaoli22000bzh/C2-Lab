import {connectMailOutlook} from "./mail-outlook-adapter.js";
const response=await fetch("./mail-outlook-scenario.json",{cache:"no-store"});
if(!response.ok)throw Error("Scénario de messagerie indisponible");
const scenario=await response.json();
const host=document.getElementById("outlook");
const status=document.getElementById("lab-status");
let bridge=connectMailOutlook(host,scenario);
function announce(result){
  status.textContent=result.message;
  status.className=result.success?"ok":"bad";
}
document.getElementById("inject").addEventListener("click",()=>{
  announce(bridge.inject({from:"client@exemple.fr",to:"contact@atelier-kerwen.fr",
    subject:"Nouveau signalement",body:"Bonjour,\n\nLe logiciel de messagerie ne démarre plus.\n\nMerci."}));
});
document.getElementById("fail-on").addEventListener("click",()=>announce(bridge.failure(document.getElementById("failure-type").value,true)));
document.getElementById("fail-off").addEventListener("click",()=>announce(bridge.failure(document.getElementById("failure-type").value,false)));
document.getElementById("reset").addEventListener("click",()=>{
  bridge=bridge.reset();
  status.className="";
  status.textContent="Laboratoire réinitialisé.";
});
// Utilisé uniquement par les tests navigateur du dépôt R2D3.
window.__mailLab={getSnapshot:()=>bridge.getSnapshot(),getUiMessages:()=>bridge.outlook.getMessages(),
  getAccounts:()=>bridge.outlook.getAccounts()};
