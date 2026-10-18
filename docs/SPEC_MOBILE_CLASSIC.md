# Le mobile, c'est le classic

Spec verrouillée le 2026-09-26. Elle acte l'abandon de l'adaptation mobile de
la scène 3D et fait du site classic la couverture mobile du portfolio.

Elle **remplace** le paragraphe « Mobile » de `docs/projet.md` (« cible :
utilisation plein écran en mode paysage sur mobile »), qui disait l'inverse —
réécrit avec elle (#189).

## La décision, et pourquoi

**La scène 3D n'est pas supportée sur les appareils à pointeur « coarse »
(téléphones ET tablettes, iPad Pro compris). Ces visiteurs reçoivent le site
classic, qui doit être pleinement responsive.**

Quatre raisons, par ordre de poids :

1. **L'audience ouvre sur téléphone en premier.** Un recruteur suit un lien
   LinkedIn depuis son mobile ; une scène tordue en portrait avec des bulles
   composées pour du 1280×720 fait une pire première impression qu'un site 2D
   net et rapide. Le compromis « passable » n'est pas neutre, il coûte.
2. **Tout le 3D est composé paysage, par nature.** Les cadrages caméra sont
   authorés dans Blender en 16:9 (ajustement horizontal du champ : un viewport
   plus haut _élargit_ le champ vertical et montre ce que personne n'a cadré) ;
   la table de placement des bulles, l'écran CV, le viseur du télescope sont
   tous mesurés contre ce cadre. Le « gros chantier » de `docs/projet.md`
   visait au mieux un plein écran paysage forcé — déjà un compromis.
3. **`docs/PORTFOLIO_2D.md` déclare le site classic « mobile-first » dès sa
   première ligne.** L'expérience mobile prévue par le design existe déjà :
   c'est le classic. On ne renonce pas à couvrir le mobile, on assume que la
   couverture s'appelle classic.
4. **La VRAM.** ~162 Mo de textures décompressées est le seul risque identifié
   qui fait _planter_ un appareil (EPIC #15) — et cet appareil était le
   téléphone. La décision retire le cas mortel au lieu de le compenser.

## Les décisions de détail (arbitrées le 2026-09-26)

| Question                          | Décision                                                                                                | Raison                                                                                                                                                                                                                 |
| --------------------------------- | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Critère de routage                | **`(pointer: coarse)` sur le pointeur primaire**, taille d'écran ignorée                                | Un critère à une dimension, prévisible et testable. Pas de sniffing d'user-agent.                                                                                                                                      |
| Tablettes (iPad, paysage compris) | **Classic**                                                                                             | Aucune tablette ne charge 162 Mo de VRAM ; la 3D tactile n'a jamais été QA-ée ; un seuil de viewport ferait un critère à deux dimensions pour un cas marginal.                                                         |
| Laptops tactiles                  | **3D disponible**                                                                                       | Leur pointeur primaire est le trackpad (`pointer: fine`) ; le critère les laisse passer sans règle dédiée.                                                                                                             |
| UX du routage                     | **La présélection s'affiche, carte 3D désactivée avec une phrase honnête** — jamais de repli silencieux | L'écran de choix est le lieu où le site explique ses deux expériences. Une carte grisée qui dit pourquoi vaut mieux qu'une option disparue — et préserve la promesse « il y a une 3D, viens la voir sur grand écran ». |
| Téléphone en paysage              | **Classic aussi**                                                                                       | Le critère est le pointeur, pas l'orientation ; tourner l'écran ne change pas la VRAM ni le tactile.                                                                                                                   |
| WebGL absent                      | **Inchangé** : repli automatique, sans écran                                                            | Proposer une expérience impossible n'est pas un choix ; une expérience _déconseillée_ en est un. Les deux cas restent distincts.                                                                                       |

## Ce que le code sait déjà faire

Vérifié dans le dépôt, pas déduit :

- **`resolveExperience` est pur** (`src/lib/experienceChoice.ts`) : params +
  storage + sonde WebGL injectés, verrouillé par
  `tests/experienceChoice.test.ts` en Node. La règle coarse s'y ajoute comme
  une entrée injectée de plus — jamais un `matchMedia` lu dans le résolveur.
- **Le repli sans-WebGL existe** (`reason: 'no-webgl'`) : le chemin « cet
  appareil ne porte pas la scène » est une extension d'un mécanisme en place.
- **Le swipe tactile alimente déjà le détecteur de gestes**
  (`CameraRig.tsx:350`) — il reste, pour les écrans tactiles _à pointeur fine_
  et les laptops tactiles. Rien à retirer.
- **Le breakpoint 720 px du classic est implémenté** (`classic.css:1040`,
  spécifié par `docs/PORTFOLIO_2D.md`) mais n'a **jamais vu un vrai
  appareil** — CLAUDE.md : « implemented as specced even though the mobile
  batch is deferred ».
- **La présélection n'a AUCUNE règle mobile** : ses styles vivent dans
  `src/styles/styles.css`, qui ne contient pas une seule media query de
  largeur (vérifié le 2026-09-26).

## Pièges connus, à reporter dans les issues

- **Les dev params forcent la 3D avant tout** (`?stop=`, `?capture`…) et
  doivent continuer : la boucle de comparaison de rendus capture par URL. La
  règle coarse s'évalue APRÈS `dev-params` dans `resolveExperience`.
- **Un choix `3d` mémorisé sur un appareil coarse ne doit pas router vers la
  3D.** localStorage est par appareil, mais un navigateur peut synchroniser ou
  un appareil changer de périphérique d'entrée : la règle coarse prime sur
  `stored: '3d'` (elle ne prime pas sur `stored: 'classic'`, qui va dans le
  même sens).
- **`matchMedia('(pointer: coarse)')` peut lever ou manquer** dans un
  environnement de test — même traitement que `probeWebGL` : injecté, avec un
  défaut sûr (fine → l'écran de choix s'affiche).
- **La QA responsive se fait sur de vrais moteurs**, Safari iOS et un Android,
  pas seulement un viewport réduit dans Chromium — règle maison : une mesure
  Chromium ne prouve rien pour un utilisateur Gecko/WebKit.
- **La carte désactivée reste focusable-explicable en accessibilité** : un
  `disabled` nu fait disparaître l'explication des lecteurs d'écran ;
  `aria-disabled` + la phrase visible sont préférables.
- **`tests/classic.test.ts` et `tests/experienceChoice.test.ts` existent** et
  verrouillent déjà les invariants voisins : les étendre plutôt qu'en créer de
  nouveaux à côté.

## Conséquences sur le backlog existant

- **#42 (« Paliers GPU et repli mobile ») : fermée** le 2026-09-26. Son
  « repli mobile » devient le routage ci-dessus ; « mesurer les fps sur un
  mobile réel » n'a plus d'objet. Ce qui reste dû — le profilage de `edges`
  sur un vrai GPU, jamais fait — est consigné en commentaire sur #39.
- **#39/#50/#51/#52 (KTX2) : conservées, déclassées.** De « prérequis
  mobile » à « optimisation » : 162 Mo de VRAM restent lourds pour un laptop
  à GPU intégré, et le budget de chargement garde sa valeur. Plus aucun
  chantier n'en dépend.
- **#97 et #179 : inchangées.**

## Le découpage

Une EPIC, quatre filles :

1. **FEAT — le routage** : la règle coarse dans `resolveExperience` (injectée,
   testée en Node) + la carte 3D désactivée sur la présélection, avec sa
   phrase, dans les deux langues.
2. **TK — le classic pleinement responsive** : QA du breakpoint 720 sur de
   vrais appareils (Safari iOS, Android), corrections, y compris les surfaces
   partagées (LangToggle, tuiles CV, fiche… ce que le classic affiche).
3. **TK — la présélection responsive** : l'écran de choix lui-même, qui n'a
   aujourd'hui aucune règle mobile et devient la première chose qu'un visiteur
   mobile voit.
4. **TK — consigner la décision** : cette spec committée, le § Mobile de
   `docs/projet.md` réécrit, la section « mobile batch deferred » de CLAUDE.md
   ajustée.
