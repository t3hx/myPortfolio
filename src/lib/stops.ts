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
 * Reads each `CameraStop_*` node's world transform straight from the loaded
 * scene graph (so there is no Blender Z-up → glTF Y-up conversion to get wrong).
 * The .glb's cameras are never made active — we only sample their transforms
 * and tween OUR render camera to match.
 *
 * Returns transforms in CAMERA_STOPS order. Missing stops are skipped with a
 * console warning (the degraded re-export case from the design doc's test plan).
 */
export function extractStops(scene: Object3D): Map<string, StopTransform> {
  scene.updateMatrixWorld(true)
  const stops = new Map<string, StopTransform>()

  for (const stop of CAMERA_STOPS) {
    const node = scene.getObjectByName(stop.camera)
    if (!node) {
      console.warn(`[stops] Missing camera node "${stop.camera}" in the .glb — skipping stop.`)
      continue
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
    // A node with the right name but NO camera used to fall through to a
    // 45° default. That is the worst kind of failure: the stop parks at the
    // right spot, warns about nothing, and shows a framing nobody authored —
    // so it looks plausible and reads as a Blender decision. Skip it loudly
    // instead, exactly like a stop missing from the graph.
    if (!cam) {
      console.warn(
        `[stops] "${stop.camera}" exists in the .glb but carries no camera ` +
          '(an Empty with the right name?) — skipping. Its focal length cannot ' +
          'be derived, and a default one would be silently wrong.',
      )
      continue
    }

    const position = new Vector3()
    const quaternion = new Quaternion()
    cam.getWorldPosition(position)
    cam.getWorldQuaternion(quaternion)
    // glTF `yfov` + `aspectRatio`, as loaded into three's camera.fov/.aspect.
    // Convert to the horizontal field, which is what the framing really is.
    const aspect = cam.aspect > 0 ? cam.aspect : 1
    const hfov = 2 * Math.atan(Math.tan((cam.fov * RAD) / 2) * aspect) * DEG
    stops.set(stop.camera, { position, quaternion, hfov })
  }

  if (stops.size === 0) {
    console.warn(
      '[stops] No CameraStop_* cameras found in the .glb. ' +
        'Re-export from Blender with "Cameras" enabled to drive the tour.',
    )
  }
  return stops
}

/** CAMERA_STOPS order, holes removed. Blender is the single source of truth
 *  for poses AND focal lengths: name a camera `CameraStop_*` there, add its
 *  order/label to CAMERA_STOPS here, done. (The hardcoded STOP_POSES fallback
 *  table is gone — it only existed while an export shipped without cameras.) */
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
