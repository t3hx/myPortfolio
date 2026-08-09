import { Canvas } from '@react-three/fiber'
import { Suspense, useRef } from 'react'
import {
  CLEAR_COLOR,
  OUTPUT_COLOR_SPACE,
  TONE_MAPPING,
} from '@/config/renderPipeline'
import { STOP_POSES } from '@/config/stopPoses'
import { Experience } from '@/scene/Experience'
import { Hud } from '@/ui/Hud'

/**
 * Spike entry. One Canvas, one render camera. The scene is pre-baked unlit
 * (see renderPipeline.ts): NO lights, NO shadows, NoToneMapping — Blender's
 * AgX is already cooked into the textures. Initial camera pose seeds the
 * Home stop so frame 0 isn't at the origin.
 */
const home = STOP_POSES.CameraStop_Home

export default function App() {
  // Stable portal target for world-anchored <Html> content (bubbles) — kept
  // outside the canvas container so the HUD/panel stacking order is ours.
  const bubbleLayer = useRef<HTMLDivElement>(null!)

  return (
    <div className="stage">
      <Canvas
        camera={{ fov: home.fov, near: 0.05, far: 1000, position: home.position }}
        onCreated={({ gl, camera }) => {
          gl.toneMapping = TONE_MAPPING
          gl.outputColorSpace = OUTPUT_COLOR_SPACE
          camera.quaternion.set(...home.quaternion)
        }}
      >
        <color attach="background" args={[CLEAR_COLOR]} />
        <Suspense fallback={null}>
          <Experience bubbleLayer={bubbleLayer} />
        </Suspense>
      </Canvas>
      <div ref={bubbleLayer} className="bubble-layer" />
      <Hud />
    </div>
  )
}
