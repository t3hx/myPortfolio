import { Box3, Vector3, type Object3D, type PerspectiveCamera } from 'three'
import { FLIGHT_FILL_MARGIN, FLIGHT_NEAR_MARGIN } from '@/config/cabinet'

/**
 * À quelle distance — et à quelle échelle — poser le dossier pour qu'il
 * remplisse le cadre (issue #82).
 *
 * Le projet raisonne en champ HORIZONTAL — c'est l'invariant que `stops.ts`
 * préserve d'un écran à l'autre — mais three ne connaît que le champ vertical
 * de sa caméra. On dérive donc les deux, et on prend la distance la PLUS
 * COURTE des deux contraintes : à cette distance, le dossier couvre le cadre
 * dans les deux axes plutôt que de s'y inscrire.
 *
 * La différence n'est pas cosmétique : le panneau DOM (#83) prend le relais en
 * fondu à la fin du vol, et un dossier simplement « inscrit » laisserait voir
 * la pièce autour de lui pendant tout le fondu.
 */
export function flightFill(
  width: number,
  height: number,
  vfovDeg: number,
  aspect: number,
  near: number,
): { distance: number; scale: number } {
  const halfV = Math.tan((vfovDeg * Math.PI) / 360)
  const halfH = halfV * aspect

  const forWidth = width / 2 / halfH
  const forHeight = height / 2 / halfV
  const ideal = Math.min(forWidth, forHeight) / FLIGHT_FILL_MARGIN

  // Le plan proche est un plancher dur : plus près, le dossier serait tranché.
  const distance = Math.max(ideal, near * FLIGHT_NEAR_MARGIN)

  // Quand le plancher l'emporte — un viewport très haut, où couvrir la hauteur
  // demanderait de coller la caméra au carton — on ne renonce pas à remplir :
  // on AGRANDIT le dossier d'autant. Reculer d'un facteur k le rapetisse de k,
  // le grossir de k rend exactement ce qui a été perdu.
  return { distance, scale: distance / ideal }
}

/** Le centre et la taille, dans le repère monde. */
export function folderBounds(parts: Object3D[]): { center: Vector3; size: Vector3 } {
  const box = new Box3()
  for (const part of parts) box.expandByObject(part)
  return { center: box.getCenter(new Vector3()), size: box.getSize(new Vector3()) }
}

/**
 * Le CORPS du dossier, sans son onglet ni son étiquette.
 *
 * C'est lui qui doit couvrir le cadre, et lui seul : l'onglet ne dépasse que
 * d'un côté, donc l'inclure décale le centre vers le haut et gonfle la hauteur
 * de 0.04 — le calcul croit alors couvrir alors que le corps, lui, laisse voir
 * la pièce sur un bord.
 */
export function bodyParts(parts: Object3D[]): Object3D[] {
  const body = parts.filter((p) => !/Folder_(Tab|Label)/.test(p.name))
  return body.length > 0 ? body : parts
}

/**
 * La pose que le dossier doit atteindre : devant la caméra, face à elle.
 *
 * L'orientation est **celle de la caméra**, pas une rotation calculée : le
 * dossier est plat dans son plan XY local, donc lui donner le quaternion de la
 * caméra rend son plan parallèle au plan image. Toute autre construction
 * (regarder vers la caméra, aligner des axes) rattraperait la même chose avec
 * un risque de roulis en prime.
 */
export function flightPose(
  camera: PerspectiveCamera,
  parts: Object3D[],
): { position: Vector3; quaternion: PerspectiveCamera['quaternion']; scale: number } {
  const { size } = folderBounds(bodyParts(parts))
  const { distance, scale } = flightFill(size.x, size.y, camera.fov, camera.aspect, camera.near)

  const forward = camera.getWorldDirection(new Vector3())
  const position = camera.getWorldPosition(new Vector3()).addScaledVector(forward, distance)

  return { position, quaternion: camera.quaternion.clone(), scale }
}
