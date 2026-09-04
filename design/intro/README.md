# Handoff : Intro « Triangle » — animation d'introduction du portfolio

## Overview
Animation d'introduction (20 s, 1920×1080, plays once puis freeze) jouée avant la première interaction, au chargement du site. Trois phases portées par la favicon (triangle inversé, contours) : **L'idée** (étoiles → arrivée du triangle → succion → big-bang), **La conception** (dérive des particules → plongée caméra dans le triangle → le plan du lab se dessine trait par trait), **La réalisation** (tourbillon de particules → « THIBAULT DUBOIS » en vraies lettres → triangle en arc derrière le nom → « CREATIVE DEVELOPER » gravé au laser, « CREATIVE » clignote ensuite en boucle façon néon défaillant).

## About the Design Files
Les fichiers de ce dossier sont des **références de design en HTML/JSX** (prototype), pas du code de production à copier tel quel. La tâche : **recréer cette animation dans `t3hx/myPortfolio`** (React + three.js/R3F + GSAP) en suivant les patterns existants du repo. Tout le code du prototype a été écrit comme fonction pure du temps `T` précisément pour rendre ce portage direct (scrub GSAP / `useFrame`).

## Fidelity
**High-fidelity** pour le motion design, les timings, les eases, les couleurs et la typographie. Le rendu particules/étoiles est fait en SVG 2D dans le prototype — en production, utiliser `THREE.Points` (BufferGeometry) pour la nova et le tourbillon ; les maths de position sont à reprendre telles quelles.

