import gsap from 'gsap'
import { Quaternion, Vector3, type PerspectiveCamera } from 'three'
import { computed, ref, watch, type Ref } from 'vue'
import { CAMERA_STOPS } from '@/config/cameraStops'

/** A camera stop's world transform, extracted from the loaded .glb. */
export interface StopTransform {
  position: Vector3
  quaternion: Quaternion
  fov: number
}

/**
 * Drives the active camera between the configured stops with GSAP.
 *
 * We don't make the .glb's cameras "active" — instead we read each stop's world
 * transform from the model and tween OUR render camera to match. Position is
 * lerped, orientation is slerped (so it arcs smoothly), and FOV is interpolated
 * too, which gives you the focal-length change between, say, the 20 mm wide shots
 * and the 270 mm telescope zoom for free.
 */
export function useCameraTour(
  camera: Ref<PerspectiveCamera | null>,
  stops: Ref<Map<string, StopTransform>>,
) {
  const currentIndex = ref(0)
  const isTweening = ref(false)

  // Reused scratch objects (avoid per-frame allocation).
  const progress = { t: 0 }
  const fromPos = new Vector3()
  const fromQuat = new Quaternion()
  const tmpPos = new Vector3()
  const tmpQuat = new Quaternion()
  let fromFov = 50

  const currentStop = computed(() => CAMERA_STOPS[currentIndex.value])
  const ready = computed(() => stops.value.size > 0)

  function transformAt(index: number): StopTransform | undefined {
    const def = CAMERA_STOPS[index]
    return def ? stops.value.get(def.camera) : undefined
  }

  /** Jump instantly to a stop (no tween) — used to place the camera on first load. */
  function snapTo(index: number) {
    const cam = camera.value
    const target = transformAt(index)
    if (!cam || !target) return
    gsap.killTweensOf(progress)
    cam.position.copy(target.position)
    cam.quaternion.copy(target.quaternion)
    cam.fov = target.fov
    cam.updateProjectionMatrix()
    currentIndex.value = index
    isTweening.value = false
  }

  function goTo(index: number, duration = 1.6) {
    const cam = camera.value
    const target = transformAt(index)
    if (!cam || !target) return

    gsap.killTweensOf(progress)
    fromPos.copy(cam.position)
    fromQuat.copy(cam.quaternion)
    fromFov = cam.fov
    progress.t = 0
    isTweening.value = true
    currentIndex.value = index

    gsap.to(progress, {
      t: 1,
      duration,
      ease: 'power2.inOut',
      onUpdate: () => {
        const t = progress.t
        tmpPos.lerpVectors(fromPos, target.position, t)
        tmpQuat.copy(fromQuat).slerp(target.quaternion, t)
        cam.position.copy(tmpPos)
        cam.quaternion.copy(tmpQuat)
        cam.fov = fromFov + (target.fov - fromFov) * t
        cam.updateProjectionMatrix()
      },
      onComplete: () => {
        isTweening.value = false
      },
    })
  }

  function goToName(name: string, duration?: number) {
    const index = CAMERA_STOPS.findIndex((s) => s.camera === name)
    if (index !== -1) goTo(index, duration)
  }

  function next(duration?: number) {
    goTo((currentIndex.value + 1) % CAMERA_STOPS.length, duration)
  }

  function prev(duration?: number) {
    goTo((currentIndex.value - 1 + CAMERA_STOPS.length) % CAMERA_STOPS.length, duration)
  }

  // Place the camera on the first available stop as soon as the model's transforms
  // are known.
  watch(
    [ready, camera],
    ([isReady, cam]) => {
      if (isReady && cam) snapTo(currentIndex.value)
    },
    { immediate: true },
  )

  return { currentIndex, currentStop, isTweening, ready, goTo, goToName, next, prev, snapTo }
}
