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
        {/* Une main qui clique, et non plus une pastille. Le point disait
            « ici » ; la main dit « ici, et clique » — la seule chose que le
            télescope attend, et que rien d'autre dans la pièce n'enseigne.

            `currentColor` : la couleur vient du CSS, avec le reste du halo. */}
        <svg
          className="ping__hand"
          viewBox="0 0 256 256"
          xmlns="http://www.w3.org/2000/svg"
          focusable="false"
        >
          <path
            fill="currentColor"
            d="M60 76a56 56 0 0 1 112 0a4 4 0 0 1-8 0a48 48 0 0 0-96 0a4 4 0 1 1-8 0m136 48a23.88 23.88 0 0 0-16.07 6.19A24 24 0 0 0 140 114.13V76a24 24 0 0 0-48 0v94l-11.26-18.06A24 24 0 0 0 39.22 176l29.32 50a4 4 0 0 0 6.9-4l-29.31-50a16 16 0 0 1 27.72-16l.07.12l18.68 30A4 4 0 0 0 100 184V76a16 16 0 0 1 32 0v68a4 4 0 0 0 8 0v-12a16 16 0 0 1 32 0v20a4 4 0 0 0 8 0v-4a16 16 0 0 1 32 0v36c0 22.66-7.51 38.06-7.58 38.21a4 4 0 0 0 1.79 5.37a4.05 4.05 0 0 0 1.79.42a4 4 0 0 0 3.58-2.21c.34-.69 8.42-17.13 8.42-41.79v-36a24 24 0 0 0-24-24"
          />
        </svg>
      </span>
    </Html>
  )
}
