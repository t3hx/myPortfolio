# Portfolio 3D — Spécifications d'implémentation TresJS / Three.js

> Document de référence pour l'implémentation frontend du portfolio 3D interactif.
> Scène exportée : `portfolio_final.glb` (~85 Mo, 145 meshes).
> Stack cible : Vue 3 + TypeScript + TresJS 5.x + Three.js + Pinia + GSAP.

---

## 0. Rappels de pipeline (contexte technique)

La scène est **entièrement pré-bakée en unlit**. Le rendu runtime doit reproduire exactement Blender :

- **`MeshBasicMaterial`** partout (pas de `MeshStandardMaterial`), aucune lumière dans la scène Three.js.
- **`NoToneMapping`** sur le renderer (`renderer.toneMapping = THREE.NoToneMapping`).
- Textures en **`SRGBColorSpace`**.
- `renderer.outputColorSpace = THREE.SRGBColorSpace`.
- **Ne PAS ajouter de lumières** : tout l'éclairage est cuit dans les textures.

### Tags de matériaux (`runtime` custom property, exporté dans `mesh.userData` ou `material.userData` via glTF `extras`)

Au chargement du `.glb`, traverser tous les nœuds et reconstruire les matériaux selon leur tag :

| Tag | Count | Traitement Three.js |
|-----|-------|---------------------|
| `unlit` | 85 | `MeshBasicMaterial({ map, side: DoubleSide })` — texture émissive bakée |
| `emissive` | 27 | `MeshBasicMaterial` couleur/texture émissive pleine (émetteurs réels) |
| `decal` | 1 | `MeshBasicMaterial({ map, transparent: true, alphaTest: 0.5, depthWrite: false, side: DoubleSide })` — logo Sharmall de l'ampli |
| `glass` | 1 | `MeshBasicMaterial({ transparent: true, opacity: 0.28, depthWrite: false, side: DoubleSide })` — vitre du PC |

> Le tag se lit sur `object.userData.runtime` ou `parent.userData.runtime` (le glTF peut placer les `extras` sur le node ou le parent). Traverser et vérifier les deux.

### Conversion d'axes Blender → glTF/Three.js

L'export utilise `export_yup=True`. Blender est **Z-up**, Three.js est **Y-up**. La conversion appliquée est :

```
Three.x =  Blender.x
Three.y =  Blender.z
Three.z = -Blender.y
```

**Important pour les axes de rotation** (fans, etc.) : un axe de rotation Blender `(bx, by, bz)` devient `(bx, bz, -by)` dans Three.js. Toutes les coordonnées ci-dessous sont données en **coordonnées Blender** (telles que lues dans le fichier) — appliquer la conversion avant usage runtime.

---

## 1. Animations continues (boucles permanentes)

Ces animations tournent en permanence, indépendamment du scroll ou des interactions.

### 1.1 Ventilateurs du PC (rotation continue)

- **Objets** (10 fans) : `Tech_PCCase_FanBottom_1/2/3`, `Tech_PCCase_FanRear`, `Tech_PCCase_FanRight_1/2/3`, `Tech_PCCase_FanTop_1/2/3`.
- **Comportement** : rotation continue autour de l'axe normal de chaque fan (l'axe perpendiculaire au plan du ventilateur).
- **Détail d'implémentation** :
  - Chaque fan doit tourner autour de son **axe local** (celui qui pointe hors de la grille du boîtier).
  - Les fans `Top` tournent autour de l'axe vertical (Blender Z → Three Y), les `Bottom` idem, les `Right` autour de l'axe horizontal latéral, le `Rear` autour de l'axe profondeur.
  - Vitesse suggérée : ~2–4 tours/seconde, légèrement désynchronisés entre fans pour un rendu naturel (offset de phase aléatoire par fan).
  - Faire pivoter chaque fan sur son **origine locale** (pivot) — vérifier que l'origine de chaque objet est bien au centre du ventilateur ; sinon, wrapper dans un `Group` centré.
- **Note** : historiquement les fans étaient piégés dans un objet mergé ; ils sont maintenant des objets séparés et animables individuellement.

### 1.2 Fumée de la tasse de café

