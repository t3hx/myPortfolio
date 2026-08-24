import { useEffect, useState } from 'react'

/** L'utilisateur demande moins de mouvement. Lu au rendu, pas seulement dans
 *  un effet : c'est ce qui permet de décider dès la PREMIÈRE image. */
function reducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * L'horloge des animations auto-déclenchées : **une boucle par surface qui
 * anime, aucune quand rien n'anime**.
 *
 * Calquée sur celle de `CvScreen` — pas extraite : son contrat diffère sur deux
 * points, voir plus bas. Le raisonnement, lui, vaut partout : une quinzaine de
 * titres se déchiffrent en même temps, et leur donner chacun sa boucle
 * `requestAnimationFrame` et son état, c'est quinze rendus React par image à
 * côté d'une scène 3D qui a déjà besoin des seize millisecondes. Un seul `rAF`
 * publie le temps écoulé et tout le monde en dérive son texte.
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
 * **Une animation terminée rend `total`, pas `null`.** Premier écart avec le
 * CV, et il vient d'un défaut mesuré : avec `null` aux deux bouts, un composant
 * ne peut pas distinguer *pas encore commencé* de *fini*. La frappe de la bulle
 * affichait donc sa phrase entière sur sa première image.
 *
 * **Le changement de `resetKey` remet l'horloge à zéro DANS LE RENDU**, pas
 * dans un effet. Second écart, même origine : un effet s'exécute *après* le
 * rendu, donc la première image du nouveau texte était calculée avec le temps
 * écoulé de l'ANCIEN — c'est-à-dire une animation terminée. Mesuré au
 * changement de page du dialogue : la phrase suivante apparaissait entière
 * pendant une image, puis se remettait à s'écrire. Le motif utilisé ici est
 * celui que React documente pour ajuster un état quand une prop change.
 */
export function useElapsed(active: boolean, total: number, resetKey?: string): number | null {
  const [clock, setClock] = useState<{ key: string | undefined; value: number | null }>(() => ({
    key: resetKey,
    value: active && !reducedMotion() ? 0 : null,
  }))

  // Ajustement pendant le rendu : React relance immédiatement le rendu du même
  // composant, donc rien de périmé n'atteint l'écran.
  if (clock.key !== resetKey) {
    setClock({ key: resetKey, value: active && !reducedMotion() ? 0 : null })
  }

  useEffect(() => {
    if (!active || reducedMotion()) {
      setClock({ key: resetKey, value: null })
      return
    }
    setClock({ key: resetKey, value: 0 })
    let frame = 0
    const started = performance.now()
    const tick = (now: number) => {
      const dt = now - started
      if (dt >= total) {
        setClock({ key: resetKey, value: total })
        return
      }
      setClock({ key: resetKey, value: dt })
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
    // `resetKey` est une dépendance à part entière : sans lui, l'horloge ne
    // repart que si `total` change, donc deux pages de MÊME longueur se
    // suivraient sans que la frappe recommence — un défaut invisible tant que
    // les longueurs diffèrent.
  }, [active, total, resetKey])

  // Pendant l'image où la clé vient de changer, on répond zéro plutôt que la
  // valeur de l'animation précédente.
  return clock.key === resetKey ? clock.value : 0
}
