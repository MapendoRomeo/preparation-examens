# Préparation & Simulation d'Examens

Application web complète de **gestion de contenu pédagogique** et de **passage
d'examens blancs**. Elle s'organise autour de trois niveaux — **Module →
Chapitre → Question** — avec une administration complète, un import/export CSV,
un tableau de bord, un thème clair/sombre, et un parcours d'examen chapitre par
chapitre.

Le projet se lance localement en une commande, avec ou sans Docker.

---

## Sommaire

- [Deux règles structurantes](#deux-règles-structurantes)
- [Fonctionnalités](#fonctionnalités)
- [Architecture](#architecture)
- [Démarrage rapide](#démarrage-rapide)
- [Configuration](#configuration)
- [Base de données et Prisma](#base-de-données-et-prisma)
- [Lancement en développement](#lancement-en-développement)
- [Lancement avec Docker](#lancement-avec-docker)
- [Format CSV](#format-csv)
- [Passer un examen](#passer-un-examen)
- [Système de notation](#système-de-notation)
- [Principe de non-persistance](#principe-de-non-persistance)
- [API REST](#api-rest)
- [Tests](#tests)
- [Dépannage](#dépannage)

---

## Deux règles structurantes

Ces deux règles gouvernent l'architecture. Elles ne sont pas des options
d'affichage : elles sont appliquées à plusieurs niveaux et vérifiées par des
tests automatisés.

### 1. Aucune correction visible avant la soumission

Pendant un examen, le navigateur ne reçoit **jamais** la bonne réponse ni
l'explication. Cela est garanti par quatre barrières successives :

| Barrière | Où | Ce qu'elle empêche |
|---|---|---|
| Sélection `select` Prisma | `backend/src/services/exam.service.ts` | Les colonnes `correctAnswer` et `explanation` ne quittent jamais PostgreSQL |
| Mapper explicite | `backend/src/types/dto.ts` — `toExamQuestionDTO()` | Champ par champ, jamais de *spread* : aucun ajout accidentel au DTO |
| Intercepteur de réponse | `backend/src/middleware/guardExamPayload.ts` | Analyse le JSON final ; en développement, lève une erreur si une clé interdite apparaît ; en production, renvoie une 500 plutôt que de laisser fuir |
| Type côté client | `frontend/src/types/index.ts` | `ExamQuestion` ne **déclare pas** `correctAnswer`/`explanation` : y accéder est une erreur de compilation |

Les tests d'intégration (`backend/tests/integration/exam.test.ts`) vérifient en
outre que le corps brut de la réponse ne contient **aucune** des chaînes
`correctAnswer`, `explanation`, ni le texte d'une explication connue.

### 2. Aucune tentative enregistrée en base

La base de données ne contient que du **contenu pédagogique**. Elle ne contient
jamais : réponses choisies, score, résultat, historique, date de tentative,
questions sautées, statistiques.

- Aucune table, aucune colonne, aucune migration ne prévoit ces données.
- `POST /api/exams/.../submit` ne contient **aucune opération d'écriture** — le
  commentaire d'en-tête de `exam.service.ts` le documente, et le test le vérifie.
- Les réponses vivent dans le store Zustand en mémoire
  (`frontend/src/stores/examStore.ts`), **sans** middleware `persist`, sans
  `localStorage`, sans `sessionStorage`, sans IndexedDB.
- Le seul élément persisté par l'application est le **thème** clair/sombre.

Les tests vérifient que le schéma se limite exactement à `Module`, `Chapter` et
`Question`, qu'aucun nom de table n'évoque une tentative, et que les compteurs de
lignes et les `updatedAt` sont identiques avant et après une soumission.

---

## Fonctionnalités

**Administration**

- CRUD complet sur les modules, les chapitres et les questions
- Réordonnancement par **glisser-déposer** (chapitres, questions)
- Duplication d'un module, d'un chapitre ou d'une question (nouveaux identifiants)
- Suppression en cascade avec confirmation chiffrée
- Tableau de bord : compteurs, modules récents, raccourcis
- Recherche globale (modules, chapitres, questions) et filtres par chapitre,
  par bonne réponse, par identifiant
- Pagination sur les listes de questions

**Import / export CSV**

- Import en 4 étapes : destination → fichier → analyse → confirmation
- Analyse sans écriture (`mode: validate`) avec prévisualisation ligne par ligne
- Gestion des accents (BOM), des guillemets, des virgules et des retours à la
  ligne dans les champs ; détection automatique du séparateur `,` ou `;`
- Rapport d'import : lignes analysées / importées / mises à jour / ignorées / en erreur
- Stratégie face aux doublons : ignorer, mettre à jour, ou traiter en erreur
- Import transactionnel : en cas d'échec, rien n'est écrit
- Modèle CSV téléchargeable, export CSV (tout le contenu, un module, un chapitre)

**Examen**

- Parcours **chapitre par chapitre**, avec progression globale et par chapitre
- Sélection A / B / C / D, bouton **Sauter**, navigation **Précédent / Suivant**
- Aller directement à un chapitre, revenir sur une question sautée
- Avertissement avant fermeture d'onglet et blocage des sorties accidentelles
- Correction et résultats **uniquement après soumission**
- Résultats : score global, détail par chapitre, correction question par question
  avec votre réponse, la bonne réponse et l'explication
- **Mode révision** séparé : correction affichée à la demande, sans score

**Interface**

- Thème clair et sombre, sans flash au chargement
- Responsive, accessible au clavier (glisser-déposer utilisable aux flèches)
- Couleurs de statut toujours accompagnées d'une icône et d'un libellé
- Messages d'erreur explicites, en français, rattachés à leur champ

---

## Architecture

```
examen/
├── docker-compose.yml          PostgreSQL + API + interface
├── .env.example                Modèle de configuration
│
├── backend/                    API REST — Node.js, Express, Prisma
│   ├── prisma/
│   │   ├── schema.prisma       Module, Chapter, Question (rien d'autre)
│   │   ├── migrations/
│   │   └── seed.ts             Module « Airlaw » : 3 chapitres, 24 questions
│   ├── src/
│   │   ├── domain/scoring.ts          calcul du score (fonction pure)
│   │   ├── types/dto.ts               contrat d'API + mappers explicites
│   │   ├── services/                  logique métier
│   │   ├── controllers/ routes/       couche HTTP
│   │   ├── middleware/                validation, erreurs, garde anti-fuite
│   │   ├── validators/schemas.ts      schémas Zod
│   │   └── utils/                     CSV RFC 4180, identifiants, HTTP
│   ├── .env.test               Base de test dédiée (versionnée)
│   └── tests/
│       ├── global-setup.ts            applique les migrations sur la base de test
│       ├── unit/                      notation, analyse CSV
│       └── integration/               API, import, examen et non-persistance
│
└── frontend/                   Interface — React, Vite, TypeScript, Tailwind
    ├── nginx.conf              Service de production (SPA + cache)
    └── src/
        ├── pages/              un fichier par écran
        ├── components/ui/      bibliothèque de composants
        ├── components/layout/  ossatures, navigation, recherche globale
        ├── services/           client HTTP et appels d'API
        ├── stores/             état d'examen (mémoire), thème, notifications
        ├── router/             table de routage
        └── types/              miroir des DTO du serveur
```

**Pile technique**

| Côté | Technologies |
|---|---|
| Backend | Node.js 22, TypeScript, Express 4, Prisma 6, PostgreSQL 16, Zod, Vitest + Supertest |
| Frontend | React 18, Vite 6, TypeScript, Tailwind CSS 4, React Router 6, Zustand 5, Axios, dnd-kit, lucide-react |

---

## Démarrage rapide

```bash
# 1. Configuration
cp .env.example .env
cp backend/.env.example backend/.env      # si le fichier existe
cp frontend/.env.example frontend/.env    # si le fichier existe
# backend/.env.test est versionné : rien à copier pour les tests

# 2. Base de données
docker compose up -d db

# 3. Dépendances
cd backend  && npm install && cd ..
cd frontend && npm install && cd ..

# 4. Schéma + jeu de démonstration
cd backend
npx prisma migrate deploy
npm run seed

# 5. Lancer (deux terminaux)
npm run dev                    # terminal 1 — API sur http://localhost:4100
cd ../frontend && npm run dev  # terminal 2 — interface sur http://localhost:5173
```

Ouvrez <http://localhost:5173>. Le jeu de démonstration contient le module
**Airlaw** (3 chapitres, 24 questions) et un module vide.

---

## Configuration

Toutes les variables sont documentées dans `.env.example`.

| Variable | Défaut | Rôle |
|---|---|---|
| `POSTGRES_USER` | `exam` | Utilisateur PostgreSQL |
| `POSTGRES_PASSWORD` | `exam` | Mot de passe PostgreSQL |
| `POSTGRES_DB` | `exam_prep` | Nom de la base |
| `POSTGRES_PORT` | `5432` | Port exposé par le conteneur PostgreSQL |
| `DATABASE_URL` | — | Chaîne Prisma (backend lancé sur l'hôte) |
| `DATABASE_URL_DOCKER` | — | Même chaîne, vue depuis le conteneur (hôte = `db`) |
| `NODE_ENV` | `development` | Environnement |
| `BACKEND_PORT` | `4100` | Port de l'API |
| `CORS_ORIGIN` | `http://localhost:5173` | Origines autorisées |
| `VITE_API_URL` | `http://localhost:4100/api` | URL de l'API vue par le navigateur |
| `FRONTEND_PORT` | `5173` | Port de l'interface |

> **Ports occupés ?** Les valeurs par défaut de ce dépôt utilisent **4100**
> (API) et **5434** (PostgreSQL), afin de cohabiter avec une instance
> PostgreSQL déjà installée sur la machine. Adaptez-les librement : il suffit de
> garder `BACKEND_PORT`, `VITE_API_URL` et `CORS_ORIGIN` cohérents.

> **`VITE_API_URL` est une variable de compilation.** Vite l'inscrit en dur dans
> le bundle : après l'avoir modifiée, il faut reconstruire l'interface
> (`npm run build`), un simple redémarrage ne suffit pas.

---

## Base de données et Prisma

### Schéma

Trois modèles, et rien d'autre :

```
Module  1 ── n  Chapter  1 ── n  Question
```

- `Module` — `id` (uuid), `name`, `description`, horodatages
- `Chapter` — `id`, `moduleId`, `name`, `description`, `order`, horodatages
- `Question` — `id` (chaîne fournie par l'utilisateur, ex. `Q001`), `chapterId`,
  `content`, `assertionA`…`assertionD`, `correctAnswer` (énumération `A|B|C|D`),
  `explanation`, `order`, horodatages

La suppression d'un module entraîne celle de ses chapitres, et celle d'un
chapitre celle de ses questions (`onDelete: Cascade`).

### Commandes

```bash
cd backend

npx prisma migrate deploy     # applique les migrations (production, Docker)
npx prisma migrate dev        # crée une migration à partir du schéma (développement)
npx prisma generate           # régénère le client typé
npx prisma studio             # explorateur de base
npm run db:reset              # remet la base à zéro (destructif)
npm run seed                  # jeu de démonstration
npm run seed:prod             # équivalent compilé, pour l'image Docker
```

### Indices et performances

Le schéma est indexé pour tenir **100 modules, 500 chapitres et 10 000 questions
et plus** : index sur `Module.name`, sur `(Chapter.moduleId, Chapter.order)`, sur
`(Question.chapterId, Question.order)` et sur `Question.content`. Les listes de
questions sont paginées côté serveur, et l'import CSV écrit par lots
(`createMany` par tranches de 500) dans une transaction unique.

---

## Lancement en développement

```bash
# Terminal 1 — API (rechargement automatique)
cd backend && npm run dev

# Terminal 2 — interface (rechargement à chaud)
cd frontend && npm run dev
```

| Service | URL |
|---|---|
| Interface | <http://localhost:5173> |
| API | <http://localhost:4100/api> |
| Santé de l'API | <http://localhost:4100/api/health> |

---

## Lancement avec Docker

```bash
docker compose up -d --build
```

Cela démarre trois services : `db` (PostgreSQL 16), `backend` (API, migrations
appliquées au démarrage) et `frontend` (interface servie par nginx sur le port
`FRONTEND_PORT`).

Pour charger le jeu de démonstration :

```bash
docker compose exec backend npm run seed:prod
```

| Service | URL |
|---|---|
| Interface | <http://localhost:5173> |
| API | <http://localhost:4100/api> |

Pour tout arrêter : `docker compose down`. Pour supprimer aussi les données :
`docker compose down -v`.

---

## Format CSV

### Colonnes

Seul le contenu pédagogique est indispensable. `id` et `order` sont **attribués
automatiquement** s'ils sont absents : un fichier réduit à
`question,assertionA,assertionB,assertionC,assertionD,correctAnswer` suffit.

| Colonne | Obligatoire | Contenu |
|---|---|---|
| `question` | oui | Énoncé |
| `assertionA` … `assertionD` | oui | Les quatre propositions |
| `correctAnswer` | oui | `A`, `B`, `C` ou `D` |
| `explanation` | non | Affichée après soumission et en révision |
| `id` | non | Identifiant unique (ex. `Q001`). Lettres, chiffres, `.`, `-`, `_` |
| `order` | non | Position dans le chapitre |

**Identifiant automatique** — à défaut de colonne `id`, les questions reçoivent
`Q001`, `Q002`, `Q003`… dans l'ordre du fichier. La numérotation reprend après
le plus grand `Q<n>` déjà présent dans le chapitre de destination : un chapitre
qui contient `Q001` à `Q010` verra donc arriver `Q011`. Comme l'identifiant est
une clé globale, un numéro déjà utilisé ailleurs est sauté. Un `id` fourni reste
prioritaire ; l'aperçu signale d'un « auto » ceux qui ont été attribués.

**Ordre automatique** — à défaut de colonne `order`, les questions sont
placées à la suite des questions existantes du chapitre, dans l'ordre du
fichier.

Les en-têtes sont tolérants à la casse et aux accents (`Assertion A`,
`bonne_reponse`, `explication`, `enonce`… sont reconnus). Les colonnes inconnues
sont signalées puis ignorées.

### Encodage et séparateurs

- Encodage **UTF-8** (le BOM d'Excel est accepté et retiré)
- Séparateur **virgule** ou **point-virgule**, détecté automatiquement
- Fins de ligne `LF`, `CRLF` ou `CR`
- Champs entre guillemets acceptant virgules, guillemets doublés (`""`) et
  retours à la ligne

### Exemple

Le minimum — `id` et `order` sont ajoutés à l'import :

```csv
question,assertionA,assertionB,assertionC,assertionD,correctAnswer,explanation
Que signifie l'acronyme ICAO ?,International Civil Aviation Organization,International Commercial Aviation Office,Internal Civil Aviation Organization,International Cargo Aviation Organization,A,"ICAO est l'Organisation de l'aviation civile internationale."
"Quel document institue l'OACI, et quand ?",La convention de Varsovie de 1929,La convention de Chicago de 1944,La convention de Montréal de 1999,Le traité de Rome de 1952,B,La convention de Chicago a été signée le 7 décembre 1944.
```

Les deux colonnes facultatives peuvent être ajoutées pour maîtriser les valeurs :

```csv
id,question,assertionA,assertionB,assertionC,assertionD,correctAnswer,explanation,order
Q001,Que signifie l'acronyme ICAO ?,International Civil Aviation Organization,International Commercial Aviation Office,Internal Civil Aviation Organization,International Cargo Aviation Organization,A,"ICAO est l'Organisation de l'aviation civile internationale.",1
```

Un modèle prêt à remplir est téléchargeable depuis **Import CSV** ou
**Export CSV** (« Télécharger un modèle CSV »).

### Rapport d'import

À l'issue d'un import, l'application affiche un bilan du type :

```
120 lignes analysées · 115 questions importées · 5 erreurs
```

Les lignes en erreur sont listées avec leur numéro de ligne, leur identifiant et
le détail de chaque problème. Elles n'empêchent pas l'import des lignes valides.

---

## Passer un examen

1. **Choisir un module** — la liste indique pour chacun le nombre de chapitres,
   de questions et le score maximum.
2. **Répondre** — les questions défilent dans l'ordre du programme. Sélectionnez
   A, B, C ou D ; utilisez **Sauter** pour passer, **Précédent**/**Suivant** pour
   circuler, ou le sélecteur de chapitres pour aller directement à une section.
3. **Soumettre** — une confirmation rappelle le nombre de questions sans réponse.
4. **Consulter les résultats** — score global, détail par chapitre, puis
   correction question par question avec l'explication.

Le **mode révision** est un parcours distinct : il affiche la correction à la
demande, ne calcule aucun score et n'envoie rien au serveur.

---

## Système de notation

| Situation | Points |
|---|---|
| Bonne réponse | **+2** |
| Mauvaise réponse | **−1** |
| Question sautée ou sans réponse | **0** |

Le score maximum d'un module est de `2 × nombre de questions`. Un total peut donc
être négatif ; l'interface le signale explicitement, une longueur de barre ne
pouvant pas représenter une valeur négative.

Le calcul vit dans une fonction pure et testée indépendamment de HTTP :
`backend/src/domain/scoring.ts` → `calculateExamResult()`.

> Exemple de référence : sur 10 questions, **5 correctes, 2 incorrectes et
> 3 sautées** donnent `5×2 − 2×1 = 8` points.

---

## Principe de non-persistance

**Ce qui est enregistré en base**

- les modules, les chapitres et les questions ;
- leurs assertions, la bonne réponse et l'explication — c'est du contenu
  pédagogique, il doit bien être stocké quelque part.

**Ce qui n'est jamais enregistré**

- les réponses choisies pendant un examen ;
- le score d'une tentative ;
- les questions auxquelles l'utilisateur a répondu, ou qu'il a sautées ;
- l'historique, la date et les statistiques des tentatives.

**Où vivent les réponses**

Dans un store Zustand en mémoire, le temps de la session d'examen. Elles ne sont
écrites nulle part : ni `localStorage`, ni `sessionStorage`, ni IndexedDB, ni
cookie. Elles sont envoyées **une seule fois**, au moment de la soumission, pour
être corrigées par le serveur — qui ne les conserve pas non plus.

**Conséquences concrètes**

- Un rafraîchissement de la page efface l'examen en cours : l'application
  avertit avant de quitter, et bloque les sorties accidentelles.
- Les résultats ne survivent pas à un rechargement de la page de résultats.
  C'est assumé : c'est la contrepartie directe de la règle.
- Il n'existe aucune page « historique de mes examens », et il ne peut pas en
  exister sans changer cette architecture.

**Vérification**

```bash
cd backend && npm test
```

Les tests d'intégration comparent les compteurs de lignes et les horodatages
avant et après une soumission, vérifient que le schéma ne contient aucune table
évoquant une tentative, et s'assurent que la réponse de l'API d'examen ne
contient ni `correctAnswer` ni `explanation`.

---

## API REST

Toutes les routes sont préfixées par `/api`. Les réponses ont la forme
`{ "data": … }` — sauf les listes paginées de questions, qui renvoient
directement `{ items, page, pageSize, total, totalPages }`. Les erreurs ont la
forme `{ "error": { "message", "code", "details" } }`.

### Contenu (administration)

| Méthode | Route | Rôle |
|---|---|---|
| `GET` | `/api/stats` | Compteurs du tableau de bord |
| `GET` | `/api/search?q=` | Recherche globale |
| `GET` | `/api/modules` | Liste des modules |
| `POST` | `/api/modules` | Créer un module |
| `GET` | `/api/modules/:id` | Détail d'un module et de ses chapitres |
| `PUT` | `/api/modules/:id` | Modifier un module |
| `DELETE` | `/api/modules/:id` | Supprimer un module (cascade) |
| `POST` | `/api/modules/:id/duplicate` | Dupliquer un module |
| `GET` | `/api/modules/:id/chapters` | Chapitres d'un module |
| `POST` | `/api/modules/:id/chapters` | Créer un chapitre |
| `GET` | `/api/chapters/:id` | Détail d'un chapitre |
| `PUT` | `/api/chapters/:id` | Modifier un chapitre |
| `DELETE` | `/api/chapters/:id` | Supprimer un chapitre (cascade) |
| `POST` | `/api/chapters/:id/duplicate` | Dupliquer un chapitre |
| `PUT` | `/api/chapters/:id/order` | Réordonner les chapitres d'un module |
| `GET` | `/api/questions` | Questions, filtres et pagination |
| `GET` | `/api/chapters/:id/questions` | Questions d'un chapitre |
| `POST` | `/api/chapters/:id/questions` | Créer une question |
| `GET` | `/api/questions/:id` | Détail d'une question |
| `PUT` | `/api/questions/:id` | Modifier une question |
| `DELETE` | `/api/questions/:id` | Supprimer une question |
| `POST` | `/api/questions/:id/duplicate` | Dupliquer une question |
| `PUT` | `/api/chapters/:id/questions/order` | Réordonner les questions d'un chapitre |

### Import / export

| Méthode | Route | Rôle |
|---|---|---|
| `POST` | `/api/import/csv` | Analyser (`mode: "validate"`) ou importer (`mode: "import"`) |
| `GET` | `/api/import/template` | Modèle CSV |
| `GET` | `/api/export/csv` | Export CSV (`?moduleId=`, `?chapterId=`, `?format=json`) |

### Examen — sans correction

| Méthode | Route | Rôle |
|---|---|---|
| `GET` | `/api/exams/modules` | Modules examinables (compteurs uniquement) |
| `GET` | `/api/exams/modules/:moduleId` | Questions **sans** `correctAnswer` ni `explanation` |
| `GET` | `/api/exams/modules/:moduleId/verify` | Vérifie que l'examen est lançable |
| `POST` | `/api/exams/modules/:moduleId/submit` | Corrige et renvoie le résultat — **sans rien écrire** |

```bash
# Récupérer les questions d'un examen (aucune correction dans la réponse)
curl http://localhost:4100/api/exams/modules/<moduleId>

# Soumettre
curl -X POST http://localhost:4100/api/exams/modules/<moduleId>/submit \
  -H "Content-Type: application/json" \
  -d '{"answers":{"Q001":"A","Q002":"B","Q008":null}}'
```

---

## Tests

```bash
cd backend

npm test                  # tout (146 tests)
npm run test:unit         # notation, analyse CSV
npm run test:integration  # API, import, examen, non-persistance
```

Les tests d'intégration utilisent une **vraie base PostgreSQL**, dont ils vident
les tables avant chaque scénario. Ils visent une base **dédiée**, décrite par
`backend/.env.test` (`exam_prep_test`) : lancer `npm test` ne touche jamais au
contenu de démonstration de la base de développement.

La base de test est créée et migrée automatiquement au premier `npm test` — il
suffit que le serveur PostgreSQL soit démarré (`docker compose up -d db`).

| Base | Usage | Variable |
|---|---|---|
| `exam_prep` | développement, contenu de démonstration | `backend/.env` |
| `exam_prep_test` | tests automatisés, vidée à chaque scénario | `backend/.env.test` |

Points couverts, au-delà du CRUD :

- la notation, y compris les cas limites (score négatif, questions sautées) ;
- le respect de la RFC 4180 (accents, guillemets, virgules, retours à la ligne,
  BOM, séparateur `;`) ;
- l'absence de `correctAnswer`/`explanation` dans la charge utile d'examen ;
- la non-persistance d'une tentative (schéma, compteurs, horodatages) ;
- un import de 600 lignes et le rapport « 120 lignes / 115 importées / 5 erreurs ».

```bash
cd frontend
npm run typecheck   # vérification des types
npm run build       # build de production
```

---

## Dépannage

**L'API ne démarre pas — `EADDRINUSE`**
Un autre service occupe le port. Changez `BACKEND_PORT` dans `.env` et
`PORT` dans `backend/.env`, puis mettez à jour `VITE_API_URL` et `CORS_ORIGIN`
en conséquence.

**`Can't reach database server`**
La base n'est pas démarrée ou le port diffère. Vérifiez avec
`docker compose ps`, puis `docker compose up -d db`. Si une autre instance
PostgreSQL occupe déjà 5432, utilisez `POSTGRES_PORT=5434` et reportez ce port
dans `DATABASE_URL`.

**L'interface affiche « Impossible de joindre le serveur »**
L'API n'est pas lancée, ou `VITE_API_URL` ne pointe pas vers le bon port. Après
avoir modifié `VITE_API_URL`, **reconstruisez** l'interface : Vite inscrit cette
valeur en dur dans le bundle.

**Le thème sombre revient au clair à chaque visite**
`localStorage` est bloqué par le navigateur. L'application se rabat sur le thème
clair sans échouer.

**Une page renvoie 404 après un rechargement (en production)**
Vérifiez que `frontend/nginx.conf` est bien pris en compte : la directive
`try_files … /index.html` est ce qui permet au routeur React de gérer les URL
profondes.

---

## Licence

Projet fourni tel quel, à usage pédagogique.
