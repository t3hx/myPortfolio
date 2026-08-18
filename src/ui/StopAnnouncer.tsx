import { CAMERA_STOPS } from '@/config/cameraStops'
import { BUBBLES, bubbleAnnouncement } from '@/content/bubbles'
import { useInteraction } from '@/state/interaction'

/**
 * La voix du tour (issue #49) : une région live qui dit la bulle de l'arrêt au
 * moment où la caméra s'y pose.
 *
 * Pourquoi une région dédiée plutôt que de rendre `.bubble-layer` elle-même
 * live : la bulle visible est rendue par `<Html>` de drei, c'est-à-dire par une
 * RACINE REACT À PART, dans un div que drei crée et insère lui-même — l'ordre
 * exact des mutations (insertion du conteneur, puis commit du texte) n'est pas
 * le nôtre, et la couche héberge en plus la bulle sortante pendant ses 200 ms
 * de fondu. Ici, un simple nœud texte dans notre arbre : ce qui est annoncé est
 * ce que le composant rend.
 *
 * Trois choses portent le comportement :
 *
 * - **Le div est monté en permanence**, texte vide compris. Une région live
 *   n'annonce que ce qui CHANGE après sa création ; la monter avec le message
 *   déjà dedans ne dirait rien.
 * - **Le retour à la chaîne vide hors `parked` est utile** : il fait du retour
 *   au même arrêt un vrai changement de contenu, donc une nouvelle annonce.
 *   Sans lui, revenir sur ses pas resterait silencieux.
 * - **Le texte n'existe qu'ici pour l'arbre d'accessibilité** : la bulle peinte
 *   est `aria-hidden` (Bubble.tsx), sinon la même phrase serait à la fois
 *   annoncée et lue une seconde fois à la navigation.
 *
 * `phase === 'parked'` est la seule condition : pendant le trajet (`touring`)
 * la bulle n'est pas affichée, et TELESCOPE comme PANEL l'effacent aussi.
 * Fermer un panneau ramène à `parked` et redit la bulle — c'est voulu, on
 * revient à la pièce et l'annonce resitue l'arrêt.
 */
export function StopAnnouncer() {
  const phase = useInteraction((s) => s.phase)
  const stopIndex = useInteraction((s) => s.stopIndex)

  const label = CAMERA_STOPS[stopIndex]?.label
  const index = BUBBLES.findIndex((b) => b.stop === label)
  const message = phase === 'parked' ? bubbleAnnouncement(BUBBLES, index) : ''

  return (
    <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
      {message}
    </div>
  )
}
