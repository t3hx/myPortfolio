import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import { Color, EdgesGeometry, Material, Mesh, Vector2, type Object3D } from 'three'
import { OutlineEffect } from 'three/addons/effects/OutlineEffect.js'
import { LineMaterial } from 'three/addons/lines/LineMaterial.js'
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js'
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js'
import {
  HULL_THICKNESS,
  LINE_COLOR,
  LINE_THRESHOLD_DEG,
  inkSkipReason,
  lineWidthFromUrl,
  type InkSkip,
} from '@/config/lineArt'
import { outlineMode } from '@/lib/viewMode'

/**
 * Contours spike (design doc Next Step 3): approach the Blender Line Art of
 * the reference renders at runtime.
 *
 *   hull  — three's OutlineEffect = the batched inverted hull. View-dependent
 *           SILHOUETTES (the one line type that cannot be baked, since Line
 *           Art silhouettes depend on the camera).
 *   edges — fat-line crease ink: EdgesGeometry(threshold) per mesh rendered
 *           through LineSegments2/LineMaterial for SCREEN-SPACE constant
 *           width, like Grease Pencil strokes (the "Blender feel" jump vs
 *           1px hairlines). Curated per object via LINE_OVERRIDES.
 *   both  — hull + edges: the full BD ink look.
 *
 * `?lw=<px>` overrides the stroke width live for taste tuning.
 * Full fidelity path (documented in the design doc): bake the
 * view-INdependent Line Art (edge marks, creases, material boundaries,
 * chained by Blender) into the .glb; keep hull for silhouettes only.
 */

const EDGE_LAYER_NAME = '__spike_edge_lines'

export function Outlines() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)

  const wantHull = outlineMode === 'hull' || outlineMode === 'both'
  const wantEdges = outlineMode === 'edges' || outlineMode === 'both'

  // Shared fat-line material — width in SCREEN PIXELS (worldUnits: false),
  // needs the drawing-buffer resolution to rasterize correctly.
  const lineMat = useMemo(() => {
    const m = new LineMaterial({ color: LINE_COLOR, linewidth: lineWidthFromUrl() })
    m.worldUnits = false
    return m
  }, [])

  useEffect(() => {
    lineMat.resolution = new Vector2(
      size.width * gl.getPixelRatio(),
      size.height * gl.getPixelRatio(),
    )
  }, [lineMat, size, gl])

  // --- edges: screen-space fat crease lines per mesh ----------------------------------
  useEffect(() => {
    if (!wantEdges) return
    const added: LineSegments2[] = []
    const offsetted: Material[] = []

    // La sonde de curation, dans l'esprit de `__rigDebug`. Une liste
    // d'exclusions qu'on ne peut pas relire finit par contenir des entrées que
    // plus personne ne sait justifier : celle-ci dit, arrêt par arrêt, ce qui
    // a été sauté et POURQUOI.
    const skipped: Record<string, { material: string; reason: InkSkip }> = {}
    let inked = 0

    scene.traverse((obj: Object3D) => {
      const mesh = obj as Mesh
      if (!mesh.isMesh || mesh.name === EDGE_LAYER_NAME) return
      const parents: string[] = []
      let p: Object3D | null = mesh.parent
      while (p) {
        parents.push(p.name)
        p = p.parent
      }

      // Un matériau par maille : le chargeur glTF monte une maille par
      // primitive. Le tableau est le cas dégénéré, et s'il survenait une seule
      // `EdgesGeometry` couvrirait des surfaces sans rapport — on ne peut pas
      // trancher, donc on n'encre pas plutôt que d'encrer de travers.
      const material = Array.isArray(mesh.material) ? null : mesh.material
      const reason = material
        ? inkSkipReason(
            material.name,
            material.userData?.runtime as string | undefined,
            mesh.name,
            parents,
          )
        : 'fine'
      if (reason) {
        skipped[mesh.name] = { material: material?.name ?? '(multiple)', reason }
        return
      }
      inked++

      const edges = new EdgesGeometry(mesh.geometry, LINE_THRESHOLD_DEG)
      const positions = edges.attributes.position.array as Float32Array
      edges.dispose()
      if (positions.length === 0) return

      const lineGeo = new LineSegmentsGeometry()
      lineGeo.setPositions(Array.from(positions))
      const lines = new LineSegments2(lineGeo, lineMat)
      lines.name = EDGE_LAYER_NAME
      lines.renderOrder = 1
      mesh.add(lines)
      added.push(lines)

      // Push the surfaces back a hair so the ink never z-fights.
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      for (const m of mats) {
        if (!m.polygonOffset) {
          m.polygonOffset = true
          m.polygonOffsetFactor = 1
          m.polygonOffsetUnits = 1
          offsetted.push(m)
        }
      }
    })

    ;(window as unknown as Record<string, unknown>).__inkDebug = {
      inked,
      skipped,
      counts: Object.values(skipped).reduce<Record<string, number>>((acc, s) => {
        acc[s.reason ?? '?'] = (acc[s.reason ?? '?'] ?? 0) + 1
        return acc
      }, {}),
    }

    return () => {
      for (const lines of added) {
        lines.parent?.remove(lines)
        lines.geometry.dispose()
      }
      for (const m of offsetted) {
        m.polygonOffset = false
        m.polygonOffsetFactor = 0
        m.polygonOffsetUnits = 0
      }
    }
  }, [scene, wantEdges, lineMat])

  // --- hull: OutlineEffect wraps the render (manual-render mode) ----------------------
  const effect = useMemo(() => {
    if (!wantHull) return null
    // `defaultColor` est un triplet BRUT, poussé tel quel dans l'espace de
    // travail LINÉAIRE du moteur — contrairement à `LineMaterial({ color })`,
    // qui passe par `Color.setStyle` et convertit depuis sRGB. Le triplet
    // écrit en dur ici était `#10131f` simplement divisé par 255 : le rendu le
    // ré-encodait donc en sRGB à la sortie et peignait **#474d62**, un ardoise
    // moyen 12× trop clair. Mesuré : 96 à 100 % des pixels du cerne étaient
    // plus CLAIRS que ce qu'ils recouvraient — une auréole, pas de l'encre.
    // `new Color()` fait la conversion, et garde `LINE_COLOR` seule source.
    const ink = new Color(LINE_COLOR)
    return new OutlineEffect(gl, {
      defaultThickness: HULL_THICKNESS,
      defaultColor: [ink.r, ink.g, ink.b],
      defaultAlpha: 1,
      defaultKeepAlive: true,
    })
  }, [gl, wantHull])

  useFrame(
    () => {
      if (effect) effect.render(scene, camera)
    },
    wantHull ? 1 : -1,
  )

  return null
}
