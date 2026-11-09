/* Sortie ipconfig /displaydns pour Windows en français.
 * Représentation des enregistrements du moteur, sans logique réseau ni horloge.
 * Le cache R2D3 conserve une réponse regroupée par nom ; les enregistrements A/CNAME
 * de la chaîne sont détaillés ici avec le TTL restant conservateur du groupe.
 */
const labelWidth=21;
const field=(label,value)=>"        "+label+" ".repeat(Math.max(0,labelWidth-label.length))+" : "+String(value);
const dotted=(label,value)=>"        "+label+" ".repeat(Math.max(0,labelWidth-label.length-1))+" : "+String(value);
function recordBlock(name,type,value,ttl){
 const lines=[
   "    "+name,
   "    ----------------------------------------",
   dotted("Nom d'enregistrement.",name),
   field("Type d'enregistrement",type),
   dotted("Durée de vie  . . . .",ttl),
   dotted("Longueur de données .",4),
   dotted("Section . . . . . . .","Réponse"),
   type===5?field("Enregistrement CNAME",value):field("Enregistrement (hôte)",value),
   ""
 ];
 return lines;
}
export function formatDisplayDns({entries=[],prompt="C:\\>"}={}){
 const lines=[prompt+"ipconfig /displaydns","","Configuration IP de Windows",""];
 if(!Array.isArray(entries))throw new TypeError("Liste du cache DNS invalide");
 const displayed=new Set();
 for(const item of entries){
   if(!item || typeof item.name!=="string")continue;
   const remaining=Math.max(0,Math.floor(item.remainingTtl??0));
   if(remaining===0)continue;
   if(item.found){
     const chain=Array.isArray(item.chain)?item.chain:[];
     const records=chain.length?chain:[{name:item.name,type:"A",value:item.address}];
     for(const record of records){
       const type=record.type==="CNAME"?5:record.type==="A"?1:null;
       if(type===null || typeof record.name!=="string" || typeof record.value!=="string")continue;
       const key=record.name.toLowerCase()+"|"+type+"|"+record.value.toLowerCase();
       if(displayed.has(key))continue;
       displayed.add(key);
       lines.push(...recordBlock(record.name,type,record.value,remaining));
     }
   }else{
     // Le format des erreurs mises en cache varie selon Windows et le type de réponse.
     // Ne pas inventer un enregistrement A/CNAME pour un nom inexistant.
     lines.push("    "+item.name,"    ----------------------------------------",
       dotted("Nom d'enregistrement.",item.name),
       field("Type d'enregistrement",0),
       dotted("Durée de vie  . . . .",remaining),
       dotted("Longueur de données .",0),
       dotted("Section . . . . . . .","Réponse"),
       "        Réponse négative",
       "");
   }
 }
 lines.push(prompt);
 return lines.join("\n");
}
export function formatFlushDns({prompt="C:\\>"}={}){
 return [prompt+"ipconfig /flushdns","","Configuration IP de Windows","",
  "Cache de résolution DNS vidé.","",prompt].join("\n");
}
