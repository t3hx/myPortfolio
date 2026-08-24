# Handoff : Portfolio « Lueur » — Thibault Dubois

## Overview

Portfolio one-page mobile-first pour développeur front créatif. Objectif : démontrer la capacité à « donner de la vie » à une interface — micro-interactions, animations orchestrées, accents 3D. Direction visuelle : verre fumé teinté bois-brûlé, accent cyan froid, ambiance sombre et épurée (dérivée de `DESIGN.md`, joint).

## About the Design Files

Les fichiers de ce bundle sont des **références de design réalisées en HTML** (prototype fonctionnel), pas du code de production à copier tel quel. La tâche est de **recréer ce design dans l'environnement cible** avec ses patterns établis. Cible recommandée : **React + react-three-fiber** (les cubes filaires du prototype sont en CSS 3D par contrainte de prototype ; en production, les rendre en R3F est souhaité par l'auteur). Ouvrir `Portfolio Thibault Dubois.dc.html` dans un navigateur pour voir le comportement de référence (garder `support.js` et `image-slot.js` à côté).

## Fidelity

**High-fidelity.** Couleurs, typographies, espacements, timings et easings sont finaux et à reproduire précisément. Les contenus marqués `[placeholder]` (expériences, formations, projets, texte « Le cap ») sont à remplacer par les vrais contenus.

## Design Tokens

- Fond encre : `#0E0B08`
- Crème (texte/icônes) : `#EFE5D3` ; texte chaud : `#F2E9DA`
- Accent cyan : `#8FDBE4` (halo profond `#6FD8E6`) — uniquement en points, liserés, halos ; jamais en aplat
- Verre fumé : `rgba(24,17,12,.5)` à `.74` + `backdrop-filter: blur(22px)` ; bord `rgba(239,229,211,.12-.16)`
- Halo braise (fond animé) : `rgba(82,45,21,.7)`
- Ombre panneau : `0 14px 44px rgba(0,0,0,.38)`
- Typo : **IBM Plex Mono** 400/500 (nom, méta, kickers mono, code) · **Space Grotesk** 400/500/600 (titres, UI, corps) · **Newsreader italique** 300 (voix : tagline du hero, phrases des cartes projets)
- Rayons : 10 (petits) · 12 (tuiles) · 18 (cartes/panneaux) · 999 (chips)
- Échelle titres de section : `clamp(30px, 3.8vw, 42px)`, Space Grotesk 500, letter-spacing −0.015em
- Breakpoint mobile : **720px**
- Liens : crème par défaut, cyan au survol, transition .18s

## Screens / Views (one-page, 5 sections + footer)

### Barre haute (fixe, fond transparent)

- Haut-droite : `gh` · `in` (IBM Plex Mono 12px, text-shadow `0 1px 10px rgba(0,0,0,.7)`) + toggle **FR/EN** (bouton bordure `rgba(143,219,228,.4)`, texte cyan 11px, rayon 10, padding 5/8)
- Haut-gauche : **mini-nom** « THIBAULT DUBOIS » (mono 12px, point cyan 6px avec lueur) — caché tant que le nom du hero est visible (voir Interactions §8)
- Photo ronde 88px en haut-gauche, **non sticky** (défile avec la page), bordure `rgba(239,229,211,.25)` — emplacement drag-and-drop dans le prototype

### 1. Hero (100vh, centré)

- Kicker : point cyan 7px (lueur 10px) + « PORTFOLIO — DÉVELOPPEUR FRONT CRÉATIF » caps 11px, letter-spacing .22em
- Nom : `THIBAULT DUBOIS`, IBM Plex Mono 500, `clamp(40px, 7vw, 92px)`, deux spans (prénom / nom) ; empilés en colonne sous 720px
- Tagline : Newsreader italique 300, `clamp(18px, 2.2vw, 23px)`, max-width 600px
- Méta : `36 ans · Français natif · Anglais pro (C1) · Permis B`, mono 12.5px, séparateurs points cyan 4px
- Cube filaire 300×300 derrière le nom (scale .6 mobile), faces bord `rgba(143,219,228,.26)`, fond `rgba(143,219,228,.02)`, perspective 640px
- Indice de scroll bas-centre : « DÉFILER » caps mono 10px + filet vertical 1×38px dégradé crème→cyan

### 2. « Le cap » (01 — Projet professionnel)

