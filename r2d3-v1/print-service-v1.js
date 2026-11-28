/* Impression réseau pédagogique V1 : travaux fictifs, port RAW TCP 9100.
 * Aucune socket réelle, aucun pilote ni moteur de rendu papier.
 * La continuité L2/IPv4 provient des moteurs réseau partagés.
 */
import {ethernetPortReachable,observeEthernetNetworkPing} from "./ethernet-switching-v1.js";

const copy=v=>JSON.parse(JSON.stringify(v));
const error=(code,message)=>({success:false,code,message});
const validName=n=>typeof n==="string"&&n.trim().length>0&&n.trim().length<=120;
const validJob=j=>!!j&&typeof j.id==="string"&&/^job-[1-9]\d*$/.test(j.id)&&
 typeof j.sourceAssetId==="string"&&j.sourceAssetId.length>0&&
 validName(j.document)&&Number.isInteger(j.pages)&&j.pages>=1&&j.pages<=9999&&
 ["en_attente","en_cours","imprime","erreur"].includes(j.status)&&
 (j.error===null||typeof j.error==="string");
function ethernetInterface(asset){
 const ports=asset?.ports?.filter(p=>p.type==="ethernet-rj45")??[];
 if(ports.length!==1)return null;
 const port=ports[0];
 return {port,ipv4:asset.interfaceIpv4?.[port.id]??null};
}
function reachable(registry,sourceId,printerId){
 const source=registry.getAsset(sourceId),printer=registry.getAsset(printerId);
 if(!source||!printer)return error("asset_missing","PC ou imprimante introuvable.");
 if(sourceId===printerId)return error("invalid_source","Le PC source doit être distinct de l'imprimante.");
 if(source.status!=="En service"||printer.status!=="En service")
  return error("asset_offline","PC ou imprimante hors service.");
 const pc=ethernetInterface(source),imp=ethernetInterface(printer);
 if(!pc||!imp)return error("interface_missing","Un port Ethernet RJ45 par équipement est requis dans ce lot.");
 if(!ethernetPortReachable(registry,pc.port.id,imp.port.id))
  return error("no_ethernet_path","Aucune continuité Ethernet entre le PC et l'imprimante.");
 if(!pc.ipv4?.address||!imp.ipv4?.address||
    !Number.isInteger(pc.ipv4.prefix)||!Number.isInteger(imp.ipv4.prefix))
  return error("ipv4_missing","Adresse IPv4 du PC ou de l'imprimante absente.");
 const ips={
  [sourceId]:{address:pc.ipv4.address,prefix:pc.ipv4.prefix},
  [printerId]:{address:imp.ipv4.address,prefix:imp.ipv4.prefix}
 };
 const ping=observeEthernetNetworkPing(registry,sourceId,printerId,ips);
 if(ping.success!==true)return error("ipv4_unreachable","La communication IPv4 entre le PC et l'imprimante échoue.");
 return {success:true,code:"reachable"};
}
function validateState(v,printerId){
 if(!v||v.version!==1||v.printerAssetId!==printerId||typeof v.enabled!=="boolean"||
  !Number.isInteger(v.nextJobId)||v.nextJobId<1||
  !Array.isArray(v.jobs)||v.jobs.some(j=>!validJob(j)))throw Error("File d'impression invalide.");
 const ids=new Set(v.jobs.map(j=>j.id));
 if(ids.size!==v.jobs.length)throw Error("Identifiants de travaux dupliqués.");
 if(v.jobs.some(j=>Number(j.id.slice(4))>=v.nextJobId))throw Error("Compteur de travaux invalide.");
 if(v.jobs.filter(j=>j.status==="en_cours").length>1)throw Error("Plusieurs travaux en cours.");
 return v;
}
export function createPrintServiceV1({registry,printerAssetId,saved}={}){
 if(!registry||typeof registry.getAsset!=="function")throw Error("Registre d'actifs requis.");
 const printer=registry.getAsset(printerAssetId);
 if(!printer||printer.name===" "||!printer.ports?.some(p=>p.type==="ethernet-rj45"))
  throw Error("Imprimante Ethernet introuvable.");
 if(registry.getProfile(printer.profileId)?.name!=="Imprimante laser monochrome")
  throw Error("Profil Imprimante laser monochrome requis.");
 const state=saved?validateState(copy(saved),printerAssetId):{
  version:1,printerAssetId,enabled:true,nextJobId:1,jobs:[]
 };
 const getJobs=()=>copy(state.jobs);
 const view=()=>copy(state);
 function setEnabled(enabled){
  if(typeof enabled!=="boolean")return error("invalid_enabled","État du service incorrect.");
  state.enabled=enabled;
  return {success:true,code:enabled?"service_enabled":"service_disabled",enabled};
 }
 function submit({sourceAssetId,document,pages}={}){
  if(!state.enabled)return error("service_disabled","Service TCP 9100 désactivé.");
  if(!validName(document)||!Number.isInteger(pages)||pages<1||pages>9999)
   return error("invalid_document","Nom de document ou nombre de pages incorrect.");
  const network=reachable(registry,sourceAssetId,printerAssetId);
  if(!network.success)return network;
  const job={id:"job-"+state.nextJobId++,sourceAssetId,document:document.trim(),pages,status:"en_attente",error:null};
  state.jobs.push(job);
  return {success:true,code:"job_queued",job:copy(job)};
 }
 function advance(){
  const inProgress=state.jobs.find(j=>j.status==="en_cours");
  const job=inProgress??state.jobs.find(j=>j.status==="en_attente");
  if(!job)return error("queue_empty","Aucun travail en attente ou en cours.");
  const printer=registry.getAsset(printerAssetId);
  if(printer?.status!=="En service"){
   job.status="erreur";job.error="Imprimante hors service.";
   return {success:false,code:"printer_offline",job:copy(job)};
  }
  if(!state.enabled){
   job.status="erreur";job.error="Service TCP 9100 arrêté pendant le traitement.";
   return {success:false,code:"service_disabled",job:copy(job)};
  }
  if(job.status==="en_attente"){
   job.status="en_cours";
   return {success:true,code:"job_processing",job:copy(job)};
  }
  job.status="imprime";
  return {success:true,code:"job_printed",job:copy(job)};
 }
 function retry(jobId){
  const job=state.jobs.find(j=>j.id===jobId);
  if(!job||job.status!=="erreur")return error("not_retryable","Seul un travail en erreur peut être relancé.");
  if(!state.enabled||registry.getAsset(printerAssetId)?.status!=="En service")
   return error("printer_unavailable","Imprimante ou service indisponible.");
  job.status="en_attente";job.error=null;
  return {success:true,code:"job_requeued",job:copy(job)};
 }
 return {submit,advance,retry,setEnabled,getJobs,exportState:view,getStatus:()=>({printerAssetId,port:9100,enabled:state.enabled,waiting:state.jobs.filter(j=>j.status==="en_attente").length})};
}
