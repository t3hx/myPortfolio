import { useFrame, useThree } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { Box3, Object3D, Quaternion, Vector3 } from 'three'
import {
  CAT_EYES,
  CAT_HIGHLIGHTS,
  CAT_PUPILS,
  CAT_TAIL,
  PUPIL_LERP,
  PUPIL_TRAVEL,
} from '@/config/cat'
import { blinkScale, pupilOffset, tailOffset } from '@/lib/cat'

/**
 * Le chat vivant (issue #37) : les pupilles suivent la souris, la queue
 * balance, les yeux clignent.
 *
 * **Tout passe par des transformations, aucun matériau n'est touché.** C'est
 * ce qui rend cette animation sans risque pour la règle WYSIWYG : le rendu
 * reste le bake de Blender, seules des positions bougent.
 *
 * **Le repère est celui DU CHAT.** Le graphe du `.glb` est plat — les 157
 * nœuds sont racines — et toutes les parties du chat portent la même rotation,
 * ~52° autour de Y. Un décalage calculé en axes monde ferait donc glisser la
 * pupille de travers sur l'œil, et la queue onduler dans la mauvaise
 * direction. On tourne les décalages par cette rotation avant de les appliquer.
 *
 * **`prefers-reduced-motion` coupe TOUT, pupilles comprises.** J'avais d'abord
 * gardé le regard, en le rangeant du côté « déclenché par un geste » du critère
 * du design system. C'était le mauvais côté : un élément qui poursuit le
 * curseur bouge à chaque déplacement de souris, pour n'importe quelle raison,
 * y compris quand on traverse l'écran pour aller ailleurs. C'est précisément ce
 * dont se plaignent les personnes sensibles au mouvement. Un survol qui allume
 * un halo répond à une intention ; une pupille qui suit, non.
 *
 * Corollaire heureux : la boucle de comparaison de renders capture en mouvement
 * réduit (voir `playwright.config.ts`), donc le chat y est au repos — l'état
 * exact des rendus de référence. Sans cette coupure, le lissage du regard
 * n'avait pas fini de converger au moment de la capture et l'écart mesuré
 * variait d'une exécution à l'autre : 0,288 % puis 0,255 %.
 */
interface CatAliveProps {
  /** La scène du `.glb`, telle que `RoomModel` la passe à `onReady`. */
  scene: Object3D
}

/** Ce qu'on doit retenir d'une partie animée : son objet et son repos. Le
 *  repos est capturé UNE fois, au montage — le relire chaque image renverrait
 *  la valeur déjà animée, et le chat dériverait à chaque frame. */
interface Rest {
  object: Object3D
  base: Vector3
  baseScaleY: number
}

export function CatAlive({ scene }: CatAliveProps) {
  const pointer = useThree((state) => state.pointer)

  const rig = useMemo(() => {
    const find = (name: string) => scene.getObjectByName(name) ?? null
    const eyes = CAT_EYES.map(find)
    const pupils = CAT_PUPILS.map(find)
    const highlights = CAT_HIGHLIGHTS.map(find)
    const tail = CAT_TAIL.map(find)

    // Un nom absent est signalé et la partie est simplement sautée — même
    // discipline qu'une caméra manquante dans `extractStops` : un ré-export qui
    // renomme un objet ne doit pas faire tomber la scène, mais il ne doit pas
    // non plus disparaître en silence.
    for (const [name, object] of [
      ...CAT_EYES.map((n, i) => [n, eyes[i]] as const),
      ...CAT_PUPILS.map((n, i) => [n, pupils[i]] as const),
      ...CAT_TAIL.map((n, i) => [n, tail[i]] as const),
    ]) {
      if (!object) console.warn(`[cat] objet « ${name} » absent du .glb — partie ignorée`)
    }

    const rest = (object: Object3D | null): Rest | null =>
      object ? { object, base: object.position.clone(), baseScaleY: object.scale.y } : null

    // La rotation du chat, lue sur le premier objet trouvé : c'est elle qui
    // convertit un décalage « gauche / haut vu du chat » en décalage monde.
    const facing = new Quaternion()
    const anyPart = eyes.find(Boolean) ?? tail.find(Boolean)
    if (anyPart) facing.copy(anyPart.quaternion)

    // Le rayon de l'œil est MESURÉ, pas écrit en dur : un ré-export qui
    // redimensionne le chat rendrait une constante fausse sans rien dire.
    let eyeRadius = 0
    const box = new Box3()
    for (const eye of eyes) {
      if (!eye) continue
      box.setFromObject(eye)
      eyeRadius = Math.max(eyeRadius, (box.max.x - box.min.x) / 2)
    }

    return {
      facing,
      travel: eyeRadius * PUPIL_TRAVEL,
      eyes: eyes.map(rest).filter((r): r is Rest => r !== null),
      pupils: pupils.map(rest).filter((r): r is Rest => r !== null),
      highlights: highlights.map(rest).filter((r): r is Rest => r !== null),
      tail: tail.map(rest).filter((r): r is Rest => r !== null),
    }
  }, [scene])

  const reduced = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches, [])

  const look = useRef(new Vector3())
  const offset = useMemo(() => new Vector3(), [])

  useFrame((_, delta) => {
    if (reduced) return

    // --- Les pupilles suivent le curseur ------------------------------------
    const [x, y] = pupilOffset(pointer.x, pointer.y, rig.travel)
    // Lissage indépendant de la fréquence d'image : un `lerp` à coefficient
    // fixe accélère avec les FPS, et le chat regarderait plus vite sur un
    // écran 120 Hz que sur un 60.
    const k = 1 - Math.exp(-PUPIL_LERP * delta)
    look.current.x += (x - look.current.x) * k
    look.current.y += (y - look.current.y) * k

    offset.set(look.current.x, look.current.y, 0).applyQuaternion(rig.facing)
    for (const part of [...rig.pupils, ...rig.highlights]) {
      part.object.position.copy(part.base).add(offset)
    }

    const time = performance.now() / 1000

    // --- Le clignement ------------------------------------------------------
    //
    // Il n'y a AUCUNE paupière dans le `.glb` : le clignement est un écrasement
    // vertical de l'œil, de la pupille et du reflet. Les trois sont écrasés
    // ensemble et autour de leur propre centre — ils partagent la même hauteur
    // à 3 millimètres près, donc l'approximation ne se voit pas, et elle évite
    // de fabriquer un groupe au runtime pour trois objets.
    //
    // La rotation du chat est purement autour de Y, donc son axe local Y est
    // l'axe vertical du monde : `scale.y` écrase bien dans le bon sens.
    const squash = blinkScale(time)
    for (const part of [...rig.eyes, ...rig.pupils, ...rig.highlights]) {
      part.object.scale.y = part.baseScaleY * squash
    }

    // --- La queue -----------------------------------------------------------
    rig.tail.forEach((part, i) => {
      offset.set(tailOffset(i, rig.tail.length, time), 0, 0).applyQuaternion(rig.facing)
      part.object.position.copy(part.base).add(offset)
    })
  })

  return null
}
