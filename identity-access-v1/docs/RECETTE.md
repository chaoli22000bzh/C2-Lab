# Recette technique et limites

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