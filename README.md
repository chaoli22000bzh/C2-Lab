# C2-Lab

Laboratoire de tests des simulateurs pédagogiques.

## Bibliothèque des composants partagés

- [Catalogue consultable et page de vérification des commandes Windows](https://chaoli22000bzh.github.io/C2-Lab/composants/)
- [Inventaire structuré des composants](composants/catalogue.json)
- [Sources communes](shared-ui/v1/)

Le catalogue répond à la question « quel composant existe déjà ? » sans devoir lire le code. On y recherche un composant par besoin (DHCP, ARP, ping), commande ou mot-clé.

### Règle de maintenance

**À chaque nouveau composant partagé**, ajouter une fiche à `composants/catalogue.json` dans le même développement :
1. Identifiant et nom pédagogique.
2. Description de ce que fait réellement le composant.
3. Catégorie et mots-clés de recherche.
4. Fichiers source et fonctions publiques.
5. Dépendances avec d'autres composants.
6. Statut de validation et possibilités de réutilisation.
7. Démonstration facultative si le composant se prête à un essai en ligne.

Toute évolution majeure d'un composant doit mettre à jour sa fiche. Ne pas créer un nouveau composant si une fonction partagée existante couvre le besoin. Le catalogue est un inventaire de code disponible, **pas** une preuve d'intégration dans C² ou sur les portails : ces projets nécessitent leur propre intégration, y compris pour fonctionner hors connexion.

La page `composants/index.html` lit le fichier `catalogue.json` pour présenter automatiquement les fiches et permettre la recherche. Les sorties de test `ipconfig`, `ipconfig /all` et ARP sont produites par import direct des modules `shared-ui/v1`. Il n'existe pas de deuxième moteur de présentation sur la page de test.
