/* C2 Shared UI v1 - sortie commune de la commande Windows ipconfig.
 * Composant autonome, sans DOM et sans moteur particulier.
 * La commande ipconfig /all sera traitée dans un composant séparé.
 */
import {createWindowsFieldFormatter} from "./windows-fields.js";

const maskFromPrefix=prefix=>{
  if(!Number.isInteger(prefix)||prefix<0||prefix>32)return "";
  const bits=prefix===0?0:(0xffffffff<<(32-prefix))>>>0;
  return [24,16,8,0].map(shift=>(bits>>>shift)&255).join(".");
};
const field=createWindowsFieldFormatter(
  ["Adresse IPv4","Masque de sous-réseau","Passerelle par défaut","Statut du média"],
  {indent:"   "}
);

/**
 * @param {object} settings
 * @param {object} settings.ipv4 - { address, prefix } tels que fournis par le moteur
 * @param {boolean} [settings.connected=true] - état de la liaison du poste
 * @param {string|null} [settings.gateway=null] - passerelle IPv4
 * @param {string} [settings.interfaceName="Ethernet"] - nom de la carte
 * @returns {string} sortie complète de l'invite de commandes Windows
 */
export function formatIpconfig({ipv4,connected=true,gateway=null,interfaceName="Ethernet"}={}){
  if(!ipv4||typeof ipv4!=="object")
    throw new TypeError("Configuration IPv4 nécessaire");
  const lines=[
    "C:\\Users\\technicien>ipconfig","",
    "Configuration IP de Windows","",
    "Carte Ethernet "+interfaceName+" :",""
  ];
  if(!connected){
    lines.push(field("Statut du média","Média déconnecté"));
  }else{
    lines.push(field("Adresse IPv4",ipv4.address??""));
    if(ipv4.address&&ipv4.prefix!==null&&ipv4.prefix!==undefined)
      lines.push(field("Masque de sous-réseau",maskFromPrefix(ipv4.prefix)));
    lines.push(field("Passerelle par défaut",gateway??""));
  }
  return [...lines,"","C:\\Users\\technicien>"].join("\n");
}
