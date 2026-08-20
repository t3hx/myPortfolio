import { useThree } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import type { Mesh, Object3D } from 'three'
import { Vector2 } from 'three'
import { LineMaterial } from 'three/addons/lines/LineMaterial.js'
import { HOVER_OUTLINE_COLOR, HOVER_OUTLINE_WIDTH_PX } from '@/config/cabinet'
import { TELESCOPE_OBJECT } from '@/config/telescope'
import { attachOutline, disposeOutline } from '@/lib/folderOutline'
import { useInteraction } from '@/state/interaction'

/**
 * Le cerne du télescope au survol (issue #106).
 *
 * Le télescope était cliquable sans jamais le dire : rien ne distinguait le
 * seul objet interactif de l'arrêt du décor qui l'entoure. Les dossiers de la
 * commode répondaient déjà au survol (#81) — c'est la même promesse, donc le
 * même cerne, réutilisé tel quel plutôt que redessiné.
 *
 * **Il n'apparaît qu'à l'arrêt du télescope, en phase PARKED** : c'est
 * exactement la condition sous laquelle le clic fait quelque chose
 * (`RoomModel`). Un cerne qui s'allume là où le clic ne répond pas serait une
 * promesse non tenue — la même faute que le survol des cartouches de formation.
 */
interface TelescopeHoverProps {
  /** La scène du `.glb`, telle que `RoomModel` la passe à `onReady`. */
  scene: Object3D
}

export function TelescopeHover({ scene }: TelescopeHoverProps) {
  const { size, gl } = useThree()
  const hovered = useInteraction((s) => s.telescopeHovered)

  const material = useMemo(() => {
    const m = new LineMaterial({
      color: HOVER_OUTLINE_COLOR,
      linewidth: HOVER_OUTLINE_WIDTH_PX,
    })
    // Épaisseur en pixels écran — d'où la résolution du tampon de dessin.
    m.worldUnits = false
    return m
  }, [])

  useEffect(() => {
    material.resolution = new Vector2(
      size.width * gl.getPixelRatio(),
      size.height * gl.getPixelRatio(),
    )
  }, [material, size, gl])

  const rig = useMemo(() => {
    const object = scene.getObjectByName(TELESCOPE_OBJECT)
    if (!object) {
      console.warn(`[telescope] « ${TELESCOPE_OBJECT} » absent du .glb — pas de cerne`)
      return null
    }
    const parts: Mesh[] = []
    object.traverse((child) => {
      if ((child as Mesh).isMesh) parts.push(child as Mesh)
    })
    const lines = attachOutline(parts, material)
    for (const line of lines) line.visible = false
    return { object, lines }
  }, [scene, material])

  useEffect(() => {
    const lines = rig?.lines
    return () => {
      if (lines) disposeOutline(lines)
      material.dispose()
    }
  }, [rig, material])

  // `RoomModel` n'allume le drapeau qu'en phase PARKED, donc le cerne s'éteint
  // tout seul dès que l'excursion commence — il resterait sinon allumé sur un
  // objet qu'on ne voit plus.
  useEffect(() => {
    if (!rig) return
    for (const line of rig.lines) line.visible = hovered
    document.body.style.cursor = hovered ? 'pointer' : ''
    return () => {
      document.body.style.cursor = ''
    }
  }, [hovered, rig])

  // Ce composant ne rend RIEN : les lignes sont déjà enfants des pièces
  // qu'elles cernent (`attachOutline`), donc déjà dans la scène.
  return null
}
