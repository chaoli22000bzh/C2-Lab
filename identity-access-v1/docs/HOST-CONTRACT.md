# Contrat d'hôte et adaptateur R2D3

Le moteur ne connaît aucune machine autre que les références `asset.id` de l'hôte.

```js
const host = {
  getMachine(assetId) {return {status:'ok', machine:{id:assetId,kind:'computer'}};},
  getServiceStatus(assetId,service) {return {status:'available'};},
  getReachability(sourceAssetId,targetAssetId,purpose) {return {status:'reachable'};},
  getSimulationTime() {return {status:'ok',value:0};}
};
```

## Résultats stricts

- `getMachine`: `{status:'ok',machine:{id,kind:'computer'|'server'}}`, `{status:'not_found'}`, `{status:'unknown'}`.
- `getServiceStatus`: `{status:'available'|'unavailable'|'unknown'}`.
- `getReachability`: `{status:'reachable'|'unreachable'|'unknown'}`.
- `getSimulationTime`: `{status:'ok',value:<nombre fini>}` ou `{status:'unknown'}`.
- `service` peut prendre `ad-ds`, `dns` ou `smb`. Le moteur actuel consulte `ad-ds` et `smb`. `purpose` peut prendre `domain` ou `smb`.

Une réponse absente ou mal formée vaut `unknown`, jamais « disponible ». Les exceptions des callbacks sont traitées comme une observation inconnue. Une machine inconnue ou disparue ne peut pas être remplacée par son nom visible.

## Utilisation de l'adaptateur

```js
import {createR2D3IdentityHost} from './adapters/r2d3-adapter.js';
const host = createR2D3IdentityHost({
  assetRegistry, // createAssetRegistry(...) dans R2D3
  networkEngine, // createEngine(...) dans R2D3
  assetToNetworkId: {
    'asset-pc01':'net-11',
    'asset-files':'net-12'
  },
  assetKinds: {
    'asset-pc01':'computer',
    'asset-files':'server'
  },
  serviceEvidence: (assetId,service) => 'unknown',
  reachabilityEvidence: (fromId,toId,purpose) => 'unknown'
});
```

`assetToNetworkId` doit être explicite et injective. L'adaptateur vérifie l'existence de l'actif avec `getAsset()` et la présence de l'objet réseau correspondant dans `getSnapshot().objectsById`.

### Limite réseau actuelle

Le moteur R2D3 expose `getSnapshot()` et `query({type:'network.ping',...})`, mais le ping ICMP ne prouve pas à lui seul la disponibilité d'AD DS ou du port SMB. **L'adaptateur retourne donc `unknown` en l'absence de constats propres au service.** Les fonctions `serviceEvidence` et `reachabilityEvidence` représentent des observations explicites, injectées par un scénario de laboratoire ; elles ne sont pas des services réseau concurrents.

Il restera à l'équipe R2D3 de raccorder, ou d'ajouter dans son moteur réseau, des constats AD/SMB fiables. Aucune modification de `R2D3/src/asset-profiles.js` ou `R2D3/src/r2d3-core.js` n'est exigée pour installer ce module.

### Tests d'intégration

`tests/adapter.test.mjs` exerce l'adaptateur contre les signatures publiques réelles identifiées, avec des doubles de test. Une recette définitive nécessitera de monter côte à côte le vrai dépôt R2D3 et le dépôt autonome, puis d'exécuter un essai transversal sur un scénario réseau réel.