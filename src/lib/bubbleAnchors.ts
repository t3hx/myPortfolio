import { Box3, Vector3, type Object3D } from 'three'
import { CAMERA_STOPS } from '@/config/cameraStops'
import { BUBBLES, type BubbleContent } from '@/content/bubbles'
import type { StopTransform } from '@/lib/stops'

/**
 * D'un placement de maquette à un point du monde (issue #48).
 *
 * Les bulles sont ancrées par projection écran — mais la table de placement de
 * DESIGN.md est écrite en fractions du cadre 1280×720, pas en mètres. Ce
 * module fait la conversion une fois, au chargement de la scène : il DÉ-PROJETTE
 * le point du design dans le tronc de vision de la caméra de l'arrêt.
 *
 * Deux moitiés indépendantes :
 *
 *  - **la direction** vient du design. Elle décide où la bulle tombe à
 *    l'écran, et elle seule : la position projetée d'un point ne dépend que de
 *    sa direction depuis la caméra, jamais de sa distance.
 *  - **la profondeur** vient de l'objet qui justifie la bulle. Elle ne change
 *    rien tant que la caméra est garée ; elle décide de la PARALLAXE, c'est-à-
 *    dire de la façon dont la bulle glisse avec son objet quand la caméra
 *    quitte l'arrêt. C'est là qu'un ancrage monde bat un `left: 4%`.
 *
 * L'aspect du design est reconstruit à partir du champ HORIZONTAL de l'arrêt
 * (`hfov`), qui est l'invariant du cadrage Blender — voir `stops.ts`. Sur un
 * écran plus étroit ou plus large, la politique « ajustement horizontal » de
 * `verticalFov` rogne en haut et en bas : la bulle garde alors sa position
 * horizontale et suit le rognage verticalement, ce que la table appelle ses
 * marges de sécurité.
 */

const RAD = Math.PI / 180

/** Le cadre dans lequel la table de placement de DESIGN.md a été mesurée. */
export const DESIGN_ASPECT = 1280 / 720

/** Profondeur de repli quand l'objet d'ancrage manque du `.glb` (mètres). */
export const FALLBACK_DEPTH = 3

/**
 * Marge de sécurité : aucune bulle ne s'approche plus près du bord (px).
 * 12 px est la marge la plus serrée du design lui-même (la barre de menu est
 * collée à 12 px du bord droit ; les bulles les plus au bord, mappemonde et
 * lune, tombent à 15,4 px). Plus large, le garde-fou déplacerait des bulles
 * que la session design a validées telles quelles.
 */
export const SAFE_MARGIN = 12

/**
 * Ramène le CENTRE projeté d'une bulle dans la marge de sécurité.
 *
 * La table de placement est écrite « en fractions, jamais en px absolus » —
 * mais une bulle, elle, garde sa largeur en pixels. Sur un cadre plus étroit
 * que le 1280 du design, une bulle collée à 13 % du bord finit par déborder
 * (mesuré : −2 px à gauche en 1000×1000). L'ancrage cède alors le pas à la
 * marge : mieux vaut une bulle décollée de quelques pixels de son point
 * projeté qu'une phrase coupée par le bord.
 *
 * Une bulle plus large que le cadre lui-même est simplement centrée : il n'y a
 * plus d'intervalle où la poser.
 */
export function clampToSafeArea(
  center: { x: number; y: number },
  box: { width: number; height: number },
  viewport: { width: number; height: number },
  margin = SAFE_MARGIN,
): { x: number; y: number } {
  const clampAxis = (value: number, size: number, extent: number): number => {
    const min = margin + size / 2
    const max = extent - margin - size / 2
    if (min > max) return extent / 2
    return Math.min(Math.max(value, min), max)
  }
  return {
    x: clampAxis(center.x, box.width, viewport.width),
    y: clampAxis(center.y, box.height, viewport.height),
  }
}

// Scratch — la résolution tourne une fois par chargement, mais trois Vector3
// par arrêt pour rien restent trois de trop.
const tmpBox = new Box3()
const tmpCenter = new Vector3()
const forward = new Vector3()
const right = new Vector3()
const up = new Vector3()