Panneau verre plein (rayon 18, padding 44 / clamp(24px,5vw,64px)), une phrase Space Grotesk 400 `clamp(19px,2.4vw,25px)` interligne 1.6, note mono 11px `rgba(239,229,211,.45)`.

### 3. CV (02 — Parcours)

- **Expériences** : cartes verre (rayon 18, padding 18/22). Ligne titre : poste 17px 500 / entreprise mono 12px crème .6 / période mono 12px cyan. Accordéon de missions **au survol** (voir §9)
- **Savoir-faire** : grille `repeat(auto-fill, minmax(88px, 1fr))`, tuiles 54×54 (rayon 12, initiale 19px 500) + nom 12px. 9 technos : JavaScript, TypeScript, Vue.js, React.js, Three.js, Tailwind CSS, PostgreSQL, Supabase, MongoDB
- **Savoir-être** : chips (rayon 999, padding 8/16, mono 12px)

### 4. Projets persos (03)

Grille `repeat(auto-fit, minmax(270px, 1fr))`, gap 18. Carte : couverture 140px (placeholder hachuré 45°, libellé mono 11px), année mono 11px cyan, titre 20px 500, phrase Newsreader italique 15.5px, stack mono 11.5px.

### 5. Formations (04)

Mêmes cartouches que les expériences, **sans accordéon ni réaction au survol** (un diplôme n'ouvre rien).

### Footer

Filet crème .12, note mono 12px « © 2026 … », liens `github.com/t3hx` · `linkedin.com/in/tdbs`.

### En-têtes de section (patron commun)

Kicker : point cyan 7px lueur + `NN — Libellé` caps 11px cyan letter-spacing .22em. Titre h2 avec **cube filaire centré sur la première lettre** (voir §5).

## Interactions & Animations — SPÉCIFICATION PRÉCISE

### 1. Déchiffrage du nom (arrivée)

- Cible : `THIBAULT DUBOIS`. Démarre après **350ms**, durée **1700ms** (tweakable 400–4000)
- Les caractères se figent **de gauche à droite** (index verrouillé = progression × longueur) ; les non-verrouillés tirent un glyphe dans `#/\<>[]{}=+*%$&@0123456789` toutes les **45ms**
- **Les espaces ne sont jamais brouillés** (ils gardent la silhouette du nom) ; chasse fixe obligatoire (sinon le nom « gigote »)
- Caret de bloc cyan (.55em × .95em, lueur `0 0 14px rgba(143,219,228,.7)`) clignotant 1s en `steps(1)`, **visible uniquement pendant** le déchiffrage

### 2. Glissement prénom / nom (simultané au déchiffrage)

- Prénom : `translateX(-16vw) → 0`, opacité 0→1 ; Nom : `translateX(+16vw) → 0`
- Durée **1.1s**, easing **cubic-bezier(.8, 0, .2, 1)** (accélération forte type ease-in-out cubique), délais **.25s / .45s**, `fill: both`

### 3. Cascade d'allumage du hero (fondu `opacity 0→1`, ease)

| Élément                     | durée | délai |
| --------------------------- | ----- | ----- |
| Kicker                      | 1s    | .4s   |
| Cube filaire                | 2.2s  | 1s    |
| Lueur cyan radiale centrale | 2.6s  | 1.5s  |
| Tagline                     | 1.4s  | 2s    |
| Méta                        | 1.4s  | 2.5s  |
| Indice scroll               | 1.6s  | 3s    |

### 4. Cube du hero — rotation pilotée par la distance souris

- Transform : `rotateX(-18deg) rotateY(angle)` mis à jour en rAF
- Vitesse cible : `7 + min(1, distance×2 / hypot(vw, vh)) × 55` (°/s) — **7°/s souris au centre du cube → 62°/s aux bords** ; défaut sans souris : 26°/s
- Lissage : `vitesse += (cible − vitesse) × 0.05` par frame ; `dt` borné à 50ms
- Parallaxe du cube sur mousemove : `translate(dx × −18px, dy × −14px)` où dx/dy ∈ [−.5, .5] (position relative viewport)

### 5. Cubes des titres de section

- Un cube filaire par titre, **centré sur la première lettre** (wrapper inline-block sur la lettre ; cube absolu `left:50% / top:44%`, translate(−50%,−50%))
- Taille **0.9em**, `translateZ(.45em)`, **perspective 1.92em** — même rapport focale/taille que le hero (640/300 ≈ 0.47) et **même inclinaison** `rotateX(-18deg)`, même sens de rotation, période 14s linéaire infinie
- Bords `rgba(143,219,228,.5)`, 4 faces latérales

### 6. Révélations en cascade au scroll

- Déclencheur : IntersectionObserver, `rootMargin: '9999px 0px -10% 0px'` (la marge haute énorme est **obligatoire** : elle révèle aussi les sections dépassées d'un coup — scroll rapide, touche End), une seule fois par groupe
- Groupes : `cap`, `cv` (en-tête), `cv-exp`, `cv-tech`, `cv-soft`, `projets`, `formations`
- Animation : `opacity 0→1` + `translateY(26px)→0`, **0.85s**, **cubic-bezier(.2, .7, .2, 1)**, `fill: both`
- Délais intra-groupe : kicker 0ms · titre 90ms · contenu 180–200ms · cartes expériences `i×110ms` · tuiles technos `90 + i×45ms` · chips `80 + i×45ms` · cartes projets `180 + i×120ms` · formations `180 + i×110ms`

### 7. Halo braise animé au scroll (fond)

- Couche `position:fixed; inset:0; overflow:hidden; pointer-events:none` **derrière tout le contenu** ; nappe interne 100% × **205vh**, `will-change: transform`
- **UN SEUL halo** : `radial-gradient(ellipse 90% 28% at 50% 56%, rgba(82,45,21,.7), transparent 65%)` — centré horizontalement, au chargement il affleure le bas du hero
- Boucle rAF : `cible = scrollY / (scrollHeight − vh)` ; `cur += (cible − cur) × 0.02` ; `translateY(−cur × (205vh − 100vh))`
- Le facteur **0.02** donne l'inertie voulue : le halo continue de glisser plusieurs secondes après l'arrêt du scroll. Course calibrée pour que le halo **reste visible du haut en bas de la page** (bas du hero → haut d'écran en fin de page). FIABILITÉ : boucle unique globale, indépendante du cycle de vie des composants, protégée par try/catch

### 8. Mini-nom sticky

- Observer sur le **h1 du nom** (pas la section), `threshold: 0` : dès que le nom sort de l'écran → mini-nom `opacity 0→1`, `translateY(-8px)→0`, transition **.45s ease** ; inverse au retour

### 9. Survols

- **Carte expérience** : accordéon au survol (`max-height 0→340px`, .3s ease) — une seule ouverte, la dernière survolée **reste ouverte** ; bord → `rgba(143,219,228,.5)`, fond → `rgba(239,229,211,.04)`, .22s
- **Carte projet** : `translateY(-4px)`, bord `rgba(111,216,230,.6)`, ombre `0 0 40px rgba(143,219,228,.12), 0 14px 44px rgba(0,0,0,.38)`, .22s
- **Tuile techno** : bord cyan .6 + lueur `0 0 18px rgba(143,219,228,.18)`, .2s
- **Chip / toggle / liens** : bord ou couleur cyan, .18–.2s

### 10. Divers

- `prefers-reduced-motion: reduce` → toutes les animations quasi instantanées (`animation-duration: .01s`)
- `::selection` : `rgba(143,219,228,.28)`

## State Management

- `lang: 'fr' | 'en'` — toggle FR/EN, tout le contenu est bilingue (dictionnaires dans le prototype)
- `name: string` + `decryptDone` — état du déchiffrage
- `openExp: number` — index de l'expérience ouverte (défaut 0)
- `revealed: Set<string>` — groupes révélés (une fois pour toutes)
- `isMobile` — matchMedia 720px (direction du nom, échelle du cube, paddings)
- Aucune donnée distante ; contenus statiques

## Responsive (mobile-first)

- ≤720px : nom en colonne, cube hero à l'échelle .6, paddings de section `clamp(90px, 16vw, 150px)`, grille technos `minmax(88px,1fr)`, projets en 1 colonne (auto-fit), footer padding bas 90px
- Pas de barre de navigation — uniquement les liens fixes en haut

## Assets

- Aucune image fournie : photo (rond 88px) et couvertures de projets (140px, hachures 45° `rgba(239,229,211,.055)` + libellé mono) sont des emplacements à remplir
- Polices via Google Fonts dans le prototype ; **auto-héberger** en production (latin étendu, accents FR)

## Files

- `Portfolio Thibault Dubois.dc.html` — prototype de référence (ouvrir dans un navigateur)
- `support.js`, `image-slot.js` — runtime du prototype (nécessaires pour l'ouvrir, ne pas porter en production)
- `DESIGN.md` — direction artistique d'origine (système « Lueur »)
