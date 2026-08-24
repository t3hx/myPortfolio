import { useCallback, useEffect, useState, type RefObject } from 'react'
import type { Object3D, Vector3 } from 'three'
import { CAMERA_STOPS } from '@/config/cameraStops'
import { BUBBLES, bubbleKicker, bubblePages } from '@/content/bubbles'
import { PROJECTS } from '@/content/projects'
import { resolveBubbleAnchors } from '@/lib/bubbleAnchors'
import { useLocale } from '@/state/locale'
import { reducedMotion } from '@/lib/clock'
import { typeDuration } from '@/lib/typewriter'
import { readStopTransform, type StopTransform } from '@/lib/stops'
import { TELESCOPE_MOON_CAMERA } from '@/config/telescope'
import { Bubble } from '@/scene/Bubble'
import { CabinetDrawer } from '@/scene/CabinetDrawer'
import { CameraRig } from '@/scene/CameraRig'
import { CatAlive } from '@/scene/CatAlive'
import { DeskAlive } from '@/scene/DeskAlive'
import { Curtains } from '@/scene/Curtains'
import { NanoLeaf } from '@/scene/NanoLeaf'
import { TelescopeHover } from '@/scene/TelescopeHover'
import { TelescopePing } from '@/scene/TelescopePing'
import { Outlines } from '@/scene/Outlines'
import { RoomModel } from '@/scene/RoomModel'
import { useInteraction } from '@/state/interaction'

/**
 * Scene contents. Navigation is stop-to-stop (CameraRig owns the wheel and
 * commands GSAP strokes); panels keep their native wheel because the rig
 * ignores events targeting them.
 *
 * Les dix bulles narratives (issue #48) sont montées ENSEMBLE et pilotées par
 * leur seul `visible` : démonter celle de l'arrêt qu'on quitte emporterait son
 * fondu de sortie avec elle. Tant qu'elle n'est ni visible ni en train de
 * sortir, une `<Bubble>` ne rend rien — neuf composants nuls ne coûtent rien.
 *
 * Une bulle n'apparaît qu'à l'arrêt (`phase === 'parked'`), jamais indexée sur
 * un défilement continu : la phase TELESCOPE, elle aussi, l'efface.
 */
interface ExperienceProps {
  /** Stable DOM layer OUTSIDE the ScrollControls scroller — see App.tsx. */
  bubbleLayer: RefObject<HTMLDivElement>
}

