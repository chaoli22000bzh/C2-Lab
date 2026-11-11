import {createMailEngine} from "./mail-core.js";
import {connectMailOutlook} from "./mail-outlook-adapter.js";
const response=await fetch("./mail-server-scenario.json",{cache:"no-store"});
if(!response.ok)throw Error("Scénario du serveur indisponible.");
const scenario=await response.json();
const host=document.getElementById("outlook"),adminStatus=document.getElementById("admin-status");
const status=document.getElementById("lab-status"),table=document.getElementById("mailboxes");
const domainSelect=document.getElementById("domain-select"),domainStatus=document.getElementById("domain-status");
const mailField=document.querySelector('#mailbox-form [name="email"]');
function paintDomains(selected){
  const domains=engine.listDomains();
  const chosen=domains.includes(selected)?selected:domains.includes(domainSelect.value)?domainSelect.value:domains[0];
  domainSelect.replaceChildren();
  for(const domain of domains){const opt=document.createElement("option");opt.value=domain;opt.textContent=domain;domainSelect.append(opt);}
  domainSelect.value=chosen;
  const settings=engine.getServerSettings(chosen);
  document.getElementById("imap-host").textContent=settings.imap.host;
  document.getElementById("pop-host").textContent=settings.pop3.host;
  document.getElementById("smtp-host").textContent=settings.smtp.host;
  const name=mailField.value.split("@")[0]||"technicien";
  mailField.value=name+"@"+chosen;
}
domainSelect.addEventListener("change",()=>paintDomains(domainSelect.value));
document.getElementById("domain-form").addEventListener("submit",event=>{
  event.preventDefault();
  const value=new FormData(event.currentTarget).get("domain");
  const r=engine.createDomain(value);
  domainStatus.textContent=r.message;
  domainStatus.className=r.success?"ok":"bad";
  if(r.success)paintDomains(r.domain);
});

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
  const expectedDomain=domainSelect.value;
  if(values.email.trim().toLowerCase().split("@")[1]!==expectedDomain){
    adminStatus.className="bad";
    adminStatus.textContent="L'adresse doit correspondre au domaine actif : "+expectedDomain+".";
    return;
  }
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
 paintDomains();paint();adminStatus.className="";adminStatus.textContent="Serveur réinitialisé, aucune boîte créée.";
 status.textContent="Le laboratoire a été réinitialisé.";
});
window.__mailServerLab={getSnapshot:()=>engine.getSnapshot(),getDomains:()=>engine.listDomains(),getServerSettings:d=>engine.getServerSettings(d),getAccounts:()=>bridge.outlook.getAccounts(),getUiMessages:()=>bridge.outlook.getMessages()};
paintDomains();paint();
