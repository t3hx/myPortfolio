# Le deuxième clic : la commode, le dossier, la fiche projet

Spec verrouillée le 2026-08-18. Elle décrit la suite de l'arrêt `Cabinet` :
comment on passe du menu « Projets » à une fiche projet plein écran.

Elle complète `docs/PORTFOLIO_3D_INTERACTIONS.md` §2.6 (qui ne décrit que le
tiroir) et `docs/design/DESIGN.md` (qui ne connaît pas encore la fiche projet).

## Le parcours, du début à la fin

1. L'utilisateur clique **Projets** dans la barre de menu → `CameraRig` vole
   jusqu'à `CameraStop_Cabinet`. _(Déjà livré, issue #26.)_
2. À l'arrivée, **le tiroir du haut coulisse tout seul** vers l'utilisateur.
   Pas de clic à dépenser : la promesse de l'épique #12 est « un projet en
   deux clics », et le clic n° 2 appartient au dossier.
3. Le tiroir contient **un dossier par projet** (3 à 5 au lancement),
   échelonnés en profondeur. Chaque dossier porte le **nom du projet sur son
   étiquette** (`Folder_Tab`). Le survol dessine un **contour** autour du
   dossier visé et le **soulève** au-dessus de ses voisins, pour que son
   étiquette se lise sans ambiguïté.
4. Le clic sort le dossier du tiroir et le fait **voler vers la caméra**.
   Quand il remplit le cadre, un **panneau DOM plein écran** prend le relais en
   fondu et présente la fiche.
5. `Échap` (ou un bouton de fermeture) referme la fiche : le panneau s'efface,
   le dossier regagne sa place, le tiroir reste ouvert. Un second `Échap`
   ne fait rien de plus — on est revenu à l'étape 3.
6. Quitter l'arrêt à la molette **referme le tiroir**.

> **`?stop=Cabinet` doit rester déterministe.** La boucle de comparaison de
> rendus capture par URL, et c'est la raison pour laquelle le preloader se
> démonte au lieu de se cacher. Un tiroir qui s'ouvre en fondu rendrait la
> capture dépendante de l'instant du déclenchement : sous `?stop=`, le tiroir
> est posé **ouvert d'emblée**, sans tween.

## Les faits mesurés (2026-08-18, export v13)

Vérifiés dans le `.glb` et dans l'app, pas déduits.

| Fait                                                                            | Conséquence                                                   |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `Folder_Back/Front/Page/Tab` existent, **un seul exemplaire**                   | les N dossiers sont des **clones runtime**                    |
| Le dossier vit dans le tiroir du **haut** (le seul avec un intérieur)           | les projets et « les archives » sont le même tiroir           |
| Le graphe du `.glb` est **plat** : 157 nœuds, tous racines                      | le « groupe tiroir » se fabrique au runtime, il n'existe pas  |
| Façade du tiroir en `z = -1.951`, fond en `-2.479`, caméra en `-0.87`           | **axe de coulissement : +Z**, profondeur utile ≈ **0.52 m**   |
| Les pièces du dossier sont des **boîtes séparées** de 1.5 mm (0.6 pour la page) | aucun rabat articulé : pas de dépliage 3D sans retour Blender |
| `Folder_Tab` a **son propre matériau** `Mat_FolderTab` (90 × 40 × 1.5 mm)       | l'étiquette s'écrit sans toucher au reste du dossier          |
| Le tiroir est **fermé** dans le `.glb`…                                         | …mais **ouvert** dans `docs/renders/refs/cabinet.png`         |

### Le risque d'éclairage est levé

Tout le rendu est **pré-cuit** (`MeshBasicMaterial`, zéro lumière) : un objet
dont le bake a été calculé à l'intérieur d'une cavité fermée peut mentir dès
qu'on le déplace. C'était le vrai risque de cette feature.

