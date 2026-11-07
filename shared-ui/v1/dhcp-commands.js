/* C2 Shared UI v1 - sorties des commandes Windows ipconfig /release et /renew.
 * Presentation pure : ne libere ni ne renouvelle un bail DHCP.
 * L'etat affiche provient exclusivement du moteur appelant.
 */
import {createWindowsFieldFormatter} from "./windows-fields.js";

const labels=["Adresse d'autoconfiguration IPv4","Adresse IPv4","Masque de sous-réseau","Passerelle par défaut"];
const field=createWindowsFieldFormatter(labels,{indent:"   "});
const mask=prefix=>{
  if(!Number.isInteger(prefix)||prefix<0||prefix>32)return "";
  const bits=prefix===0?0:(0xffffffff<<(32-prefix))>>>0;
  return [24,16,8,0].map(shift=>(bits>>>shift)&255).join(".");
};
function header(command){
  return ["C:\\Users\\technicien>ipconfig /"+command,"","Configuration IP de Windows","","Carte Ethernet :",""];
}
function complete(lines){return [...lines,"","C:\\Users\\technicien>"].join("\n");}

/** Sortie de /release apres liberation confirmee par le moteur.
 * ipv4 est l'etat APRES l'action ; un echec moteur ne doit pas appeler ce rendu.
 */
export function formatIpconfigRelease({ipv4}={}){
  if(!ipv4||typeof ipv4!=="object")throw new TypeError("Etat IPv4 nécessaire");
  const lines=header("release");
  lines.push(field("Adresse IPv4",ipv4.address??"0.0.0.0"));
  lines.push(field("Masque de sous-réseau",ipv4.address?mask(ipv4.prefix):"0.0.0.0"));
  lines.push(field("Passerelle par défaut",""));
  return complete(lines);
}

/** Sortie de /renew selon le resultat du moteur R2D3.
 * status : lease | lease-retained | apipa ; pas de simulation de messages d'erreur
 * particuliers a une version de Windows ni de diagnostic sans source.
 */
export function formatIpconfigRenew({ipv4,status,gateway=null}={}){
  if(!ipv4||typeof ipv4!=="object")throw new TypeError("Etat IPv4 nécessaire");
  if(!["lease","lease-retained","apipa"].includes(status))
    throw new TypeError("Résultat du renouvellement DHCP inconnu");
  const lines=header("renew");
  if(status==="apipa"){
    lines.push(field("Adresse d'autoconfiguration IPv4",ipv4.address??""));
  }else{
    lines.push(field("Adresse IPv4",ipv4.address??""));
  }
  if(ipv4.address&&ipv4.prefix!=null)lines.push(field("Masque de sous-réseau",mask(ipv4.prefix)));
  lines.push(field("Passerelle par défaut",status==="apipa"?"":gateway??""));
  return complete(lines);
}
