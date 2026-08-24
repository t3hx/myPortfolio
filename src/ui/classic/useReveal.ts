import { useEffect, useRef, useState, type CSSProperties, type RefObject } from 'react'
import { REVEAL_ROOT_MARGIN } from '@/config/classic'

/**
 * Un groupe qui se révèle quand il entre en vue (spec §6).
 *
 * **Une fois pour toutes.** L'observateur cesse de regarder son groupe dès
 * qu'il l'a révélé : sans ça, remonter la page rejouerait la cascade, et une
 * animation d'entrée qui se rejoue cesse d'être une entrée pour devenir un
 * clignotement.
 *
 * Un observateur par groupe, et non un observateur global : les groupes ne
 * sont pas des sections. Le CV en contient quatre — l'en-tête, les
 * expériences, les savoir-faire, les savoir-être — et ils s'allument à des
 * moments différents parce qu'ils occupent des hauteurs différentes. Les
 * imbriquer sous un seul `data-revealed` aurait allumé les cartouches en même
 * temps que le titre, trois écrans trop tôt.
 *
 * Le drapeau ressort en `data-revealed`, jamais en classe : c'est le CSS qui
 * porte l'animation (`.classic-reveal`), et une classe ajoutée en JS ferait
 * exister deux endroits où l'on décide si un élément est visible.
 *
 * **Un groupe ne doit jamais en contenir un autre.** Le CSS révèle par
 * `[data-revealed='true'] .classic-reveal`, un sélecteur de DESCENDANCE : un
 * groupe imbriqué s'allume donc avec son parent, quel que soit son propre
 * observateur. C'est arrivé au CV, dont les trois blocs partaient mille cinq
 * cents pixels trop tôt — et le symptôme n'est pas « ça s'allume trop tôt »,
 * c'est « il n'y a aucune animation », parce qu'on arrive après. Rien dans le
 * DOM ne le montre, seul le défilement le révèle, d'où l'avertissement
 * ci-dessous plutôt qu'un commentaire.
 */
export function useReveal<T extends HTMLElement>(): [RefObject<T | null>, boolean] {
  const ref = useRef<T>(null)
  const [revealed, setRevealed] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    // Pas de garde `prefers-reduced-motion` ici, et c'est délibéré : sous
    // mouvement réduit le CSS rend les éléments visibles d'emblée, donc
    // l'observateur ne commande plus rien — mais couper l'effet laisserait
    // `revealed` à false et l'attribut absent, ce qui reviendrait à parier que
    // la règle CSS existe. Elle existe, et si elle disparaissait la page
    // resterait blanche sans que rien ne l'explique.
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          setRevealed(true)
          io.unobserve(entry.target)
        }
      },
      { rootMargin: REVEAL_ROOT_MARGIN },
    )
    io.observe(el)

    // Développement seulement : Vite remplace `import.meta.env.DEV` par une
    // constante et le bloc disparaît du bundle de production.
    if (import.meta.env.DEV && el.querySelector('[data-revealed]')) {
      console.warn(
        '[classic] Un groupe de révélation en contient un autre. Le CSS révèle ' +
          'par descendance : le groupe interne s’allumera avec celui-ci, bien ' +
          'avant qu’on l’atteigne, et la cascade paraîtra absente.',
        el,
      )
    }

    return () => io.disconnect()
  }, [])

  return [ref, revealed]
}

/**
 * Le retard d'un élément dans sa cascade.
 *
 * Il voyage en propriété CSS plutôt qu'en `animationDelay` direct : la
 * déclaration `animation` complète vit dans `classic.css`, avec sa durée et
 * son easing, et n'en laisser QUE le retard au JSX est ce qui garde la table
 * de la spec lisible d'un seul côté. Écrire `animationDelay` ici obligerait à
 * écrire aussi la durée et l'easing, ou à les voir écrasés en silence.
 */
export function revealDelay(ms: number): CSSProperties {
  return { '--reveal-delay': `${ms}ms` } as CSSProperties
}

/** Durée et retard d'un fondu d'allumage de l'accueil (spec §3). */
export function ignite(durationMs: number, delayMs: number): CSSProperties {
  return {
    '--ignite-dur': `${durationMs}ms`,
    '--ignite-delay': `${delayMs}ms`,
  } as CSSProperties
}

/**
 * Le retard d'un balayage de consigne.
 *
 * Il compte plus qu'il n'en a l'air sur l'accroche : elle ne reçoit qu'UN
 * passage, et un laser qui traverse pendant que le fondu d'allumage court
 * encore traverse un texte transparent. Le seul passage qu'il y avait est
 * alors perdu, et rien ne le rejoue.
 */
export function cueDelay(ms: number): CSSProperties {
  return { '--cue-delay': `${ms}ms` } as CSSProperties
}
