import { PerspectiveCamera, Quaternion, Vector3, type Object3D } from 'three'
import { CAMERA_STOPS } from '@/config/cameraStops'

/** A camera stop's world transform, extracted from the loaded .glb.
 *
 *  The field of view is stored HORIZONTALLY, on purpose. A glTF camera
 *  describes its framing as `yfov` + `aspectRatio`, and Blender picks that
 *  pair from the scene's render resolution: the v12 export declares
 *  `aspectRatio: 1`, so its `yfov` (Home: 54.43°) is the field of a SQUARE
 *  frame — not the vertical field of a widescreen one. Feeding it straight
 *  into three's `camera.fov` (which is vertical, against the CANVAS aspect)
 *  framed everything far too wide.
 *
 *  The horizontal field is the invariant across both: 54.43° horizontal is
 *  32.27° vertical at 16:9, which is exactly what the previous export
 *  declared for the same camera. Store it once, derive the vertical field per
 *  viewport (see `verticalFov`).
 */
export interface StopTransform {
  position: Vector3
  quaternion: Quaternion
  /** Horizontal field of view, in degrees. */
  hfov: number
}

const DEG = 180 / Math.PI
const RAD = Math.PI / 180

/**
 * Vertical fov (degrees) that renders `hfov` horizontally on a viewport of
 * `aspect` — the "horizontal fit" policy: Blender's horizontal framing is
 * preserved on every screen, and a viewport shorter than the authored frame
 * simply crops top and bottom rather than pulling back and losing the shot.
 */
export function verticalFov(hfov: number, aspect: number): number {
  const a = aspect > 0 ? aspect : 1
  return 2 * Math.atan(Math.tan((hfov * RAD) / 2) / a) * DEG
}

/**
 * Lit le transform monde d'UNE caméra du `.glb`, par le nom exact de son nœud
 * (donc sans conversion Z-up → Y-up de Blender à se tromper). Les caméras du
 * `.glb` ne sont jamais activées : on échantillonne leur pose et on interpole
 * NOTRE caméra de rendu jusqu'à elle.
 *
 * Ce helper existe pour être appelé DEUX fois de sources différentes : par
 * `extractStops()` pour chaque arrêt du tour, et par le télescope pour
 * `CameraStop_TelescopeMoon`, qui est une caméra du `.glb` **hors tour**
 * (#113). C'est la dérivation du champ horizontal qui ne doit exister qu'une
 * fois — la recopier ailleurs, ce serait une deuxième source de vérité sur une
 * focale, et `tests/stops.test.ts` ne verrouille que celle-ci.
 *
 * `null` avec un avertissement si le nœud manque, ou s'il porte le bon nom
 * sans porter de caméra.
 */
export function readStopTransform(scene: Object3D, cameraName: string): StopTransform | null {
  const node = scene.getObjectByName(cameraName)
  if (!node) {
    console.warn(`[stops] Missing camera node "${cameraName}" in the .glb — skipping stop.`)
    return null
  }

  // The node may itself be a camera, or hold one as a child.
  const cams: PerspectiveCamera[] = []
  node.traverse((c: Object3D) => {
    if ((c as PerspectiveCamera).isCamera) cams.push(c as PerspectiveCamera)
  })
  const cam = cams[0] ?? null

  // A node with the right name but NO camera used to fall through to a
  // 45° default. That is the worst kind of failure: the stop parks at the
  // right spot, warns about nothing, and shows a framing nobody authored —
  // so it looks plausible and reads as a Blender decision. Skip it loudly
  // instead, exactly like a stop missing from the graph.
  if (!cam) {
    console.warn(
      `[stops] "${cameraName}" exists in the .glb but carries no camera ` +
        '(an Empty with the right name?) — skipping. Its focal length cannot ' +
        'be derived, and a default one would be silently wrong.',
    )
    return null
  }

  const position = new Vector3()
  const quaternion = new Quaternion()
  cam.getWorldPosition(position)
  cam.getWorldQuaternion(quaternion)
  // glTF `yfov` + `aspectRatio`, as loaded into three's camera.fov/.aspect.
  // Convert to the horizontal field, which is what the framing really is.
  const aspect = cam.aspect > 0 ? cam.aspect : 1
  const hfov = 2 * Math.atan(Math.tan((cam.fov * RAD) / 2) * aspect) * DEG
  return { position, quaternion, hfov }
}

/**
 * Les arrêts du tour, lus dans le graphe chargé. Renvoie les transforms indexés
 * par nom de caméra ; un arrêt manquant est sauté avec un avertissement (le cas
 * du ré-export dégradé prévu au plan de test du design doc).
 *
 * Ne lit QUE `CAMERA_STOPS` : une caméra du `.glb` absente de ce tableau n'est
 * jamais extraite ici. C'est voulu — le tour est ce tableau — et c'est pourquoi
 * la lune passe par `readStopTransform()` de son côté depuis #113.
 */
export function extractStops(scene: Object3D): Map<string, StopTransform> {
  scene.updateMatrixWorld(true)
  const stops = new Map<string, StopTransform>()

  for (const stop of CAMERA_STOPS) {
    const transform = readStopTransform(scene, stop.camera)
    if (transform) stops.set(stop.camera, transform)
  }

  if (stops.size === 0) {
    console.warn(
      '[stops] No CameraStop_* cameras found in the .glb. ' +
        'Re-export from Blender with "Cameras" enabled to drive the tour.',
    )
  }
  return stops
}

export function orderedStops(map: Map<string, StopTransform>): StopTransform[] {
  return CAMERA_STOPS.map((s) => map.get(s.camera)).filter(
    (t): t is StopTransform => t !== undefined,
  )
}

// Scratch objects — avoid per-frame allocation.
const tmpPos = new Vector3()
const tmpQuat = new Quaternion()

/**
 * Applies a continuous tour progress p ∈ [0, N-1] to the render camera:
 * position lerped, orientation slerped, horizontal fov interpolated (so
 * focal-length changes — the wide guitar shot → the telescope-moon zoom —
 * come for free), then converted to the vertical fov this viewport needs.
 */
export function applyProgress(cam: PerspectiveCamera, stops: StopTransform[], p: number): void {
  if (stops.length === 0) return
  const clamped = Math.min(Math.max(p, 0), stops.length - 1)
  const i = Math.min(Math.floor(clamped), stops.length - 2)
  const t = stops.length > 1 ? clamped - i : 0
  const a = stops[Math.max(i, 0)]
  const b = stops[Math.min(i + 1, stops.length - 1)]

  tmpPos.lerpVectors(a.position, b.position, t)
  tmpQuat.copy(a.quaternion).slerp(b.quaternion, t)
  cam.position.copy(tmpPos)
  cam.quaternion.copy(tmpQuat)
  cam.fov = verticalFov(a.hfov + (b.hfov - a.hfov) * t, cam.aspect)
  cam.updateProjectionMatrix()
}
