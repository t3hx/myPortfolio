import { useCallback, useState, type RefObject } from 'react'
import type { Object3D, Vector3 } from 'three'
import { CAMERA_STOPS } from '@/config/cameraStops'
import { BUBBLES, bubbleKicker, bubbleText } from '@/content/bubbles'
import { PROJECTS } from '@/content/projects'
import { resolveBubbleAnchors } from '@/lib/bubbleAnchors'
import { useLocale } from '@/state/locale'
import type { StopTransform } from '@/lib/stops'
import { Bubble } from '@/scene/Bubble'
import { CabinetDrawer } from '@/scene/CabinetDrawer'
import { CameraRig } from '@/scene/CameraRig'
import { CatAlive } from '@/scene/CatAlive'
import { DeskAlive } from '@/scene/DeskAlive'
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
 * Les onze bulles narratives (issue #48) sont montées ENSEMBLE et pilotées par
 * leur seul `visible` : démonter celle de l'arrêt qu'on quitte emporterait son
 * fondu de sortie avec elle. Tant qu'elle n'est ni visible ni en train de
 * sortir, une `<Bubble>` ne rend rien — dix composants nuls ne coûtent rien.
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
  // La scène est conservée : le tiroir de la commode (#76) a besoin du graphe
  // lui-même, pas seulement des poses qu'on en a extraites.
  const [scene, setScene] = useState<Object3D | null>(null)
  const [anchors, setAnchors] = useState<(Vector3 | null)[]>([])
  const phase = useInteraction((s) => s.phase)
  const stopIndex = useInteraction((s) => s.stopIndex)
  const setReady = useInteraction((s) => s.setReady)
  const locale = useLocale((s) => s.locale)

  const onReady = useCallback(
    (ordered: StopTransform[], scene: Object3D) => {
      setStops(ordered)
      setScene(scene)
      // Une seule fois : la dé-projection ne dépend que des caméras du .glb et
      // des boîtes englobantes, tous deux figés après le chargement.
      setAnchors(resolveBubbleAnchors(scene, ordered))
      setReady()
    },
    [setReady],
  )

  const parkedStop = phase === 'parked' ? CAMERA_STOPS[stopIndex]?.label : undefined

  return (
    <>
      <RoomModel onReady={onReady} />

      {/* Stop-to-stop navigation model (2026-08-05): no ScrollControls — the
          wheel is owned and gestures command GSAP strokes; see CameraRig. */}
      {stops.length > 0 && <CameraRig stops={stops} />}

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
          >
            {/* Le tiroir vide n'ouvre aucune fiche : son repli passe par la
                bulle de la commode, pas par un écran (#78). */}
            {bubbleText(bubble, PROJECTS.length, locale)}
          </Bubble>
        )
      })}
    </>
  )
}
