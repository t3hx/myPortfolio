import { PerspectiveCamera, Quaternion, Vector3, type Object3D } from 'three'
import { CAMERA_STOPS } from '@/config/cameraStops'
import { STOP_POSES } from '@/config/stopPoses'

/** A camera stop's world transform, extracted from the loaded .glb. */
export interface StopTransform {
  position: Vector3
  quaternion: Quaternion
  fov: number
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

    const position = new Vector3()
    const quaternion = new Quaternion()
    const source = cam ?? node
    source.getWorldPosition(position)
    source.getWorldQuaternion(quaternion)
    stops.set(stop.camera, { position, quaternion, fov: cam?.fov ?? 45 })
  }

  if (stops.size === 0) {
    console.warn(
      '[stops] No CameraStop_* cameras found in the .glb. ' +
        'Re-export from Blender with "Cameras" enabled to drive the tour.',
    )
  }
  return stops
}

/** CAMERA_STOPS order — glb-extracted transforms first, STOP_POSES fallback.
 *  The current export (portfolio_final.glb) ships no cameras at all, so in
 *  practice every stop resolves from the sampled pose table; if cameras come
 *  back in a future export they take precedence automatically. */
export function orderedStops(map: Map<string, StopTransform>): StopTransform[] {
  return CAMERA_STOPS.map((s) => {
    const extracted = map.get(s.camera)
    if (extracted) return extracted
    const pose = STOP_POSES[s.camera]
    if (!pose) return undefined
    return {
      position: new Vector3(...pose.position),
      quaternion: new Quaternion(...pose.quaternion),
      fov: pose.fov,
    }
  }).filter((t): t is StopTransform => t !== undefined)
}

// Scratch objects — avoid per-frame allocation.
const tmpPos = new Vector3()
const tmpQuat = new Quaternion()

/**
 * Applies a continuous tour progress p ∈ [0, N-1] to the render camera:
 * position lerped, orientation slerped, fov interpolated (so focal-length
 * changes — 20 mm wide shot → 270 mm telescope zoom — come for free).
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
  cam.fov = a.fov + (b.fov - a.fov) * t
  cam.updateProjectionMatrix()
}
