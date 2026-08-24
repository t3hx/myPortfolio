import { Quaternion, Vector3, type Object3D } from 'three'
import { BUBBLES } from '@/content/bubbles'
import { CAMERA_STOPS } from '@/config/cameraStops'
import { LOOK_DEADZONE, LOOK_LERP, LOOK_MAX_DEG, LOOK_MAX_FRAC } from '@/config/lookAround'
import { anchorDepth } from '@/lib/bubbleAnchors'
import type { StopTransform } from '@/lib/stops'

/**
 * Le regard autour du sujet — **la géométrie, pure**.
 *
 * À l'arrêt, porter la souris à gauche ou à droite fait ORBITER la caméra de
 * quelques degrés autour du sujet. Le sujet, lui, ne bouge pas d'un pixel :
 * c'est ce qui distingue un regard d'un panoramique, et c'est la seule lecture
 * qui satisfasse les deux moitiés de la demande — « tourner » ET « garder le
 * focus sur le sujet ».
 *
 * **La caméra tourne AUTOUR d'un point de l'axe de visée**, à la profondeur du
 * sujet. C'est ce qui rend le centrage exact plutôt qu'approché : en écrivant
 * le pivot `P = C + f·d`, une rotation d'angle θ autour de la verticale passant
 * par `P` donne `C' = P − d·f'`, donc `P = C' + d·f'`. Le pivot est encore à la
 * même distance devant la nouvelle caméra — la démonstration tient quel que
 * soit le tangage de l'arrêt, parce que la rotation se fait autour de l'axe
 * MONDE et n'introduit donc aucun roulis.
 *
 * Corollaire à connaître : seul ce qui est À la profondeur du pivot reste
 * immobile. Ce qui est devant ou derrière glisse, et c'est précisément l'effet
 * recherché — c'est la parallaxe qui donne le volume, pas la rotation.
 */

const DEG = Math.PI / 180

/**
 * L'angle visé, en degrés, pour un curseur à `x` de l'axe (−1 à gauche, +1 à
 * droite) sur un arrêt de champ `hfov`.
 *
 * Deux bornes, et elles ne disent pas la même chose : la fraction du champ
 * garde la même SENSATION d'un arrêt à l'autre, le plafond en degrés garde le
 * même DÉPLACEMENT — la caméra parcourt un arc de rayon × angle, et sur un
 * arrêt large et lointain une amplitude relative la ferait entrer dans un mur.
 */
export function lookYaw(x: number, hfov: number): number {
  const clamped = Math.min(Math.max(x, -1), 1)
  const sign = Math.sign(clamped)
  // La zone morte est retirée PUIS renormalisée : sans la renormalisation, la
  // course utile serait raccourcie d'autant et l'amplitude maximale ne serait
  // plus jamais atteinte au bord de l'écran.
  const beyond = Math.abs(clamped) - LOOK_DEADZONE
  if (beyond <= 0) return 0
  const amount = beyond / (1 - LOOK_DEADZONE)
  return sign * amount * Math.min(LOOK_MAX_FRAC * hfov, LOOK_MAX_DEG)
}

/** Un pas de lissage vers l'angle visé. Le curseur saute d'un bord à l'autre en
 *  une image ; la caméra, non. */
export function approachYaw(current: number, target: number): number {
  return current + (target - current) * LOOK_LERP
}

const pivot = new Vector3()
const forward = new Vector3()
const spin = new Quaternion()
const UP = new Vector3(0, 1, 0)

/**
 * Écrit dans `out` la pose `pose` orbitée de `yawDeg` autour du point situé à
 * `radius` mètres devant elle.
 *
 * **Le champ n'est pas touché** : un regard ne zoome pas. Et la pose d'origine
 * n'est jamais modifiée — c'est ce qui permet de composer ce regard au moment
 * d'écrire dans la caméra, sans que le tour perde la pose que Blender a
 * autorisée. Muter `pose` ferait dériver l'arrêt et un mouvement partirait
 * d'ailleurs que de là où il croit partir.
 *
 * Un angle négatif porte la caméra vers SA gauche : la rotation est celle du
 * monde, et c'est `tests/lookAround.test.ts` qui en verrouille le sens — un
 * signe inversé se voit à l'œil et ne se démontre pas dans une revue de diff.
 */
export function orbitPose(
  out: StopTransform,
  pose: StopTransform,
  radius: number,
  yawDeg: number,
): StopTransform {
  out.hfov = pose.hfov

  if (yawDeg === 0 || radius <= 0) {
    out.position.copy(pose.position)
    out.quaternion.copy(pose.quaternion)
    return out
  }

  forward.set(0, 0, -1).applyQuaternion(pose.quaternion)
  pivot.copy(pose.position).addScaledVector(forward, radius)

  spin.setFromAxisAngle(UP, yawDeg * DEG)
  // La position tourne autour de la VERTICALE passant par le pivot : on la
  // ramène dans le repère du pivot, on tourne, on la remet. Tourner autour de
  // l'origine du monde enverrait la caméra à l'autre bout de la pièce.
  out.position.copy(pose.position).sub(pivot).applyQuaternion(spin).add(pivot)
  // La même rotation sur l'orientation, et dans CET ordre : `spin` d'abord
  // remet l'axe de visée sur le pivot. Multiplier dans l'autre sens
  // appliquerait la rotation dans le repère de la caméra, ce qui inclinerait
  // l'horizon sur tout arrêt qui plonge.
  out.quaternion.copy(spin).multiply(pose.quaternion)
  return out
}

/**
 * Le rayon d'orbite de chaque arrêt : la profondeur de son SUJET.
 *
 * Elle n'est pas inventée — c'est celle de l'ancre de la bulle, c'est-à-dire
 * les nœuds que `bubbles.ts` déclare déjà comme le sujet de l'arrêt. Déclarer
 * une seconde fois « ce que cet arrêt regarde » aurait été deux vérités pour
 * une seule chose, et la première à dériver aurait été la plus silencieuse :
 * un pivot faux ne casse rien, il décentre lentement le sujet pendant le
 * regard.
 *
 * `0` pour un arrêt qui refuse le regard : `orbitPose` rend alors la pose
 * telle quelle, sans qu'aucun appelant ait à connaître l'exception.
 */
export function resolveLookPivots(scene: Object3D, stops: StopTransform[]): number[] {
  return stops.map((stop, i) => {
    const config = CAMERA_STOPS[i]
    if (!config || config.lookAround === false) return 0
    const bubble = BUBBLES.find((b) => b.stop === config.label)
    if (!bubble) return 0
    return anchorDepth(scene, bubble.objects, stop)
  })
}
