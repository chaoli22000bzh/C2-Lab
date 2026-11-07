/* R2D3 - affichage partagé des tests ping.
 * Animation obligatoire des quatre réponses et remplacement du résultat précédent.
 * Ce module n'influence ni le diagnostic ni l'état du moteur réseau.
 */
export function createPingAnimator(element, {intervalMs=230}={}) {
  let generation=0;
  let timeoutId=null;
  function cancel(message="") {
    generation++;
    if(timeoutId!==null)clearTimeout(timeoutId);
    timeoutId=null;
    element.textContent=message;
  }
  function run({sourceName,sourceAddress,targetAddress,outcome,onProgress,onComplete}) {
    cancel("");
    const ticket=generation;
    const success=Boolean(outcome.success&&!outcome.conflict);
    const lines=["C:\\Users\\technicien>ping "+targetAddress,"",
      "Envoi d'une requête 'Ping' "+targetAddress+" avec 32 octets de données :"];
    const display=()=>{element.textContent=lines.join("\n");};
    let count=0;
    display();
    if(typeof onProgress==="function")onProgress(0);
    const step=()=>{
      if(ticket!==generation)return;
      count++;
      lines.push(success
        ?"Réponse de "+targetAddress+" : octets=32 temps<1 ms TTL=128"
        :"Délai d'attente de la demande dépassé.");
      if(count===4){
        const received=success?4:0;
        lines.push("","Statistiques Ping pour "+targetAddress+" :",
          "    Paquets : envoyés = 4, reçus = "+received+
          ", perdus = "+(4-received)+" ("+(success?0:100)+" % de perte)");
        timeoutId=null;
        display();
        if(typeof onComplete==="function")onComplete({success,outcome});
      }else{
        display();
        if(typeof onProgress==="function")onProgress(count);
        timeoutId=setTimeout(step,intervalMs);
      }
    };
    timeoutId=setTimeout(step,intervalMs);
  }
  return {run,cancel};
}
