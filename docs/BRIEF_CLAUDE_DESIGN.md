# Brief — UI 2D du portfolio

## Le produit

Un portfolio personnel dont l'interface **est** la 3D : une chambre modélisée
sous Blender, dans laquelle la caméra fait une visite guidée d'arrêt en arrêt.
Chaque arrêt cadre un objet qui raconte quelque chose de son auteur — le bureau,
le chat, la guitare, le télescope.

**L'UI 2D est volontairement minimale.** Elle ne doit ni concurrencer la scène,
ni l'encombrer. La scène porte la personnalité ; l'UI se contente de la rendre
navigable et de la faire parler.

## Ce qu'il y a à designer

Deux éléments. Il n'y en a pas d'autres.

### 1. Une barre de menu verticale, sur le bord droit

Persistante pendant toute l'expérience. Elle doit rester lisible par-dessus une
scène 3D dont le fond change complètement d'un arrêt à l'autre — du bois clair au
quasi-noir (voir les rendus).

### 2. Un système de bulles

Une bulle par arrêt, ancrée à l'objet qu'elle commente et le suivant à l'écran.
Le texte y vit dans le DOM (sélectionnable, lisible par un lecteur d'écran, net à
toute densité), pas peint dans le canvas.

## Les 11 cadrages

Les maquettes se posent sur les rendus Blender de `docs/renders/refs/`
(1280×720), **jamais sur un fond abstrait** : chaque arrêt a sa focale, sa
composition et son espace négatif propres. Une bulle qui fonctionne sur le plan
large de la guitare n'a nulle part où aller sur le téléobjectif de la lune.

| Fichier | Objet cadré | Champ horizontal |
|---|---|---|
| `guitar.png` | guitare + ampli | 83,97° — très large |
| `posters.png` | posters | 61,93° |
| `scoreboard.png` | mappemonde à punaises et fils | 55,79° |
| `telescope.png` | télescope | 54,43° |
| `home.png` | moniteur, plein cadre | 53,13° |
| `bookshelf.png` | étagère | 49,55° |
| `desk.png` | bureau, PC | 46,40° |
| `cabinet.png` | commode à tiroirs | 41,91° |
| `cat.png` | le chat | 39,60° |
| `cv.png` | second écran, vertical | 26,99° |
| `moon.png` | la lune au télescope | 7,63° — téléobjectif |

`overview.png` montre la pièce entière : utile pour comprendre l'espace, ce n'est
pas un arrêt.

**L'ordre de la visite n'est pas figé** et ne concerne pas le design.

**Les cadrages sont en paysage uniquement.** Le rendu réel s'étire du 16:10
portable à l'ultrawide, ce qui déplace l'espace négatif : les overlays s'ancrent
relativement au sujet cadré, avec des marges de safe-area, jamais en positions
pixel absolues.

## Direction artistique

**« Carnet de BD »**, dérivée du rendu 2,5D de la scène : trait dessiné, aplats,
bulles de bande dessinée avec une queue qui pointe l'objet commenté. L'UI et la
scène partagent le même langage graphique.

L'exigence typographique est le point de risque : le trait dessiné doit rester
**crédible pour un profil technique**, jamais enfantin. Accents français
obligatoires (les textes seront bilingues FR/EN, ce qui joue sur les gabarits —
le français est 15 à 20 % plus long).

**Palette : à extraire des rendus à la pipette**, pas à inventer. Les rendus sont
calibrés exactement comme le rendu WebGL, donc la cohérence scène/UI est garantie
par construction.

### Interdictions

- Pas de fonte système par défaut (`system-ui`, Inter, Arial) en typo principale.
- Pas de gradient violet/indigo, pas de blobs ni de vagues SVG décoratives.
- Pas de grille 3 colonnes « icône dans un cercle + titre + description ».
- Pas de radius uniforme *bubbly* partout.

## Contraintes techniques

Elles viennent du code déjà écrit. Une maquette qui les enfreint n'est pas
implémentable.

- **Empilement** : canvas 0 < bulles 100 < barre de menu 200 < panneaux 300.
- **Les bulles n'interceptent jamais la molette.** La racine de l'overlay est en
  `pointer-events: none` ; seuls les îlots interactifs les réactivent.
- **Une bulle a deux états, présente ou absente** — elle apparaît à l'arrivée sur
  l'arrêt. Un geste de scroll enchaîne d'un arrêt au suivant en un mouvement
  fluide (1,2 s) ; la caméra ne stationne jamais entre deux arrêts, donc pas
  d'opacité continue indexée sur un pourcentage de défilement.
- **Contraste ≥ 4,5:1** sur tout texte, sur un fond 3D vivant et variable. Le
  moyen (scrim, aplat opaque, liseré) est au choix du design system.
- **Cibles tactiles ≥ 44 px.** Navigation clavier complète.
- L'UI est en **CSS écrit à la main** : livrer des tokens (valeurs + échelles),
  pas des classes utilitaires.

## Livrable

**`docs/DESIGN.md`** : tokens (typographie, palette, échelle d'espacement),
anatomie des deux composants (bulle : trait, épaisseur, queue, padding ; barre de
menu : largeur, états, comportement au survol), budgets de motion.

C'est la source de vérité des reviews design suivantes.

---

*Hors périmètre : la scène 3D et ses shaders, l'écran de pré-sélection (#24), le
preloader (#25).*
