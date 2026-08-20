# DESIGN.md — UI 2D du portfolio 3D

Direction retenue : **« Lueur » — verre fumé & lueur froide.**
Source de vérité des reviews design. Maquettes de référence : `screens/*.html`.

## La direction, et pourquoi

La scène porte la personnalité ; l'UI se contente d'un seul matériau et d'un seul accent :

- **Un matériau : le verre fumé teinté bois-brûlé.** Fond `rgba(24,17,12, .5–.74)` + `backdrop-filter: blur(22px)`. Il garantit le contraste sur n'importe quel arrière-plan (du bois clair du bureau au noir du chat) sans jamais poser d'aplat mort : la scène reste perceptible à travers.
- **Un accent : le cyan des cordes, du clavier et des yeux du chat** (`#8FDBE4`). Utilisé uniquement en points lumineux, liserés et halos — jamais en surface.
- **Deux voix typographiques :** Newsreader italique pour ce que « dit » la pièce (les bulles, la microcopie du preloader) ; Space Grotesk pour ce qui s'opère (menu, étiquettes, méta). Les deux couvrent les accents FR ; les gabarits absorbent +15–20 % de longueur FR/EN.
- La palette est **extraite à la pipette des rendus** (calibrés comme le rendu WebGL) — cohérence scène/UI par construction.

## Tokens

Fichier prêt à l'emploi : `tokens.css` (custom properties + composants). Résumé :

| Token | Valeur | Usage |
|---|---|---|
| --ink-glass | rgb(24 17 12) à .5–.74 | fond bulle/barre |
| --cream | #EFE5D3 | texte, icônes |
| --glow | #8FDBE4 | accent (points, logo, FR actif) |
| --glow-deep | #6FD8E6 | halo survol |
| --font-voice | Newsreader italique 19/28,5 | phrase des bulles |
| --font-ui | Space Grotesk 11/caps/+0.2em | kicker, menu |
| Espace | 4 · 8 · 12 · 16 · 24 · 32 · 48 | |
| Rayons | 10 (bulle) · 18 (item) · 26 (barre) | |
| Z | canvas 0 < bulles 100 < barre 200 < panneaux 300 | contrainte code |

## Anatomie — bulle

Un emplacement, pas une forme de BD : panneau de verre, pas de queue.

