/* C2 Shared UI v1 - commande Windows ipconfig /all.
 * Sortie autonome : aucune dependance au DOM, aux laboratoires ou au moteur R2D3.
 * Les donnees sont fournies par l'appelant, jamais inventees par le composant.
 */
import {createWindowsFieldFormatter} from "./windows-fields.js";

const labels=[
  "Nom de l'hôte","Description","Adresse physique","DHCP activé",
  "Configuration automatique activée","Adresse d'autoconfiguration IPv4",
  "Adresse IPv4","Masque de sous-réseau","Passerelle par défaut",
  "Bail obtenu","Bail expirant","Serveur DHCP","Serveurs DNS",
  "NetBIOS sur Tcpip","Statut du média"
];
const field=createWindowsFieldFormatter(labels);
const width=Math.max(...labels.map(label=>label.length));
const prefixMask=prefix=>{
  if(!Number.isInteger(prefix)||prefix<0||prefix>32)return "";
  const bits=prefix===0?0:(0xffffffff<<(32-prefix))>>>0;
  return [24,16,8,0].map(shift=>(bits>>>shift)&255).join(".");
};
const yesNo=value=>value?"Oui":"Non";
const valueOrEmpty=value=>value??"";
const preferred=address=>address?address+" (préféré)":"Non attribuée";

/**
 * @param {object} config - photographie de l'interface réseau, sans accès au moteur.
 * @param {object} config.ipv4 - {address,prefix,lease?}
 * @param {string} [config.hostname] - nom Windows du poste
 * @param {boolean} [config.dhcp=false]
 * @param {boolean} [config.autoconfiguration=true]
 * @param {boolean} [config.connected=true]
 * @param {string} [config.description] - description réelle si connue
 * @param {string} [config.mac] - MAC de l'interface si connue
 * @param {string} [config.gateway]
 * @param {string[]} [config.dns]
 * @param {string} [config.dhcpServer] - adresse effective du serveur DHCP
 * @param {string} [config.leaseStart] - date déjà formatée dans le contexte
 * @param {string} [config.leaseEnd] - date déjà formatée dans le contexte
 * @param {string} [config.netbios] - état réellement fourni (ex : Activé)
 * @param {string} [config.interfaceName="Ethernet"]
 * @param {boolean} [config.compact=false] - affichage sans pointillés pour les écrans étroits
 */
export function formatIpconfigAll({
  ipv4,hostname,dhcp=false,autoconfiguration=true,connected=true,
  description,mac,gateway=null,dns=[],dhcpServer,leaseStart,leaseEnd,
  netbios,interfaceName="Ethernet",compact=false
}={}){
  if(!ipv4||typeof ipv4!=="object")throw new TypeError("Configuration IPv4 nécessaire");
  if(!Array.isArray(dns))throw new TypeError("Serveurs DNS invalides");
  const formatField=compact?(label,value="")=>label+" : "+String(value??""):field;
  const apipa=Boolean(dhcp&&ipv4.address?.startsWith("169.254.")&&!ipv4.lease);
  const lines=[
    "C:\\Users\\technicien>ipconfig /all","",
    "Configuration IP de Windows",""
  ];
  if(hostname!==undefined)lines.push(formatField("Nom de l'hôte",hostname));
  lines.push("");
  if(description!==undefined)lines.push(formatField("Description",description));
  if(mac!==undefined)lines.push(formatField("Adresse physique",mac));
  lines.push(formatField("DHCP activé",yesNo(dhcp)));
  lines.push(formatField("Configuration automatique activée",yesNo(autoconfiguration)));
  if(!connected){
    lines.push(formatField("Statut du média","Média déconnecté"));
  }else{
    if(apipa){
      lines.push(formatField("Adresse d'autoconfiguration IPv4",preferred(ipv4.address)));
    }else{
      lines.push(formatField("Adresse IPv4",preferred(ipv4.address)));
    }
    if(ipv4.address&&ipv4.prefix!==null&&ipv4.prefix!==undefined)
      lines.push(formatField("Masque de sous-réseau",prefixMask(ipv4.prefix)));
    if(leaseStart!==undefined&&ipv4.lease)lines.push(formatField("Bail obtenu",leaseStart));
    if(leaseEnd!==undefined&&ipv4.lease)lines.push(formatField("Bail expirant",leaseEnd));
    lines.push(formatField("Passerelle par défaut",apipa?"":valueOrEmpty(gateway)));
    if(dhcp&&dhcpServer!==undefined&&ipv4.lease)lines.push(formatField("Serveur DHCP",dhcpServer));
    if(dns.length&&!apipa){
      lines.push(formatField("Serveurs DNS",dns[0]));
      for(const server of dns.slice(1))lines.push(compact?"  "+server:"  "+" ".repeat(width+3)+server);
    }
    if(netbios!==undefined)lines.push(formatField("NetBIOS sur Tcpip",netbios));
  }
  return [...lines,"","C:\\Users\\technicien>"].join("\n");
}
