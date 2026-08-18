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
  // The CV beat: the vertical second monitor. Placed right after Home so the
  // flat-screen reveal flows straight into "who I am" before the camera pulls
  // back to the desk — reorder this line freely, the array IS the tour order.
  // Le numéro des bulles suit cet ordre : réordonner ici renumérote le tour.
  { camera: 'CameraStop_MonitorVertical', label: 'CV' },
  { camera: 'CameraStop_Desk', label: 'Desk' },
  { camera: 'CameraStop_Scoreboard', label: 'Scoreboard' },
  { camera: 'CameraStop_BookshelfPlant', label: 'Bookshelf' },
  { camera: 'CameraStop_Cabinet', label: 'Cabinet' },
  { camera: 'CameraStop_Cat', label: 'Cat' },
  { camera: 'CameraStop_GuitarPoster', label: 'Guitar' },
  { camera: 'CameraStop_PosterTelescope', label: 'Posters' },
  { camera: 'CameraStop_Telescope', label: 'Telescope' },
  { camera: 'CameraStop_TelescopeMoon', label: 'Moon' },
]
