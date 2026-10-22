import { useEffect, useState } from 'react'

/** L'utilisateur demande moins de mouvement. Lu au rendu, pas seulement dans
 *  un effet : c'est ce qui permet de décider dès la PREMIÈRE image. */
export function reducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * L'heure courante, republiée à chaque image tant que `active` — **une horloge
 * sans origine à elle**.
 *
 * C'est toute la différence avec la version précédente, et c'est ce qui a rendu
 * le dialogue fiable (#122). Une horloge qui possède son propre départ possède
 * aussi son propre avis sur « l'animation est-elle finie ? » — et quand deux
 * endroits ont un avis, il faut le faire circuler, donc il arrive en retard.
 * Ici l'origine vit dans le store, avec la page ; ce composant ne fait que
 * demander « quelle heure est-il », ce à quoi personne ne peut répondre faux.
 *
 * La boucle s'arrête d'elle-même dès que l'appelant n'a plus besoin d'images :
 * une frappe finie, une bulle invisible, un écran encore couvert.
 */
export function useNow(active: boolean): number {
  const [now, setNow] = useState(() => (typeof performance === 'undefined' ? 0 : performance.now()))

  useEffect(() => {
    if (!active) return
    let frame = 0
    const tick = () => {
      setNow(performance.now())
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [active])

  return now
}

/**
 * Le temps écoulé d'une frappe **locale** : celle que personne d'autre n'a
 * besoin d'arbitrer.
 *
 * Le dialogue des bulles n'utilise pas ce crochet, et c'est délibéré : là-bas,
 * l'entrée doit savoir si la frappe est en cours pour décider ce que vaut un
 * geste, donc l'origine du temps vit dans le store avec la page. Ici — la
 * phrase de la lune, dans une visée qui ne reçoit aucune entrée — il n'y a
 * qu'un lecteur, donc une horloge locale suffit.
 *
 * Le minuteur sert d'unique signal de fin : il arrête la boucle d'images sans
 * qu'on ait à comparer le temps courant à lui-même pour savoir s'il faut
 * continuer.
 */
export function useTyping(active: boolean, duration: number): number {
  const [startedAt, setStartedAt] = useState(0)
  const [finished, setFinished] = useState(false)

  useEffect(() => {
    if (!active) {
      setStartedAt(0)
      setFinished(false)
      return
    }
    setStartedAt(performance.now())
    setFinished(duration <= 0)
    const timer = window.setTimeout(() => setFinished(true), duration)
    return () => window.clearTimeout(timer)
  }, [active, duration])

  const now = useNow(active && !finished)
  if (!active) return 0
  return finished ? duration : now - startedAt
}
