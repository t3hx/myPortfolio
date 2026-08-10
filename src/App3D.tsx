import { Canvas } from '@react-three/fiber'
import { Suspense, useRef } from 'react'
import {
  CLEAR_COLOR,
  OUTPUT_COLOR_SPACE,
  TONE_MAPPING,
} from '@/config/renderPipeline'
import { Experience } from '@/scene/Experience'
import { Hud } from '@/ui/Hud'

/**
 * L'expérience 3D complète. One Canvas, one render camera. The scene is
 * pre-baked unlit (see renderPipeline.ts): NO lights, NO shadows,
 * NoToneMapping — Blender's AgX is already cooked into the textures.
 *
 * Ce module n'est atteint QUE par le `React.lazy` d'`App.tsx` : importer
 * `Experience` tire `RoomModel`, dont le `useGLTF.preload` part au chargement
 * du module. Un import statique où que ce soit hors de ce chunk ferait
 * télécharger le `.glb` avant l'écran de pré-sélection (issue #24).
 *
 * No initial camera pose is seeded: `<Suspense>` holds the first frame until
 * the .glb is parsed, and CameraRig places the camera on the first frame
 * after that from the glb's own `CameraStop_*` cameras. Nothing renders at
 * the origin in between.
 */
export default function App3D() {
  // Stable portal target for world-anchored <Html> content (bubbles) — kept
  // outside the canvas container so the HUD/panel stacking order is ours.
  const bubbleLayer = useRef<HTMLDivElement>(null!)

  return (
    <div className="stage">
      <Canvas
        camera={{ near: 0.05, far: 1000 }}
        onCreated={({ gl }) => {
          gl.toneMapping = TONE_MAPPING
          gl.outputColorSpace = OUTPUT_COLOR_SPACE
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
