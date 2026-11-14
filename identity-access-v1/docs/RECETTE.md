# Recette technique et limites

## Recette enseignante réellement effectuée le 14 novembre 2026

**5 tests sur 5 déclarés validés par le professeur dans le navigateur** sur le banc CyberNet publié dans C2-Lab, après correction de l'affichage des identités et élargissement de l'interface :

1. Identification de cinq comptes (domaine et comptes administrateurs locaux) et affichage lisible des machines.
2. SMB : accès Julie autorisé (`access_granted`) et compte local de PC01 non reconnu (`identity_not_recognized`).
3. Partage SMB : écriture autorisée, refus `share_insufficient_permission` après limitation à Lecture, puis écriture à nouveau autorisée.
4. Active Directory : session Julie ouverte si DC02 reste disponible malgré l'arrêt de DC01, puis refus `domain_controller_unavailable` si les deux DC sont indisponibles.
5. NTFS : désactivation de l'héritage avec conservation, réactivation, puis désactivation avec suppression des entrées héritées ; codes et état affiché conformes.

**Portée :** recette fonctionnelle de l'interface web sur ce scénario, pas preuve exhaustive des calculs NTFS ni audit indépendant. La vérification de la conservation effective de toutes les entrées ACL dans chaque mode relève aussi des tests Node et de l'audit externe.

**Tests Node annoncés à la livraison :** 31/31 réussis. Aucun nouveau test Node exécuté lors de cette mise à jour documentaire.

**Points restant ouverts :** dépôt GitHub autonome distinct à créer ; adaptateur à valider avec vraies instances R2D3 et faits réseau AD/SMB ; audit externe ; aucune intégration C².


## Commandes exécutables

```sh
npm test
npm run demo
npm run build:demo
```

## Couverture

Les tests vérifient : comptes locaux homonymes, domaine et groupes, chaîne AGDLP, droits cumulés, refus atomiques, permissions NTFS et partage, accès SMB avec identité différente, DC redondants, indisponibilité des DC, services inconnus, attribution de lecteur, export/restauration, absence de mutation dans les consultations, héritage, suppression refusée si références, isolation de deux moteurs, contrôle des opérations d'administration, absence de modification distante par un raccourci local.

## Points non encore vérifiés dans la cible finale

1. **Dépôt GitHub autonome non créé**. L'archive contient le dépôt local complet et son historique Git, prêt à être hébergé.
2. **Adaptateur testé avec doubles** des interfaces R2D3. Son raccordement au vrai moteur réseau et aux vrais actifs reste à valider conjointement avec l'équipe R2D3.
3. **Banc navigateur** livré, mais validation manuelle Android/Firefox non déclarée tant qu'elle n'a pas été effectuée.
4. **C²** non modifié ; aucune intégration à ses séances, authentifications ou bases de données.
5. L'authentification et les profils sont fictifs et non sécurisants ; la vraie sécurité est du ressort de l'hôte.
6. Pas de GPO, réplication AD, Kerberos, LDAP, NTLM, protocole SMB réel, cache de tickets ou stratégies de mots de passe.
7. Les opérations de fichiers sont limitées à des ressources fictives simples, sans système de fichiers Windows complet ni ACL spéciales.

## Recette enseignante minimale proposée (après audit externe)

1. Tester Julie sur le partage Comptabilite : `write` réussit ; limiter le partage à `read` et vérifier que `write` échoue, puis rétablir l'accès.
2. Arrêter DC01, conserver DC02 : nouvelle session de domaine autorisée ; arrêter les deux et vérifier le refus explicite.
3. Sur le dossier Comptabilite : désactiver l'héritage en le conservant, constater les droits, puis le réactiver.

Ces trois manipulations ne doivent être demandées au professeur qu'après validation complète des tests et de l'audit externe.
## Correctifs après audit indépendant (candidat, vérification à refaire)

