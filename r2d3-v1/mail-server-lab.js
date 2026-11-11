import {createMailEngine} from "./mail-core.js";
import {connectMailOutlook} from "./mail-outlook-adapter.js";
const response=await fetch("./mail-server-scenario.json",{cache:"no-store"});
if(!response.ok)throw Error("Scénario du serveur indisponible.");
const scenario=await response.json();
const host=document.getElementById("outlook"),adminStatus=document.getElementById("admin-status");
const status=document.getElementById("lab-status"),table=document.getElementById("mailboxes");
let engine=createMailEngine(scenario),bridge=connectMailOutlook(host,scenario,{engine});
function paint(){
  table.replaceChildren();
  const entries=engine.listMailboxes();
  if(!entries.length){const tr=document.createElement("tr"),td=document.createElement("td");td.colSpan=2;td.textContent="Aucune boîte";tr.append(td);table.append(tr);return;}
  for(const entry of entries){const tr=document.createElement("tr");for(const v of [entry.email,entry.type.toUpperCase()]){const td=document.createElement("td");td.textContent=v;tr.append(td);}table.append(tr);}
}
document.getElementById("mailbox-form").addEventListener("submit",event=>{
  event.preventDefault();
  const form=event.currentTarget,values=Object.fromEntries(new FormData(form));
  const r=engine.createMailbox(values);
  adminStatus.className=r.success?"ok":"bad";adminStatus.textContent=r.message;
  paint();
});
document.getElementById("inject").addEventListener("click",()=>{
 const accounts=bridge.outlook.getAccounts();
 if(!accounts.length){status.textContent="Configure d'abord une boîte créée dans Outlook.";return;}
 const target=accounts[0].email;
 const result=bridge.inject({from:"client@exemple.fr",to:target,subject:"Message de test",body:"Bonjour,\nCeci est un message fictif."});
 status.textContent=result.message;
});
document.getElementById("reset").addEventListener("click",()=>{
 bridge.destroy();
 engine=createMailEngine(scenario);
 bridge=connectMailOutlook(host,scenario,{engine});
 paint();adminStatus.className="";adminStatus.textContent="Serveur réinitialisé, aucune boîte créée.";
 status.textContent="Le laboratoire a été réinitialisé.";
});
window.__mailServerLab={getSnapshot:()=>engine.getSnapshot(),getAccounts:()=>bridge.outlook.getAccounts(),getUiMessages:()=>bridge.outlook.getMessages()};
paint();
