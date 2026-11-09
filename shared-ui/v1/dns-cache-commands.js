/* Sorties Windows 11 : ipconfig /displaydns et /flushdns.
 * Le moteur DNS fournit les entrees et TTL restants. Ce module ne simule ni le cache ni l'horloge.
 */
import {createWindowsFieldFormatter} from "./windows-fields.js";
const f=createWindowsFieldFormatter(["Nom de l'enregistrement","Type d'enregistrement","Durée de vie","Longueur des données","Section","Enregistrement A (hôte)","Réponse négative"],{indent:"    "});
export function formatDisplayDns({entries=[],prompt="C:\\>"}={}){
  const lines=[prompt+"ipconfig /displaydns","","Configuration IP de Windows",""];
  for(const item of entries){
    const ttl=Math.max(0,Math.floor(item.remainingTtl??0));
    lines.push("    "+item.name,"    ----------------------------------------",
      f("Nom de l'enregistrement",item.name),
      f("Type d'enregistrement",item.found?1:0),
      f("Durée de vie",ttl),
      f("Longueur des données",item.found?4:0),
      f("Section","Réponse"));
    if(item.found)lines.push(f("Enregistrement A (hôte)",item.address));
    else lines.push(f("Réponse négative","Le nom n'existe pas"));
    lines.push("");
  }
  lines.push(prompt);
  return lines.join("\n");
}
export function formatFlushDns({prompt="C:\\>"}={}){
  return [prompt+"ipconfig /flushdns","","Configuration IP de Windows","",
    "Cache de résolution DNS vidé.","",prompt].join("\n");
}
