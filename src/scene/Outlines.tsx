import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import {
  Color,
  EdgesGeometry,
  LineBasicMaterial,
  LineSegments,
  Material,
  Mesh,
  type Object3D,
} from 'three'
import { OutlineEffect } from 'three/addons/effects/OutlineEffect.js'
import { outlineMode } from '@/lib/viewMode'

/**
 * Contours spike (design doc Next Step 3): can WebGL approach the Blender
 * Line Art of the reference renders?
 *
 *   hull  — three's OutlineEffect = the batched inverted-hull: every mesh is
 *           re-drawn backfaced and normal-inflated. Silhouettes ONLY (the
 *           classic cel-shading rim); internal creases don't exist.
 *   edges — one LineSegments(EdgesGeometry(geometry, threshold)) child per
 *           mesh: draws every edge whose faces meet above the threshold
 *           angle. That IS the internal-crease look of Line Art, computed at
 *           runtime. 1px lines (LineBasicMaterial linewidth is ignored by
 *           WebGL); fat lines would need Line2 — noted as follow-up.
 *   both  — hull under edges: silhouette weight + internal creases.
 *
 * Mode is URL-driven (?outline=) so the render-comparison loop can A/B
 * against docs/renders/refs/desk.png deterministically.
 */

const EDGE_THRESHOLD_DEG = 29 // faces meeting above this angle get a line
const EDGE_COLOR = new Color('#10131f') // near-black ink, matches the BD stroke
const HULL_THICKNESS = 0.0028 // inverted-hull inflation, world units

const EDGE_LAYER_NAME = '__spike_edge_lines'

export function Outlines() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)

  const wantHull = outlineMode === 'hull' || outlineMode === 'both'
  const wantEdges = outlineMode === 'edges' || outlineMode === 'both'

  // --- edges: EdgesGeometry overlay per mesh ------------------------------------------
  useEffect(() => {
    if (!wantEdges) return
    const added: LineSegments[] = []
    const offsetted: Material[] = []
    const lineMat = new LineBasicMaterial({ color: EDGE_COLOR })

    scene.traverse((obj: Object3D) => {
      const mesh = obj as Mesh
      if (!mesh.isMesh || mesh.name === EDGE_LAYER_NAME) return
      // Skip the moon sphere: a dense sphere produces a useless wireframe hash.
      if (mesh.name.toLowerCase().includes('moon')) return
      const lines = new LineSegments(new EdgesGeometry(mesh.geometry, EDGE_THRESHOLD_DEG), lineMat)
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
      lineMat.dispose()
      for (const m of offsetted) {
        m.polygonOffset = false
        m.polygonOffsetFactor = 0
        m.polygonOffsetUnits = 0
      }
    }
  }, [scene, wantEdges])

  // --- hull: OutlineEffect wraps the render -------------------------------------------
  // A positive-priority useFrame puts R3F in manual-render mode; the effect
  // then draws scene + inflated backface pass in one call.
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

  useFrame(() => {
    if (effect) effect.render(scene, camera)
  }, wantHull ? 1 : -1)

  return null
}