**Testé** : tiroir translaté de +0.28 en Z dans l'app en direct
(`?stop=Cabinet`, 1280×720). L'intérieur du tiroir est correctement éclairé, le
dossier apparaît, et le résultat est quasi identique au rendu de référence
Blender. **Le bake tient.** Amplitude retenue : **0.28**.

### Les dossiers sont une cible cliquable confortable

Deuxième doute à lever : le dossier d'origine, seul et rangé au fond, ne
représente que quelques pour cent de la hauteur du cadre. C'est censé être
**tout le clic n° 2** de l'épique #12 — trop petit et la promesse tombe.

**Testé** : cinq dossiers clonés et échelonnés dans le tiroir ouvert, capturés
au même cadrage. Ils remplissent le tiroir, se lisent immédiatement comme un
classeur, et chaque **onglet** fait ~100 × 50 px à l'écran — largement au-delà
des 44 px de cible tactile. **Aucun ajustement de caméra n'est nécessaire** :
c'est le nombre de dossiers qui fabrique la cible, pas le cadrage.

Un piège vu à cette occasion : à pas de 0.09 le dossier de devant **traverse la
façade du tiroir**. L'échelonnement se calcule, il ne se choisit pas — voir le
couloir ci-dessous.

### Le couloir en Z : les dossiers ne peuvent pas vivre n'importe où

Contrainte non évidente et qui mordra si elle n'est pas écrite.

`Cabinet_Top` occupe `z` de -2.500 à -1.950, à une hauteur `y` de 0.730 à
0.750. Or le haut d'une étiquette est **déjà** à `y = 0.745`. Donc **tout
dossier situé en `z < -1.950` a son étiquette dans le plateau de la commode, et
ne peut pas se soulever du tout.**

Le tiroir sortant de 0.28, les dossiers doivent tous tenir dans ce **couloir de
0.28 m** (`z > -1.950`) — et non dans les 0.42 m d'intérieur du tiroir. Pour
cinq dossiers cela donne le calage validé au spike : de **-1.930 à -1.710, pas
de 0.055**.

### Le survol se lit sans ambiguïté