- **Objet source** : `Prop_Mug_Coffee` (position Blender `[-0.55, 1.95, 0.835]`).
- **Comportement** : une fine fumée/vapeur monte du mug en continu.
- **Implémentation suggérée** (aucune géométrie de fumée n'existe dans le `.glb`, à créer côté code) :
  - Système de particules léger (`THREE.Points` ou sprites) émis depuis le haut du mug.
  - Ou un shader de "wispy smoke" (plan billboard + bruit animé + fondu alpha vertical).
  - Mouvement : montée lente + dérive latérale sinusoïdale + dissipation (fade out + scale up) sur ~2–3 s.
  - Couleur : blanc cassé très transparent (opacité max ~0.15), additif ou normal blending.
  - Émettre depuis un point légèrement au-dessus du centre du mug (offset +Z ~0.05 en Blender).

### 1.3 Dégradé animé des tuiles NanoLeaf / LED

- **Objet** : `LEDTiles_Merged` (position Blender `[0.06, 2.49, 1.55]`), matériau `Mat_LEDEmissive`. Voir aussi `Tech_LEDTile_1_mesh` et `LEDTiles_Merged`.
- **Comportement** : les tuiles LED murales affichent un **dégradé de couleur animé** (effet NanoLeaf : couleurs qui glissent/pulsent lentement entre les tuiles).
- **Implémentation** :
  - Remplacer/augmenter le matériau émissif par un **shader custom** (`ShaderMaterial`) animant un dégradé de teinte (HSL hue shift dans le temps) sur les UV des tuiles.
  - Alternative simple : animer `material.color` en cyclant lentement la teinte, ou un léger flux de couleur par tuile avec offset de phase.
  - Palette cohérente "cozy night" : cyans, magentas, violets doux, bleus. Éviter le blanc pur.
  - Vitesse lente (~cycle complet sur 10–20 s), lueur douce.
  - Ces tuiles sont un **émetteur réel** (tag `emissive`) — garder une base lumineuse même sans animation.

---

## 2. Interactions déclenchées (clic / hover / scroll)

### 2.1 Interaction télescope → Lune (clic sur le télescope)

Élément central de l'expérience.

- **Objets télescope** :
  - `Telescope_Merged` — le télescope visible (position Blender `[1.6, -0.65, 0.95]`).
  - `Telescope_Base` — la base fixe `[1.6, -0.65, 0.0]`.
  - `Telescope_Aim` — le point de visée / pivot d'orientation `[1.6, -0.65, 0.95]`.
  - `Telescope_ViewAnchor` — **position/rotation de la caméra pour la "vue dans le télescope"** : loc Blender `[1.254, -0.925, 0.927]`, rot Blender `[111.4°, 0°, -51.5°]`.
- **Comportement attendu** :
  1. Le télescope est **cliquable** (raycaster sur `Telescope_Merged`).
  2. Au clic : transition de caméra vers `CameraStop_TelescopeMoon` (voir §3) ou vers `Telescope_ViewAnchor`.
  3. Afficher la **vignette "vue intérieur télescope"** (§2.2) : un overlay circulaire montrant la Lune détaillée en gros plan.
  4. Basculer la Lune low-def → high-def pendant la vue rapprochée (§2.3).
- **Hover** : léger highlight / scale du télescope pour signaler qu'il est interactif.

### 2.2 Vignette "vue intérieur télescope"

- **À créer côté code** (pas dans le `.glb`).
- **Comportement** : quand on regarde dans le télescope, afficher un **cache circulaire** (viewfinder) — cercle noir avec ouverture centrale, éventuellement un réticule/crosshair — par-dessus le rendu.
- **Implémentation** :
  - Overlay HTML/CSS (`position: fixed`, masque radial) OU une seconde passe de rendu dans un `RenderTarget` circulaire.
  - Au centre : la Lune détaillée (`Outside_Moon_Detailed`) bien visible.
  - Ajouter un léger vignettage sombre sur les bords + éventuellement une aberration chromatique subtile pour le réalisme optique.
  - Transition d'entrée/sortie douce (fade + scale du cercle).

### 2.3 Gestion des deux Lunes (low-def ↔ high-def)

- **Objets** :
  - `Outside_Moon` — Lune **low-def** (position Blender `[22.32, 15.82, 11.48]`, scale `40`). Visible par défaut dans le ciel, vue de loin par la fenêtre.
  - `Outside_Moon_Detailed` (alias `Moon_Detailed`) — Lune **high-def** (même position `[22.32, 15.82, 11.48]`, scale `1`). Pour le gros plan télescope.
- **Comportement** :
  - **État par défaut** (vue pièce / fenêtre) : afficher `Outside_Moon` (low-def), masquer `Outside_Moon_Detailed`.
  - **Vue télescope** : masquer `Outside_Moon`, afficher `Outside_Moon_Detailed` (high-def) avec les textures détaillées (albedo + normal map : `moon_albedo_2k.jpg`, `moon_normal_2k.jpg`).
  - Utiliser `object.visible = true/false` pour basculer. Transition douce (crossfade d'opacité si possible).
  - Les deux sont au même endroit → pas de repositionnement, juste le toggle de visibilité.

### 2.4 Yeux du chat qui suivent la souris

- **Objets** :
  - Yeux : `Cat_Eye_L` `[-0.014, -0.07, 0.17]`, `Cat_Eye_R`.
  - Pupilles : `Cat_Pupil_L` `[-0.014, -0.073, 0.17]`, `Cat_Pupil_R` `[0.014, -0.073, 0.17]`.
  - Highlights : `Cat_EyeHighlight_L/R`.
- **Comportement** : les **pupilles** (`Cat_Pupil_L/R`) se déplacent légèrement pour suivre le curseur de la souris (effet "le chat te regarde").
- **Implémentation** :
  - Mapper la position normalisée de la souris (`-1..1` en x/y) vers un petit offset de position ou de rotation des pupilles.
  - **Clamp** le déplacement dans les limites de l'œil (offset max ~0.005–0.01 en unités locales) pour que la pupille ne sorte pas du blanc de l'œil.
  - Interpolation douce (lerp) vers la cible pour un mouvement organique.
  - Déplacer les highlights (`Cat_EyeHighlight_L/R`) avec les pupilles ou les laisser fixes (à tester visuellement).
  - Les pupilles sont des objets séparés → animables directement.

### 2.5 Rideaux qui bougent

- **Objets** : `Window_Curtain_Left`, `Window_Curtain_Right` (+ tringle `Window_CurtainRod_Pole` et supports, statiques).
- **Comportement** : léger mouvement des rideaux (comme une brise douce venant de la fenêtre).
- **Implémentation** :
  - Option simple : légère oscillation de rotation/scale des mesh rideaux (sinusoïde lente).
  - Option riche : déformation de vertices via shader (vertex displacement type "vent") — ondulation douce sur la hauteur du rideau, amplitude plus forte en bas.
  - Mouvement subtil (c'est une scène cozy, pas une tempête). Désynchroniser gauche/droite.

### 2.6 Ouvrir le tiroir de la commode

- **Objets tiroirs** (façades) : `Cabinet_TopDrawer_Front`, `Cabinet_MidDrawer_Front`, `Cabinet_BotDrawer_Front`.
  - Le tiroir du haut a une géométrie complète (côtés/fond) : `Cabinet_TopDrawer_Front/Back/Bottom/LSide/RSide` + poignée `Cabinet_TopDrawer_HandleBar/HandlePost_L/R`.
  - Les tiroirs mid/bot ont surtout la façade + poignées (`Cabinet_MidDrawer_HandleBar/HandlePost_L/R`, idem Bot).
- **Comportement** : au clic sur un tiroir (ou sa poignée), le tiroir **coulisse vers l'extérieur** (translation) puis peut se refermer.
- **Implémentation** :
  - Raycaster sur la façade/poignée.
  - Animer une **translation** du groupe tiroir le long de l'axe de profondeur de la commode (probablement l'axe qui pointe vers l'avant de la pièce — vérifier l'orientation de la commode dans la scène ; a priori translation sur l'axe Y Blender → Z Three, à confirmer visuellement).
  - Regrouper façade + poignée (+ côtés/fond pour le tiroir du haut) dans un `Group` et translater le groupe.
  - Amplitude d'ouverture : ~0.2–0.3 unités. Easing GSAP (`power2.out` à l'ouverture).
  - Toggle open/close au clic. Un seul tiroir ouvert à la fois (optionnel).

---

## 3. Caméra : stops et transitions scroll-driven

La caméra se déplace entre des **points d'arrêt prédéfinis** (`CameraStop_*`) pilotés par le scroll. À chaque stop correspond un élément de la pièce et un texte à afficher (§4).

### 3.1 Points d'arrêt caméra (coordonnées Blender)

> Rotation en degrés Euler (XYZ). Appliquer la conversion d'axes Blender→Three avant usage.
> Ces empties donnent la **pose cible de la caméra** (position + orientation).

| Stop | Position (Blender) | Rotation Euler° (Blender) | Élément ciblé |
|------|--------------------|-----------------------------|---------------|
| `CameraStop_Home` | `[0.0, 1.718, 1.1]` | `[90, 0, 0]` | Vue d'accueil (face à la pièce) |
| `CameraStop_Desk` | `[0.0, -0.08, 1.46]` | `[76.8, 0, 0]` | Bureau / setup PC |
| `CameraStop_Cat` | `[-1.035, 1.995, 1.769]` | `[108.6, 0, 45]` | Le chat sur son étagère |
| `CameraStop_Cabinet` | `[0.77, 0.87, 1.24]` | `[58.9, 0, -21]` | Commode à tiroirs |
| `CameraStop_BookshelfPlant` | `[-0.52, 1.48, 1.61]` | `[77, 0, 90]` | Bibliothèque / plante |
| `CameraStop_GuitarPoster` | `[-1.27, 1.787, 0.001]` | `[131.8, 0, 26.9]` | Guitare + poster |
| `CameraStop_PosterTelescope` | `[0.78, 1.82, 1.6]` | `[90, 0, -90]` | Poster télescope |
| `CameraStop_Scoreboard` | `[-0.3, -0.5, 1.5]` | `[90, 0, 90]` | Tableau / mappemonde |
| `CameraStop_Telescope` | `[-0.2, -1.0, 1.0]` | `[103, 0, -67]` | Vue vers le télescope |
| `CameraStop_TelescopeMoon` | `[1.969, -0.356, 1.285]` | `[111.4, 0, -51.5]` | Gros plan Lune (via télescope) |

### 3.2 Transitions de caméra

- **Scroll-driven** : le scroll de la page interpole la caméra d'un stop au suivant.
- **Implémentation** :
  - Ordonner les stops en une **séquence de scénario** (à définir — ex : Home → Desk → Cat → Cabinet → BookshelfPlant → GuitarPoster → PosterTelescope → Scoreboard → Telescope → TelescopeMoon).
  - Mapper la progression de scroll `[0..1]` sur la séquence de stops.
  - Interpoler **position** (lerp/spline) et **orientation** (slerp de quaternions — convertir les Euler en quaternions) entre stops adjacents.
  - Utiliser **GSAP** + ScrollTrigger, ou un `useScroll` custom, avec easing par segment.
  - Envisager une **courbe de Catmull-Rom** (`THREE.CatmullRomCurve3`) passant par les positions pour un mouvement fluide plutôt que des segments linéaires.
  - La caméra ne doit pas traverser les murs — les stops sont déjà placés à l'intérieur du volume, garder l'interpolation "à l'intérieur".
- **Vue télescope** : `CameraStop_Telescope` → `CameraStop_TelescopeMoon` est déclenchée par le **clic sur le télescope** (§2.1), pas forcément par le scroll seul.

---

## 4. Textes / légendes par étape

Chaque stop caméra affiche un texte descriptif (overlay HTML, synchronisé avec la position de scroll / le stop actif).

> **À rédiger par Thibault** — le contenu narratif est personnel (présentation, projets, compétences). Structure suggérée : un titre court + 1–2 phrases par stop.

| Stop | Texte à afficher (à compléter) |
|------|--------------------------------|
| `CameraStop_Home` | _(accroche / intro — "Bienvenue", nom, tagline)_ |
| `CameraStop_Desk` | _(setup / stack technique / ce sur quoi tu travailles)_ |
| `CameraStop_Cat` | _(touche perso / le chat)_ |
| `CameraStop_Cabinet` | _(à définir — ex : expériences, à ouvrir le tiroir pour découvrir)_ |
| `CameraStop_BookshelfPlant` | _(veille / lectures / centres d'intérêt)_ |
| `CameraStop_GuitarPoster` | _(hobbies — musique, guitare LTD EC-1000)_ |
| `CameraStop_PosterTelescope` | _(à définir)_ |
| `CameraStop_Scoreboard` | _(la mappemonde / voyages / projets par pays)_ |
| `CameraStop_Telescope` | _(invitation à cliquer sur le télescope)_ |
| `CameraStop_TelescopeMoon` | _(moment contemplatif / conclusion / contact)_ |

**Implémentation des textes** :
- Overlay HTML/Vue positionné (pas du texte 3D), avec transitions d'apparition (fade + slide).
- Synchroniser l'affichage avec le stop actif (via l'état de scroll / la progression GSAP).
- Un seul bloc de texte visible à la fois, transition douce entre les blocs.

---

## 5. Récapitulatif des objets interactifs (raycaster)

Objets à rendre cliquables/survolables :

| Objet | Interaction |
|-------|-------------|
| `Telescope_Merged` | Clic → vue Lune + vignette télescope |
| `Cat_Merged` (ou zone chat) | Hover → les pupilles suivent déjà la souris globalement |
| `Cabinet_TopDrawer_Front` (+ poignée) | Clic → ouvrir/fermer tiroir |
| `Cabinet_MidDrawer_Front` (+ poignée) | Clic → ouvrir/fermer tiroir |
| `Cabinet_BotDrawer_Front` (+ poignée) | Clic → ouvrir/fermer tiroir |

---

## 6. Checklist d'implémentation

**Setup de base**
- [ ] Charger `portfolio_final.glb` (GLTFLoader).
- [ ] Traverser la scène, lire `userData.runtime`, reconstruire les matériaux (unlit / emissive / decal / glass).
- [ ] Renderer : `NoToneMapping`, `outputColorSpace = SRGB`, pas de lumières.
- [ ] Vérifier le rendu = parité avec Blender (WYSIWYG).

**Animations continues**
- [ ] Rotation des 10 ventilateurs (axes convertis, pivots centrés, phases désync).
- [ ] Fumée du mug de café (particules/sprite/shader).
- [ ] Dégradé animé des tuiles NanoLeaf (`Mat_LEDEmissive` → shader ou hue cycle).
- [ ] Mouvement des rideaux (oscillation ou vertex shader).

**Interactions**
- [ ] Raycaster + hover states.
- [ ] Clic télescope → transition caméra + vignette + toggle Lune high-def.
- [ ] Vignette "vue télescope" (overlay circulaire).
- [ ] Toggle Lune low-def / high-def (`Outside_Moon` ↔ `Outside_Moon_Detailed`).
- [ ] Pupilles du chat suivent la souris (clamp + lerp).
- [ ] Tiroirs cliquables (translation + easing).

**Caméra & narration**
- [ ] Récupérer/hardcoder les poses des 10 `CameraStop_*` (conversion d'axes).
- [ ] Séquence de scénario + interpolation scroll-driven (GSAP ScrollTrigger, slerp d'orientation).
- [ ] Overlays de texte synchronisés par stop (contenu à écrire).

**Finitions**
- [ ] Vérifier la vitre PC (`glass`, opacité 0.28).
- [ ] Vérifier le décal Sharmall de l'ampli (`decal`, alphaTest, transparent).
- [ ] Responsive / perf (le glb fait 85 Mo — envisager compression Draco/KTX2 si besoin de réduire).

---

## 7. Notes & pièges connus

- **Parité Blender/Three.js** : la règle d'or est "ce que je vois dans Blender = ce que je vois dans Three.js". Toute la scène est unlit + AgX cuit dans les PNG. Ne rien ajouter comme éclairage ou tone mapping.
- **Extras glTF** : les `userData` (tags runtime, custom props) peuvent atterrir sur le node OU son parent selon la structure. Traverser et vérifier les deux niveaux.
- **Taille du glb (85 Mo)** : plusieurs textures 2K/4K. Pour le web, envisager **KTX2/Basis** (compression GPU) ou **Draco** (géométrie) pour réduire le poids de chargement. Prévoir un écran de chargement.
- **Fans / pupilles / tiroirs** : ce sont des objets **séparés** dans le glb (pas mergés), donc animables individuellement. Vérifier les noms exacts après import (le glTF peut suffixer `.001` etc. ou renommer — mapper par `name` avec tolérance).
- **Objets `Text` / `Text.001..005`** : ce sont les "?" du cube Mario (convertis de FONT en mesh pour l'export). Statiques.
- **Coordonnées** : toutes les positions de ce document sont en **Blender (Z-up)**. Appliquer la conversion `(x, z, -y)` pour Three.js.