export function Experience({ bubbleLayer }: ExperienceProps) {
  const [stops, setStops] = useState<StopTransform[]>([])
  // La lune est lue à part : sa caméra existe dans le `.glb` mais pas dans le
  // tour (#113). Une seule lecture, au chargement, comme les ancres de bulles.
  const [moon, setMoon] = useState<StopTransform | null>(null)
  // La scène est conservée : le tiroir de la commode (#76) a besoin du graphe
  // lui-même, pas seulement des poses qu'on en a extraites.
  const [scene, setScene] = useState<Object3D | null>(null)
  const [anchors, setAnchors] = useState<(Vector3 | null)[]>([])
  const phase = useInteraction((s) => s.phase)
  const stopIndex = useInteraction((s) => s.stopIndex)
  const setReady = useInteraction((s) => s.setReady)
  const dialoguePage = useInteraction((s) => s.dialoguePage)
  const startDialogue = useInteraction((s) => s.startDialogue)
  const revealed = useInteraction((s) => s.revealed)
  const locale = useLocale((s) => s.locale)

  const onReady = useCallback(
    (ordered: StopTransform[], scene: Object3D) => {
      setStops(ordered)
      setScene(scene)
      setMoon(readStopTransform(scene, TELESCOPE_MOON_CAMERA))
      // Une seule fois : la dé-projection ne dépend que des caméras du .glb et
      // des boîtes englobantes, tous deux figés après le chargement.
      setAnchors(resolveBubbleAnchors(scene, ordered))
      setReady()
    },
    [setReady],
  )

  const parkedStop = phase === 'parked' ? CAMERA_STOPS[stopIndex]?.label : undefined

  /**
   * Le dialogue repart au premier temps à CHAQUE arrivée (#122). Les dix
   * bulles restent montées ensemble — les démonter emporterait leur fondu de
   * sortie — donc rien ne remet leur pagination à zéro tout seul : une bulle
   * revisitée rouvrirait sur sa dernière page.
   */
  useEffect(() => {
    if (!parkedStop || !revealed) return
    const bubble = BUBBLES.find((b) => b.stop === parkedStop)
    if (!bubble) return
    // Sous « mouvement réduit », des durées nulles : ça dit exactement ce qu'on
    // veut dire — la frappe ne dure pas — et le store n'a pas à avoir son
    // propre avis sur le mouvement.
    const pages = bubblePages(bubble, PROJECTS.length, locale)
    startDialogue(reducedMotion() ? pages.map(() => 0) : pages.map(typeDuration))
    // `revealed` est une dépendance : le dialogue ne part QU'UNE FOIS l'écran
    // découvert, sinon la première phrase s'écrit derrière le préchargeur.
  }, [parkedStop, locale, revealed, startDialogue])

  return (
    <>
      <RoomModel onReady={onReady} />

      {/* Stop-to-stop navigation model (2026-08-05): no ScrollControls — the
          wheel is owned and gestures command GSAP strokes; see CameraRig. */}
      {stops.length > 0 && <CameraRig stops={stops} moon={moon} />}

      {/* Le tiroir de la commode s'ouvre à l'arrivée sur l'arrêt Cabinet (#76).
          Monté APRÈS CameraRig : celui-ci publie l'arrêt initial dans son
          effet, et le tiroir lit cet état au montage pour se poser sans
          animation. */}
      {scene && <CabinetDrawer scene={scene} />}

      {/* Le chat vivant (#37) : pupilles, queue, clignement. Que des
          transformations — aucun matériau touché, donc aucun risque pour le
          rendu cuit. */}
      {scene && <CatAlive scene={scene} />}

      {/* Le bureau qui respire (#35) : les ventilateurs tournent, la tasse
          fume. La fumée est de la géométrie AJOUTÉE, pas un matériau cuit
          modifié — le pipeline non éclairé n'est pas touché. */}
      {scene && <DeskAlive scene={scene} />}

      {/* Le dégradé des tuiles NanoLeaf (#36) : la seule animation du lot qui
          touche un matériau cuit, et de la façon la plus étroite possible —
          `onBeforeCompile` sur un seul matériau nommé. */}
      {scene && <NanoLeaf scene={scene} />}

      {/* Les rideaux dans la brise (#38) : un déplacement de sommets sur le
          seul `Mat_Curtain`, dont la texture cuite reste intacte. */}
      {scene && <Curtains scene={scene} />}

      {/* Le cerne du télescope au survol (#106) : le seul objet interactif de
          son arrêt ne le disait pas. Ne rend rien — les lignes sont enfants de
          l'objet qu'elles cernent. */}
      {scene && <TelescopeHover scene={scene} />}

      {/* La pastille qui désigne le télescope (#106). En DOM et pas en 3D :
          la boucle de comparaison capture le tampon WebGL, où la référence
          Blender ne contient aucun indice d'interface. */}
      {scene && <TelescopePing scene={scene} portal={bubbleLayer} />}

      {/* Contours spike: ?outline=off|hull|edges|both — see Outlines.tsx. */}
      {stops.length > 0 && <Outlines />}

      {BUBBLES.map((bubble, i) => {
        const anchor = anchors[i]
        if (!anchor) return null
        const pages = bubblePages(bubble, PROJECTS.length, locale)
        return (
          <Bubble
            key={bubble.stop}
            anchor={anchor}
            portal={bubbleLayer}
            visible={parkedStop === bubble.stop}
            kicker={bubbleKicker(BUBBLES, i, locale)}
            maxWidth={bubble.maxWidth}
            tick={bubble.tick}
            tilt={bubble.tilt}
            hasNext={parkedStop === bubble.stop && dialoguePage + 1 < pages.length}
          >
            {/* Le tiroir vide n'ouvre aucune fiche : son repli passe par la
                bulle de la commode, pas par un écran (#78).

                La page courante du dialogue (#122). Une seule bulle est
                visible à la fois, donc un seul index suffit ; les neuf autres
                le reçoivent aussi mais ne rendent rien. Le `min` protège
                l'instant où l'arrêt a changé et où le nombre de pages n'a pas
                encore été republié. */}
            {pages[Math.min(dialoguePage, pages.length - 1)]}
          </Bubble>
        )
      })}
    </>
  )
}
