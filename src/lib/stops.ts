import { PerspectiveCamera, Quaternion, Vector3, type Object3D } from 'three'
import { CAMERA_STOPS } from '@/config/cameraStops'

/** A camera stop's world transform, extracted from the loaded .glb.
 *
 *  The field of view is stored HORIZONTALLY, on purpose. A glTF camera
 *  describes its framing as `yfov` + `aspectRatio`, and Blender picks that
 *  pair from the scene's render resolution: the v12 export declares
 *  `aspectRatio: 1`, so its `yfov` (Home: 54.43°) is the field of a SQUARE
 *  frame — not the vertical field of a widescreen one. Feeding it straight
 *  into three's `camera.fov` (which is vertical, against the CANVAS aspect)
 *  framed everything far too wide.
 *
 *  The horizontal field is the invariant across both: 54.43° horizontal is
 *  32.27° vertical at 16:9, which is exactly what the previous export
 *  declared for the same camera. Store it once, derive the vertical field per
 *  viewport (see `verticalFov`).
 */
export interface StopTransform {
  position: Vector3
  quaternion: Quaternion
  /** Horizontal field of view, in degrees. */
  hfov: number
}

const DEG = 180 / Math.PI
const RAD = Math.PI / 180

/**
 * Vertical fov (degrees) that renders `hfov` horizontally on a viewport of
 * `aspect` — the "horizontal fit" policy: Blender's horizontal framing is
 * preserved on every screen, and a viewport shorter than the authored frame
 * simply crops top and bottom rather than pulling back and losing the shot.
 */
export function verticalFov(hfov: number, aspect: number): number {
  const a = aspect > 0 ? aspect : 1
  return 2 * Math.atan(Math.tan((hfov * RAD) / 2) / a) * DEG
}

/**
 * Lit le transform monde d'UNE caméra du `.glb`, par le nom exact de son nœud
 * (donc sans conversion Z-up → Y-up de Blender à se tromper). Les caméras du
 * `.glb` ne sont jamais activées : on échantillonne leur pose et on interpole
 * NOTRE caméra de rendu jusqu'à elle.
 *
 * Ce helper existe pour être appelé DEUX fois de sources différentes : par
 * `extractStops()` pour chaque arrêt du tour, et par le télescope pour
 * `CameraStop_TelescopeMoon`, qui est une caméra du `.glb` **hors tour**
 * (#113). C'est la dérivation du champ horizontal qui ne doit exister qu'une
 * fois — la recopier ailleurs, ce serait une deuxième source de vérité sur une
 * focale, et `tests/stops.test.ts` ne verrouille que celle-ci.
 *
 * `null` avec un avertissement si le nœud manque, ou s'il porte le bon nom
 * sans porter de caméra.
 */
export function readStopTransform(scene: Object3D, cameraName: string): StopTransform | null {
  const node = scene.getObjectByName(cameraName)
  if (!node) {
    console.warn(`[stops] Missing camera node "${cameraName}" in the .glb — skipping stop.`)
    return null
  }

  // The node may itself be a camera, or hold one as a child.
  const cams: PerspectiveCamera[] = []
  node.traverse((c: Object3D) => {
    if ((c as PerspectiveCamera).isCamera) cams.push(c as PerspectiveCamera)
  })
  const cam = cams[0] ?? null

  // A node with the right name but NO camera used to fall through to a
  // 45° default. That is the worst kind of failure: the stop parks at the
  // right spot, warns about nothing, and shows a framing nobody authored —
  // so it looks plausible and reads as a Blender decision. Skip it loudly
  // instead, exactly like a stop missing from the graph.
  if (!cam) {
    console.warn(
      `[stops] "${cameraName}" exists in the .glb but carries no camera ` +
        '(an Empty with the right name?) — skipping. Its focal length cannot ' +
        'be derived, and a default one would be silently wrong.',
    )
    return null
  }

  const position = new Vector3()
  const quaternion = new Quaternion()
  cam.getWorldPosition(position)
  cam.getWorldQuaternion(quaternion)
  // glTF `yfov` + `aspectRatio`, as loaded into three's camera.fov/.aspect.
  // Convert to the horizontal field, which is what the framing really is.
  const aspect = cam.aspect > 0 ? cam.aspect : 1
  const hfov = 2 * Math.atan(Math.tan((cam.fov * RAD) / 2) * aspect) * DEG
  return { position, quaternion, hfov }
}

