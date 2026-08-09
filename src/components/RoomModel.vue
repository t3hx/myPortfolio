<script setup lang="ts">
import { useGLTF } from '@tresjs/cientos'
import { useLoop } from '@tresjs/core'
import {
  AnimationMixer,
  type Object3D,
  PerspectiveCamera,
  Quaternion,
  Vector3,
} from 'three'
import { watch } from 'vue'
import {
  LIGHT_INTENSITY_MULTIPLIER,
  LIGHT_OVERRIDES,
  SHADOW_CASTING_LIGHTS,
  SHADOW_MAP_SIZE,
} from '@/config/blenderMatch'
import { CAMERA_STOPS } from '@/config/cameraStops'
import type { StopTransform } from '@/composables/useCameraTour'

const props = defineProps<{ src: string }>()

const emit = defineEmits<{
  ready: [payload: { stops: Map<string, StopTransform> }]
}>()

// TresJS v5: useGLTF is a reactive composable. It kicks off loading immediately
// and exposes the result through `state` (a Ref<GLTF | null>) — there is nothing
// to await here. `draco: true` is harmless if the model isn't Draco-compressed.
const { state } = useGLTF(props.src, { draco: true })

let mixer: AnimationMixer | null = null
let done = false

watch(
  state,
  (gltf) => {
    if (!gltf || done) return
    done = true

    const scene = gltf.scene

    // --- Match Blender lighting / shadows ---------------------------------------------
    // glTF carries materials + emissive + punctual lights, but NOT shadow flags, so we
    // re-apply them here. Shadows on EVERY light is critical: in Three.js, a light with
    // castShadow=false illuminates through walls and uniformly lifts every surface in
    // its cone, which destroys contrast. See SHADOW_CASTING_LIGHTS docstring.
    scene.traverse((obj: Object3D) => {
      const o = obj as any

      if (o.isMesh) {
        o.castShadow = true
        o.receiveShadow = true
      }

      if (o.isLight) {
        o.intensity *= LIGHT_INTENSITY_MULTIPLIER

        // Per-light intensity override (e.g. kill WindowFill that floods the room).
        for (const [match, factor] of Object.entries(LIGHT_OVERRIDES)) {
          if (o.name.includes(match)) {
            o.intensity *= factor
            break
          }
        }

        const cast =
          SHADOW_CASTING_LIGHTS.length === 0 ||
          SHADOW_CASTING_LIGHTS.some((name) => o.name.includes(name))
        o.castShadow = cast
        if (cast && o.shadow) {
          o.shadow.mapSize.set(SHADOW_MAP_SIZE, SHADOW_MAP_SIZE)
          o.shadow.bias = -0.0005
          if (o.shadow.camera) {
            o.shadow.camera.near = 0.05
            o.shadow.camera.far = 30
          }
        }
      }
    })

    // --- Play any baked animations (e.g. the curtains in 09_Animated) -----------------
    if (gltf.animations.length > 0) {
      mixer = new AnimationMixer(scene)
      for (const clip of gltf.animations) {
        mixer.clipAction(clip).reset().play()
      }
    }

    // --- Extract the camera-stop transforms in Three.js space -------------------------
    // We read straight from the loaded graph so there's no Blender(Z-up) -> glTF(Y-up)
    // conversion to get wrong.
    scene.updateMatrixWorld(true)
    const stops = new Map<string, StopTransform>()

    for (const stop of CAMERA_STOPS) {
      const node = scene.getObjectByName(stop.camera)
      if (!node) continue

      // The node may itself be a camera, or hold one as a child. Collect into an array
      // to keep TypeScript's narrowing happy inside the traverse closure.
      const cams: PerspectiveCamera[] = []
      node.traverse((c: Object3D) => {
        if ((c as any).isCamera) cams.push(c as PerspectiveCamera)
      })
      const cam = cams[0] ?? null

      const position = new Vector3()
      const quaternion = new Quaternion()
      const source = cam ?? node
      source.getWorldPosition(position)
      source.getWorldQuaternion(quaternion)
      const fov = cam?.fov ?? 45

      stops.set(stop.camera, { position, quaternion, fov })
    }

    if (stops.size === 0) {
      console.warn(
        '[RoomModel] No CameraStop_* cameras found in the .glb. ' +
          'Re-export from Blender with "Cameras" enabled to drive the tour. ' +
          'Falling back to free-look.',
      )
    }

    emit('ready', { stops })
  },
  { immediate: true },
)

const { onBeforeRender } = useLoop()
onBeforeRender(({ delta }) => {
  mixer?.update(delta)
})
</script>

<template>
  <primitive v-if="state" :object="state.scene" />
</template>
