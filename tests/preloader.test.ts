import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { PRELOAD_OUT_MS } from '@/ui/Preloader'
import { useLoading } from '@/state/loading'

/**
 * Même piège que pour la bulle : le démontage différé (Preloader.tsx) et le
 * fondu CSS (.preload--out, durée --t-preload-out) sont deux implémentations du
 * même budget. Désynchronisés, le preloader se démonte en plein fondu — ou
 * traîne invisible AU-DESSUS du canvas.
 */
describe('preloader exit budget', () => {
  it('PRELOAD_OUT_MS matches --t-preload-out in tokens.css', () => {
    const css = readFileSync('src/styles/tokens.css', 'utf8')
    const m = css.match(/--t-preload-out:\s*(\d+)ms/)
    expect(m).not.toBeNull()
    expect(Number(m![1])).toBe(PRELOAD_OUT_MS)
  })
})

/**
 * La progression est le seul contenu du preloader : une barre qui recule ou qui
 * invente un pourcentage est précisément ce que la DoD de #25 interdit.
 */
describe('loading progress', () => {
  const reset = () => useLoading.setState({ loaded: 0, total: 0, fraction: 0 })

  it('reports the byte fraction of the .glb', () => {
    reset()
    useLoading.getState().report(1_479_194, 2_958_388)
    expect(useLoading.getState().fraction).toBeCloseTo(0.5)
  })

  it('never goes backwards', () => {
    reset()
    const { report } = useLoading.getState()
    report(2_000_000, 2_958_388)
    report(100, 2_958_388) // une relecture tardive, ou un total réévalué
    expect(useLoading.getState().fraction).toBeCloseTo(2_000_000 / 2_958_388)
  })

  it('stays at zero when the server gives no Content-Length', () => {
    reset()
    // `lengthComputable` faux → total 0 : la barre passe en indéterminé plutôt
    // que d'afficher un pourcentage qu'on ne connaît pas.
    useLoading.getState().report(1_000_000, 0)
    expect(useLoading.getState().fraction).toBe(0)
    expect(useLoading.getState().total).toBe(0)
  })

  it('clamps a total that under-reports the body', () => {
    reset()
    useLoading.getState().report(3_000_000, 2_958_388)
    expect(useLoading.getState().fraction).toBe(1)
  })
})

/**
 * CE QUE LE PRÉCHARGEUR DÉCOUVRE. `ready` allume son fondu ; il ne veut pas
 * dire « la scène est parsée » mais « une image de la pièce est à l'écran, à la
 * pose que Blender a composée ». Émis au parsing, il découvrait la pièce vue
 * depuis la caméra PAR DÉFAUT de R3F, à l'origine, face au fond de la pièce —
 * mesuré au chargement, image par image : à t = 1662 ms le préchargeur était
 * à 0,73 d'opacité et la caméra encore à (0, 0, 5). Le visiteur voyait la pièce
 * en 3D avant de voir l'écran, ce que toute l'intro existe pour éviter.
 *
 * Deux pièces, et aucune ne suffit seule ; on ne peut pas les vérifier sans
 * navigateur, alors on verrouille leur présence dans le code — même discipline
 * que la garde de mouvement réduit du chat.
 */
describe('what the preloader uncovers', () => {
  it('announces the discovery from a drawn frame, never from the parse', () => {
    const experience = readFileSync('src/scene/Experience.tsx', 'utf8')
    const gate = readFileSync('src/scene/ReadyGate.tsx', 'utf8')
    // Le verrou annonce depuis la boucle d'images, pas depuis un effet.
    expect(gate).toMatch(/useFrame\([\s\S]*setReady\(\)/)
    // Il est monté avec les arrêts : dans la même validation que `CameraRig`,
    // dont l'effet de mise en page a déjà posé la caméra.
    expect(experience).toMatch(/stops\.length > 0 && <ReadyGate \/>/)
    // Et `onReady` ne l'annonce plus, SAUF s'il n'y a aucun arrêt à poser :
    // `CameraRig` ne monterait pas, et personne n'annoncerait jamais rien.
    const announcements = experience.match(/setReady\(\)/g) ?? []
    expect(announcements).toHaveLength(1)
    expect(experience).toMatch(/if \(ordered\.length === 0\) \{[\s\S]*setReady\(\)/)
  })

  it('places the camera in a layout effect, before any frame of its commit', () => {
    const rig = readFileSync('src/scene/CameraRig.tsx', 'utf8')
    // Un effet passif s'exécute après la peinture de sa propre validation :
    // l'image de la caméra par défaut pouvait donc être peinte avant la pose.
    const initial = rig.slice(rig.indexOf('Placement initial'))
    expect(initial.slice(0, initial.indexOf('applyPose'))).toContain('useLayoutEffect(')
  })
})
