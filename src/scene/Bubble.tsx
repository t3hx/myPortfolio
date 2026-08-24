import { Html } from '@react-three/drei'
import { useCallback, useEffect, useRef, useState, type CSSProperties, type RefObject } from 'react'
import { Vector3, type Camera, type Object3D } from 'three'
import { clampToSafeArea } from '@/lib/bubbleAnchors'
import { useElapsed } from '@/lib/clock'
import { typeDuration, typedLength } from '@/lib/typewriter'
import { useInteraction } from '@/state/interaction'
import { Typed } from '@/ui/Typed'

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
  tick?: 'left' | 'right'
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
   * La frappe (#121). Elle part quand la bulle devient visible et s'arrête
   * seule ; `useElapsed` rend `null` avant, après, et sous
   * `prefers-reduced-motion` — cas dans lequel `typedLength` rend la phrase
   * entière. La frappe est auto-déclenchée, donc c'est bien une COUPURE qui
   * lui convient, pas un raccourcissement : le critère du design system est
   * l'autonomie de l'animation, pas sa durée.
   */
  // La frappe attend que l'écran soit découvert : démarrée pendant le fondu du
  // préchargeur, elle s'écrit derrière lui et la phrase est déjà à moitié faite
  // quand on la voit (#122).
  const revealed = useInteraction((st) => st.revealed)
  const elapsed = useElapsed(visible && revealed, typeDuration(children), children)

  // Un geste reçu pendant la frappe l'achève (#122, arbitrage A). Le store
  // transmet un COMPTEUR et non un booléen : ce qui passe est un événement
  // (« achève »), pas un état — un booléen demanderait d'être rabaissé après
  // coup, et deux gestes rapprochés ne se distingueraient pas.
  //
  // La bulle retient la valeur du jeton AU DÉBUT de la page ; tout incrément
  // postérieur veut dire « celle-ci, achève-la ». Repartir de la valeur
  // courante à chaque changement de texte est ce qui empêche un achèvement de
  // déborder sur la page suivante.
  const skip = useInteraction((st) => st.dialogueSkip)
  const [skipBase, setSkipBase] = useState(skip)
  useEffect(() => setSkipBase(useInteraction.getState().dialogueSkip), [children])
  const shown = skip > skipBase ? children.length : typedLength(children, elapsed)

  // La frappe en cours est publiée pour que l'entrée sache si un geste doit
  // l'achever ou tourner la page. C'est le seul état que la bulle expose.
  const setDialogueTyping = useInteraction((st) => st.setDialogueTyping)
  const typing = visible && shown < children.length
  useEffect(() => {
    if (visible) setDialogueTyping(typing)
  }, [visible, typing, setDialogueTyping])
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
  // Tant que le préchargeur couvre l'écran, la bulle n'existe pas. Arrêter son
  // horloge ne suffisait pas : `useElapsed` rend `null` quand elle est
  // inactive, ce que le texte lit comme « affiche tout » — la phrase entière
  // paraissait donc le temps d'une image, à l'instant précis où l'écran se
  // découvrait, avant de repartir de zéro.
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
        {/* Le chevron « la suite ». Une bulle qui a fini de parler et une bulle
            qui attend qu'on tourne la page se ressemblent trait pour trait —
            rien, dans le texte, ne dit qu'il en reste. C'est la seule chose
            qu'on ajoute au dialogue, et c'est un signe, pas une phrase. */}
        {hasNext && shown >= children.length && (
          <span className="bubble__next" aria-hidden="true" />
        )}
        {tick && <span className={`bubble__tick bubble__tick--${tick}`} aria-hidden="true" />}
        {kicker ? (
          <>
            <header className="bubble__kicker">
              <span className="bubble__dot" />
              <span className="bubble__label">{kicker}</span>
            </header>
            <p className="bubble__text">
              <Typed text={children} shown={shown} />
            </p>
          </>
        ) : (
          <div className="bubble__inline">
            <span className="bubble__dot" />
            <p className="bubble__text">
              <Typed text={children} shown={shown} />
            </p>
          </div>
        )}
      </article>
    </Html>
  )
}
