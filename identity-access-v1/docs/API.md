# API publique V0.1.0

## Initialiser et restaurer

```js
import {createIdentityAccessEngine,restoreIdentityAccessEngine} from './src/identity-access-core.js';
const engine = createIdentityAccessEngine({scenario, host});
const sameEngine = restoreIdentityAccessEngine({scenario,savedState:engine.exportState(),host});
```

Un scénario est un objet `{format:"identity-access-scenario",schemaVersion:1,state:{...}}`. Le champ `state` contient l'état métier initial validé et explicitement privilégié. Il est la **seule voie d'initialisation privilégiée**, séparée des commandes d'utilisateur. L'absence de `actorSessionId` n'accorde jamais de droits administratifs.

`restoreIdentityAccessEngine` valide les références avant de restituer l'instance et échoue avec une exception explicite si l'état est invalide. `exportState()` retourne un objet JSON, à sérialiser au choix par l'appelant. Les données du domaine et des comptes sont fictives.

## Commandes

```js
const result = engine.command({
  type:'account.create',
  actorSessionId:'session-1',
  expectedRevision: 0, // facultatif, contrôle concurrent
  params:{kind:'domain',ownerId:'domain-1',login:'sophie'}
});
```

Les commandes renvoient `{success,code,revision,data}`. Une commande refusée ne modifie ni l'état ni sa révision. Les résultats sont copiés, pas des pointeurs mutables sur l'état interne.

Familles disponibles :

- Domaine : `domain.configure`, `domain.joinMachine`, `domain.leaveMachine`.
- OU : `ou.create`, `ou.rename`, `ou.move`, `ou.delete`, `ou.assignObject`.
- Comptes : `account.create`, `account.rename`, `account.setEnabled`, `account.setLocked`, `account.resetCredential`, `account.delete`.
- Groupes : `group.create`, `group.rename`, `group.delete`, `group.addMember`, `group.removeMember`.
- Rôles administratifs : `administrator.grant`, `administrator.revoke`.
- Dossiers : `folder.create`, `folder.rename`, `folder.delete`.
- Fichiers locaux : `file.create`, `file.update`, `file.rename`, `file.delete`.
- Permissions : `ntfs.setPermission`, `ntfs.removePermission`, `ntfs.disableInheritance`, `ntfs.enableInheritance`.
- Partages : `share.create`, `share.rename`, `share.delete`, `share.setPermission`, `share.removePermission`.
- Fichiers via SMB : `smb.fileCreate`, `smb.fileUpdate`, `smb.fileDelete` avec `shareId`, `credentialAccountId` éventuel et identifiant de fichier ou de dossier.
- Lecteurs : `driveRule.create`, `driveRule.update`, `driveRule.delete`.
- Sessions : `session.open`, `session.close`.

**Exception volontaire :** `session.open` n'exige pas `actorSessionId`, car elle représente la création d'une session, et non une opération privilégiée. Les comptes sont fictifs : l'ouverture simule une présentation d'identité et un marqueur de secret fictif `credentialRevision` (0 par défaut). Après `account.resetCredential`, la révision attendue augmente et un marqueur antérieur est refusé. Ce mécanisme **n'est pas une authentification réelle** et ne doit pas protéger des données sensibles.

`file.read` n'est **pas** une commande. C'est une requête sans mutation.

## Requêtes

```js
engine.query({type:'account.list'});
engine.query({type:'identity.groups',accountId:'account-2',machineId:'asset-files'});
engine.query({type:'ntfs.effectivePermission',accountId:'account-2',folderId:'folder-2'});
engine.query({type:'access.evaluateLocal',sessionId:'session-1',folderId:'folder-3',operation:'read'});
engine.query({type:'access.evaluateSmb',sessionId:'session-1',credentialAccountId:'account-2',shareId:'share-1',operation:'write'});
engine.query({type:'file.read',sessionId:'session-2',fileId:'file-1'});
```

Autres types : `state.summary`, `group.list`, `group.members`, `ou.list`, `folder.list`, `file.list`, `share.list`, `session.list`, `driveRule.list`, `domain.status`, `session.profile`, `session.mappedDrives`.

