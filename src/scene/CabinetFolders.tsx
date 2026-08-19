import { useFrame, useThree } from '@react-three/fiber'
import gsap from 'gsap'
import { useEffect, useMemo, useRef } from 'react'
import { Vector2, type Mesh, type Object3D } from 'three'
import { LineMaterial } from 'three/addons/lines/LineMaterial.js'
import type { LineSegments2 } from 'three/addons/lines/LineSegments2.js'
import {
  HOVER_EASE,
  HOVER_LIFT_Y,
  HOVER_OUTLINE_COLOR,
  HOVER_OUTLINE_WIDTH_PX,
  HOVER_SHIFT_Z,
  HOVER_TWEEN_S,
} from '@/config/cabinet'
import { attachOutline, disposeOutline } from '@/lib/folderOutline'
import type { FolderHandle } from '@/lib/folders'
import { useInteraction } from '@/state/interaction'

/**
 * Le survol des dossiers (#81) : cerne + surélévation.
 *
 * Sans lui, cinq dossiers côte à côte ne disent pas lequel on vise, et
 * l'étiquette du fond reste à moitié cachée par sa voisine. C'est ce qui
 * transforme le tiroir en cible cliquable — le deuxième clic de l'épique #12.
 *
 * **Le lancer de rayon est fait ici, pas délégué à R3F.** Les dossiers sont
 * ajoutés au graphe impérativement (ce sont des clones d'un nœud du `.glb`,
 * pas des éléments JSX) : les déclarer en `<primitive>` pour hériter des
 * événements les sortirait du groupe du tiroir, qu'ils doivent suivre quand il
 * coulisse. Vingt maillages testés par image ne coûtent rien, et le contrôle
 * est total — un seul dossier survolé, et rien du tout tant que le tiroir
 * n'est pas ouvert.
 */
interface CabinetFoldersProps {
  folders: FolderHandle[]
}

/** La pose de repos d'une pièce, pour savoir où la reposer. */
interface Rest {
  object: Object3D
  y: number
  z: number
}

export function CabinetFolders({ folders }: CabinetFoldersProps) {
  const gl = useThree((s) => s.gl)
  const size = useThree((s) => s.size)
  const camera = useThree((s) => s.camera)
  const raycaster = useThree((s) => s.raycaster)
  const pointer = useThree((s) => s.pointer)

  const hovered = useRef<number | null>(null)
  const tweens = useRef(new Map<number, gsap.core.Tween>())

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

  // Cernes et poses de repos, montés une fois par jeu de dossiers.
  const rig = useMemo(() => {
    const outlines = new Map<number, LineSegments2[]>()
    const rests = new Map<number, Rest[]>()
    const targets: { mesh: Mesh; folder: number }[] = []

    folders.forEach((folder, i) => {
      outlines.set(i, attachOutline(folder.parts, material))
      rests.set(
        i,
        folder.parts.map((object) => ({ object, y: object.position.y, z: object.position.z })),
      )
      for (const part of folder.parts) {
        const mesh = part as Mesh
        if (mesh.isMesh) targets.push({ mesh, folder: i })
      }
    })

    return { outlines, rests, targets }
  }, [folders, material])

  useEffect(() => {
    // Capturés dans l'effet : au nettoyage, `tweens.current` peut déjà pointer
    // ailleurs, et `gl.domElement` avoir été remplacé — on rendrait alors son
    // curseur à un canvas qui n'existe plus, en laissant l'autre en `pointer`.
    const running = tweens.current
    const cursorOwner = gl.domElement
    return () => {
      for (const lines of rig.outlines.values()) disposeOutline(lines)
      for (const tween of running.values()) tween.kill()
      running.clear()
      cursorOwner.style.cursor = ''
    }
  }, [rig, gl])

  useEffect(() => () => material.dispose(), [material])

  /** Monte ou repose un dossier. `v` va de 0 (rangé) à 1 (offert). */
  function moveFolder(index: number, v: number) {
    const rests = rig.rests.get(index)
    if (!rests) return
    tweens.current.get(index)?.kill()

    const state = { v: rests[0] ? (rests[0].object.position.y - rests[0].y) / HOVER_LIFT_Y : 0 }
    tweens.current.set(
      index,
      gsap.to(state, {
        v,
        duration: HOVER_TWEEN_S,
        ease: HOVER_EASE,
        onUpdate: () => {
          for (const rest of rests) {
            rest.object.position.y = rest.y + HOVER_LIFT_Y * state.v
            rest.object.position.z = rest.z + HOVER_SHIFT_Z * state.v
          }
        },
      }),
    )
  }

  function setHovered(next: number | null) {
    if (hovered.current === next) return

    if (hovered.current !== null) {
      for (const lines of rig.outlines.get(hovered.current) ?? []) lines.visible = false
      moveFolder(hovered.current, 0)
    }
    if (next !== null) {
      for (const lines of rig.outlines.get(next) ?? []) lines.visible = true
      moveFolder(next, 1)
    }

    hovered.current = next
    gl.domElement.style.cursor = next === null ? '' : 'pointer'
  }

  useFrame(() => {
    // Un dossier n'est saisissable que dans un tiroir ouvert : pendant qu'il
    // coulisse, l'état n'est ni `open` ni `closed`, et rien ne réagit.
    if (useInteraction.getState().cabinet !== 'open' || rig.targets.length === 0) {
      setHovered(null)
      return
    }

    raycaster.setFromCamera(pointer, camera)
    // Non récursif : les cernes sont enfants des pièces, et se cerner
    // soi-même ferait clignoter le survol.
    const hits = raycaster.intersectObjects(
      rig.targets.map((t) => t.mesh),
      false,
    )
    if (hits.length === 0) {
      setHovered(null)
      return
    }
    setHovered(rig.targets.find((t) => t.mesh === hits[0].object)?.folder ?? null)
  })

  return null
}
