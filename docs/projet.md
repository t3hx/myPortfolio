# Portfolio 3D — Document projet

## Pitch

Portfolio personnel démontrant mon habileté à intégrer de la 3D au web.

L'utilisateur est immergé dans une scène 3D (un `.glb` travaillé sous Blender) qui sert de **background interactif**, surmonté d'une **UI discrète**. La scène représente mon bureau : on y trouve des éléments qui me tiennent à cœur (PC, chat, guitare + ampli, télescope, mappemonde) et une partie pro — une commode à tiroirs remplie de dossiers, chaque dossier représentant un projet sur lequel j'ai travaillé.

L'utilisateur **scrolle verticalement** pour piloter la caméra (animée) entre des plans d'arrêt, chacun mettant en valeur un élément de la pièce (bureau, étagère, posters, chat, etc.). Sur chaque plan, un contenu texte contextuel s'affiche (bulle, ou intégré de manière organique dans la scène 3D — à trancher plus tard).

**Objectif** : donner un instantané de moi plus authentique qu'un CV — mes projets persos et mon parcours pro, mais aussi des facettes personnelles (hobbies, passions), exprimés de manière percutante en 3D.

Inspiration principale : <https://guillaumegouessan.com/>

## Fonctionnalités

### Priorité haute

- **Mode debug freefly** (`?debug`-style) : vue première personne libre (WASD/ZQSD), non affectée par les contraintes caméra, avec collision sur les murs (on ne les traverse pas). **PRIORITAIRE** — déjà partiellement couvert par le prototype (`?debug-fly`), sauf la collision.
- **Tour caméra piloté au scroll** : transitions animées par tweening lissé (GSAP), arrêt à chaque plan. Le prototype actuel pilote le tour par HUD ; le passage au scroll vertical est le cœur de l'UX cible.
- **Preloader** : le `.glb` est très lourd (> 70 Mo en mémoire). Il faut une barre de chargement et un écran d'accueil réconfortant qui invite à patienter sans stresser.

### Animations & interactions 3D (à animer ou créer)

- Fumée de la tasse de café sur le bureau
- Queue du chat
- Ventilateur du PC
- NanoLeaf : dégradé animé qui parcourt les tuiles
- Rideaux : simulation de vent
- Commode : ouverture du tiroir, parcours des dossiers, ouverture d'un dossier
- **Vue télescope** : au clic sur le télescope, mouvement de caméra vers l'oculaire, vignette, et bascule de la lune vers sa texture haute définition. La lune a deux états : *simple* (low-poly, par défaut) et *détail* (vue télescope, grossissement, texture HD).
- **Éléments cliquables** : mise en exergue au survol (contour animé ou autre), via raycasting. Chantier à prévoir.

### Contenu & texte

- Sur chaque plan d'arrêt, affichage d'un contenu texte (bulles ou autre) dont l'emplacement/la forme peut varier selon le contenu et le plan. Chantier de second temps.

### Auth

- Authentification requise : lien magique + Google + GitHub.

### Mobile

- Les cadrages caméra sont pensés paysage, incompatibles avec un affichage portrait. Cible : utilisation plein écran en mode paysage sur mobile. Gros chantier, **pour la fin**.

## Direction artistique

