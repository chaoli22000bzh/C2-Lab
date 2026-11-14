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