/**
 * Distance, le long de l'axe de visée de l'arrêt, du centre de la boîte
 * englobante des `objects`. Retombe sur `FALLBACK_DEPTH` — en le signalant —
 * si aucun nœud n'est trouvé, ou si l'objet est derrière la caméra (un nom
 * juste mais un objet hors champ : la bulle serait projetée à l'envers).
 */
export function anchorDepth(scene: Object3D, objects: string[], stop: StopTransform): number {
  tmpBox.makeEmpty()
  let found = 0
  for (const name of objects) {
    const node = scene.getObjectByName(name)
    if (!node) {
      console.warn(`[bubbles] Nœud d'ancrage "${name}" absent du .glb — ignoré.`)
      continue
    }
    tmpBox.expandByObject(node)
    found++
  }
  if (found === 0 || tmpBox.isEmpty()) {
    console.warn(
      `[bubbles] Aucun nœud d'ancrage résolu parmi [${objects.join(', ')}] — ` +
        `profondeur de repli ${FALLBACK_DEPTH} m (la bulle reste au bon endroit à ` +
        `l'écran, elle perd seulement la parallaxe de son objet).`,
    )
    return FALLBACK_DEPTH
  }

  tmpBox.getCenter(tmpCenter)
  forward.set(0, 0, -1).applyQuaternion(stop.quaternion)
  const depth = tmpCenter.sub(stop.position).dot(forward)
  if (depth <= 0) {
    console.warn(
      `[bubbles] L'ancre [${objects.join(', ')}] est derrière la caméra de l'arrêt — ` +
        `profondeur de repli ${FALLBACK_DEPTH} m.`,
    )
    return FALLBACK_DEPTH
  }
  return depth
}

/**
 * Le point monde qui se projette sur `center` (fraction du cadre du design)
 * vu de `stop`, à `depth` mètres devant la caméra.
 */
export function designAnchor(
  stop: StopTransform,
  depth: number,
  center: { x: number; y: number },
): Vector3 {
  // Demi-dimensions du plan à `depth` : le champ horizontal est l'invariant,
  // le vertical s'en déduit par l'aspect du cadre du design.
  const halfWidth = depth * Math.tan((stop.hfov * RAD) / 2)
  const halfHeight = halfWidth / DESIGN_ASPECT

  // Fraction du cadre → NDC (y vers le haut).
  const ndcX = center.x * 2 - 1
  const ndcY = 1 - center.y * 2

  forward.set(0, 0, -1).applyQuaternion(stop.quaternion)
  right.set(1, 0, 0).applyQuaternion(stop.quaternion)
  up.set(0, 1, 0).applyQuaternion(stop.quaternion)

  return new Vector3()
    .copy(stop.position)
    .addScaledVector(forward, depth)
    .addScaledVector(right, ndcX * halfWidth)
    .addScaledVector(up, ndcY * halfHeight)
}

/**
 * L'ancre de chaque bulle, dans l'ordre de `BUBBLES`. `null` pour une bulle
 * dont l'arrêt manque à l'appel — `extractStops` a déjà crié, et une bulle
 * sans caméra n'a pas de cadre où se placer.
 *
 * `stops` est l'ordre de `CAMERA_STOPS`, trous retirés : c'est l'hypothèse que
 * fait déjà tout le reste de l'app (le HUD indexe `CAMERA_STOPS[stopIndex]`).
 */
export function resolveBubbleAnchors(
  scene: Object3D,
  stops: StopTransform[],
  bubbles: BubbleContent[] = BUBBLES,
): (Vector3 | null)[] {
  return bubbles.map((bubble) => {
    const index = CAMERA_STOPS.findIndex((s) => s.label === bubble.stop)
    const stop = index >= 0 ? stops[index] : undefined
    if (!stop) {
      console.warn(`[bubbles] Arrêt "${bubble.stop}" introuvable — bulle non ancrée.`)
      return null
    }
    return designAnchor(stop, anchorDepth(scene, bubble.objects, stop), bubble.center)
  })
}
