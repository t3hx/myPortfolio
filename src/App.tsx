import { Suspense, lazy, useState } from 'react'
import {
  clearStoredChoice,
  isWebGLAvailable,
  readStoredChoice,
  resolveExperience,
  storeChoice,
  type ExperienceChoice,
  type ExperienceResolution,
} from '@/lib/experienceChoice'
import { ClassicApp } from '@/ui/ClassicApp'
import { Preselection } from '@/ui/Preselection'

/**
 * Aiguillage racine (issue #24) : pré-sélection → expérience 3D ou classique.
 *
 * L'import dynamique d'App3D est OBLIGATOIRE, pas une optimisation :
 * `RoomModel` lance `useGLTF.preload` dès l'évaluation de son module. Le
 * code-splitting est donc la seule garantie que le `.glb` (3 Mo) — et tout
 * three/r3f/drei — ne partent qu'APRÈS le choix du visiteur. La route
 * classique, elle, ne doit jamais créer de contexte WebGL (voir
 * experienceChoice.ts pour l'ordre choix mémorisé / sonde).
 */
const App3D = lazy(() => import('@/App3D'))

function resolveFromBrowser(): ExperienceResolution {
  return resolveExperience({
    search: new URLSearchParams(window.location.search),
    stored: readStoredChoice(),
    probeWebGL: isWebGLAvailable,
  })
}

export default function App() {
  const [resolution, setResolution] = useState<ExperienceResolution>(resolveFromBrowser)

  const choose = (choice: ExperienceChoice) => {
    storeChoice(choice)
    setResolution({ kind: 'route', choice, reason: 'chosen' })
  }

  // Rouvre l'écran ; si WebGL est indisponible, re-résoudre retombe sur la
  // version classique (le bouton n'est d'ailleurs pas proposé dans ce cas).
  const reopen = () => {
    clearStoredChoice()
    setResolution(resolveFromBrowser())
  }

  if (resolution.kind === 'ask') {
    return <Preselection onChoose={choose} />
  }

  if (resolution.choice === 'classic') {
    return <ClassicApp autoFallback={resolution.reason === 'no-webgl'} onReopen={reopen} />
  }

  return (
    <Suspense fallback={<ChunkLoader />}>
      <App3D />
    </Suspense>
  )
}

/** Tient l'écran pendant le chargement du chunk 3D (le .glb a son loader à lui, dans le HUD). */
function ChunkLoader() {
  return (
    <div className="stage">
      <div className="loader">
        <span className="spinner" />
        <p>Chargement…</p>
      </div>
    </div>
  )
}
