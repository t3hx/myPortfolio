import { Canvas } from '@react-three/fiber'
import { Suspense, useRef } from 'react'
import { CLEAR_COLOR, OUTPUT_COLOR_SPACE, TONE_MAPPING } from '@/config/renderPipeline'
import { Experience } from '@/scene/Experience'
import { captureMode, viewMode } from '@/lib/viewMode'
import { Hud } from '@/ui/Hud'
import { Menu } from '@/ui/Menu'
import { ProjectSheet } from '@/ui/ProjectSheet'

/**
 * L'expérience 3D complète. One Canvas, one render camera. The scene is
 * pre-baked unlit (see renderPipeline.ts): NO lights, NO shadows,
 * NoToneMapping — Blender's AgX is already cooked into the textures.
 *
 * Ce module n'est atteint QUE par le `React.lazy` d'`App.tsx` (issue #24) : un
 * import statique où que ce soit hors de ce chunk ferait atterrir three / R3F /
 * drei dans le chunk d'entrée, que le visiteur choisisse la 3D ou non. Le
 * preloader, lui, est monté par `App.tsx` HORS de ce module : il doit couvrir
 * le chargement de ce chunk-ci avant même de couvrir celui du `.glb` (#25).
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
        // `?capture` seulement (#45) : sans `preserveDrawingBuffer`, le
        // `toDataURL()` de la boucle de comparaison rend du noir, et l'allumer
        // en permanence coûterait une copie de tampon à chaque image.
        gl={{ preserveDrawingBuffer: captureMode }}
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
      {/* Le HUD est l'outillage du spike : bandeau de phase, rail de stops,
          boutons de test des phases. `?debug` le déclarait déjà (viewMode.ts)
          mais rien ne branchait le fil, alors il s'affichait toujours — et son
          rail se superposait pixel pour pixel à la barre de menu, les deux à
          z-index 200. L'issue #26 le disait : le rail est un prototype de
          diagnostic, pas la navigation. */}
      {viewMode === 'tour' && <Hud />}
      <Menu />
      {/* La fiche projet (#83) est montée APRÈS la barre : elle la couvre, comme
          l'empilement panneaux 300 > barre 200 l'impose. Elle ne rend rien tant
          qu'aucun dossier n'a été ouvert. */}
      <ProjectSheet />
    </div>
  )
}