/**
 * Les arrêts du tour, lus dans le graphe chargé. Renvoie les transforms indexés
 * par nom de caméra ; un arrêt manquant est sauté avec un avertissement (le cas
 * du ré-export dégradé prévu au plan de test du design doc).
 *
 * Ne lit QUE `CAMERA_STOPS` : une caméra du `.glb` absente de ce tableau n'est
 * jamais extraite ici. C'est voulu — le tour est ce tableau — et c'est pourquoi
 * la lune passe par `readStopTransform()` de son côté depuis #113.
 */
export function extractStops(scene: Object3D): Map<string, StopTransform> {
  scene.updateMatrixWorld(true)
  const stops = new Map<string, StopTransform>()

  for (const stop of CAMERA_STOPS) {
    const transform = readStopTransform(scene, stop.camera)
    if (transform) stops.set(stop.camera, transform)
  }

  if (stops.size === 0) {
    console.warn(
      '[stops] No CameraStop_* cameras found in the .glb. ' +
        'Re-export from Blender with "Cameras" enabled to drive the tour.',
    )
  }
  return stops
}

export function orderedStops(map: Map<string, StopTransform>): StopTransform[] {
  return CAMERA_STOPS.map((s) => map.get(s.camera)).filter(
    (t): t is StopTransform => t !== undefined,
  )
}

/**
 * Mélange deux poses et écrit le résultat dans `out`. `t = 0` rend `from`,
 * `t = 1` rend exactement `to`.
 *
 * **Le champ interpolé est HORIZONTAL, jamais vertical, et ce n'est pas un
 * détail de rangement.** Une caméra glTF décrit son cadrage par `yfov` **plus**
 * `aspectRatio`, et Blender dérive ce couple de la résolution de rendu. Ce qui
 * est invariant, c'est le champ horizontal : l'interpoler lui, puis convertir
 * par viewport, fait survivre le cadrage de Blender à tous les rapports
 * d'écran — un cadre plus court rogne en haut et en bas au lieu de reculer.
 * Interpoler le champ vertical rendrait le mouvement dépendant de l'écran.
 */
export function blendPose(
  out: StopTransform,
  from: StopTransform,
  to: StopTransform,
  t: number,
): StopTransform {
  out.position.lerpVectors(from.position, to.position, t)
  out.quaternion.copy(from.quaternion).slerp(to.quaternion, t)
  out.hfov = from.hfov + (to.hfov - from.hfov) * t
  return out
}

/**
 * Écrit une pose dans la caméra de rendu. C'est le seul endroit où le champ
 * horizontal redevient le champ vertical que three.js attend — et il le fait
 * avec le rapport d'écran RÉEL de la caméra.
 *
 * Ce détail a déjà coûté un défaut : le retour du télescope échantillonnait la
 * pose du tour dans une caméra jetable laissée à son rapport par défaut, et
 * revenait donc zoomé.
 */
export function applyPose(cam: PerspectiveCamera, pose: StopTransform): void {
  cam.position.copy(pose.position)
  cam.quaternion.copy(pose.quaternion)
  cam.fov = verticalFov(pose.hfov, cam.aspect)
  cam.updateProjectionMatrix()
}

/** Une pose neutre, à remplir. */
export function emptyPose(): StopTransform {
  return { position: new Vector3(), quaternion: new Quaternion(), hfov: 60 }
}

/** Copie `from` dans `out`, sans allouer. */
export function copyPose(out: StopTransform, from: StopTransform): StopTransform {
  out.position.copy(from.position)
  out.quaternion.copy(from.quaternion)
  out.hfov = from.hfov
  return out
}

/**
 * L'index visé par un PAS du tour, dans la direction donnée.
 *
 * Deux décisions produit tiennent dans cette fonction, et aucune ne survit à
 * une « simplification » en modulo (2026-08-24) :
 *
 *  - **Le tour boucle en avant, du dernier arrêt vers le PREMIER ARRÊT**, pas
 *    vers l'accueil. L'accueil est le seuil du parcours : son cadrage remplit
 *    l'image d'un écran pour que la première vue se lise comme une image plate,
 *    et le premier défilement recule et révèle la pièce. Rejouer cette
 *    révélation à chaque tour la viderait de son effet.
 *  - **Il ne boucle pas en arrière.** Reculer depuis l'accueil ne fait rien —
 *    on y retourne en reculant depuis le premier arrêt, ou par la barre de
 *    menu, jamais en avançant.
 *
 * `null` quand le pas ne mène nulle part.
 */