**Testé** (`docs/renders/spikes/cabinet-hover-label.png`) : cinq dossiers
étiquetés, celui du milieu survolé — contour couleur `--glow` (#8FDBE4),
soulevé de 0.05 en `y`. Les noms de projet sont **nets et lisibles** à ce
cadrage, le dossier survolé se détache franchement, et l'accent froid tranche
bien sur le bois chaud.

Deux enseignements de la capture :

- **Le dossier survolé monte _et_ avance** (+Y et +Z). Attention au
  raisonnement : le décalage vers l'avant ne dégage **pas** les voisins —
  vérifié à l'implémentation, c'est l'inverse, approcher le dossier de la
  caméra l'agrandit et il en couvre davantage. Il est là parce qu'il fait lire
  le geste comme une **extraction**, le début du mouvement que le clic
  achèvera. Qu'un dossier survolé masque ses voisins de derrière est attendu :
  une seule étiquette a besoin d'être lisible à la fois, celle qu'on vise.
- **La coque inversée n'est pas le bon contour** : à l'échelle testée
  (1.02, 1.03, 3.0) elle se lit comme un cadre flottant, pas comme un cerne.
  Voir la conception ci-dessous.

Les trois captures du spike sont conservées dans `docs/renders/spikes/` :
`cabinet-drawer-open.png` (le tiroir seul), `cabinet-folders-x5.png` (les cinq
dossiers) et `cabinet-hover-label.png` (survol + étiquettes).

## Conception technique

### Le groupe tiroir

Douze objets à déplacer ensemble : les huit `Cabinet_TopDrawer_*` et les quatre
`Folder_*` (plus leurs clones).

> **Piège** : reparenter avec `Object3D.attach()`, **jamais `add()`**.
> `attach()` préserve la transformation monde ; `add()` ne le fait pas, et les
> trois poignées portent des quaternions non triviaux — elles partiraient de
> travers. Le graphe est plat, donc les douze objets sont des enfants directs de
> la scène et rien ne casse en les déplaçant.

### Les clones de dossier

Cloner les quatre meshes par projet et les échelonner sur l'axe Z **dans le
couloir** décrit plus haut (`z > -1.950`), pas dans tout l'intérieur du tiroir :
de -1.930 à -1.710, **pas de 0.055** pour cinq dossiers. Le pas se dérive du
nombre de projets, il ne se code pas en dur.

Les clones partagent leurs matériaux : un `.clone()` de mesh ne duplique pas la
texture, donc les 162 Mo de VRAM ne bougent pas. **Mais** le survol modifie le
matériau — il faut donc **cloner le matériau** de chaque dossier, sinon les
cinq réagissent ensemble. Ce clonage se fait **une fois par dossier à la
construction**, pas à chaque survol : un `.clone()` par événement de souris
fuit un matériau à chaque pixel parcouru.

> **Piège** : `.clone()` **recopie le nom**. Cinq nœuds `Folder_Front` et
> `getObjectByName('Folder_Front')` rend le premier venu — or `RoomModel`,
> `bubbleAnchors` et `LINE_OVERRIDES` résolvent tous par nom. Les clones
> prennent donc un suffixe (`Folder_Front__p1`…), et il faut vérifier que le
> mode `edges` d'`Outlines` ne dessine pas d'encre sur les cinq.

### L'étiquette : le nom du projet sur `Folder_Tab`

L'étiquette est un **plan de texte posé 1.2 mm devant la face de `Folder_Tab`**,
avec une `CanvasTexture` transparente générée au runtime depuis le nom du
projet. Le bake de l'étiquette n'est pas touché : il sert de fond papier au
texte.

Pourquoi un plan séparé plutôt que peindre dans la texture existante : les UV
de `Folder_Tab` sont ceux d'un dépliage de bake, pas d'un cadre à écrire. Un
plan neuf donne des UV maîtrisés et laisse le bake intact.

> **Piège** : le spike utilisait `transparent: true, depthWrite: false`. Ça
> tient à cinq dossiers immobiles, pas pendant le vol vers la caméra, où
> l'étiquette peut se peindre par-dessus une géométrie située devant elle. La
> réponse du pipeline maison est le traitement **`decal`** — `alphaTest: 0.5`
> et écriture de profondeur normale (voir la table de `renderPipeline.ts`).
> Une seule histoire pour la transparence découpée dans tout le projet.

### Le survol : contour + surélévation

Trois effets simultanés sur le dossier visé par le raycast :

1. **Contour** couleur `--glow` (#8FDBE4), via la machinerie **`edges` déjà
   présente dans `Outlines.tsx`** (`EdgesGeometry` → `LineSegments2`, largeur
   constante à l'écran), appliquée au seul dossier survolé.
2. **Surélévation** de ~0.05 en `y` **et un décalage vers l'avant** en `z` : le
   spike montre qu'un dossier qui monte seulement masque son voisin de derrière.
3. Retour à la position d'origine à la sortie du survol, en tween court.

> **Piège** : `Outlines.tsx` en mode `hull` prend la main sur le rendu via un
> `useFrame` prioritaire. Sans danger en production — le mode par défaut est
> `off` — mais un contour de survol ne doit pas dépendre de ce mode : il se
> construit pour lui-même, et `?outline=hull` reste un outil de A/B.

La coque inversée a été essayée et écartée : elle se lit comme un cadre
flottant autour du dossier, pas comme un cerne.

### L'état

`Phase` (`src/state/interaction.ts`) **ne bouge pas**. La règle « chaque phase
possède UN routage d'entrée » est ce qui tient ce fichier debout, et le tiroir
n'a pas de routage à lui : il ne capture ni molette ni clavier.

On ajoute une tranche `cabinet` distincte :

```ts
type CabinetState = 'closed' | 'open' | 'folder'
```

Seule l'ouverture de la fiche fait passer `Phase` en `'panel'` — la phase qui
possède déjà la molette et `Échap`, et dont `CameraRig` ignore déjà les
événements (`.panel`).

### Le relais 3D → DOM

Le texte de la fiche est du **vrai DOM**, jamais une texture : décision
verrouillée de l'épique #13 (accessibilité, SEO, netteté). Le dossier 3D est
donc une **transition**, pas un support de contenu — il vole vers la caméra,
et le panneau DOM se fond par-dessus quand il remplit le cadre.

> **L'étiquette est la seule exception, et elle est validée** (décision
> utilisateur, 2026-08-18). Elle porte du texte **dans une texture**, ce que la
> règle interdit — la lecture retenue est que l'étiquette est une
> **affordance** (comme l'icône d'un bouton) et non du contenu : elle ne porte
> qu'un nom de projet, et ce nom existe aussi dans la fiche DOM, qui reste la
> version accessible et indexable. La règle tient dans son intention, pas dans
> sa lettre. **L'exception s'arrête là** : rien d'autre que le nom du projet ne
> va sur une texture. Le repli, s'il fallait un jour y revenir, est une
> étiquette DOM projetée (même mécanique que `Bubble.tsx`) — nette et
> accessible, mais flottant devant l'étiquette au lieu de se coucher dedans.

## Découpage

Cinq lots, tous sous l'épique #13. `#31` existait déjà et ne couvre que la
couche contenu ; les quatre autres ont été créés le 2026-08-19.

| Lot                                                                                  | Contenu                                                                                               |
| ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| **A — le tiroir** ([#76](https://github.com/t3hx/myPortfolio/issues/76))             | groupe runtime, ouverture auto à l'arrivée, fermeture au départ                                       |
| **B — les dossiers** ([#77](https://github.com/t3hx/myPortfolio/issues/77))          | clones, échelonnement, étiquettes nommées, survol (contour + surélévation), clic → vol vers la caméra |
| **C — la fiche, design** ([#78](https://github.com/t3hx/myPortfolio/issues/78))      | session `/design-consultation` → maquette dans `docs/design/screens/`, + typographie de l'étiquette   |
| **D — la fiche, intégration** ([#79](https://github.com/t3hx/myPortfolio/issues/79)) | panneau DOM plein écran, relais depuis le vol, `Échap`, phase `panel`                                 |
| **E — le contenu** ([#31](https://github.com/t3hx/myPortfolio/issues/31))            | type TS, `src/content/projects.ts`, repli liste vide, illustration générique                          |

B et D étant trop gros pour une PR chacun, ils ont été découpés (2026-08-19) :

- **B** → [#80](https://github.com/t3hx/myPortfolio/issues/80) les dossiers
  étiquetés, puis [#81](https://github.com/t3hx/myPortfolio/issues/81) le survol
- **D** → [#82](https://github.com/t3hx/myPortfolio/issues/82) le vol vers la
  caméra, puis [#83](https://github.com/t3hx/myPortfolio/issues/83) le panneau

A ne dépend de rien et peut commencer tout de suite. **E précède B** — B a
besoin du type et de la liste pour savoir combien de dossiers cloner et ce
qu'ils portent. C bloque le panneau (#83).

## Questions laissées ouvertes

- **Le tiroir fermé dans le `.glb`, ouvert dans le rendu de référence.** Les
  deux datent du 2026-08-10. Ce n'est pas un obstacle — on l'ouvre au runtime —
  mais un des deux est désynchronisé, et la scène Blender appartient à
  l'utilisateur.
- **La typographie de l'étiquette.** Le spike est en serif générique. Le choix
  de la fonte, du corps et de la casse revient à la session design (lot C), qui
  décidera aussi si l'étiquette est visible en permanence ou au survol seul.
  Le spike la montre permanente, et c'est ce qui rend le tiroir lisible d'un
  coup d'œil.
- **La copie de la bulle `Cabinet`** parle d'archives, pas de projets. Gardée
  telle quelle : les textes des bulles sont des placeholders (décision
  utilisateur, 2026-08-18).
