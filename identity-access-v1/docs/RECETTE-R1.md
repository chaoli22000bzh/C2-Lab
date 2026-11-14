# Recette R1 : véritables modules R2D3

## Modules visés

- Registre R2D3 : `R2D3/src/asset-profiles.js`, fonction `createAssetRegistry`.
- Réseau R2D3 : `R2D3/src/r2d3-core.js`, fonction `createEngine`.
- Scénario réel R2D3 de base : `scenarios/atelier-2pc-imprimante-exp.json`.
- Version R2D3 figée au commit `b497a7168913e0f3c31fad0dcdccfab3a3a4052c`.
- Adaptateur du laboratoire : `adapters/r2d3-adapter.js`.

## Nature de la preuve

La CI récupère le **vrai dépôt R2D3**, crée cinq actifs avec le **vrai registre**, étend le scénario réseau à un serveur de fichiers et deux DC avec les structures reconnues par le **vrai moteur réseau**, puis exécute le moteur d'identités avec ses `asset.id` exacts.

Le test vérifie la correspondance explicite entre l'identité des objets réseau et le nom des actifs, la disponibilité du domaine, la continuité entre DC, l'accès SMB et le refus ou l'état inconnu.

**Limite majeure :** R2D3 ne simule toujours pas les services AD DS et SMB eux-mêmes. Les observations applicatives sont injectées par le test ; `network.ping` ne prouve que la connectivité IPv4 de base et est traité comme une condition nécessaire, jamais comme une preuve autonome de la disponibilité applicative. Sans observations injectées, la réponse reste `unknown`.

**Décision d'intégration :** le test transversal atteste une compatibilité des constructeurs et de leurs états. Il ne permet PAS de déclarer une vraie détection AD DS/SMB ni de supprimer le risque R1 avant prise en charge de ces observations par l'hôte R2D3. Aucun fichier dans le dépôt R2D3 n'a été modifié.
