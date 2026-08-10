import { Html } from '@react-three/drei'
import { useEffect, useState, type ReactNode, type RefObject } from 'react'
import type { Vector3 } from 'three'

/**
 * Bulle narrative ancrée par projection écran (issue #47).
 *
 * L'anatomie visuelle (verre fumé, kicker, phrase Newsreader) vient de
 * docs/design/tokens.css — ce composant recrée le markup exact des maquettes
 * de docs/design/screens/ ; il n'apporte que le comportement :
 *
 * - `<Html>` projette `anchor` (un point monde) à chaque frame : la bulle suit
 *   l'objet pendant les mouvements de caméra.
 * - `portal` est OBLIGATOIRE et pointe la couche stable `.bubble-layer`
 *   d'App3D : sans lui, drei portale dans le conteneur du canvas et la bulle
 *   hérite de son contexte d'empilement.
 * - `zIndexRange` est plafonné BAS : le défaut de drei monte à ~16 millions et
 *   peindrait la bulle au-dessus du HUD (200) et du panneau (300). Ici la
 *   plage n'ordonne que les bulles entre elles, `.bubble-layer` (z 100) fixe
 *   l'étage dans la pile canvas 0 < bulles 100 < HUD 200 < panneau 300.
 * - Deux états seulement, présente/absente (DESIGN.md) : `bubble-in` au
 *   montage (tokens.css), et quand `visible` retombe la bulle reste montée le
 *   temps du fondu de sortie avant de se démonter.
 *
 * La bulle est purement narrative (décision #47) : jamais un bouton, elle
 * n'ouvre rien — `pointer-events: none`, la molette et les clics la
 * traversent. Le `.bubble--interactive` de tokens.css reste une spécification
 * dormante. Le contenu et l'ancre par stop (table de placement, variantes
 * --tilted…) relèvent de #48 ; l'accessibilité complète de #49.
 */

/** Doit suivre --t-bubble-out (tokens.css) — synchro verrouillée par tests/bubble.test.ts. */
export const BUBBLE_OUT_MS = 200

export interface BubbleProps {
  /** Point monde suivi par projection écran (recalculée chaque frame). */
  anchor: Vector3
  /** Couche DOM stable hors du conteneur canvas — `.bubble-layer` d'App3D. */
  portal: RefObject<HTMLDivElement>
  /** Présente/absente. La sortie joue un fondu de 200 ms avant démontage. */
  visible: boolean
  /** Étiquette caps du kicker (« NN — Objet ») ; absente = variante inline (home). */
  kicker?: string
  /** Variantes/placement par stop (#48) : classes ajoutées à `.bubble`. */
  className?: string
  /** La phrase — une seule, voix Newsreader italique. */
  children: ReactNode
}

export function Bubble({
  anchor,
  portal,
  visible,
  kicker,
  className,
  children,
}: BubbleProps) {
  // Démontage différé : `visible` à false lance le fondu (.bubble--out), le
  // démontage suit une fois le budget écoulé. Un retour à true dans la fenêtre
  // annule le timer et rejoue l'entrée sur l'élément encore monté.
  const [mounted, setMounted] = useState(visible)
  useEffect(() => {
    if (visible) {
      setMounted(true)
      return
    }
    const timer = window.setTimeout(() => setMounted(false), BUBBLE_OUT_MS)
    return () => window.clearTimeout(timer)
  }, [visible])

  // Garde anti-fallback : drei résout sa cible AU RENDER (`portal?.current ||
  // conteneur du canvas`) et ne se re-parente jamais si le ref se remplit
  // après. Aujourd'hui le Suspense du glb garantit l'ordre ; ce garde le
  // garantit par le code (un montage trop tôt attend le re-render suivant).
  if (!mounted || !portal.current) return null

  const cls = ['bubble', !visible && 'bubble--out', className]
    .filter(Boolean)
    .join(' ')

  return (
    <Html
      position={anchor}
      center
      portal={portal}
      zIndexRange={[40, 0]}
      // Hook d'inspection (DevTools / Playwright) — volontairement sans CSS.
      className="bubble-anchor"
    >
      {/* Markup des maquettes : kicker (point + étiquette) puis phrase, ou
          variante « sans titre » point + phrase sur une ligne (home). */}
      <article className={cls} role="note">
        {kicker ? (
          <>
            <header className="bubble__kicker">
              <span className="bubble__dot" />
              <span className="bubble__label">{kicker}</span>
            </header>
            <p className="bubble__text">{children}</p>
          </>
        ) : (
          <div className="bubble__inline">
            <span className="bubble__dot" />
            <p className="bubble__text">{children}</p>
          </div>
        )}
      </article>
    </Html>
  )
}
