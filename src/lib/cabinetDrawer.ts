import { Group, type Object3D } from 'three'
import {
  DRAWER_CONTENT_NAMES,
  DRAWER_GROUP_NAME,
  DRAWER_PART_NAMES,
  DRAWER_REQUIRED_PART,
  DRAWER_STOP_LABEL,
} from '@/config/cabinet'
import { CAMERA_STOPS } from '@/config/cameraStops'
import type { Phase } from '@/state/interaction'

/**
 * Fabrique le groupe du tiroir du haut (issue #76).
 *
 * Le `.glb` a un graphe **plat** : ses 157 nœuds sont tous enfants directs de
 * la scène, et le « tiroir » n'existe donc nulle part comme objet. Les douze
 * pièces qui doivent coulisser ensemble — huit pour la caisse, quatre pour le
 * dossier qu'elle contient — sont réunies ici, au chargement.
 *
 * **`attach()` et jamais `add()`.** `attach()` préserve la transformation
 * MONDE de l'objet reparenté ; `add()` la laisse être réinterprétée dans le
 * repère du nouveau parent. Les trois poignées portent des quaternions non
 * triviaux (rotations d'un quart de tour) : avec `add()` elles partiraient de
 * travers. Le groupe étant posé à l'identité, les deux donnent aujourd'hui le
 * même résultat — mais la première ligne qui déplacera ou tournera le groupe
 * transformerait ce détail en bug silencieux.
 */
export function buildDrawerGroup(scene: Object3D): Group | null {
  // `useLoader` met la scène en cache : un remontage retrouve le groupe déjà
  // construit, et le reconstruire lui volerait ses pièces.
  const existing = scene.getObjectByName(DRAWER_GROUP_NAME)
  if (existing instanceof Group) return existing

  if (!scene.getObjectByName(DRAWER_REQUIRED_PART)) {
    console.warn(`[cabinet] "${DRAWER_REQUIRED_PART}" absent du .glb — le tiroir ne s'ouvrira pas.`)
    return null
  }

  const group = new Group()
  group.name = DRAWER_GROUP_NAME
  scene.add(group)

  const missing: string[] = []
  for (const name of [...DRAWER_PART_NAMES, ...DRAWER_CONTENT_NAMES]) {
    const part = scene.getObjectByName(name)
    if (!part) {
      missing.push(name)
      continue
    }
    group.attach(part)
  }

  // Une pièce manquante dégrade le tiroir sans l'annuler (il coulissera sans
  // elle) : on le dit, on ne l'invente pas.
  if (missing.length > 0) {
    console.warn(
      `[cabinet] pièces absentes du .glb, non solidaires du tiroir : ${missing.join(', ')}`,
    )
  }

  return group
}

/**
 * Le tiroir doit-il être sorti ?
 *
 * `phase !== 'touring'` et non `=== 'parked'` : quand le dossier volera vers la
 * caméra (#82) la phase passera à PANEL, et le tiroir doit rester ouvert
 * derrière lui. Le tour qui roule, lui, le referme — `goToIndex` pose
 * `stopIndex` au DÉPART de la course, donc c'est bien la phase, et elle seule,
 * qui distingue « on arrive » de « on s'en va ».
 */
export function drawerShouldBeOpen(phase: Phase, stopIndex: number): boolean {
  return phase !== 'touring' && CAMERA_STOPS[stopIndex]?.label === DRAWER_STOP_LABEL
}

/**
 * La caméra de l'arrêt commode est-elle dans le `.glb` ?
 *
 * `stopIndex` indexe les arrêts RÉELLEMENT présents, `CAMERA_STOPS` les arrêts
 * DÉCLARÉS : les deux ne coïncident que si l'export les porte tous. Sans la
 * caméra de la commode, l'index 5 désignerait le chat — et le tiroir
 * s'ouvrirait sur un plan qui n'a rien à voir. C'est la classe de panne que
 * `tests/stops.test.ts` verrouille déjà pour les poses : plausible, muette, et
 * invisible à l'œil de qui ne regarde pas ce plan-là.
 */
export function cabinetStopPresent(scene: Object3D): boolean {
  const stop = CAMERA_STOPS.find((s) => s.label === DRAWER_STOP_LABEL)
  if (!stop || !scene.getObjectByName(stop.camera)) {
    console.warn(`[cabinet] arrêt "${DRAWER_STOP_LABEL}" absent du .glb — le tiroir reste fermé.`)
    return false
  }
  return true
}

/**
 * La position fermée du tiroir, mémorisée SUR le groupe.
 *
 * `buildDrawerGroup` rend le groupe déjà monté quand il en trouve un — donc au
 * remontage du composant, `group.position.z` vaut la position COURANTE, tiroir
 * ouvert compris. Relire la référence dans la portée de l'effet la ferait
 * dériver de 0.28 à chaque remontage, et l'ouverture suivante viserait 0.56 :
 * une sonde qui mesure la course y verrait toujours 0.28 et confirmerait un
 * tiroir pourtant sorti deux fois trop loin.
 */
export function drawerClosedZ(group: Group): number {
  group.userData.closedZ ??= group.position.z
  return group.userData.closedZ as number
}
