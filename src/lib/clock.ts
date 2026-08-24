import { useEffect, useState } from 'react'

/**
 * L'horloge des animations auto-déclenchées : **une boucle par surface qui
 * anime, aucune quand rien n'anime**.
 *
 * Calquée sur celle de `CvScreen` — pas extraite : son contrat diffère sur un
 * point décisif, voir plus bas. Le raisonnement, lui, vaut partout : une quinzaine de titres se déchiffrent en même
 * temps, et leur donner chacun sa boucle `requestAnimationFrame` et son état,
 * c'est quinze rendus React par image à côté d'une scène 3D qui a déjà besoin
 * des seize millisecondes. Un seul `rAF` publie le temps écoulé et tout le
 * monde en dérive son texte : un rendu par image, quel que soit le nombre de
 * textes.
 *
 * Ce que ça n'est PAS : une horloge unique pour l'application entière. À
 * l'arrêt CV, la cascade et la frappe de la bulle tournent ensemble, donc deux
 * boucles. Les mutualiser demanderait un module singleton avec des abonnés, et
 * ce serait de la machinerie pour un problème que personne n'a mesuré — ce qui
 * coûtait cher, c'était les états React par élément, pas la boucle elle-même.
 *
 * **`null` veut dire « pas d'animation », et RIEN d'autre** : `active` est
 * faux, ou `prefers-reduced-motion` est demandé. Les composants le lisent comme
 * « affiche l'état final », ce qui neutralise l'animation au lieu de la
 * raccourcir — le critère du design system est l'autonomie, et une animation
 * qui part toute seule doit disparaître, pas accélérer.
 *
 * **Une animation terminée rend `total`, pas `null`.** C'est là que ce contrat
 * s'écarte de celui du CV, et la raison est un défaut mesuré : avec `null` aux
 * deux bouts, un composant ne peut pas distinguer *pas encore commencé* de
 * *fini*. La frappe de la bulle affichait donc sa phrase entière sur sa
 * première image — avant que la première image d'horloge n'arrive — puis
 * repartait de zéro. Sur une bulle qui apparaît en même temps qu'elle s'écrit,
 * ça se voyait comme « le texte ne s'écrit jamais ». Rendre `total` lève
 * l'ambiguïté au lieu de la contourner.
 */
export function useElapsed(active: boolean, total: number, resetKey?: string): number | null {
  const [elapsed, setElapsed] = useState<number | null>(null)

  useEffect(() => {
    if (!active) {
      setElapsed(null)
      return
    }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setElapsed(null)
      return
    }
    // Zéro tout de suite : sans ça, la première image rendue l'est avec l'état
    // précédent — c'est-à-dire l'animation terminée — et la phrase apparaît
    // entière le temps d'une image avant de se remettre à s'écrire.
    setElapsed(0)
    let frame = 0
    const started = performance.now()
    const tick = (now: number) => {
      const dt = now - started
      if (dt >= total) {
        setElapsed(total)
        return
      }
      setElapsed(dt)
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
    // `resetKey` existe pour une raison précise : sans lui, l'horloge ne
    // repart que si `total` change. Deux pages de dialogue de MÊME longueur se
    // suivraient donc sans que la frappe recommence — la seconde s'afficherait
    // d'un coup, et le défaut serait invisible tant que les longueurs diffèrent.
  }, [active, total, resetKey])

  return elapsed
}
