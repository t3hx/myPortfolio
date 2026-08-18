import { Html } from '@react-three/drei'
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from 'react'
import { Vector3, type Camera, type Object3D } from 'three'
import { clampToSafeArea } from '@/lib/bubbleAnchors'

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
 * n'ouvre rien, et le `.bubble--interactive` de tokens.css reste une
 * spécification dormante.
 *
 * Accessibilité (issue #49) — deux choses, et elles vont ensemble :
 *
 * - L'article est `aria-hidden` : la phrase est DITE par `<StopAnnouncer>`
 *   (App3D), la seule copie du texte dans l'arbre d'accessibilité. Sans ça,
 *   elle serait annoncée à l'arrivée puis relue une seconde fois à la
 *   navigation. Retirer l'un sans l'autre casse la moitié de l'issue.
 * - Le texte redevient sélectionnable : `.bubble-layer .bubble__text` relève
 *   `pointer-events` sur la SEULE phrase (styles.css). La molette continue de
 *   traverser — l'écouteur du tour est sur `.stage` et l'événement y remonte —
 *   mais un clic sur la phrase ne descend plus au raycaster : c'est le prix
 *   assumé de la sélection, et il s'arrête au texte (le point, le trait de
 *   rappel et le fond restent transparents aux clics).
 *
 * Le composant ne connaît AUCUN texte ni aucune position : le contenu, le
 * placement et les variantes du design viennent de `src/content/bubbles.ts`,
 * l'ancre monde de `src/lib/bubbleAnchors.ts` (issue #48).
 */

/** Doit suivre --t-bubble-out (tokens.css) — synchro verrouillée par tests/bubble.test.ts. */
export const BUBBLE_OUT_MS = 200

/** Scratch : la projection tourne à chaque frame, pour chaque bulle montée. */
const projected = new Vector3()

export interface BubbleProps {
  /** Point monde suivi par projection écran (recalculée chaque frame). */
  anchor: Vector3
  /** Couche DOM stable hors du conteneur canvas — `.bubble-layer` d'App3D. */
  portal: RefObject<HTMLDivElement>
  /** Présente/absente. La sortie joue un fondu de 200 ms avant démontage. */
  visible: boolean
  /** Étiquette caps du kicker (« NN — Objet ») ; absente = variante inline (home). */
  kicker?: string
  /** `max-width` de la table de placement, en px content-box ; `null` = libre. */
  maxWidth?: number | null
  /** Ligne de rappel de 44 px vers l'objet, du côté indiqué. */
  tick?: 'left' | 'right'
  /** Variante `--tilted` : rotation en degrés (guitare : −11,15°). */
  tilt?: number
  /** Classes supplémentaires ajoutées à `.bubble`. */
  className?: string
  /** La phrase — une seule, voix Newsreader italique. */
  children: ReactNode
}

export function Bubble({
  anchor,
  portal,
  visible,
  kicker,
  maxWidth,
  tick,
  tilt,
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

  // La taille rendue de la bulle, relevée aux seuls changements de taille : la
  // lire à chaque frame forcerait un calcul de mise en page par frame.
  //
  // Ref callback et non `useEffect` : drei rend les enfants dans une RACINE
  // REACT À PART (`createRoot` sur son propre div). Ses commits ne sont pas
  // synchronisés avec les nôtres — au moment où nos effets tournent, l'article
  // n'est pas encore dans le DOM, et un effet à dépendances figées ne
  // repasserait jamais. Le callback, lui, se déclenche quand le nœud arrive.
  const box = useRef({ width: 0, height: 0 })
  const measureBox = useCallback((el: HTMLElement | null) => {
    if (!el) return
    const measure = () => {
      const rect = el.getBoundingClientRect()
      box.current = { width: rect.width, height: rect.height }
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => {
      observer.disconnect()
      box.current = { width: 0, height: 0 }
    }
  }, [])

  // Projection maison, pour insérer la marge de sécurité entre le point projeté
  // et la position finale (voir clampToSafeArea). `center` de drei pose ensuite
  // le translate(−50 %, −50 %) qui fait de ce point le CENTRE de la bulle.
  const calculatePosition = useCallback(
    (el: Object3D, camera: Camera, size: { width: number; height: number }) => {
      projected.setFromMatrixPosition(el.matrixWorld).project(camera)
      const centre = {
        x: (projected.x * 0.5 + 0.5) * size.width,
        y: (-projected.y * 0.5 + 0.5) * size.height,
      }
      const safe = clampToSafeArea(centre, box.current, size)
      return [safe.x, safe.y]
    },
    [],
  )

  // Garde anti-fallback : drei résout sa cible AU RENDER (`portal?.current ||
  // conteneur du canvas`) et ne se re-parente jamais si le ref se remplit
  // après. Aujourd'hui le Suspense du glb garantit l'ordre ; ce garde le
  // garantit par le code (un montage trop tôt attend le re-render suivant).
  if (!mounted || !portal.current) return null

  const cls = ['bubble', !visible && 'bubble--out', tilt !== undefined && 'bubble--tilted', className]
    .filter(Boolean)
    .join(' ')

  // `--bubble-rotate` est la variable que lit `.bubble--tilted` (tokens.css) :
  // la rotation passe par la propriété individuelle `rotate`, jamais par
  // `transform`, que l'animation `bubble-in` remplacerait (DESIGN.md).
  const style: CSSProperties = {
    maxWidth: maxWidth ?? 'none',
    ...(tilt !== undefined ? { '--bubble-rotate': `${tilt}deg` } : {}),
  } as CSSProperties

  return (
    <Html
      position={anchor}
      center
      portal={portal}
      zIndexRange={[40, 0]}
      calculatePosition={calculatePosition}
      // Hook d'inspection (DevTools / Playwright) — volontairement sans CSS.
      className="bubble-anchor"
    >
      {/* Markup des maquettes : kicker (point + étiquette) puis phrase, ou
          variante « sans titre » point + phrase sur une ligne (home). */}
      <article ref={measureBox} className={cls} aria-hidden="true" style={style}>
        {tick && <span className={`bubble__tick bubble__tick--${tick}`} aria-hidden="true" />}
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