- Panneau : padding 16/22/15, rayon 10, bord `cream .14`, ombre `0 14px 44px rgba(0,0,0,.38)`.
- Kicker : point accent 7 px (lueur 10 px) + `NN — Objet` en caps 11.
- Phrase : une seule, Newsreader italique 19/28,5, `#F2E9DA`, `text-wrap: pretty`.
- Sans titre (home) : point + phrase alignés sur une ligne (`.bubble__inline`).
- Ligne de rappel optionnelle vers l'objet : 44×1 px en dégradé crème (`.bubble__tick`).
- Survol (bulles interactives) : halo accent — bord `glow-deep .6`, anneau 1,5 px, lueur externe 40 px, lueur interne légère. 200 ms.
- Variantes : `--centered` (home, desk) ; `--tilted` (guitare : `rotate(-11.15deg)`, mesuré au pixel sur le bord de l'ampli, ombre courte `0 12px 26px`).
- Le texte vit dans le DOM ; la racine overlay est `pointer-events: none`, seuls les îlots réactivent.

### Placement par arrêt (ancré au sujet, marges safe-area, jamais en px absolus)

| Écran | Position (repère 1280×720) | Largeur max | Note |
|---|---|---|---|
| home | centrée, top 85 % | libre (nowrap) | sans titre, point seul |
| 01 desk | centrée, top 75 % | 460 | deux lignes |
| 02 cv | left 1,6 %, top 20 % | 260 | centrée dans la marge (écran : x 24,5→75,3 %) ; tick → |
| 03 cabinet | left 2,5 %, top 76 % | 300 | coin bas-gauche |
| 04 bookshelf | left 2 %, top 55 % | 240 | alignée sur la séparation d'étagère |
| 05 cat | left 4 %, top 7 % | 340 | fond quasi noir : le verre suffit |
| 06 guitar | left 52,5 %, top 31,5 % | 380 | rotation −11,15°, parallèle à l'ampli |
| 07 scoreboard | left 1,2 %, top 82 % | 340 | sur l'océan |
| 08 posters | left 2,5 %, top 38 % | 330 | hors halo du spot ; tick → |
| 09 telescope | left 62 %, top 3,5 % | 340 | coin haut-droit, dans le ciel |
| 10 moon | left 1,2 %, top 82 % | 330 | coin bas-gauche, hors lune |

**Numérotation — tranchée avec #48 (2026-08-18) : c'est l'ordre du TOUR qui numérote, pas celui des maquettes.** Les écrans ci-dessus ont été capturés dans leur propre ordre (01 bureau, 02 CV…) alors que le tour, lui, va Accueil → CV → bureau → mappemonde → étagère → commode → chat → guitare → posters → télescope → lune. Le kicker se calcule donc à l'exécution depuis `CAMERA_STOPS` (accueil non numéroté) : réordonner la visite renumérote tout seul, et les numéros gravés dans les maquettes sont périmés par construction — leur texte, lui, fait toujours foi (`tests/bubbleAnchors.test.ts` le vérifie mot pour mot).

**Le placement est implémenté par dé-projection, pas en CSS.** Les fractions du tableau donnent la DIRECTION du point monde ancré, l'objet visé en donne la profondeur (donc la parallaxe au départ de la caméra) — voir `src/lib/bubbleAnchors.ts`. Les onze positions ont été re-mesurées au navigateur : elles retombent à moins de 0,1 px des maquettes en 1280×720. Hors 16:9, une marge de sécurité de 12 px (la plus serrée du design : celle de la barre de menu) empêche les bulles de bord de sortir du cadre — une bulle garde sa largeur en pixels quand le cadre, lui, rétrécit.

## Anatomie — barre de menu

- 52 px de large, collée à **12 px** du bord droit, centrée verticalement, rayon 26.
- Repos : **opacité .4** ; survol / focus-within : **.75** (180 ms). Jamais invisible.
- De haut en bas : logo triangle accent (12 px, lueur, statique — il ne respire que sur les écrans de chargement) · filet · **Accueil / Résumé / Projets en texte vertical** (`writing-mode: vertical-rl` + `rotate(180deg)` — se lit tête penchée à gauche) · filet · in · gh · toggle FR/EN.
- Item actif : cartouche crème .09 **+ point accent 4,5 px** au-dessus du mot (flux flex, padding symétrique).
- Survol d'item : cartouche crème .09, 140 ms.
- Cibles 36–40 px (≥ 44 px avec zone étendue) ; Tab = focus (état survol), ↑↓ entre items.

## Anatomie — fiche projet

Maquettes : `screens/03b-project.html` (fiche) et `screens/03c-project-empty.html` (tiroir vide).

**La fiche est une bulle à l'échelle de l'écran.** Même anatomie en trois temps —
kicker à point accent · titre · une seule phrase en Newsreader italique — même
matériau, même accent. Ce qui change est l'échelle, et la raison en est
mécanique : la scène a disparu du cadre, le dossier la remplit entièrement.

- **Le verre reste du verre**, à la densité haute de la plage : `rgba(24,17,12, .74)` +
  `blur(26px) saturate(.9)`, plein cadre. Un panneau opaque effacerait le carton
  crème du dossier qu'on vient de mettre 850 ms à amener sous le nez du visiteur ;
  le `backdrop-filter` le laisse transparaître, ce qui est exactement ce pour quoi
  la direction l'a retenu. Un dégradé radial crème à .07 empêche le verre de lire
  comme un aplat mort.
- **Composition en deux colonnes**, `min(1040px, 84%)` centrée : couverture 300 px
  à gauche, texte à droite, gouttière 48. La couverture est **portrait et pleine
  hauteur** — c'est une page dans un dossier, pas une vignette ; alignée sur la
  colonne de texte elle tient la composition par la gauche au lieu de flotter.
- **Titre** : Space Grotesk 500, `--fs-display` 44/1,05, `-.015em`. Le nom d'un
  projet relève de ce qui s'opère, pas de ce que la pièce dit — la voix italique
  est réservée à la phrase, une seule, comme dans une bulle. **`--fs-display` est
  un échelon neuf de l'échelle typo** (11 · 12 · 19 · 26 · **44**), ajouté ici
  volontairement : les six autres échelons servent des îlots posés sur la scène,
  celui-ci sert le seul écran qui occupe tout le cadre. Aucun autre écran n'a le
  droit de s'en servir sans la même raison.
- **Méta** (année, rôle) entre deux filets crème .12 ; **stack** en pastilles mono
  11,5 ; **faits saillants** en liste dont la puce est le point accent du kicker —
  un seul signe dans tout le système.
- **Liens** : bouton verre, halo accent au survol et au focus (mêmes valeurs que
  `.bubble--interactive`). Une fiche sans lien n'affiche **rien** : trois des cinq
  dépôts sont privés, et la règle de `MENU_SOCIALS` vaut ici — jamais de porte
  fermée à clé.
- **Couverture manquante** : illustration générique (`GENERIC_COVER_SRC`), jamais
  un trou.

**La fiche couvre la barre de menu** — l'empilement `panneaux 300 > barre 200` est
une contrainte de code, pas un choix pris ici. Elle est donc **modale par
construction**, et sa sortie doit être la chose la plus évidente après le titre :
deux sorties toujours, `Échap` affiché en pastille mono et un bouton rond en haut
à droite. Jamais une seule des deux.

### Le tiroir vide n'ouvre aucune fiche

À zéro projet il n'y a **aucun dossier à cliquer**, donc aucun panneau ne s'ouvre
jamais : un écran vide plein cadre serait une porte qui ne s'ouvre pas. Le repli
vit là où l'utilisateur se trouve — devant le tiroir ouvert et vide — et le
système n'admet qu'un seul bloc de texte à la fois. **C'est donc la bulle de la
commode, à sa place habituelle, avec une autre phrase.** Aucun composant nouveau,
et #83 s'en trouve réduit d'autant.

### L'étiquette des dossiers 3D

Le seul texte du projet qui vive dans une **texture** et non dans le DOM
(exception tranchée le 2026-08-18 : c'est une affordance, comme l'icône d'un
bouton, et le nom existe aussi dans la fiche accessible).

| Point | Valeur | Pourquoi |
|---|---|---|
| Fonte | `--font-ui` (Space Grotesk) 600 | les micro-étiquettes sont déjà son travail |
| Casse | **phrase, sans interlettrage** | les caps à +0.2em mangeraient la largeur : 430 px utiles seulement |
| Encre | `#2B2418` | brun chaud sur carton crème ; `--ink` est un fond d'écran, il virerait au trou noir sur du papier |
| Corps | 66 px dans une texture de 512, **réduit jusqu'à ce que ça entre** | mesuré : « Portfolio » (9 signes) tient à 78 px, « myPortfolio » (11) déborde ; un compte de signes reste un proxy |
| Visibilité | **permanente**, pas au survol | c'est ce qui rend le tiroir lisible d'un coup d'œil, et le survol sert déjà à désigner |

## Écrans hors visite

- **0a Pré-sélection** : fond radial braise→encre, logo (triangle pointe en bas depuis le 2026-08-10, respirant en 2,6 s — propagé au menu et au preloader avec #65 : le losange n'existe plus nulle part), question en Newsreader italique 30, deux cartes verre 340 px — aucun halo au repos : la carte survolée ou focusée l'allume et il respire en boucle au rythme du logo du preloader (2,6 s ease-in-out). Note mono : choix mémorisé.
- **0b Pré-loader** : logo triangle en respiration 2,6 s (opacité **et** portée de la lueur, comme sur 0a — sur 16 px l'opacité seule ne se lit pas), barre 340×2 px (piste crème .14, fil dégradé→accent, point de tête lumineux), microcopie Newsreader (« On allume les lampes… ») + pourcentage mono.
- **02 CV** : contenu « affiché par l'écran », sept blocs empilés dans le moniteur vertical (élargi le 2026-08-20, à la demande de l'auteur) —
  1. le **nom**, en haut de tout, en chasse fixe et **déchiffré à l'arrivée** (1600 ms, `--t-decrypt`), suivi d'un **caret de bloc** qui ne vit que pendant le déchiffrement — c'est lui qui fait lire « console » plutôt que « titre animé ». Les caractères se figent de gauche à droite, les espaces ne sont jamais brouillés : ce sont eux qui gardent la silhouette du nom. La chasse fixe n'est pas décorative — en proportionnelle, chaque glyphe tiré au sort change la largeur du mot et le nom gigote ;
  2. une rangée **photo · savoir-être · langues & permis**, la photo (148 × 180, placeholder hachuré) en donnant la hauteur ;
  3. la réglette **savoir-faire** ;
  4. **« Le cap »**, la vision — section à part entière, titre au même rang qu'Expériences et Formations, placée AVANT le parcours : l'intention se lit d'abord, les expériences la justifient ensuite. Seul bloc écrit dans la police de la _voix_ (Newsreader italique, celle des bulles), parce que c'est la seule ligne qui parle à la première personne ;
  5. **Expériences** : cartouches poste—entreprise—période en **accordéon au survol** (260 ms), quatre missions minimum chacune ;
  6. **Formations** : mêmes cartouches, **sans accordéon** — un diplôme n'a pas de missions à dérouler, et `--static` retire donc aussi la réaction au survol : un fond qui s'éclaircit sur quelque chose qui n'ouvre rien est une promesse non tenue.

  Les deux réglettes partagent **une seule anatomie** : une marque carrée, un nom dessous. Sans SVG fourni, la marque est l'**initiale du nom** en crème monochrome — le glyphe neutre en attendant les vraies icônes, jamais un état d'erreur (aucun `onError`). Avec un SVG, elle est rendue en `<img>` donc **en couleur** : une marque monochrome ne ressemble pas à la marque, et l'asymétrie est voulue.

  **Tous les titres se déchiffrent en cascade** (420 ms, `--t-cascade`, décalés de 60 ms du haut vers le bas) — titres de carte, titres de section et intitulés de cartouches. Une **seule horloge** pilote l'ensemble : quinze titres avec chacun sa boucle `rAF` et son état, ce serait quinze rendus React par image à côté d'une scène 3D. Le tirage des glyphes est **déterministe**, dérivé de l'image et de la position, parce que le composant est rendu pendant la phase de rendu de React. Étant autonome, la cascade est **coupée** — pas raccourcie — sous `prefers-reduced-motion`.

  **Les titres de section portent l'accent froid**, les titres de carte restent crème sourd : c'est la couleur qui porte la hiérarchie, sans ajouter ni corps ni graisse.

  **Le survol d'une cartouche déclenche un balayage** (700 ms, `--t-sweep`) : un liseré froid la traverse une fois. Il n'annonce pas une ouverture — les formations l'ont aussi, elles qui ne s'ouvrent pas — il accuse réception du pointeur. Déclenché par un geste, il est donc **conservé** sous mouvement réduit.

  **Le haut du CV ne bouge jamais.** Il n'est donc **pas centré** : centré, tout ce qui le fait grandir le fait remonter — c'est de l'arithmétique, la moitié de ce qu'un accordéon ajoute est reprise en haut, et aucune réserve ne corrige ça exactement puisque les quatre accordéons n'ont pas la même hauteur (78 à 91 px). Il est ancré en haut, sous une **entretoise incompressible** (`.cv::before`, `flex: 0 0 auto`, `min(13vh, 220px)`) qui lui donne l'air centré au repos. Le mot qui compte est *incompressible* : une entretoise en `0 1 auto` tient tant que rien ne déborde puis cède — mesuré, 9 px rendus au premier accordéon à 1512 × 945, où le CV déborde déjà au repos, et une seconde entretoise en bas n'y change rien puisqu'à cette taille elle est déjà à zéro. **Mesuré après : 0 px sur les huit cartouches, à 1795 × 1300, 1512 × 945 et 1280 × 720.** Le prix est une entretoise qui reste en place quand ça défile : on défile un peu plus longtemps, mais rien ne saute sous le curseur.

  Corollaire : **plus aucune règle de mise en page ne dépend d'un survol.** La tentative précédente réglait une marge via `:has(.job:hover)`, qui se déclenchait aussi sur les **formations** — survoler un diplôme, qui n'ouvre rien, déplaçait tout le CV.

  **Le projet est pensé plein écran d'abord** (décision de l'auteur, 2026-08-20) : sur un écran plein, les six sections (~910 px fermé, ~990 accordéon ouvert) tiennent et se **centrent**. Dans un cadre de 720, elles ne tiennent pas — et le mobile reste une question ouverte, non traitée ici. Trois règles en découlent, toutes vérifiées par `tests/cv.test.ts` :

  - `justify-content: **safe center**`, jamais `center` seul : centré tant que ça rentre, ancré en haut dès que ça déborde. Un `center` seul déborderait des **deux** côtés, et un conteneur ne défile jamais vers le négatif — la moitié haute du CV deviendrait inatteignable. Un navigateur qui ignore le mot-clé `safe` jette la déclaration et retombe sur `flex-start`, c'est-à-dire au bon endroit. Contrepartie assumée : quand il y a la place de centrer, ouvrir un accordéon décale le bloc de 40 px ;
  - il porte `pointer-events: auto` : un élément transparent au pointage ne reçoit pas la molette, elle irait au canevas ;
  - il ne porte **pas** la classe `panel`. `panel` ferait ignorer au tour _toute_ molette passant ici, et on ne pourrait plus quitter l'arrêt en défilant. C'est `CvScreen` qui arbitre cran par cran : il prend la molette tant qu'il lui reste de la course dans ce sens, et la rend au tour en butée. L'écouteur est **natif**, parce que `CameraRig` l'est aussi et que React délègue ses `onWheel` à un ancêtre de `.stage`.

- **Les variantes positionnelles passent par `translate` / `rotate`, jamais par `transform`.** `bubble-in` anime `transform` en fill-mode `both`, et une animation bat toute la cascade — styles inline compris. Un `transform: translateX(-50%)` posé sur `.bubble` est donc écrasé par la valeur finale du keyframe : mesuré, la bulle d'accueil sortait de 10 px hors d'un viewport 1280 (centre décalé de +325 px) et la guitare rendait à plat, rotation annulée. Les propriétés individuelles se composent avec `transform` au lieu d'être remplacées, ce qui règle le conflit sans wrapper.
- **Les largeurs de la table de placement sont en `content-box`** — le pack ne pose aucun reset. `01-desk` à `max-width: 460` mesure 506 px de bord à bord (padding 22 × 2 + bord 1 × 2). Avec le `box-sizing: border-box` qu'un projet React pose par défaut, retrancher 46 px ou les largeurs rétrécissent d'autant.
- **Les polices sont chargées depuis le CDN Google dans les maquettes** (commodité de prototype). En production : Newsreader et Space Grotesk auto-hébergées, sous-réglées sur le latin étendu — les deux couvrent les accents FR.
- **Les fonds sont `docs/renders/refs/*.png`**, partagés avec la boucle de comparaison de rendus. Dans l'app, le canvas WebGL les remplace ; ils ne sont là que pour juger les placements sur les vraies focales.
- **`.panel` est un marqueur de COMPORTEMENT, pas une apparence.** `CameraRig`
  ignore toute molette dont la cible est dedans : c'est le seul rôle de cette
  classe. `src/styles.css` lui attachait pourtant l'apparence du panneau de
  démonstration du HUD du spike — `width: min(420px, 90vw)`, collé à droite,
  fond bleu. La fiche projet, qui réclame `.panel` pour la molette, en héritait :
  mesuré, elle sortait à 420 px de large au lieu de 1280. L'apparence du HUD vit
  désormais sous `.hud-panel`, et `.panel` ne porte plus aucun style.
- **Le halo de survol est spécifié mais non maquetté** : aucun écran de `screens/` ne porte `.bubble--interactive`, faute d'objet cliquable arrêté au moment de la session. Le CSS existe et vaut spécification — ce n'est pas une maquette qu'on aurait oubliée. **Tranché avec #47 : aucune bulle n'est interactive** — la bulle est purement narrative, n'ouvre rien, et laisse passer molette et clics (`pointer-events: none`). `.bubble--interactive` reste une spécification dormante si un futur arrêt en a besoin.

## Contraintes respectées (rappel code)

- Empilement 0/100/200/300 ; racine overlay `pointer-events: none`.
- Contraste ≥ 4,5:1 : crème #EFE5D3 sur verre encre .5+ tient sur tous les rendus, y compris bois clair.
- Cibles ≥ 44 px, navigation clavier complète.
- CSS main : tokens (valeurs + échelles), pas de classes utilitaires.
- Overlays ancrés au sujet cadré (%, safe-area), paysage 16:10 → ultrawide.
