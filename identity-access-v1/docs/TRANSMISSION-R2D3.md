# Transmission au responsable R2D3

> **Mise à jour de publication.** Un banc d'essai complet est publié sous [C2-Lab/identity-access-v1](https://github.com/chaoli22000bzh/C2-Lab/tree/main/identity-access-v1) et [sa page CyberNet](https://chaoli22000bzh.github.io/C2-Lab/identity-access-v1/demo/). L'absence de dépôt GitHub autonome mentionnée ci-dessous concerne toujours le dépôt définitif, qui reste à créer. Le banc C2-Lab n'est pas une intégration C² ni une validation navigateur.


## État de la recette du laboratoire, 14 novembre 2026

Le professeur a réalisé et **validé 5/5 tests manuels** dans le navigateur : affichage des identités Windows, autorisation/refus SMB selon l'identité, limitation/rétablissement du partage, continuité DC02 puis échec des deux DC, et commandes d'héritage NTFS. Les noms artificiels des comptes du scénario ont été remplacés par des comptes Administrateur locaux dans le banc publié ; l'affichage a été élargi.

Le laboratoire GitHub Pages et ses sources sont accessibles : [interface CyberNet](https://chaoli22000bzh.github.io/C2-Lab/identity-access-v1/demo/).

**Ne pas confondre cette recette du banc avec l'audit externe ou une intégration réelle dans R2D3.** Les observations AD/SMB de l'hôte doivent encore être raccordées et le dépôt autonome définitif n'existe toujours pas.


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
## Suite de l'audit indépendant (14 novembre 2026)

L'auditeur a refusé l'intégration V0.1.0 (A1, A2, A3 majeures, A4 mineure, réserve R1). Des correctifs ont été publiés sur le banc, mais la contre-vérification et l'exécution des tests sur ce commit restent nécessaires. La conversion NTFS de permissions héritées pour un principal déjà couvert par une permission explicite n'est pas fidèle à toutes les ACE Windows en raison du schéma actuel, comme expliqué dans `docs/API.md`. **Ne pas intégrer à R2D3 à ce stade.**

## Correctif A2 après contre-audit

La première correction A2 était non conforme car elle supprimait le niveau hérité quand il existait une entrée explicite du même principal. Le nouveau code représente une ACE convertie séparée (`converted:true`) et des tests vérifient le droit effectif avant/après désactivation. Le schéma des permissions reste volontairement simplifié (quatre niveaux). En attendant exécution Node et nouveau contre-audit : **intégration R2D3 NON autorisée**.

## Correctif A5 après deuxième contre-audit

La suppression NTFS prend dorénavant `source:'explicit'|'converted'|'all'`, avec `explicit` comme valeur par défaut. La documentation API et un test de non-régression ont été ajoutés. La portée reste strictement celle des ACL, sans modification R2D3. L'intégration demeure non autorisée jusqu'à tests exécutés et contre-vérification indépendante.

## Exécution CI confirmée, commit 3ce0ac6

GitHub Actions, exécution [43605816669](https://github.com/chaoli22000bzh/C2-Lab/actions/runs/43605816669), sur le commit `3ce0ac61b3d659e6b5ba48cfc721d4775009effc` : **36 tests Node exécutés, 36 réussis, 0 échec**, dont A5. `npm run build:demo` et la comparaison avec le scénario généré ont également réussi. Les résultats ont été contrôlés dans les journaux du job GitHub.

La validation automatisée ne remplace ni le contre-audit indépendant ni le raccordement de l'adaptateur aux véritables moteurs R2D3 (R1). **Intégration R2D3 NON autorisée à cette étape.**
