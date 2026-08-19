import { EdgesGeometry, type Mesh, type Object3D } from 'three'
import { LineMaterial } from 'three/addons/lines/LineMaterial.js'
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js'
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js'
import { HOVER_OUTLINE_THRESHOLD_DEG } from '@/config/cabinet'

/**
 * Le cerne du dossier survolé (#81).
 *
 * Même recette que le mode `edges` d'`Outlines.tsx` : `EdgesGeometry` pour les
 * arêtes vives, puis `LineSegments2` pour une épaisseur **constante à
 * l'écran**. Une ligne d'un pixel qui s'affine avec la distance ne se lit plus
 * comme un trait, mais comme une partie de l'objet.
 *
 * La coque inversée a été essayée d'abord, et écartée : agrandie assez pour se
 * voir, elle se lit comme un cadre flottant autour du dossier plutôt que comme
 * un cerne.
 *
 * Les lignes sont **enfants de la pièce qu'elles cernent** : elles suivent
 * ainsi la surélévation sans qu'on ait à les déplacer, et elles disparaissent
 * avec elle si le dossier est masqué.
 *
 * Indépendant d'`?outline` : le mode par défaut est `off`, donc rien ne dispute
 * le rendu au cerne en production — mais il ne doit pas non plus en dépendre.
 */
const OUTLINE_NAME = '__folder_outline'

export function attachOutline(parts: Object3D[], material: LineMaterial): LineSegments2[] {
  const lines: LineSegments2[] = []

  for (const part of parts) {
    const mesh = part as Mesh
    if (!mesh.isMesh || !mesh.geometry) continue

    const edges = new EdgesGeometry(mesh.geometry, HOVER_OUTLINE_THRESHOLD_DEG)
    const positions = edges.attributes.position.array as Float32Array
    edges.dispose()
    if (positions.length === 0) continue

    const geometry = new LineSegmentsGeometry()
    geometry.setPositions(Array.from(positions))

    const segments = new LineSegments2(geometry, material)
    segments.name = OUTLINE_NAME
    // Par-dessus les surfaces du dossier, jamais entamé par elles.
    segments.renderOrder = 2
    segments.visible = false
    // Le cerne n'est pas une cible : sans ça, il ferait écran au raycast qui
    // vient justement de le faire apparaître, et le survol clignoterait.
    segments.raycast = () => {}
    mesh.add(segments)
    lines.push(segments)
  }

  return lines
}

export function disposeOutline(lines: LineSegments2[]): void {
  for (const segments of lines) {
    segments.parent?.remove(segments)
    segments.geometry.dispose()
  }
}
