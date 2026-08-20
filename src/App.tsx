import { Suspense, lazy, useEffect, useState } from 'react'
import {
  clearStoredChoice,
  isWebGLAvailable,
  readStoredChoice,
  resolveExperience,
  storeChoice,
  type ExperienceChoice,
  type ExperienceResolution,
} from '@/lib/experienceChoice'
import { useLocale } from '@/state/locale'
import { ClassicApp } from '@/ui/ClassicApp'
import { Preloader } from '@/ui/Preloader'
import { Preselection } from '@/ui/Preselection'

/**
 * Aiguillage racine (issue #24) : pré-sélection → expérience 3D ou classique.
 *
 * L'import dynamique d'App3D est OBLIGATOIRE, pas une optimisation : le
 * code-splitting est la seule garantie que three / r3f / drei — et le `.glb` de
 * 3 Mo qu'ils vont chercher — ne partent qu'APRÈS le choix du visiteur. La
 * route classique, elle, ne doit jamais créer de contexte WebGL (voir
 * experienceChoice.ts pour l'ordre choix mémorisé / sonde).
 *
 * Le preloader est monté ICI, hors du <Suspense> (issue #25). Il y a deux
 * attentes à couvrir — le chunk 3D, puis le `.glb` — et une seule est
 * mesurable. Le monter à l'intérieur d'App3D laissait la première à découvert :
 * mesuré à 306 ms d'écran nu en dev. Hors du <Suspense>, un seul preloader
 * traverse les deux et se démonte sur `ready`, quand la scène est reconstruite.
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
  const locale = useLocale((state) => state.locale)

  // `lang` du document (#33) — accessibilité et SEO. Écrit ICI et nulle part
  // ailleurs : `index.html` livre `lang="fr"` en dur, et le store peut résoudre
  // `en` dès le chargement. Deux endroits qui écrivent le même attribut
  // finiraient par diverger, et ce serait le premier rendu qui aurait tort —
  // celui qu'aucun test ne regarde.
  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

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
    <>
      <Suspense fallback={null}>
        <App3D />
      </Suspense>
      {/* Après App3D dans l'ordre du DOM, et z-index 400 : il recouvre le canvas
          jusqu'à sa première frame. */}
      <Preloader />
    </>
  )
}
