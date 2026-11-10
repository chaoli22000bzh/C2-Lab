/* nslookup Windows (fr-FR), presentation uniquement. Le moteur fournit le resultat DNS.
 * Premiere version : requete par nom, A et CNAME, un serveur local, sans PTR/TTL.
 */
const isText=value=>typeof value==="string" && value.length>0;
const rtrim=value=>String(value??"").trim();
function heading(serverName,serverAddress){
  return ["Serveur :  "+(isText(serverName)?serverName:"UnKnown"),
    "Address:  "+(serverAddress??""),""];
}
export function formatNslookup({name,result,serverName=null,prompt="C:\\>",authoritative=true}={}){
  const requested=rtrim(name),prefix=prompt+"nslookup "+requested;
  if(!result || typeof result!=="object")throw new TypeError("Résultat DNS manquant");
  const serverAddress=result.serverAddress??null;
  const lines=[prefix,""];
  if(result.status!=="ok"){
    // Ne pas inventer un nom de serveur. Aucun PTR n'est simule actuellement.
    if(serverAddress)lines.push(...heading(serverName,serverAddress));
    if(result.reason==="Serveur DNS non configure sur le poste")
      lines.push("*** Aucun serveur DNS n'est configuré.");
    else {
      lines.push("DNS request timed out.","    timeout was 2 seconds.","*** Request to "+(serverName??serverAddress??"UnKnown")+" timed-out");
    }
    return lines.join("\n");
  }
  lines.push(...heading(serverName,serverAddress));
  if(!authoritative)lines.push("Réponse ne faisant pas autorité :","");
  if(!result.found){
    if(result.reason==="name_not_found" || result.reason==="name_outside_zone")
      lines.push("*** "+(serverName??"UnKnown")+" ne parvient pas à trouver "+requested+" : Non-existent domain");
    else if(result.reason==="alias_loop")
      lines.push("*** "+(serverName??"UnKnown")+" ne parvient pas à trouver "+requested+" : Server failed");
    else lines.push("*** "+(serverName??"UnKnown")+" ne parvient pas à trouver "+requested+" : Server failed");
    return lines.join("\n");
  }
  const chain=Array.isArray(result.chain)?result.chain:[];
  const terminal=chain.findLast?.(entry=>entry.type==="A")??chain.filter(entry=>entry.type==="A").at(-1);
  const finalName=terminal?.name??requested,aliases=chain.filter(entry=>entry.type==="CNAME").map(entry=>entry.name);
  lines.push("Nom :    "+finalName,"Address:  "+result.address);
  if(aliases.length){
    lines.push("Aliases:  "+aliases[0]);
    for(const alias of aliases.slice(1))lines.push("          "+alias);
  }
  return lines.join("\n");
}

/**
 * Affichage des recherches DNS typées, sans requête réseau réelle.
 * L'ancien formatNslookup() demeure intact pour les scénarios A/CNAME.
 */
export function formatTypedNslookup({name,recordType="A",result,serverName=null}={}){
  const type=String(recordType).toUpperCase();
  if(type==="A")return formatNslookup({name,result,serverName});
  if(!result || typeof result!=="object")throw new TypeError("Résultat DNS manquant");
  const asked=String(name??"").trim();
  const lines=["C:\\>nslookup -type="+type+" "+asked,"",...heading(serverName,result.serverAddress??null)];
  if(result.status!=="ok"){
    lines.push("*** Échec de la requête DNS : "+(result.reason??"serveur inaccessible"));
    return lines.join("\n");
  }
  if(!result.found){
    lines.push("*** Aucun enregistrement "+type+" pour "+asked+".");
    return lines.join("\n");
  }
  for(const record of result.records??[]){
    if(type==="AAAA")lines.push(record.name+"   AAAA address = "+record.value);
    else if(type==="MX")lines.push(record.name+"   mail exchanger = "+record.priority+" "+record.value);
    else if(type==="TXT")lines.push(record.name+"   text = \""+record.value+"\"");
    else if(type==="PTR")lines.push(record.name+"   name = "+record.value);
  }
  return lines.join("\n");
}
