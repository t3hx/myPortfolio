import { useGLTF } from '@react-three/drei'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { AnimationMixer, type Light, type LightShadow, type Object3D } from 'three'
import {
  LIGHT_INTENSITY_MULTIPLIER,
  LIGHT_OVERRIDES,
  MODEL_SRC,
  SHADOW_CASTING_LIGHTS,
  SHADOW_MAP_SIZE,
} from '@/config/blenderMatch'
import { extractStops, orderedStops, type StopTransform } from '@/lib/stops'
import { useInteraction } from '@/state/interaction'

interface RoomModelProps {
  onReady: (stops: StopTransform[]) => void
}

/**
 * Loads the Blender-authored room and re-applies everything glTF cannot carry:
 * shadow flags, the light intensity multiplier, per-light overrides (see
 * blenderMatch.ts). Then extracts the CameraStop_* transforms and hands them up.
 * Any baked animation clips (curtains, drawer) are auto-played.
 */
export function RoomModel({ onReady }: RoomModelProps) {
  const { scene, animations } = useGLTF(MODEL_SRC)
  const applied = useRef(false)

  const mixer = useMemo(() => {
    if (animations.length === 0) return null
    const m = new AnimationMixer(scene)
    for (const clip of animations) m.clipAction(clip).reset().play()
    return m
  }, [scene, animations])

  useEffect(() => {
    if (applied.current) return
    applied.current = true

    scene.traverse((obj: Object3D) => {
      const mesh = obj as Object3D & { isMesh?: boolean; castShadow: boolean; receiveShadow: boolean }
      if (mesh.isMesh) {
        mesh.castShadow = true
        mesh.receiveShadow = true
      }

      const light = obj as Light & { isLight?: boolean; shadow?: LightShadow }
      if (light.isLight) {
        light.intensity *= LIGHT_INTENSITY_MULTIPLIER
        for (const [match, factor] of Object.entries(LIGHT_OVERRIDES)) {
          if (light.name.includes(match)) {
            light.intensity *= factor
            break
          }
        }
        const cast =
          SHADOW_CASTING_LIGHTS.length === 0 ||
          SHADOW_CASTING_LIGHTS.some((name) => light.name.includes(name))
        light.castShadow = cast
        if (cast && light.shadow) {
          light.shadow.mapSize.set(SHADOW_MAP_SIZE, SHADOW_MAP_SIZE)
          light.shadow.bias = -0.0005
          const shadowCam = light.shadow.camera as { near?: number; far?: number } | undefined
          if (shadowCam) {
            shadowCam.near = 0.05
            shadowCam.far = 30
          }
        }
      }
    })

    onReady(orderedStops(extractStops(scene)))
  }, [scene, onReady])

  useFrame((_, delta) => mixer?.update(delta))

  // Raycast entry into the TELESCOPE phase: clicking any telescope part while
  // parked flies the camera to the ocular. Everything else just logs its name —
  // spike-grade discovery of which meshes are clickable interaction anchors.
  function onClick(e: ThreeEvent<MouseEvent>) {
    e.stopPropagation()
    const name = e.object.name
    console.info(`[raycast] clicked "${name}"`)
    const { phase, enterTelescope } = useInteraction.getState()
    if (phase === 'parked' && name.toLowerCase().includes('telescope')) enterTelescope()
  }

  return <primitive object={scene} onClick={onClick} />
}

useGLTF.preload(MODEL_SRC)
