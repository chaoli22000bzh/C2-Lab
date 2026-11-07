/* C2 Shared UI v1 - commandes Windows ARP.
 * Module partage independant du moteur, du DOM et du laboratoire.
 * Recoit la table et l'IPv4 du poste courant, sans gerer le cache lui-meme.
 */
const prompt="C:\\Users\\technicien>";
const header="  Adresse Internet         Adresse physique       Type";
const ipv4Column=24,macColumn=23;

/**
 * @param {object} config
 * @param {string} config.interfaceAddress - adresse IPv4 du poste exécutant arp -a
 * @param {Array<{address:string,mac:string,type:string}>} config.entries - lignes du cache ARP du poste
 * @returns {string} sortie de la commande arp -a, sans informations supplémentaires
 */
export function formatArpTable({interfaceAddress,entries}={}){
  if(typeof interfaceAddress!=="string"||!interfaceAddress.trim())
    throw new TypeError("Adresse IPv4 de l'interface ARP requise");
  if(!Array.isArray(entries)||entries.some(item=>!item||typeof item.address!=="string"||typeof item.mac!=="string"||typeof item.type!=="string"))
    throw new TypeError("Entrées de table ARP invalides");
  const lines=entries.map(item=>"  "+item.address.padEnd(ipv4Column)+item.mac.padEnd(macColumn)+item.type);
  return [prompt+"arp -a","","Interface : "+interfaceAddress,header,...lines,"",prompt].join("\n");
}

/**
 * Sortie Windows après suppression réussie des entrées ARP.
 * Aucun message de réussite n'est ajouté dans la console.
 * La purge effective doit être réalisée par le moteur appelant.
 */
export function formatArpClear(){
  return [prompt+"arp -d *","",prompt].join("\n");
}
