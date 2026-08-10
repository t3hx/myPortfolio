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

## Anatomie — barre de menu

- 52 px de large, collée à **12 px** du bord droit, centrée verticalement, rayon 26.
- Repos : **opacité .4** ; survol / focus-within : **.75** (180 ms). Jamais invisible.
- De haut en bas : logo losange accent (12 px, lueur) · filet · **Accueil / Résumé / Projets en texte vertical** (`writing-mode: vertical-rl` + `rotate(180deg)` — se lit tête penchée à gauche) · filet · in · gh · toggle FR/EN.
- Item actif : cartouche crème .09 **+ point accent 4,5 px** au-dessus du mot (flux flex, padding symétrique).
- Survol d'item : cartouche crème .09, 140 ms.
- Cibles 36–40 px (≥ 44 px avec zone étendue) ; Tab = focus (état survol), ↑↓ entre items.

## Écrans hors visite

- **0a Pré-sélection** : fond radial braise→encre, logo (triangle pointe en bas depuis le 2026-08-10, respirant en 2,6 s — les autres écrans portent encore le losange, à propager une fois validé), question en Newsreader italique 30, deux cartes verre 340 px — aucun halo au repos : la carte survolée ou focusée l'allume et il respire en boucle au rythme du logo du preloader (2,6 s ease-in-out). Note mono : choix mémorisé.
- **0b Pré-loader** : logo en respiration 2,6 s, barre 340×2 px (piste crème .14, fil dégradé→accent, point de tête lumineux), microcopie Newsreader (« On allume les lampes… ») + pourcentage mono.
- **02 CV** : contenu « affiché par l'écran » — photo (placeholder hachuré) + carte langues/permis, puis cartouches poste—entreprise—période en **accordéon au survol** (260 ms, max-height) révélant les missions à puces.

## Budgets de motion

| Mouvement | Durée | Détail |
|---|---|---|
| bulle in | 480 ms | cubic-bezier(.2,.8,.2,1), reveal bas→haut (clip) ; clip final inset(−35 %) pour ne pas rogner les variantes transformées |
| reveal typo | +40 ms/mot | translateY 10→0 |
| bulle out | 200 ms | fade simple, avant le départ caméra (1 200 ms, fourni) |
| barre repos→survol | 180 ms | opacité .4→.75 |
| item / halo | 140 / 200 ms | |
| accordéon CV | 260 ms | max-height |

Deux états de bulle seulement (présente/absente) — aucune opacité indexée sur un pourcentage de scroll.

### `prefers-reduced-motion`

La session design n'avait pas tranché la variante réduite ; elle est posée ici, implémentée dans `tokens.css`. **Le critère est l'autonomie, pas le déplacement :** ce qui part tout seul ou tourne en boucle est neutralisé, ce que l'utilisateur déclenche lui-même est conservé. Un halo qui s'allume au survol répond à un geste et ne surprend personne ; la respiration du logo tourne sans fin sans qu'on l'ait demandée.

| Mouvement | Sous mouvement réduit |
|---|---|
| bulle in (480 ms, clip + translation) | fondu d'opacité seul, 200 ms |
| reveal typo mot à mot | supprimé — la phrase paraît d'un bloc |
| respiration du logo (boucle 2,6 s) | supprimée ; la barre continue de progresser, c'est de l'information |
| barre .4→.75, halo, cartouche d'item, accordéon CV | **conservés** — déclenchés par l'utilisateur |
| **déplacement caméra 1,2 s** | **coupe au stop suivant** (`STEP_DURATION` à 0 dans `CameraRig`) |

La dernière ligne est la seule qui compte vraiment : elle ne vit pas dans le CSS, et sans elle le seul mouvement d'ampleur de l'expérience reste entier.

## Notes d'implémentation (vérifiées au navigateur, 2026-08-10)

Quatre points où recréer « au pixel » dérive silencieusement si on ne les connaît pas :

- **Les variantes positionnelles passent par `translate` / `rotate`, jamais par `transform`.** `bubble-in` anime `transform` en fill-mode `both`, et une animation bat toute la cascade — styles inline compris. Un `transform: translateX(-50%)` posé sur `.bubble` est donc écrasé par la valeur finale du keyframe : mesuré, la bulle d'accueil sortait de 10 px hors d'un viewport 1280 (centre décalé de +325 px) et la guitare rendait à plat, rotation annulée. Les propriétés individuelles se composent avec `transform` au lieu d'être remplacées, ce qui règle le conflit sans wrapper.
- **Les largeurs de la table de placement sont en `content-box`** — le pack ne pose aucun reset. `01-desk` à `max-width: 460` mesure 506 px de bord à bord (padding 22 × 2 + bord 1 × 2). Avec le `box-sizing: border-box` qu'un projet React pose par défaut, retrancher 46 px ou les largeurs rétrécissent d'autant.
- **Les polices sont chargées depuis le CDN Google dans les maquettes** (commodité de prototype). En production : Newsreader et Space Grotesk auto-hébergées, sous-réglées sur le latin étendu — les deux couvrent les accents FR.
- **Les fonds sont `docs/renders/refs/*.png`**, partagés avec la boucle de comparaison de rendus. Dans l'app, le canvas WebGL les remplace ; ils ne sont là que pour juger les placements sur les vraies focales.
- **Le halo de survol est spécifié mais non maquetté** : aucun écran de `screens/` ne porte `.bubble--interactive`, faute d'objet cliquable arrêté au moment de la session. Le CSS existe et vaut spécification — ce n'est pas une maquette qu'on aurait oubliée. **Tranché avec #47 : aucune bulle n'est interactive** — la bulle est purement narrative, n'ouvre rien, et laisse passer molette et clics (`pointer-events: none`). `.bubble--interactive` reste une spécification dormante si un futur arrêt en a besoin.

## Contraintes respectées (rappel code)

- Empilement 0/100/200/300 ; racine overlay `pointer-events: none`.
- Contraste ≥ 4,5:1 : crème #EFE5D3 sur verre encre .5+ tient sur tous les rendus, y compris bois clair.
- Cibles ≥ 44 px, navigation clavier complète.
- CSS main : tokens (valeurs + échelles), pas de classes utilitaires.
- Overlays ancrés au sujet cadré (%, safe-area), paysage 16:10 → ultrawide.
