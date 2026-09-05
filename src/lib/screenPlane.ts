import { Mesh, Quaternion, Vector3, type BufferGeometry, type Object3D } from 'three'

/**
 * Le plan d'un écran, mesuré dans le `.glb` (issue #142).
 *
 * L'intro est un DOM posé dans la 3D, sur la surface du moniteur principal :
 * il lui faut le centre de cette surface, son orientation et ses dimensions.
 * Les écrire en dur marcherait jusqu'au prochain export ; les dériver du
 * graphe survit à un ré-export qui garde la scène, exactement comme le rayon
 * de l'œil du chat ou l'axe des ventilateurs.
 *
 * **La difficulté est que le matériau ne suffit pas.** `Mat_MonitorScreen`
 * couvre les DEUX moniteurs dans une seule primitive de huit sommets : deux
 * rectangles disjoints, l'un face à la caméra Home, l'autre tourné de 10°. On
 * regroupe donc les triangles par PLAN (normale et distance à l'origine), puis
 * on garde, parmi ces plans, celui que la caméra Home a devant elle et sur
 * son axe — pas le plus grand, pas le premier.
 */
export interface ScreenPlane {
  /** Le centre du rectangle, en coordonnées monde. */
  center: Vector3
  /** La normale, orientée VERS la caméra (le matériau est double face). */
  normal: Vector3
  /** L'axe horizontal du rectangle, vers la droite vue de la caméra. */
  right: Vector3
  /** L'axe vertical du rectangle, vers le haut du monde. */
  up: Vector3
  /** Dimensions en mètres, le long de `right` et de `up`. */
  width: number
  height: number
}

export interface Viewer {
  position: Vector3
  quaternion: Quaternion
}

/** Un plan en cours de regroupement : sa normale, et les sommets qu'il porte. */
interface PlaneGroup {
  normal: Vector3
  /** Distance signée du plan à l'origine, le long de `normal`. */
  offset: number
  points: Vector3[]
}

const FORWARD = new Vector3(0, 0, -1)
const WORLD_UP = new Vector3(0, 1, 0)

/** Deux triangles sont coplanaires si leurs normales et leurs distances à
 *  l'origine coïncident à ces tolérances près (0,5° et 1 mm). */
const NORMAL_EPS = 0.01
const OFFSET_EPS = 0.001

function planeGroups(mesh: Mesh): PlaneGroup[] {
  const geometry = mesh.geometry as BufferGeometry
  const position = geometry.getAttribute('position')
  if (!position) return []
  const index = geometry.getIndex()
  const count = index ? index.count : position.count
  const at = (i: number) => {
    const vi = index ? index.getX(i) : i
    return new Vector3().fromBufferAttribute(position, vi).applyMatrix4(mesh.matrixWorld)
  }
  const groups: PlaneGroup[] = []
  const ab = new Vector3()
  const ac = new Vector3()
  for (let i = 0; i + 2 < count; i += 3) {
    const a = at(i)
    const b = at(i + 1)
    const c = at(i + 2)
    const normal = ab.subVectors(b, a).cross(ac.subVectors(c, a))
    if (normal.lengthSq() === 0) continue // triangle dégénéré
    normal.normalize()
    // Même plan, quel que soit le sens de la normale (double face) : normales
    // parallèles, et le sommet `a` posé sur le plan du groupe.
    let group = groups.find(
      (g) =>
        Math.abs(g.normal.dot(normal)) > 1 - NORMAL_EPS &&
        Math.abs(g.normal.dot(a) - g.offset) < OFFSET_EPS,
    )
    if (!group) {
      group = { normal: normal.clone(), offset: normal.dot(a), points: [] }
      groups.push(group)
    }
    group.points.push(a, b, c)
  }
  return groups
}

function measure(group: PlaneGroup, viewer: Viewer): ScreenPlane {
  const normal = group.normal.clone()
  // Centroïde provisoire, pour orienter la normale vers la caméra.
  const centroid = new Vector3()
  for (const p of group.points) centroid.add(p)
  centroid.divideScalar(group.points.length)
  if (viewer.position.clone().sub(centroid).dot(normal) < 0) normal.negate()

  // Base du rectangle : « haut » = la verticale du monde projetée sur le plan
  // (un écran droit dans la pièce), « droite » = ce qui ferme une base
  // directe avec la normale vers le spectateur.
  const up = WORLD_UP.clone().addScaledVector(normal, -WORLD_UP.dot(normal))
  if (up.lengthSq() < 1e-6) up.set(0, 0, 1) // écran à plat : n'arrive pas ici
  up.normalize()
  const right = new Vector3().crossVectors(up, normal).normalize()

  let uMin = Infinity
  let uMax = -Infinity
  let vMin = Infinity
  let vMax = -Infinity
  const d = new Vector3()
  for (const p of group.points) {
    d.subVectors(p, centroid)
    const u = d.dot(right)
    const v = d.dot(up)
    if (u < uMin) uMin = u
    if (u > uMax) uMax = u
    if (v < vMin) vMin = v
    if (v > vMax) vMax = v
  }
  const center = centroid
    .clone()
    .addScaledVector(right, (uMin + uMax) / 2)
    .addScaledVector(up, (vMin + vMax) / 2)
  return { center, normal, right, up, width: uMax - uMin, height: vMax - vMin }
}

/**
 * Le plan d'écran que `viewer` a devant lui, sur son axe, parmi toutes les
 * faces qui portent `materialName`. `null`, avec un avertissement, si aucune.
 */
export function findScreenPlane(
  scene: Object3D,
  materialName: string,
  viewer: Viewer,
): ScreenPlane | null {
  scene.updateMatrixWorld(true)
  const forward = FORWARD.clone().applyQuaternion(viewer.quaternion)
  let best: { plane: ScreenPlane; lateral: number } | null = null
  let seen = false

  scene.traverse((obj) => {
    if (!(obj instanceof Mesh)) return
    const material = obj.material
    // Un tableau de matériaux ne dit pas quelle face est l'écran : ignoré,
    // comme `Outlines` refuse d'encrer ce qu'il ne sait pas départager.
    if (Array.isArray(material) || material.name !== materialName) return
    seen = true
    for (const group of planeGroups(obj)) {
      const plane = measure(group, viewer)
      const toCenter = plane.center.clone().sub(viewer.position)
      const depth = toCenter.dot(forward)
      if (depth <= 0) continue // derrière la caméra
      const lateral = toCenter.addScaledVector(forward, -depth).length()
      if (!best || lateral < best.lateral) best = { plane, lateral }
    }
  })

  if (!best) {
    console.warn(
      seen
        ? `[intro] aucune face de « ${materialName} » devant la caméra — pas d'écran`
        : `[intro] « ${materialName} » absent du .glb — pas d'écran pour l'intro`,
    )
    return null
  }
  return (best as { plane: ScreenPlane }).plane
}
