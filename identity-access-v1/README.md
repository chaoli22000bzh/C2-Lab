# Identity Access Core

**Version de livraison : 0.1.0 (candidat à l'audit externe)**

Moteur pédagogique JavaScript autonome pour les identités locales et de domaine, un Active Directory simulé, les appartenances AGDLP, les droits NTFS simplifiés, les partages SMB et les règles de lecteurs réseau. **Ce projet n'est pas un système de sécurité réel.**

## Exécution immédiate

Prérequis : Node.js 20 ou supérieur.

```bash
npm test
npm run demo
npm run build:demo
```

Le laboratoire graphique peut être lancé avec un petit serveur HTTP statique, sans accès à Internet :

```bash
python3 -m http.server 8765
```

Puis ouvrir `http://localhost:8765/demo/` dans un navigateur. Un navigateur interdit habituellement les imports ES modules depuis `file://`, d'où le serveur HTTP statique. Le moteur lui-même n'utilise aucune requête réseau.

## Dépôt autonome et intégration

L'archive forme un dépôt Git autonome. Le nom GitHub **`identity-access-core` est proposé, mais sa création et sa disponibilité restent à confirmer**. La connexion GitHub disponible pendant cette livraison ne permet pas de créer un nouveau dépôt. Aucun code n'a été copié dans R2D3 ou C².

Modules publics :

- `src/identity-access-core.js` : moteur canonique.
- `adapters/r2d3-adapter.js` : adaptation explicite des vrais identifiants `asset.id` et du moteur réseau.
- `scenarios/cybernet.json` : état initial fictif de référence.
- `demo/` : interface de démonstration, distincte du moteur.
- `tests/` : tests Node exécutables sans aucune dépendance externe.
- `docs/API.md` et `docs/HOST-CONTRACT.md` : contrat d'intégration.

La diffusion hors ligne consiste à embarquer une **version identifiée et intacte** de `src/identity-access-core.js` avec l'application consommatrice. Ne pas modifier ce fichier dans chaque cours. Toute évolution se fait dans le dépôt source puis est distribuée avec un numéro de version et une somme de contrôle.

## Répartition des responsabilités

Le moteur ne possède **aucune machine**. Les identifiants `machineId` sont ceux des actifs de R2D3. Les propriétés matérielles, la disponibilité des services, la connectivité et le temps simulé viennent exclusivement du contrat hôte. Aucun DNS, DHCP, LDAP, Kerberos, NTLM, SMB ou Windows réel n'est exécuté.

C² demeure responsable des véritables utilisateurs, séances, permissions pédagogiques, notes, persistence SQL et sécurité applicative. Les identités créées ici sont fictives et ne doivent pas être utilisées pour sécuriser des données réelles.

## Statut de validation

- Vérification de syntaxe et tests Node disponibles via `npm test`.
- Démonstration Node accessible via `npm run demo`.
- L'adaptateur a été testé contre les signatures réelles **observées** de `getAsset`, `getSnapshot` et `query`, à l'aide de doubles de test. La preuve d'intégration exécutée avec le dépôt R2D3 lui-même reste à réaliser lorsque les deux dépôts seront disponibles côte à côte.
- Aucun test manuel du professeur ni audit externe n'est déclaré terminé.

La matrice des limites et des scénarios de recette figure dans `docs/RECETTE.md`.