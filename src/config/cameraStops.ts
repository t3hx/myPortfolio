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
}

export const CAMERA_STOPS: CameraStop[] = [
  { camera: 'CameraStop_Home', label: 'Home' },
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
  { camera: 'CameraStop_MonitorVertical', label: 'CV' },
  { camera: 'CameraStop_Cabinet', label: 'Cabinet' },
  { camera: 'CameraStop_BookshelfPlant', label: 'Bookshelf' },
  { camera: 'CameraStop_Cat', label: 'Cat' },
  { camera: 'CameraStop_GuitarPoster', label: 'Guitar' },
  { camera: 'CameraStop_PosterTelescope', label: 'Posters' },
  { camera: 'CameraStop_Telescope', label: 'Telescope' },
  { camera: 'CameraStop_Scoreboard', label: 'Scoreboard' },
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
