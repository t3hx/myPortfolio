/**
 * The guided camera tour. Each stop references a camera **by the exact name it has
 * in Blender** (and therefore in the exported .glb). The transform (position /
 * rotation / focal length) is read from the .glb at runtime — you only define the
 * order here.
 *
 * Ported unchanged from the Vue prototype: order = tour order = scroll order.
 * Le texte de l'arrêt ne vit plus ici : les bulles et leur placement sont dans
 * `src/content/bubbles.ts` (issue #48), reliés par `label`.
 */
export interface CameraStop {
  /** Must match the camera object name in Blender / the .glb node name. */
  camera: string
  /** Short label for the navigation UI (also the `?stop=` deep-link key).
   *  C'est aussi la clé qui relie l'arrêt à sa bulle — `src/content/bubbles.ts`. */
  label: string
  /**
   * L'arrêt accepte-t-il qu'on regarde autour de son sujet ? Absent = oui.
   *
   * **C'est une liste d'EXCEPTIONS, pas un réglage à remplir.** Le regard est
   * la règle : un arrêt qui l'interdit doit dire pourquoi, ici, en une ligne.
   * Le laisser optionnel est ce qui garantit qu'un arrêt ajouté demain
   * l'aura — l'oubli va dans le bon sens.
   */
  lookAround?: false
  /**
   * `contain` : le champ vertical ne dépasse jamais celui que Blender a
   * composé. Absent = la règle du tour, l'ajustement horizontal.
   *
   * **C'est une liste d'exceptions, comme `lookAround`.** L'ajustement
   * horizontal reste la bonne politique pour une vue de pièce : sur une fenêtre
   * plus courte, recadrer en haut et en bas vaut mieux que reculer et perdre le
   * plan. Il ne devient un défaut que lorsque le cadrage est un TRÈS gros plan
   * dont le sujet a des bords — là, montrer plus, c'est montrer ce qu'il ne
   * faut pas voir.
   */
  fit?: 'contain' | 'column'
}

export const CAMERA_STOPS: CameraStop[] = [
  // L'accueil ne bouge pas, et c'est la plus forte des trois exceptions : son
  // cadrage existe POUR SE LIRE COMME UNE IMAGE PLATE — il remplit l'écran d'un
  // moniteur, et c'est le premier défilement qui recule et révèle la pièce en
  // volume. Or la parallaxe est précisément ce qui dit « ceci est en trois
  // dimensions » : un regard à l'accueil vendrait la mèche avant le geste qui
  // devait la vendre, et la révélation d'ouverture n'aurait plus rien à
  // révéler. Décision de l'auteur, 2026-08-25.
  // `fit: 'contain'` (#135) — l'accueil est un gros plan sur l'écran du PC, et
  // toute sa raison d'être est de passer pour une image plate. Sous
  // l'ajustement horizontal, une fenêtre plus HAUTE que le cadrage composé fait
  // grandir le champ vertical : on voit le mur au-dessus et le bureau en
  // dessous, et l'illusion tombe avant le premier défilement.
  //
  // Mesuré par bissection sur le rendu : l'aspect critique est **1,735**. Le
  // 16:9 (1,778) passe de justesse — le cadrage a été composé pour remplir
  // l'écran pile, ce qui explique qu'il n'y ait aucune marge. Un écran
  // 2560×1440 est exactement 16:9 et ne voit donc jamais le défaut.
  { camera: 'CameraStop_Home', label: 'Home', lookAround: false, fit: 'contain' },
  // L'ordre du tour (décision produit, 2026-08-24). Le tableau EST le parcours,
  // et son rang décide aussi du numéro des bulles : réordonner ici renumérote
  // tout seul, `bubbleKicker()` ne lit rien d'autre que ce rang.
  //
  // Le premier défilement quitte l'écran plat de l'accueil pour le bureau,
  // qui est la pièce maîtresse ; le CV vient juste après, sur l'écran vertical
  // qui est déjà dans le cadre. La visite s'éloigne ensuite du bureau par la
  // commode, puis fait le tour de la pièce jusqu'au télescope, et le tableau
  // d'affichage la referme.
  { camera: 'CameraStop_Desk', label: 'Desk' },
  // Le CV ne se regarde PAS sous un autre angle, et ce n'est pas une question
  // de cadrage : `CvScreen` est un panneau du DOM, posé dans le repère de
  // l'écran, dont tout le travail est de se lire comme AFFICHÉ PAR le second
  // moniteur. La caméra orbite, le moniteur glisse, le CV reste cloué au
  // viewport — les deux se décollent, ce qui est exactement le défaut contre
  // lequel cet écran est écrit. Une bulle, elle, est ancrée dans le monde et
  // suit sans qu'on ait rien à faire.
  // `fit: 'column'` (2026-09-07) — la règle jumelle de celle de l'accueil, et
  // dans l'autre sens. Le CV est écrit sur l'écran VERTICAL, et son texte est
  // du DOM posé sur la projection de cet écran : sa colonne vaut 44,8 % de la
  // fenêtre, ce qui fait 677 px sur un portable et 175 px sur un téléphone en
  // portrait — illisible, avec 444 px de contenu en trop. Le cadrage se
  // rapproche donc jusqu'à ce que la colonne retrouve la largeur pour laquelle
  // elle est écrite, ou toute la fenêtre moins ses marges si celle-ci est plus
  // étroite. Il ne fait que RESSERRER : à 1 280 px comme à 1 920, le cadrage
  // composé dans Blender est intact, et les dix références de rendu avec.
  { camera: 'CameraStop_MonitorVertical', label: 'CV', lookAround: false, fit: 'column' },
  { camera: 'CameraStop_Cabinet', label: 'Cabinet' },
  { camera: 'CameraStop_BookshelfPlant', label: 'Bookshelf' },
  { camera: 'CameraStop_Cat', label: 'Cat' },
  { camera: 'CameraStop_GuitarPoster', label: 'Guitar' },
  { camera: 'CameraStop_PosterTelescope', label: 'Posters' },
  { camera: 'CameraStop_Telescope', label: 'Telescope' },
  // Le tableau d'affichage non plus (demande de l'auteur, 2026-08-25) : c'est
  // une surface PLATE qu'on vient lire. Quelques degrés suffisent à la mettre
  // en fuite, et une surface en fuite se lit moins bien — le regard ferait
  // perdre ce qu'il est censé donner.
  { camera: 'CameraStop_Scoreboard', label: 'Scoreboard', lookAround: false },
]

/**
 * `CameraStop_TelescopeMoon` n'est PAS dans le tour, et c'est une décision
 * produit (#113) : la lune est une fonctionnalité de l'arrêt Télescope, pas une
 * étape. On y arrive en cliquant l'instrument, jamais en défilant.
 *
 * Sa caméra existe pourtant bien dans le `.glb` — c'est elle qui donne à
 * l'excursion sa pose d'arrivée et son téléobjectif. Elle est donc lue à part,
 * par `readStopTransform()`, et son nom vit dans `config/telescope.ts` avec le
 * reste de ce que l'excursion a besoin de savoir.
 */
