import { useGLTF } from '@react-three/drei'
import { type ThreeEvent } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import {
  Color,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  type Material,
  type MeshStandardMaterial,
  type Object3D,
  type Texture,
} from 'three'
import {
  DECAL_ALPHA_TEST,
  DRACO_DECODER_PATH,
  GLASS_OPACITY,
  MODEL_SRC,
  MOON_DETAILED_NAMES,
  MOON_LOWDEF_NAME,
} from '@/config/renderPipeline'
import { extractStops, orderedStops, type StopTransform } from '@/lib/stops'
import { useInteraction } from '@/state/interaction'

interface RoomModelProps {
  /** Appelé une fois la scène parsée et ses matériaux reconstruits. La scène
   *  est passée telle quelle : les ancres de bulles (#48) ont besoin des
   *  boîtes englobantes de ses objets, pas seulement des caméras. */
  onReady: (stops: StopTransform[], scene: Object3D) => void
}

/**
 * Loads the pre-baked unlit scene and rebuilds every material from its
 * `runtime` tag (glTF extras, on the node OR a parent — the exporter places
 * them on either level). The baked lighting lives in the EMISSIVE texture
 * slot of the exported materials — MeshBasicMaterial({ map: emissiveMap })
 * IS the whole render pipeline. No lights, no shadows, no tone mapping.
 * See docs/PORTFOLIO_3D_INTERACTIONS.md §0.
 *
 * Also owns the moon low-def ↔ high-def visibility toggle (§2.3), driven by
 * the TELESCOPE interaction phase.
 */

type RuntimeTag = 'unlit' | 'emissive' | 'decal' | 'glass'

/** The baked texture: the exporter routes it to the emissive slot. */
function bakedMap(src: MeshStandardMaterial): Texture | null {
  return src.emissiveMap ?? src.map ?? null
}

function isBlack(c: Color | undefined): boolean {
  return !c || (c.r === 0 && c.g === 0 && c.b === 0)
}

/**
 * How to treat a material.
 *
 * The `runtime` extras are read FIRST when present, but the 2026-08-09 export
 * (portfolio_v10) ships none — so the treatment is derived from the glTF
 * material itself, which is self-describing and cannot fall out of sync:
 *
 *   - alpha blended, no texture      → glass   (the PC case pane)
 *   - alpha blended/masked + texture → decal   (the amp's Sharmall logo)
 *   - no texture, emissive non-black → emissive (fans, LEDs, bulbs, cat eyes…)
 *   - anything else                  → unlit   (the 100 baked materials)
 *
 * Deriving beats tagging here: an export that forgets the custom properties
 * still renders correctly.
 */
function treatmentOf(obj: Object3D, src: MeshStandardMaterial): RuntimeTag {
  let node: Object3D | null = obj
  while (node) {
    const tag = node.userData?.runtime as RuntimeTag | undefined
    if (tag) return tag
    node = node.parent
  }

  const map = bakedMap(src)
  const blended = src.transparent === true && (src.opacity ?? 1) < 1
  if (blended && !map) return 'glass'
  if ((src.transparent === true || (src.alphaTest ?? 0) > 0) && map) return 'decal'
  if (!map && !isBlack(src.emissive)) return 'emissive'
  return 'unlit'
}

/**
 * Emitters carry their brightness in KHR_materials_emissive_strength, which
 * three loads as `emissiveIntensity` (bulbs ×5, cat eyes ×2.37, stars ×2…).
 * An unlit MeshBasicMaterial has no emissive channel, so the intensity has to
 * be folded into the colour or the emitters render far too dim.
 */
function emissiveColor(src: MeshStandardMaterial): Color {
  const c = src.emissive?.clone() ?? new Color('#ffffff')
  return c.multiplyScalar(src.emissiveIntensity ?? 1)
}

function rebuildMaterial(src: MeshStandardMaterial, tag: RuntimeTag): MeshBasicMaterial {
  const map = bakedMap(src)
  switch (tag) {
    case 'glass':
      return new MeshBasicMaterial({
        color: src.color?.clone() ?? new Color('#ffffff'),
        transparent: true,
        // Prefer the alpha authored in Blender; fall back to the spec value.
        opacity: (src.opacity ?? 1) < 1 ? src.opacity : GLASS_OPACITY,
        depthWrite: false,
        side: DoubleSide,
      })
    case 'decal':
      return new MeshBasicMaterial({
        map,
        transparent: true,
        alphaTest: DECAL_ALPHA_TEST,
        depthWrite: false,
        side: DoubleSide,
      })
    case 'emissive':
      return new MeshBasicMaterial({
        map,
        color: map ? new Color('#ffffff') : emissiveColor(src),
        side: DoubleSide,
      })
    case 'unlit':
    default:
      return new MeshBasicMaterial({
        map,
        color: map
          ? new Color('#ffffff')
          : !isBlack(src.emissive)
            ? emissiveColor(src)
            : (src.color?.clone() ?? new Color('#ffffff')),
        side: DoubleSide,
      })
  }
}

export function RoomModel({ onReady }: RoomModelProps) {
  const { scene } = useGLTF(MODEL_SRC, DRACO_DECODER_PATH)
  const applied = useRef(false)

  useEffect(() => {
    if (applied.current) return
    applied.current = true

    const cache = new Map<string, MeshBasicMaterial>()
    const disposed: Material[] = []

    scene.traverse((obj: Object3D) => {
      const mesh = obj as Mesh
      if (!mesh.isMesh) return
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      const rebuilt = mats.map((m) => {
        const src = m as MeshStandardMaterial
        // Per material, not per mesh: a merged mesh mixes baked surfaces with
        // emitters (e.g. Monitors_Merged, Headset_Merged).
        const tag = treatmentOf(mesh, src)
        const key = `${src.uuid}:${tag}`
        let out = cache.get(key)
        if (!out) {
          out = rebuildMaterial(src, tag)
          out.name = src.name
          cache.set(key, out)
          disposed.push(src)
        }
        return out
      })
      mesh.material = Array.isArray(mesh.material) ? rebuilt : rebuilt[0]
    })
    for (const m of disposed) m.dispose()

    // Moon default state: low-def visible, detailed hidden (§2.3).
    for (const name of MOON_DETAILED_NAMES) {
      const detailed = scene.getObjectByName(name)
      if (detailed) detailed.visible = false
    }

    onReady(orderedStops(extractStops(scene)), scene)
  }, [scene, onReady])

  // TELESCOPE phase drives the low-def ↔ high-def moon swap.
  useEffect(() => {
    const unsub = useInteraction.subscribe((state, prev) => {
      if (state.phase === prev.phase) return
      const inTelescope = state.phase === 'telescope'
      const low = scene.getObjectByName(MOON_LOWDEF_NAME)
      if (low) low.visible = !inTelescope
      for (const name of MOON_DETAILED_NAMES) {
        const detailed = scene.getObjectByName(name)
        if (detailed) detailed.visible = inTelescope
      }
    })
    return unsub
  }, [scene])

  // Raycast entry into the TELESCOPE phase (Telescope_Merged per the
  // interactions doc §2.1); other clicks just log their mesh name —
  // spike-grade discovery of the clickable anchors.
  function onClick(e: ThreeEvent<MouseEvent>) {
    e.stopPropagation()
    const name = e.object.name
    console.info(`[raycast] clicked "${name}"`)
    const { phase, enterTelescope } = useInteraction.getState()
    if (phase === 'parked' && name.toLowerCase().includes('telescope')) enterTelescope()
  }

  return <primitive object={scene} onClick={onClick} />
}

useGLTF.preload(MODEL_SRC, DRACO_DECODER_PATH)
