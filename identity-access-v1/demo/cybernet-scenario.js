// Distribution generee depuis scenarios/cybernet.json. NE PAS EDITER.
export default {
  "format": "identity-access-scenario",
  "schemaVersion": 1,
  "state": {
    "format": "identity-access-state",
    "schemaVersion": 1,
    "revision": 0,
    "nextIds": {
      "account": 5,
      "group": 3,
      "folder": 3,
      "file": 1,
      "share": 1,
      "session": 1,
      "profile": 1,
      "driveRule": 1,
      "ou": 1
    },
    "domain": {
      "id": "domain-1",
      "dnsName": "ad.cybernet.example",
      "shortName": "CYBERNET",
      "controllerAssetIds": [
        "asset-dc01",
        "asset-dc02"
      ]
    },
    "machineMemberships": [
      {
        "machineId": "asset-pc01",
        "joined": true,
        "ouId": "ou-1"
      },
      {
        "machineId": "asset-pc02",
        "joined": true,
        "ouId": "ou-1"
      },
      {
        "machineId": "asset-files",
        "joined": true,
        "ouId": "ou-1"
      },
      {
        "machineId": "asset-dc01",
        "joined": true,
        "ouId": null
      },
      {
        "machineId": "asset-dc02",
        "joined": true,
        "ouId": null
      }
    ],
    "organizationalUnits": [
      {
        "id": "ou-1",
        "name": "Postes et services",
        "parentId": null
      }
    ],
    "accounts": [
      {
        "id": "account-1",
        "kind": "domain",
        "ownerId": "domain-1",
        "login": "admin",
        "displayName": "Administrateur fictif",
        "enabled": true,
        "locked": false,
        "credentialRevision": 0,
        "ouId": null
      },
      {
        "id": "account-2",
        "kind": "domain",
        "ownerId": "domain-1",
        "login": "julie",
        "displayName": "Julie Martin",
        "enabled": true,
        "locked": false,
        "credentialRevision": 0,
        "ouId": null
      },
      {
        "id": "account-3",
        "kind": "local",
        "ownerId": "asset-pc01",
        "login": "Administrateur",
        "displayName": "Administrateur local du poste PC01",
        "enabled": true,
        "locked": false,
        "credentialRevision": 0,
        "ouId": null
      },
      {
        "id": "account-4",
        "kind": "local",
        "ownerId": "asset-pc02",
        "login": "Administrateur",
        "displayName": "Administrateur local du poste PC02",
        "enabled": true,
        "locked": false,
        "credentialRevision": 0,
        "ouId": null
      },
      {
        "id": "account-5",
        "kind": "local",
        "ownerId": "asset-files",
        "login": "Administrateur",
        "displayName": "Administrateur local du serveur de fichiers",
        "enabled": true,
        "locked": false,
        "credentialRevision": 0,
        "ouId": null
      }
    ],
    "groups": [
      {
        "id": "group-1",
        "kind": "domain-global",
        "ownerId": "domain-1",
        "name": "GG_Comptabilite",
        "ouId": null
      },
      {
        "id": "group-2",
        "kind": "domain-local",
        "ownerId": "domain-1",
        "name": "DL_Comptabilite_Modification",
        "ouId": null
      },
      {
        "id": "group-3",
        "kind": "machine-local",
        "ownerId": "asset-pc01",
        "name": "Support_Local",
        "ouId": null
      }
    ],
    "groupMemberships": [
      {
        "groupId": "group-1",
        "memberType": "account",
        "memberId": "account-2"
      },
      {
        "groupId": "group-2",
        "memberType": "group",
        "memberId": "group-1"
      },
      {
        "groupId": "group-3",
        "memberType": "account",
        "memberId": "account-3"
      }
    ],
    "administratorAssignments": [
      {
        "principalId": "account-1",
        "scope": "domain"
      },
      {
        "principalId": "account-3",
        "scope": "machine",
        "machineId": "asset-pc01"
      },
      {
        "principalId": "account-5",
        "scope": "machine",
        "machineId": "asset-files"
      }
    ],
    "folders": [
      {
        "id": "folder-1",
        "machineId": "asset-files",
        "parentId": null,
        "name": "DossiersEntreprise",
        "inheritanceEnabled": true,
        "acl": [
          {
            "principalId": "account-1",
            "level": "admin",
            "inheritable": true
          },
          {
            "principalId": "group-2",
            "level": "read",
            "inheritable": true
          }
        ]
      },
      {
        "id": "folder-2",
        "machineId": "asset-files",
        "parentId": "folder-1",
        "name": "Comptabilite",
        "inheritanceEnabled": true,
        "acl": [
          {
            "principalId": "group-2",
            "level": "write",
            "inheritable": true
          }
        ]
      },
      {
        "id": "folder-3",
        "machineId": "asset-pc01",
        "parentId": null,
        "name": "Travail",
        "inheritanceEnabled": true,
        "acl": [
          {
            "principalId": "account-3",
            "level": "admin",
            "inheritable": true
          }
        ]
      }
    ],
    "files": [
      {
        "id": "file-1",
        "folderId": "folder-2",
        "name": "Budget.txt",
        "content": "Budget fictif CyberNet"
      }
    ],
    "shares": [
      {
        "id": "share-1",
        "machineId": "asset-files",
        "folderId": "folder-2",
        "name": "Comptabilite",
        "acl": [
          {
            "principalId": "group-2",
            "level": "write",
            "inheritable": false
          },
          {
            "principalId": "account-1",
            "level": "admin",
            "inheritable": false
          }
        ]
      }
    ],
    "sessions": [
      {
        "id": "session-1",
        "machineId": "asset-pc01",
        "accountId": "account-1",
        "kind": "domain",
        "active": true,
        "profileId": "profile-1",
        "mappedDrives": []
      }
    ],
    "profiles": [
      {
        "id": "profile-1",
        "machineId": "asset-pc01",
        "accountId": "account-1"
      }
    ],
    "driveMappingRules": [
      {
        "id": "driveRule-1",
        "principalId": "group-1",
        "shareId": "share-1",
        "letter": "S"
      }
    ]
  }
};
