import { Canvas } from '@react-three/fiber'
import { Suspense, useRef } from 'react'
import {
  CLEAR_COLOR,
  OUTPUT_COLOR_SPACE,
  SHADOW_MAP_TYPE,
  TONE_MAPPING,
  TONE_MAPPING_EXPOSURE,
  WORLD_AMBIENT_COLOR,
  WORLD_AMBIENT_INTENSITY,
} from '@/config/blenderMatch'
import { Experience } from '@/scene/Experience'
import { Hud } from '@/ui/Hud'

/**
 * Spike entry. One Canvas, one render camera (the .glb's cameras are only
 * sampled, never activated — initial pose is a seed near the Home stop so
 * frame 0 isn't at the origin). No PostFx in the spike: the perf ladder
 * requires the look to hold with bloom OFF anyway.
 */
export default function App() {
  // Stable portal target for world-anchored <Html> content. Spike finding
  // (risk #3): ScrollControls reparents the canvas into its own scrolled
  // container, so a plain <Html> portals THERE and gets offset by scrollTop —
  // bubbles must portal to a layer outside the scroller.
  const bubbleLayer = useRef<HTMLDivElement>(null!)

  return (
    <div className="stage">
      <Canvas
        shadows
        camera={{ fov: 37.85, near: 0.05, far: 1000, position: [0, 1.1, -1.718] }}
        onCreated={({ gl, camera }) => {
          gl.toneMapping = TONE_MAPPING
          gl.toneMappingExposure = TONE_MAPPING_EXPOSURE
          gl.outputColorSpace = OUTPUT_COLOR_SPACE
          gl.shadowMap.type = SHADOW_MAP_TYPE
          camera.lookAt(0, 1.1, 0)
        }}
      >
        <color attach="background" args={[CLEAR_COLOR]} />
        <ambientLight color={WORLD_AMBIENT_COLOR} intensity={WORLD_AMBIENT_INTENSITY} />
        <Suspense fallback={null}>
          <Experience bubbleLayer={bubbleLayer} />
        </Suspense>
      </Canvas>
      <div ref={bubbleLayer} className="bubble-layer" />
      <Hud />
    </div>
  )
}