export function nextStopIndex(from: number, dir: 1 | -1, count: number): number | null {
  if (count <= 0) return null
  const last = count - 1
  const next = from + dir
  if (next < 0) return null
  if (next > last) return last >= LOOP_FIRST ? LOOP_FIRST : null
  return next
}

/** Le premier arrêt du tour, celui sur lequel on boucle. L'accueil est 0. */
export const LOOP_FIRST = 1

/**
 * Les trois échelles qui font qu'un mouvement est « long ». **Mesurées sur la
 * scène**, pas choisies : ce sont les maxima observés entre deux arrêts
 * voisins du tour.
 *
 *   distance   0,72 → 3,04 m   (médiane 1,36)
 *   rotation   13 → 157°       (médiane 44)
 *   Δ champ    1,4 → 44°       (médiane 10)
 */
const MOVE_REF_M = 3.05
const MOVE_REF_DEG = 158
const MOVE_REF_FOV = 45

/** Les bornes de la durée, en secondes. */
export const MOVE_MIN_S = 1.15
export const MOVE_MAX_S = 2.1

/**
 * ARBITRAGE EN COURS (#115) — `?feel=a|b|c` essaie trois réglages dans le
 * navigateur. Le mouvement ne se juge qu'en mouvement, et une capture prise
 * sous un rasteriseur logiciel ne dit rien de sa fluidité. À retirer une fois
 * le choix fait, avec le candidat retenu écrit en dur ci-dessus.
 */
export const FEEL_CANDIDATES: Record<string, { min: number; max: number; ease: string }> = {
  a: { min: 1.0, max: 1.7, ease: 'power2.inOut' },
  b: { min: 1.15, max: 2.1, ease: 'power3.inOut' },
  c: { min: 1.35, max: 2.5, ease: 'expo.inOut' },
}

export function feelParam(): { min: number; max: number; ease: string } | null {
  if (typeof window === 'undefined') return null
  const key = new URLSearchParams(window.location.search).get('feel')
  return key ? (FEEL_CANDIDATES[key] ?? null) : null
}

/**
 * La durée d'un mouvement, d'après ce qu'il fait parcourir à l'œil.
 *
 * **Trois termes, et pas un seul, parce que la mesure a montré que distance et
 * rotation sont DÉCORRÉLÉES sur cette scène.** Le pas le plus court en distance
 * (Télescope → Mappemonde, 0,72 m) est aussi le plus violent : un demi-tour de
 * 157° sur place. Le plus long (Posters → Télescope, 3,04 m) ne tourne que de
 * 26°. Une durée proportionnelle à la seule distance rendrait donc le demi-tour
 * le plus RAPIDE de la visite, ce qui est exactement l'inverse de ce qu'il
 * faut. Le champ compte pour la même raison : un changement de focale se lit
 * comme un travelling, même sans un centimètre parcouru.
 *
 * On prend le maximum des trois plutôt que leur somme : ce qui fatigue l'œil,
 * c'est le mouvement le plus ample, pas leur cumul.
 */
export function moveDuration(from: StopTransform, to: StopTransform): number {
  const metres = from.position.distanceTo(to.position)
  // L'angle entre deux orientations, en degrés. `Math.abs` sur le produit
  // scalaire : q et −q décrivent la même orientation, et sans lui un demi-tour
  // se compterait parfois à 360° moins son angle.
  const dot = Math.min(1, Math.abs(from.quaternion.dot(to.quaternion)))
  const degres = 2 * Math.acos(dot) * DEG
  const champ = Math.abs(from.hfov - to.hfov)

  const effort = Math.min(
    1,
    Math.max(metres / MOVE_REF_M, degres / MOVE_REF_DEG, champ / MOVE_REF_FOV),
  )
  const feel = feelParam()
  const min = feel?.min ?? MOVE_MIN_S
  const max = feel?.max ?? MOVE_MAX_S
  return min + (max - min) * effort
}
