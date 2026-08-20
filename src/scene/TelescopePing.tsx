import { Html } from '@react-three/drei'
import { useMemo, type RefObject } from 'react'
import { Box3, type Object3D, Vector3 } from 'three'
import { CAMERA_STOPS } from '@/config/cameraStops'
import { PING_RISE, TELESCOPE_OBJECT } from '@/config/telescope'
import { useInteraction } from '@/state/interaction'

/**
 * La pastille qui désigne le télescope (issue #106).
 *
 * Le télescope est le seul objet cliquable de son arrêt, et rien ne le disait
 * avant qu'on l'ait déjà survolé — or on ne survole que ce qu'on soupçonne.
 *
 * **Elle vit dans le DOM, et c'est une contrainte, pas une commodité.** La
 * boucle de comparaison capture le tampon WebGL de l'arrêt `Telescope`, dont la
 * référence Blender ne contient évidemment aucun indice d'interface : tout ce
 * qu'on dessinerait EN 3D au repos ferait dériver cette mesure. Le couper sous
 * `prefers-reduced-motion` pour sauver la mesure aurait privé d'indication les
 * personnes sensibles au mouvement — c'est-à-dire laisser le test décider du
 * design. En DOM, la question ne se pose pas : la boucle ne voit pas la page.
 *
 * Sous mouvement réduit, le point reste et l'anneau disparaît : l'indication
 * survit, l'animation non.
 *
 * Elle s'efface au survol — le cerne prend le relais et l'indice a fait son
 * travail — et pendant toute l'excursion.
 */
interface TelescopePingProps {
  /** La scène du `.glb`, telle que `RoomModel` la passe à `onReady`. */
  scene: Object3D
  /** La couche DOM stable d'App3D, hors du conteneur du canvas. */
  portal: RefObject<HTMLDivElement>
}

/** `label` de l'arrêt où la pastille a un sens — le seul d'où le clic répond. */
const TELESCOPE_STOP = 'Telescope'

export function TelescopePing({ scene, portal }: TelescopePingProps) {
  const phase = useInteraction((s) => s.phase)
  const stopIndex = useInteraction((s) => s.stopIndex)
  const hovered = useInteraction((s) => s.telescopeHovered)

  const anchor = useMemo(() => {
    const object = scene.getObjectByName(TELESCOPE_OBJECT)
    if (!object) {
      console.warn(`[telescope] « ${TELESCOPE_OBJECT} » absent du .glb — pas de pastille`)
      return null
    }
    const box = new Box3().setFromObject(object)
    const center = box.getCenter(new Vector3())
    // Au-dessus du tube plutôt qu'en son milieu : posée dessus, elle se confond
    // avec lui au lieu de le désigner.
    center.y += (box.max.y - box.min.y) * PING_RISE
    return center
  }, [scene])

  const atStop = phase === 'parked' && CAMERA_STOPS[stopIndex]?.label === TELESCOPE_STOP

  // Garde anti-repli : drei résout sa cible AU RENDER, et sans elle il
  // portalerait dans le conteneur du canvas — même piège que la bulle.
  if (!anchor || !atStop || hovered || !portal.current) return null

  return (
    <Html position={anchor} center portal={portal} zIndexRange={[40, 0]}>
      <span className="ping" aria-hidden="true">
        <span className="ping__ring" />
        <span className="ping__dot" />
      </span>
    </Html>
  )
}