- A1 : contrôle de portée des administrateurs locaux à l'attribution, à l'utilisation et à la restauration.
- A2 : protection des entrées ACL explicites lors de `preserve` ; limite du schéma sur les ACE de même principal documentée dans API.md.
- A3 : `file.list` ne renvoie plus le contenu des fichiers.
- A4 : ajout du script `scripts/build-demo.mjs` pour `npm run build:demo`.
- Tests de non-régression ajoutés. **Aucun verdict de réussite Node revendiqué tant que `npm test` n'a pas été exécuté sur le commit corrigé.**
- Verdict d'intégration R2D3 : **NON**, en attendant contre-audit, clarification A2 et raccordement réel de l'adaptateur.

## Deuxième correction A2 (14 novembre 2026)

Les ACL distinguent désormais l'entrée explicite de l'entrée héritée convertie (`converted:true`), y compris pour un principal identique. Deux tests visent le droit effectif avant et après `preserve`, le maintien de l'explicite `read`, la conservation du droit converti `admin`, la modification ultérieure du parent, la restauration et le mode `removeInherited`.

**Tests Node non encore exécutés sur ce commit.** La validation externe et la démonstration R2D3 restent requises. Ne pas déclarer l'intégration autorisée.

## Correctif A5, 14 novembre 2026

`ntfs.removePermission` : sélection déterministe `explicit` (défaut), `converted`, `all`. Test de régression ajouté : deux ACE pour le même groupe, suppression explicite seule, puis convertie seule, puis toutes, droit effectif et atomicité des refus.

Le nouveau commit doit être vérifié par Node et contre-audit avant levée du refus d'intégration. Le raccordement aux vraies instances R2D3 (R1) demeure hors de cette correction.

## Exécution CI confirmée, commit 3ce0ac6

GitHub Actions, exécution [43605816669](https://github.com/chaoli22000bzh/C2-Lab/actions/runs/43605816669), sur le commit `3ce0ac61b3d659e6b5ba48cfc721d4775009effc` : **36 tests Node exécutés, 36 réussis, 0 échec**, dont A5. `npm run build:demo` et la comparaison avec le scénario généré ont également réussi. Les résultats ont été contrôlés dans les journaux du job GitHub.

La validation automatisée ne remplace ni le contre-audit indépendant ni le raccordement de l'adaptateur aux véritables moteurs R2D3 (R1). **Intégration R2D3 NON autorisée à cette étape.**

## R1 : tests transversaux avec véritables moteurs R2D3

Une CI distincte importe les vrais `createAssetRegistry` et `createEngine` du dépôt R2D3 à commit figé ; source et rapport : `docs/RECETTE-R1.md`. Les tests ont des observations applicatives simulées mais de vrais identifiants d'actifs et de vraies réponses réseau. La disponibilité applicative AD DS/SMB n'est **pas** encore observée nativement par R2D3.

## R1, banc transversal avec moteurs réels (14 novembre 2026)

La suite `tests/integration-real.mjs` charge directement `createAssetRegistry` depuis `R2D3/src/asset-profiles.js` et `createEngine` depuis `R2D3/src/r2d3-core.js` par un deuxième checkout GitHub Actions. Elle crée les cinq actifs via le registre réel et une topologie dérivée du scénario réseau réel `atelier-dhcp-deux-pc-v1.json`, avec correspondance explicite des identifiants. Aucun moteur réseau, registre d'actifs ou stock métier parallèle n'est créé.

Le test distingue strictement deux choses : (1) le vrai moteur R2D3 constate la connectivité ICMP ; (2) un constat explicite injecté par le scénario de banc est nécessaire pour AD DS/SMB, qui ne sont pas encore observables directement par le moteur R2D3. Le ping seul ne permet aucun faux succès AD/SMB. Ce banc prouve l'interopérabilité des API et la propagation des références, **pas** l'observation intrinsèque des services AD/SMB par R2D3.

Le workflow est `.github/workflows/identity-access-r2d3.yml`. Résultat non confirmé avant consultation de l'exécution GitHub Actions.
