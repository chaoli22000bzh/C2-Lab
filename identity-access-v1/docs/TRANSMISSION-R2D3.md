# Transmission au responsable R2D3

## Livré

- Projet : `identity-access-core`
- Version : **0.1.0**, candidat à l'audit externe
- Commit local : `4122884` (branche `main`)
- Module : `src/identity-access-core.js`
- Adaptateur : `adapters/r2d3-adapter.js`
- Scénario : `scenarios/cybernet.json`
- Contrats : `docs/API.md` et `docs/HOST-CONTRACT.md`
- Vérification : `npm test` (31 tests, 31 réussites à la livraison)
- Laboratoire : `demo/index.html` avec `demo/app.js`, distinct du moteur

## Démarrage

```bash
npm test
npm run demo
python3 -m http.server 8765
```

Puis ouvrir http://localhost:8765/demo/.

## Pour raccorder à R2D3

1. Cloner (ou installer) cette version du module comme **dépendance identifiée** sans en copier/modifier la logique métier dans R2D3.
2. Préparer les machines par `createAssetRegistry`, puis conserver leurs `asset.id`.
3. Créer le moteur réseau par `createEngine` et établir une correspondance **explicite** `asset.id` vers `objectsById` du scénario réseau.
4. Construire l'hôte via `createR2D3IdentityHost`. Injecter les constats vérifiés pour services AD DS/SMB et leur joignabilité. **Le réseau V0.3 ne fournit pas encore de sonde suffisante pour considérer ces services disponibles sans faits additionnels.**
5. Créer le moteur d'identités avec `createIdentityAccessEngine({scenario,host})`.
6. Vérifier AGDLP, héritage, SMB, DC01 interrompu/DC02 joignable, export/restauration et isolation.

L'adaptateur conserve **uniquement les références** aux objets R2D3 et aux fonctions de l'hôte. Aucun moteur DNS/DHCP et aucun inventaire parallèle n'ont été ajoutés.

## Points à auditer particulièrement

- Contrôle des permissions au niveau des commandes, pas seulement dans l'interface.
- Mutation refusée sans changement de révision.
- Comptes homonymes locaux distincts de l'identité domaine.
- Conversion de permissions héritées en permissions explicites.
- Gestion d'identité SMB distincte de la session cliente.
- Cohérence des exports/restaurations.
- Connectivité inconnue qui ne devient pas un faux succès.
- Fonctionnement effectif de l'adaptateur sur de **vraies instances R2D3**, après fourniture des observations AD/SMB.

## Limitations de recette

- Aucun dépôt GitHub distant n'a été créé, faute de fonction de création de dépôt dans la connexion actuellement disponible. L'archive contient un dépôt Git prêt à publier.
- Le laboratoire n'a pas été validé dans le navigateur : la plateforme d'exécution bloque la navigation HTTP locale par stratégie administrative.
- Aucun changement de C², `R2D3/src/asset-profiles.js` ou `R2D3/src/r2d3-core.js`.
- Les tests automatisés ne sont pas un audit indépendant.