**Attention :** `query()` fournit des informations techniques destinées aux interfaces de simulation. Elle ne remplace pas le contrôle d'autorisation réel de C² ni une API sécurisée multi-utilisateur.

## Modèle des permissions

`none < read < write < admin`.

- Les droits directs et les droits des groupes applicables sont agrégés par maximum.
- Aucun refus explicite : `none` n'annule jamais les droits d'un autre groupe.
- Pour SMB, le niveau effectif est le minimum du niveau du partage et du niveau NTFS.
- Les `ACL` sont des entrées `{principalId,level,inheritable}` ; les permissions héritées sont calculées à la demande.
- `ntfs.disableInheritance` accepte `mode:'preserve'` (convertir en permissions explicites) ou `mode:'removeInherited'` (ne garder que les explicites).
- Des fichiers ne sont modifiables localement que par une session ouverte **sur la machine propriétaire** ; une modification distante passe explicitement par `smb.fileUpdate` et contrôle le partage ainsi que les NTFS.

## Codes d'erreur principaux

`invalid_command`, `invalid_query`, `unsupported_command`, `unsupported_query`, `revision_conflict`, `actor_session_required`, `actor_session_invalid`, `administrator_required`, `account_not_found`, `account_disabled`, `account_locked`, `credential_rejected`, `machine_not_found`, `machine_unknown`, `machine_not_domain_member`, `domain_not_configured`, `domain_controller_unavailable`, `domain_status_unknown`, `membership_scope_invalid`, `organizational_unit_not_empty`, `folder_not_found`, `folder_outside_share`, `share_not_found`, `identity_not_recognized`, `service_unavailable`, `service_status_unknown`, `server_unreachable`, `network_status_unknown`, `share_insufficient_permission`, `ntfs_insufficient_permission`, `local_machine_mismatch`, `invalid_resulting_state`.

Le champ `code` est stable pour les interfaces. La traduction en français et les explications de l'exercice doivent appartenir à l'interface.

## Export, reprise et règles de version

- Les identifiants d'actifs sont conservés tels quels.
- Aucune information de disponibilité réseau n'est exportée.
- La révision est incrémentée après une mutation admissible.
- Une restitution incohérente provoque une exception plutôt qu'une réparation silencieuse.
- Une modification de schéma incompatible nécessitera une migration explicite et une nouvelle version majeure.
## Conversion de l'héritage NTFS après contre-audit

`ntfs.disableInheritance(mode:'preserve')` maintient les ACE explicites et ajoute les ACE héritées converties avec le marqueur `converted:true`. Deux entrées de même `principalId` peuvent coexister si l'une est une ACE explicite et l'autre est convertie. Les permissions héritées de plusieurs ancêtres pour un même principal sont agrégées par maximum dans l'ACE convertie. Le niveau effectif immédiatement avant/après `preserve` doit rester identique.

`mode:'removeInherited'` élimine les ACE héritées sans affecter les ACE explicites. Lors de la réactivation de l'héritage, les ACE converties restent explicites, tandis que le moteur recalcule les entrées héritées dynamiquement.

La simulation conserve les quatre niveaux `none/read/write/admin`, sans simuler toutes les ACE Windows ni les refus explicites. `file.list` ne divulgue pas le champ `content`; celui-ci nécessite `file.read` et un contrôle NTFS.


## Suppression des permissions NTFS, règle A5

La commande `ntfs.removePermission` reçoit `params:{folderId,principalId,source?}`.

- `source:'explicit'` (**défaut**, pour compatibilité) supprime uniquement l'ACE explicite d'origine, jamais l'ACE convertie.
- `source:'converted'` supprime uniquement l'ACE issue d'une conversion `preserve`.
- `source:'all'` supprime toutes les ACE locales sur ce dossier pour le principal, sans toucher aux entrées du parent ni à l'héritage dynamique.

Un sélecteur invalide renvoie `invalid_permission_source`. Une sélection ne correspondant à aucune ACE renvoie `permission_not_found`. Les refus ne changent pas l'état ni la révision. `ntfs.setPermission` conserve la sémantique d'édition de l'ACE explicite d'origine.
