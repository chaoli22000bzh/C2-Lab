/* C2 Shared UI v1 - lignes étiquetées des commandes Windows.
 * Pas de points après le libellé le plus long : les autres sont alignés.
 * Utilitaire sans DOM, utilisable par R2D3, C2 et les portails.
 */
export function createWindowsFieldFormatter(labels,{indent="  "}={}){
  if(!Array.isArray(labels)||labels.length===0||labels.some(v=>typeof v!=="string"))
    throw new TypeError("Libellés Windows invalides");
  const width=Math.max(...labels.map(label=>label.length));
  return (label,value="")=>{
    if(typeof label!=="string")throw new TypeError("Libellé Windows invalide");
    return indent+label+".".repeat(Math.max(0,width-label.length))+" : "+String(value??"");
  };
}
