import gsap from 'gsap'
import { useEffect, useRef, useState } from 'react'
import type { Object3D } from 'three'
import { DRAWER_EASE, DRAWER_OPEN_Z, DRAWER_TWEEN_S } from '@/config/cabinet'
import { PROJECTS } from '@/content/projects'
import {
  buildDrawerGroup,
  cabinetStopPresent,
  drawerClosedZ,
  drawerShouldBeOpen,
} from '@/lib/cabinetDrawer'
import { labelFontReady } from '@/lib/folderLabel'
import { buildFolders, type FolderHandle } from '@/lib/folders'
import { CabinetFolders } from '@/scene/CabinetFolders'
import { useInteraction } from '@/state/interaction'

/**
 * Le tiroir du haut de la commode s'ouvre tout seul à l'arrivée (issue #76).
 *
 * **Pourquoi automatiquement.** Le critère de succès de l'épique #12 est « un
 * projet en deux clics » : « Projets » dans la barre est le premier, le dossier
 * sera le second. Un clic dépensé à ouvrir le tiroir mangerait la promesse.
 *
 * **Le tiroir suit l'ARRÊT, pas la phase seule.** Il est ouvert dès lors que
 * l'arrêt courant est la commode et que le tour ne roule pas. `goToIndex` pose
 * `stopIndex` au DÉPART de la course (c'est ce qui allume l'item du menu en
 * partant) : conditionner sur la seule destination ouvrirait le tiroir à
 * l'instant où l'on s'en approche, et le fermerait à l'instant où l'on s'en
 * va — ici il attend PARKED, et se referme au premier tour de molette.
 *
 * `phase !== 'touring'` plutôt que `phase === 'parked'` : quand le dossier
 * volera vers la caméra (#82), la phase passera à PANEL et le tiroir doit
 * rester ouvert derrière lui.
 */
interface CabinetDrawerProps {
  /** La scène du `.glb`, telle que `RoomModel` la passe à `onReady`. */
  scene: Object3D
}

export function CabinetDrawer({ scene }: CabinetDrawerProps) {
  const tween = useRef<gsap.core.Tween | null>(null)
  // Les dossiers ne peuvent pas être construits au rendu : ils attendent la
  // fonte de leurs étiquettes. Ils remontent donc par un état, et le survol
  // (#81) se monte derrière eux.
  const [folders, setFolders] = useState<FolderHandle[]>([])

  useEffect(() => {
    if (!cabinetStopPresent(scene)) return

    const group = buildDrawerGroup(scene)
    if (!group) return

    const closedZ = drawerClosedZ(group)

    // Un dossier par projet (#80). L'attente de la fonte est load-bearing :
    // `canvas` ne connaît pas `font-display: swap` et peindrait l'étiquette
    // dans la police de secours, sans rien signaler, une fois pour toutes.
    //
    // Elle ne retarde rien en pratique, et surtout elle ne rend pas `?stop=`
    // indéterministe : mesuré, les fontes sont prêtes à 273 ms quand ce code
    // s'exécute à 3874 ms — le .glb de 3 Mo met bien plus longtemps à arriver
    // que deux fontes. Le tiroir, lui, n'attend pas : il coulisse pendant ce
    // temps.
    let cancelled = false
    void labelFontReady().then(() => {
      if (!cancelled) setFolders(buildFolders(group, PROJECTS))
    })
    const setCabinet = useInteraction.getState().setCabinet

    const apply = (open: boolean, instant: boolean) => {
      tween.current?.kill()
      const z = open ? closedZ + DRAWER_OPEN_Z : closedZ

      // Fermé se déclare au DÉPART du mouvement, ouvert à son ARRIVÉE : entre
      // les deux le tiroir n'est ni l'un ni l'autre, et les dossiers (#80, #81)
      // ne doivent pas être saisissables pendant qu'ils coulissent.
      if (!open) setCabinet('closed')

      if (instant) {
        group.position.z = z
        if (open) setCabinet('open')
        return
      }

      tween.current = gsap.to(group.position, {
        z,
        duration: DRAWER_TWEEN_S,
        ease: DRAWER_EASE,
        onComplete: () => {
          tween.current = null
          if (open) setCabinet('open')
        },
      })
    }

    // L'état de départ est POSÉ, jamais joué.
    //
    // C'est ce qui rend `?stop=Cabinet` déterministe pour la boucle de
    // comparaison de rendus : elle capture par URL, et une capture ne doit pas
    // dépendre de l'instant où elle tombe dans un fondu — même discipline que
    // le preloader, qui se démonte au lieu de se cacher.
    //
    // Ne PAS étendre la règle à toute la session sous `?stop=` : ce paramètre
    // sert aussi de lien partageable, et un visiteur arrivé par un lien
    // perdrait alors l'animation partout. Seul le premier placement est posé.
    //
    // Load-bearing : `<CabinetDrawer>` est monté APRÈS `<CameraRig>` dans
    // Experience, dont l'effet de placement initial publie l'arrêt et la phase.
    // Inverser les deux rendrait cette lecture aveugle, et le tiroir
    // s'ouvrirait en fondu au premier rendu d'un `?stop=Cabinet`.
    const first = useInteraction.getState()
    let open = drawerShouldBeOpen(first.phase, first.stopIndex)
    apply(open, true)

    const unsub = useInteraction.subscribe((state) => {
      const next = drawerShouldBeOpen(state.phase, state.stopIndex)
      if (next === open) return
      open = next
      apply(next, false)
    })

    // Sonde de dev, comme `__rigDebug` : la course du tiroir se voit à l'œil
    // sur le plan de la commode, et nulle part ailleurs. De tous les autres
    // arrêts, c'est la seule façon de savoir s'il s'est bien refermé.
    if (import.meta.env.DEV) {
      ;(window as unknown as Record<string, unknown>).__cabinetDebug = {
        get z() {
          return group.position.z - closedZ
        },
        get state() {
          return useInteraction.getState().cabinet
        },
      }
    }

    return () => {
      cancelled = true
      unsub()
      tween.current?.kill()
      tween.current = null
    }
  }, [scene])

  return <CabinetFolders folders={folders} />
}