- Tendance **2,5D** (2D + 3D) : contours projetés et aplats de couleur simples, proche du cell-shading.
- Les contours projetés de Blender (Line Art / Freestyle) sont la cible visuelle mais **ne s'exportent pas dans un `.glb`** : gros chantier pour les reproduire fidèlement en post-processing Three.js (outline pass, edge detection, ou autre technique à évaluer).
- Le matching colorimétrique Blender EEVEE → WebGL est déjà calibré dans le prototype (`src/config/blenderMatch.ts` : AgX tone mapping, exposition, multiplicateur d'intensité lumineuse ×0.01, bloom). Ces valeurs et la boucle de comparaison (`docs/renders/refs/` vs captures) sont à transposer telles quelles.

## Architecture

### Pivot technique

⚠️ Le code actuel du repo est un **prototype Vue 3 + TresJS** (voir `CLAUDE.md`). La cible est un **rebuild TypeScript / React 19** :

- **react-three-fiber** (+ drei, postprocessing, ou toute techno 3D pertinente à conseiller)
- **GSAP** pour le tweening avancé — incontournable
- **Tailwind 4** pour l'UI
- **pnpm** comme package manager

Les acquis du prototype à transposer : extraction des transforms des caméras `CameraStop_*` du `.glb`, tweening position/quaternion/fov, calibrage `blenderMatch`, modes de vue pilotés par URL, renders de référence.

### Backend & données

- Pas vraiment de backend : la seule « intelligence » est la récupération d'une liste de projets à jour avec leurs informations. Le reste est géré côté front.
- **PostgreSQL 18** (déjà hébergé sur mon VPS) + **Drizzle** pour cette fonction de retrieve des projets.

### Secrets, déploiement, environnements

- Secrets gérés par **Doppler** (branches dev + prod).
- Distribution via mon **Dokploy** personnel (VPS, qui héberge déjà le Postgres). Les fichiers `.github/workflows/*` seront fournis en temps voulu.
- L'app doit pouvoir être testée en local dans un environnement le plus proche possible de la prod : reproduction de la topologie de prod dans un script, avec **Docker** en local.

### Outillage IA

- Framework **Gstack + Gbrain** (garry-tan) : `/office-hours` pour discuter, reviews croisées, sous-agents pour tâches spécifiques. <https://github.com/garrytan/gstack>
- **Claude Design** interviendra sur la partie visuelle (UI hors 3D) une fois le topo produit ; l'UI est minimale, le clou du spectacle étant la 3D interactive.

## Guidelines de coding

- Utiliser des **informations fraîches** : vérifier en ligne au moindre doute.
- Principes **DRY**, **SOLID**, architecture **hexagonale** quand c'est possible — mais toujours privilégier un code **clair, logique, human-readable**, quitte à ne pas être 100 % optimal.
- **TDD** quand c'est possible/pertinent (UI exclue).
- **Bien documenter** toutes les fonctions créées (explications niveau débutant).
- **Pas de français dans le code** — autorisé dans les commentaires, commits et PR.

## Workflow version control & projet

- **Jujutsu (jj) en priorité**, git seulement quand on n'a pas le choix.
- Branches :
  - **`dev`** : branche principale de travail. On peut commit dessus. Les PR vers `dev` déclenchent la CI (verify, tests) mais **jamais de deploy**. **Squash uniquement**.
  - **`main`** : branche de déploiement. **Commit interdit**, PR uniquement (**merge commit uniquement**). Une PR vers `main` déclenche le pipeline complet : vérif → build de l'image chez GitHub → push GHCR → pull + deploy Dokploy.

```
feat/xxx ──squash──▶ dev ──merge commit──▶ main ──▶ CI ──▶ build ──▶ GHCR ──▶ Dokploy
            CI            CI, jamais de deploy                                en ligne
```

- **Intégration GitHub (Orca IDE) au max** : une **issue** par unité de travail — **epic** / **feature** / **task** — avec **taille** (S à XL) et **priorité** (P0, P1, P2), versées automatiquement dans un projet GitHub suivi et mis à jour au fil de l'eau.
  - Nomenclature : *EPIC* = `Project_name-EP#x/Titre`, *FEATURE* = `Project_name-FEAT#x/Titre`, *TASK* = `Project_name-TK#x/Titre` (x entier).
- **Une branche par feature, gros fix ou gros refacto**, nommée d'après l'issue. On squash en conservant les branches. Idée : un epic pourrait finir en déploiement (pipeline complet).
- **Avant tout squash sur `dev`, me faire tester.**
- Ne pas hésiter à créer des **worktrees via Orca** quand c'est pertinent.
