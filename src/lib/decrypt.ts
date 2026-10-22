import { useEffect, useState } from 'react'

/**
 * L'horloge du déchiffrage — séparée de `Scrambled` parce qu'un fichier qui
 * exporte à la fois un composant et un crochet perd le Fast Refresh : React
 * ne sait plus s'il peut remplacer le module à chaud, et remonte tout l'arbre
 * à chaque frappe. La règle `react-refresh/only-export-components` le dit, et
 * ce dépôt la traite en erreur (`--max-warnings 0`).
 */

/**
 * L'horloge d'un déchiffrage — **une seule pour tous ses textes**.
 *
 * Donner à chaque titre sa boucle `requestAnimationFrame` et son état, c'est
 * autant de rendus React par image — quinze pour le CV, à côté d'une scène 3D
 * qui a déjà besoin de ses seize millisecondes. Ici un seul `rAF` publie le
 * temps écoulé et tout le monde en dérive son texte : un rendu par image, quel
 * que soit le nombre de textes.
 *
 * Retourne `null` quand il n'y a rien à animer — animation finie, ou
 * `prefers-reduced-motion`. Les composants lisent ce `null` comme « affiche le
 * texte final », ce qui NEUTRALISE l'animation au lieu de la raccourcir : le
 * critère du design system est l'autonomie, et celle-ci part toute seule.
 */
export function useDecryptClock(active: boolean, total: number): number | null {
  const [elapsed, setElapsed] = useState<number | null>(null)

  useEffect(() => {
    if (!active) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let frame = 0
    const started = performance.now()
    const tick = (now: number) => {
      const dt = now - started
      if (dt >= total) {
        setElapsed(null)
        return
      }
      setElapsed(dt)
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [active, total])

  return elapsed
}
