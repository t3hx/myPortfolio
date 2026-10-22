import { useLoader, type ThreeEvent } from '@react-three/fiber'
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
import { DRACOLoader, GLTFLoader } from 'three-stdlib'
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
import { useLoading } from '@/state/loading'
import { isTelescope } from '@/config/telescope'

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

/**
 * Le chargement passe par `useLoader` de R3F plutôt que par le `useGLTF` de
 * drei (issue #25) : seul `useLoader` accepte un `onProgress`, et c'est lui qui
 * porte les OCTETS du `.glb` — le seul signal de progression honnête ici (voir
 * `src/state/loading.ts` pour la mesure qui disqualifie le compteur d'items).
 *
 * Le reste est ce que drei faisait : mêmes classes (celles de `three-stdlib`,
 * son propre fournisseur) et même mise en place du décodeur draco. Son décodeur
 * meshopt est le seul abandon, assumé — l'`extensionsUsed` du v13 ne déclare que
 * draco, webp et emissive_strength.
 *
 * `three-stdlib` et non `three/examples/jsm` : le DRACOLoader de three déclare
 * ses fichiers de décodeur en `new URL(..., import.meta.url)`, que Vite résout
 * statiquement — 1,3 Mo de décodeur émis dans `dist/` alors qu'on pointe
 * `decoderPath` sur `public/draco/` et qu'on ne les charge jamais. Mesuré.
 *
 * Définis au niveau du module et non dans le composant : R3F ne met PAS ces
 * fonctions dans sa clé de cache (`[loader, url]`), donc une référence fraîche
 * à chaque rendu rejouerait la mise en place sans rien changer au résultat.
 * C'est aussi ce qui garantit que le `preload` du bas de fichier et l'appel de
 * rendu partagent la MÊME entrée de cache : sinon, deux fois 3 Mo.
 */
const dracoLoader = new DRACOLoader().setDecoderPath(DRACO_DECODER_PATH)
const withDraco = (loader: GLTFLoader) => loader.setDRACOLoader(dracoLoader)

/** `lengthComputable` est faux quand le serveur n'annonce pas de
 *  `Content-Length` : on transmet alors 0 et la barre passe en indéterminé,
 *  plutôt que d'afficher un pourcentage inventé. */
const reportBytes = (e: ProgressEvent) =>
  useLoading.getState().report(e.loaded, e.lengthComputable ? e.total : 0)

export function RoomModel({ onReady }: RoomModelProps) {
  const { scene } = useLoader(GLTFLoader, MODEL_SRC, withDraco, reportBytes)
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
          // Le traitement choisi est MARQUÉ, pas seulement appliqué : `Outlines`
          // (#41) a besoin de savoir ce qui émet de la lumière pour ne pas
          // poser un trait sombre dessus. Le re-dériver là-bas ferait deux
          // sources pour une même décision, et la seconde finirait par mentir.
          out.userData.runtime = tag
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

  // L'échange lune stylisée ↔ lune détaillée est piloté par `moonDetailed`, et
  // NON par la phase.
  //
  // C'est le MOMENT qui compte, pas la condition, et il diffère aux deux bouts.
  // À l'aller, `moonDetailed` s'allume quand la caméra est derrière l'oculaire
  // et que l'écran est noir — on regarde l'intérieur du tube, il n'y a rien à
  // regarder pendant l'échange. Au retour, il s'éteint à la FIN du vol, quand
  // la lune est redevenue un petit disque dans la fenêtre. Piloté par la phase,
  // l'échange se voyait des deux côtés : en pleine fenêtre au clic, et en plein
  // cadre à la sortie.
  useEffect(() => {
    const unsub = useInteraction.subscribe((state, prev) => {
      if (state.moonDetailed === prev.moonDetailed) return
      const inTelescope = state.moonDetailed
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
    if (phase === 'parked' && isTelescope(name)) enterTelescope()
  }

  return <primitive object={scene} onClick={onClick} />
}

/* Il n'y a plus de `preload` au niveau du module, et c'est délibéré (#25) :
   `useLoader.preload(loader, url, extensions)` n'accepte PAS d'`onProgress`.
   Comme il partait à l'évaluation du module, c'était LUI qui lançait le
   téléchargement, et l'`onProgress` du rendu n'était jamais atteint — `suspend`
   trouvait la promesse déjà en vol. Mesuré : zéro événement de progression, une
   barre structurellement muette. Le chargement part donc au premier rendu de
   RoomModel, une poignée de millisecondes plus tard.

   L'import paresseux d'App3D reste porteur (issue #24) : sans lui, tout three /
   R3F / drei atterrirait dans le chunk d'entrée, que le visiteur choisisse la 3D
   ou non. Ce n'est simplement plus le `.glb` qu'il retient, c'est le code. */