## Mapping prototype → repo
| Prototype | Équivalent portfolio |
|---|---|
| `OM_SCENES` (3 sections) | labels d'une timeline GSAP master (`tl.addLabel('idee', 0)` …) |
| `MOTION.enter / draw / pop` | `power4.out` / `sine.inOut` / `back.out` |
| `camA` (translate+scale autour d'un point visé) | rig caméra three.js : dolly + zoom sur le triangle |
| `novaD` / `swirlD` (positions par frame) | `THREE.Points`, positions recalculées dans `useFrame` |
| `lab-data.js` (2 274 traits en 11 lots) | SVG overlay ou `THREE.Line2`; draw-on par `stroke-dashoffset` (`pathLength=1`) |
| fin d'animation | déclencher la révélation de la scène bureau (cf. `useInteraction.setRevealed`, comme `Preloader.tsx`) |

## Timeline (20 s — offsets relatifs au début de chaque phase)
Phase 1 « L'idée » — 0 → 6.5 s
- 0–1.5+ : étoiles (6 groupes, fade-in décalé 0.22 s/groupe, twinkle sinusoïdal)
- 1.2–3.4 : arrivée triangle : scale 6.2→1.55 (power4.out), rotation −160°→0 (back.out), opacité 0→1 en 0.9 s ; côté HAUT en emphase
- 2.2 : « GENESIS » lettre par lettre (0.09 s/lettre), haut-gauche (150,168), fade-out à 4.9
- 3.2–3.6 : anticipation (+9 % scale, back.out)
- 3.55–5.3 : succion : scale ×(1−0.988·u^1.9), rotation +980°·u^2.6, glow ×(1+2.2u), cœur lumineux r=30·u^1.6
- 5.35 : big-bang — flash radial (montée 0.14 s, descente 0.54 s), 2 ondes (r 30→910 en 1.5 s, r 20→520 en 2.3 s), particules éjectées

Phase 2 « La conception » — 6.5 → 13 s
- particules : R = spd·1020·(1−(1−u)^4), u = (T−5.35)/6.2 → décélération continue + wobble sinusoïdal croissant
- 6.65–8.8 : panoramique caméra (sine.inOut) vers le triangle 2 (dérive : centre 340,290 ± sin lent ; 2 côtés en emphase), zoom 1→2.2
- 8.8–10.3 : plongée : zoom 2.2→16 exponentiel (exposant u^2.2), fondu du monde A 9.85–10.35
- monde B (intérieur) : scale 0.07→1 (9.35–10.65), opacité 0→1 (9.5–10.15)
- 9.5–13 : le plan se dessine : 11 lots dans l'ordre H2,H1,H05,V2,V1,V05,D2,D1,D05,DRAWS,CABLES — départ lot k = 9.5+k·0.26, 5 sous-groupes décalés de 0.06 s, tracé 0.72 s (sine.inOut)
- 10.3 : « INCUBATION » bas-droite (x=W−610, y=H−186), fade-out à 12.65

Phase 3 « La réalisation » — 13 → 20 s
- 13.05 : tourbillon — chaque particule : delay 0–1.45 s, durée 1.6–2.4 s, spirale rayon 700–1220→0, +4.3 rad d'enroulement (cos-ease), cible = pixel échantillonné du nom (canvas, Michroma 96 px, letterSpacing 6 px, grille 6 px, alpha>120)
- 13.5 : « EMERGENCE » haut-droite (x=W−610, y=152), fade-out à 18.1
- 15.35 : lettres réelles apparaissent (0.045 s/lettre, translateY 12→0) ; particules s'éteignent 15.5–16.3 ; le plan derrière passe à 32 % d'opacité (14.6–16.1)
- 15.9–18.2 : triangle 3 : arc de cercle θ −215°→−90°, rayon 760→0 (power4.out), taille 240→470, rotation −80°→0, 3 côtés néon (glow 2.2) ; puis s'assombrit (18.2–19.3 : opacité ×0.52, glow →1.15) pour laisser la vedette au texte
- 16.9–18.6 : gravure laser du titre : clip-path inset droite 100 %→0 (sine.inOut), étincelle 6×38 px (blanc-cyan, boxShadow accent) qui suit le bord + scintillement sin(T·42)
- ≥18.75 : « CREATIVE » clignote en boucle : `@keyframes omFlicker` 2.7 s `steps(1,end)` infinite — majoritairement éteint (0.08–0.22) avec pics à 1 (« fonctionne plus mal que bien »). En CSS pour survivre au gel de la timeline.

## Design Tokens (du repo)
- Fond : `#04050c` (CLEAR_COLOR, renderPipeline.ts)
- Accent : **`#00C0E8`** (choix final utilisateur — le token du DS est `--glow #8FDBE4`, dispo en variante)
- Texte : `#EFE5D3` (`--cream`) ; titre laser : `#C9D4D8` ; cœur néon : `#EAFBFF`
- Nom : **Michroma** 96 px, letter-spacing 6 px, majuscules
- Titre : **Space Grotesk** 500, 24 px, letter-spacing 0.52em ; mots de phase : Space Grotesk 500, 19 px, 0.62em, couleur accent
- Triangle : géométrie favicon `M6 7 H26 L16 26 Z` (boîte 32, pointe en bas) ; néon = 4 traits superposés (16/9/4.2/1.8 px, opacités 0.07·g / 0.14·g / 0.32·g / 0.85·g, cœur blanc-cyan)
- Particules : 900 (réglage final utilisateur ; classes 60/30/10 % en 3.2/4.8/7 px)
- Vignette : radial transparent 52 % → rgba(0,0,3,.55)

## Le plan du lab (`lab.svg` / `lab-data.js`)
Le SVG source (2 385 lignes) est À PLAT — les familles ont été reconstruites par calcul : orientation (H <28°, V >62°, D entre) + épaisseur (≥2 / 1 / ≤0.5) ; tracés complexes (courbes ou >4 segments) = DRAWS, les 20 % derniers du fichier = CABLES. `lab-data.js` contient le résultat (`window.LAB_ART = {vb, order, batches}`). Astuce perf reprise telle quelle : `pathLength="1"` + `stroke-dasharray:1 1` + dashoffset piloté par 55 variables CSS posées sur le conteneur → zéro re-render des 2 274 paths.

## Notes de perf (mesurées sur le prototype)
- La caméra DOIT être un transform vectoriel (groupe SVG / caméra three.js), pas un transform CSS sur un calque contenant les tracés — le re-raster CSS à chaque frame de zoom saccade.
- Tout est fonction pure de T : aucun état intégré → seek/scrub/replay triviaux.

## State Management
Aucun état métier. Une seule sortie : à la fin (T=20, freeze), déclencher la révélation de la scène 3D (équivalent `setRevealed`). Pas de bouton skip (choix utilisateur).

## Assets
- `lab.svg` — dessin du bureau/lab fourni par l'utilisateur (source des tracés)
- `lab-data.js` — tracés classés, générés depuis lab.svg
- Fonts Google : Michroma, Space Grotesk (400/500)

## Files
- `Intro Portfolio.dc.html` — page hôte (scènes/timeline, tokens, keyframes omFlicker)
- `intro-scene.jsx` — TOUTE la chorégraphie (référence principale, commentaires de portage GSAP/three.js inclus)
- `lab-data.js`, `lab.svg`

## Notes d'intégration (#141)

- **Ce prototype ne s'exécute pas tel quel.** `Intro Portfolio.dc.html` importait `animations-v3.jsx`, `tweaks-panel.jsx` et un `support.js` locaux, qui n'ont pas été livrés ; la page hôte n'a donc pas été committée. `intro-scene.jsx` se lit comme la partition de l'animation, fonction pure de `T`.
- **Le code de classification des tracés n'a pas été livré**, seul son résultat (`lab-data.js`). Le README ci-dessus annonce 2 274 traits ; le fichier en contient **2 346** (H2 131, H1 632, H05 117, V2 100, V1 550, V05 80, D2 70, D1 249, D05 35, DR 305, CA 77).
- **L'app charge `src/content/labPlan.json`**, généré depuis `lab-data.js` sans autre transformation ; `tests/labPlan.test.ts` vérifie que les deux fichiers portent la même donnée. `lab.svg` (avec son manifeste C2PA) reste ici, il n'est jamais servi.
- Le vocabulaire de l'intro (découverte, dernière image, geste de saut…) est fixé dans `CONTEXT.md` à la racine ; la « révélation de la scène » de ce README désigne le plan qui se dessine, pas la pièce 3D.
