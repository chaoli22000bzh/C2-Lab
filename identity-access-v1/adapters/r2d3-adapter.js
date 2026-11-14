/**
 * Adaptateur de preuve R2D3 vers le contrat hôte.
 * AUCUN inventaire ou moteur réseau parallèle. Toutes les références restent des asset.id.
 * Les services et observations non disponibles dans R2D3 V0.3 sont 'unknown', sauf
 * si l'environnement d'essai injecte explicitement un constat fiable.
 */
export function createR2D3IdentityHost({assetRegistry,networkEngine,assetToNetworkId,assetKinds,serviceEvidence,reachabilityEvidence}) {
 if(!assetRegistry || typeof assetRegistry.getAsset !== 'function')throw Error('assetRegistry R2D3 requis');
 if(!networkEngine || typeof networkEngine.query !== 'function' || typeof networkEngine.getSnapshot !== 'function')throw Error('networkEngine R2D3 requis');
 if(!assetToNetworkId || !assetKinds || typeof assetToNetworkId !== 'object')throw Error('Correspondance explicite des machines obligatoire');
 const pairs=Object.entries(assetToNetworkId);
 if(new Set(pairs.map(([,id])=>id)).size!==pairs.length)throw Error('Correspondance non injective des machines');
 const allowedServices=new Set(['ad-ds','dns','smb']);
 const getMachine=assetId=>{
  const asset=assetRegistry.getAsset(assetId);if(!asset)return {status:'not_found'};
  const kind=assetKinds[assetId];if(!['computer','server'].includes(kind))return {status:'unknown'};
  const id=assetToNetworkId[assetId];if(typeof id!=='string'||!id)return {status:'unknown'};
  const nw=networkEngine.getSnapshot();if(!nw?.objectsById?.[id])return {status:'unknown'};
  return {status:'ok',machine:{id:assetId,kind}};
 };
 return {
  getMachine,
  getServiceStatus(assetId,service){
   if(getMachine(assetId).status!=='ok'||!allowedServices.has(service))return {status:'unknown'};
   if(typeof serviceEvidence!=='function')return {status:'unknown'};
   const status=serviceEvidence(assetId,service);
   return {status:['available','unavailable'].includes(status)?status:'unknown'};
  },
  getReachability(fromAssetId,toAssetId,purpose){
   if(getMachine(fromAssetId).status!=='ok'||getMachine(toAssetId).status!=='ok')return {status:'unknown'};
   if(typeof reachabilityEvidence==='function'){
    const r=reachabilityEvidence(fromAssetId,toAssetId,purpose);
    if(['reachable','unreachable'].includes(r))return {status:r};
   }
   // Un ping ICMP n'est pas une preuve qu'AD DS ou SMB est disponible sur ses ports.
   // R2D3 V0.3 expose network.ping, mais pas encore une sonde de service AD/SMB.
   return {status:'unknown'};
  },
  getSimulationTime(){const snapshot=networkEngine.getSnapshot();return typeof snapshot?.simulationClock==='number'&&Number.isFinite(snapshot.simulationClock)?{status:'ok',value:snapshot.simulationClock}:{status:'unknown'};}
 };
}