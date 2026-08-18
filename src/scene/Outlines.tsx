import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import { EdgesGeometry, Material, Mesh, Vector2, type Object3D } from 'three'
import { OutlineEffect } from 'three/addons/effects/OutlineEffect.js'
import { LineMaterial } from 'three/addons/lines/LineMaterial.js'
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js'
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js'
import {
  HULL_THICKNESS,
  LINE_COLOR,
  LINE_OVERRIDES,
  LINE_THRESHOLD_DEG,
  lineWidthFromUrl,
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

function lineFactor(name: string, parents: string[]): number {
  for (const [match, factor] of Object.entries(LINE_OVERRIDES)) {
    if (name.includes(match) || parents.some((p) => p.includes(match))) return factor
  }
  return 1
}

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

    scene.traverse((obj: Object3D) => {
      const mesh = obj as Mesh
      if (!mesh.isMesh || mesh.name === EDGE_LAYER_NAME) return
      const parents: string[] = []
      let p: Object3D | null = mesh.parent
      while (p) {
        parents.push(p.name)
        p = p.parent
      }
      if (lineFactor(mesh.name, parents) === 0) return

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
  const effect = useMemo(
    () =>
      wantHull
        ? new OutlineEffect(gl, {
            defaultThickness: HULL_THICKNESS,
            defaultColor: [0.063, 0.075, 0.122], // #10131f
            defaultAlpha: 1,
            defaultKeepAlive: true,
          })
        : null,
    [gl, wantHull],
  )

  useFrame(
    () => {
      if (effect) effect.render(scene, camera)
    },
    wantHull ? 1 : -1,
  )

  return null
}
