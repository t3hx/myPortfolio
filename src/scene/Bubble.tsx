import { Html } from '@react-three/drei'
import { useCallback, useEffect, useRef, useState, type CSSProperties, type RefObject } from 'react'
import { Vector3, type Camera, type Object3D } from 'three'
import { clampToSafeArea } from '@/lib/bubbleAnchors'
import { useNow } from '@/lib/clock'
import { typedLength } from '@/lib/typewriter'
import { useInteraction } from '@/state/interaction'
import { BubbleCard } from '@/ui/BubbleCard'

/**
 * Bulle narrative ancrée par projection écran (issue #47).
 *
 * L'anatomie visuelle (verre fumé, kicker, phrase Newsreader) vient de
 * src/styles/tokens.css — ce composant recrée le markup exact des maquettes
 * de design/screens/ ; il n'apporte que le comportement :
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
 * dormante. L'accessibilité complète relève de #49.
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
  tick?: 'left' | 'right' | 'top'
  /** Variante `--tilted` : rotation en degrés (guitare : −11,15°). */
  tilt?: number
  /** Classes supplémentaires ajoutées à `.bubble`. */
  className?: string
  /**
   * Il reste une page après celle-ci. Affiche le chevron « la suite » — mais
   * seulement une fois la frappe finie : tant que le texte s'écrit, la suite
   * n'est pas encore la question, et l'annoncer inviterait à couper la phrase
   * qu'on est en train de lire.
   */
  hasNext?: boolean
  /**
   * La phrase à écrire. **Une chaîne, pas un `ReactNode`** depuis #121 : la
   * machine à écrire a besoin des caractères, et un nœud React ne se coupe pas
   * en deux à la lettre près.
   */
  children: string
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
  hasNext = false,
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

  /**
   * La frappe. Elle lit la MÊME origine que l'arbitrage des gestes — l'instant
   * où la page a commencé — au lieu d'avoir son horloge et de publier son état.
   * C'est ce qui rend le clic fiable : la bulle et l'entrée ne peuvent pas être
   * d'avis différents sur « est-ce que ça écrit encore », puisque ni l'une ni
   * l'autre ne le décide.
   */
  const startedAt = useInteraction((st) => st.dialogueStartedAt)
  const done = useInteraction((st) => st.dialogueDone)
  const revealed = useInteraction((st) => st.revealed)
  // La durée vient du STORE, pas d'un `typeDuration(children)` recalculé ici.
  // Recalculée, elle ignorait le « mouvement réduit » — que l'appelant exprime
  // par des durées nulles — et la bulle écrivait quand même.
  const duration = useInteraction((st) => st.dialogueDurations[st.dialoguePage] ?? 0)

  // Le minuteur est le seul signal de fin, et il se recale sur `startedAt` :
  // c'est la seule clé qui change à CHAQUE page, y compris entre deux pages de
  // longueur identique — où la durée, elle, ne bougerait pas.
  const [finished, setFinished] = useState(false)
  useEffect(() => {
    setFinished(duration <= 0)
    if (duration <= 0) return
    const timer = window.setTimeout(() => setFinished(true), duration)
    return () => window.clearTimeout(timer)
  }, [startedAt, duration])

  const now = useNow(visible && revealed && !done && !finished)
  const shown =
    done || finished ? children.length : typedLength(children, now - startedAt, duration)

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
  // Tant que le préchargeur couvre l'écran, la bulle n'existe pas : une frappe
  // lancée derrière lui s'écrit sans spectateur, et la phrase était déjà à
  // moitié faite quand elle devenait visible (mesuré : 42 caractères sur 69).
  if (!mounted || !revealed || !portal.current) return null

  const cls = [
    'bubble',
    !visible && 'bubble--out',
    tilt !== undefined && 'bubble--tilted',
    className,
  ]
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
      <article ref={measureBox} className={cls} role="note" style={style}>
        <BubbleCard kicker={kicker} text={children} shown={shown} tick={tick} hasNext={hasNext} />
      </article>
    </Html>
  )
}
