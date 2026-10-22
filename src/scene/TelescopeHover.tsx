import { useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import type { Mesh, Object3D } from 'three'
import { Raycaster, Vector2 } from 'three'
import { LineMaterial } from 'three/addons/lines/LineMaterial.js'
import { HOVER_OUTLINE_COLOR, HOVER_OUTLINE_WIDTH_PX } from '@/config/cabinet'
import { TELESCOPE_OBJECT, isTelescope } from '@/config/telescope'
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
  const { camera, gl: renderer } = useThree()
  const hovered = useInteraction((s) => s.telescopeHovered)
  const raycaster = useRef(new Raycaster())

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

  /**
   * Le survol est décidé par UN lancer de rayon par mouvement de souris, et non
   * par les événements `onPointerOver` / `onPointerOut` de react-three-fiber.
   *
   * Posés sur la scène entière, ces deux-là se déclenchent pour CHAQUE maillage
   * traversé : entrer sur le télescope allumait le cerne, puis un `pointerOut`
   * retardé venant d'un objet voisin l'éteignait — et inversement. Résultat
   * mesuré : un cerne qui ne s'allumait pas quand il fallait, et qui
   * s'allumait quand la souris était ailleurs.
   *
   * Un rayon ne s'apparie avec rien : à chaque mouvement, on demande ce qui est
   * touché EN PREMIER dans toute la scène, et le cerne s'allume si c'est le
   * télescope. Un seul état, pas d'ordre d'événements à faire tenir.
   */
  useEffect(() => {
    if (!rig) return
    const canvas = renderer.domElement
    const pointer = new Vector2()

    const onMove = (e: PointerEvent) => {
      const { phase, hoverTelescope } = useInteraction.getState()
      if (phase !== 'parked') return hoverTelescope(false)
      const r = canvas.getBoundingClientRect()
      pointer.set(
        ((e.clientX - r.left) / r.width) * 2 - 1,
        -((e.clientY - r.top) / r.height) * 2 + 1,
      )
      raycaster.current.setFromCamera(pointer, camera)
      // La scène ENTIÈRE, pas le seul télescope : viser l'objet isolément
      // l'allumerait à travers ce qui le cache.
      const hit = raycaster.current.intersectObject(scene, true)[0]
      hoverTelescope(!!hit && isTelescope(hit.object.name))
    }
    const onLeave = () => useInteraction.getState().hoverTelescope(false)

    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerleave', onLeave)
    return () => {
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerleave', onLeave)
    }
  }, [rig, scene, camera, renderer])

  // Le drapeau ne s'allume qu'en phase PARKED, donc le cerne s'éteint tout seul
  // dès que l'excursion commence — il resterait sinon allumé sur un objet qu'on
  // ne voit plus.
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
