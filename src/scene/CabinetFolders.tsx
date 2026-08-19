import { useFrame, useThree } from '@react-three/fiber'
import gsap from 'gsap'
import { useEffect, useMemo, useRef } from 'react'
import {
  Group,
  Quaternion,
  Vector2,
  Vector3,
  type Mesh,
  type Object3D,
  type PerspectiveCamera,
} from 'three'
import { LineMaterial } from 'three/addons/lines/LineMaterial.js'
import type { LineSegments2 } from 'three/addons/lines/LineSegments2.js'
import {
  FLIGHT_DURATION_S,
  FLIGHT_EASE,
  FLIGHT_RETURN_EASE,
  HOVER_EASE,
  HOVER_LIFT_Y,
  HOVER_OUTLINE_COLOR,
  HOVER_OUTLINE_WIDTH_PX,
  HOVER_SHIFT_Z,
  HOVER_TWEEN_S,
} from '@/config/cabinet'
import { bodyParts, flightPose, folderBounds } from '@/lib/folderFlight'
import { attachOutline, disposeOutline } from '@/lib/folderOutline'
import type { FolderHandle } from '@/lib/folders'
import { useInteraction } from '@/state/interaction'

/**
 * Les dossiers vivants : survol (#81) puis vol vers la caméra (#82).
 *
 * **Le lancer de rayon est fait ici, pas délégué à R3F.** Les dossiers sont
 * ajoutés au graphe impérativement (ce sont des clones d'un nœud du `.glb`,
 * pas des éléments JSX) : les déclarer en `<primitive>` pour hériter des
 * événements les sortirait du groupe du tiroir, qu'ils doivent suivre quand il
 * coulisse. Vingt maillages testés par image ne coûtent rien, et le contrôle
 * est total — un seul dossier survolé, et rien du tout hors d'un tiroir ouvert.
 */
interface CabinetFoldersProps {
  folders: FolderHandle[]
}

/** La pose de repos d'une pièce, pour savoir exactement où la reposer. */
interface Rest {
  object: Object3D
  position: Vector3
  quaternion: Quaternion
}

/** Un dossier en vol : ses pièces voyagent réunies sous un pivot. */
interface Flight {
  index: number
  pivot: Group
  /** Le groupe du tiroir, à qui rendre les pièces au retour. */
  home: Object3D
  restPosition: Vector3
  restQuaternion: Quaternion
  tween: gsap.core.Tween | null
}

export function CabinetFolders({ folders }: CabinetFoldersProps) {
  const gl = useThree((s) => s.gl)
  const size = useThree((s) => s.size)
  const scene = useThree((s) => s.scene)
  // Le tour n'a qu'une caméra, et elle est perspective — `applyProgress`
  // n'écrit que des `fov`. Le type large de R3F couvre un cas qui n'existe pas.
  const camera = useThree((s) => s.camera) as PerspectiveCamera
  const raycaster = useThree((s) => s.raycaster)
  const pointer = useThree((s) => s.pointer)

  const hovered = useRef<number | null>(null)
  const tweens = useRef(new Map<number, gsap.core.Tween>())
  const flight = useRef<Flight | null>(null)

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
        folder.parts.map((object) => ({
          object,
          position: object.position.clone(),
          quaternion: object.quaternion.clone(),
        })),
      )
      for (const part of folder.parts) {
        const mesh = part as Mesh
        if (mesh.isMesh) targets.push({ mesh, folder: i })
      }
    })

    return { outlines, rests, targets }
  }, [folders, material])

  /** Monte ou repose un dossier survolé. `v` va de 0 (rangé) à 1 (offert). */
  function hoverFolder(index: number, v: number) {
    const rests = rig.rests.get(index)
    if (!rests) return
    tweens.current.get(index)?.kill()

    const first = rests[0]
    const state = { v: first ? (first.object.position.y - first.position.y) / HOVER_LIFT_Y : 0 }
    tweens.current.set(
      index,
      gsap.to(state, {
        v,
        duration: HOVER_TWEEN_S,
        ease: HOVER_EASE,
        onUpdate: () => {
          for (const rest of rests) {
            rest.object.position.y = rest.position.y + HOVER_LIFT_Y * state.v
            rest.object.position.z = rest.position.z + HOVER_SHIFT_Z * state.v
          }
        },
      }),
    )
  }

  function showOutline(index: number, visible: boolean) {
    for (const lines of rig.outlines.get(index) ?? []) lines.visible = visible
  }

  function setHovered(next: number | null) {
    if (hovered.current === next) return

    if (hovered.current !== null) {
      showOutline(hovered.current, false)
      hoverFolder(hovered.current, 0)
    }
    if (next !== null) {
      showOutline(next, true)
      hoverFolder(next, 1)
    }

    hovered.current = next
    gl.domElement.style.cursor = next === null ? '' : 'pointer'
  }

  /**
   * Le dossier quitte le tiroir et vole jusqu'à remplir le cadre.
   *
   * Les cinq pièces voyagent sous un **pivot** posé à leur centre : les tweener
   * une à une leur ferait suivre cinq trajectoires parallèles, et le dossier se
   * disloquerait dès la première rotation. `attach()` les y transfère sans rien
   * déplacer, puisqu'il préserve la transformation monde — la même discipline
   * que le groupe du tiroir.
   */
  function takeOff(index: number) {
    const folder = folders[index]
    const home = folder.parts[0]?.parent
    if (!home || flight.current) return

    // Le survol lâche la main sans reposer le dossier : le vol en hérite.
    tweens.current.get(index)?.kill()
    showOutline(index, false)
    hovered.current = null
    gl.domElement.style.cursor = ''

    const pivot = new Group()
    pivot.name = `Folder_Flight__${folder.slug}`
    // Le pivot se pose au centre du CORPS : l'onglet ne dépasse que d'un
    // côté, et le prendre en compte décentrerait le dossier dans le cadre.
    pivot.position.copy(folderBounds(bodyParts(folder.parts)).center)
    scene.add(pivot)
    for (const part of folder.parts) pivot.attach(part)

    const target = flightPose(camera, folder.parts)
    const from = {
      position: pivot.position.clone(),
      quaternion: pivot.quaternion.clone(),
      scale: pivot.scale.clone(),
    }
    const state = { v: 0 }

    flight.current = {
      index,
      pivot,
      home,
      restPosition: from.position,
      restQuaternion: from.quaternion,
      tween: gsap.to(state, {
        v: 1,
        duration: FLIGHT_DURATION_S,
        ease: FLIGHT_EASE,
        onUpdate: () => {
          pivot.position.lerpVectors(from.position, target.position, state.v)
          pivot.quaternion.copy(from.quaternion).slerp(target.quaternion, state.v)
          pivot.scale.setScalar(1 + (target.scale - 1) * state.v)
        },
      }),
    }

    const store = useInteraction.getState()
    store.setCabinet('folder')
    store.selectProject(folder.slug)
    // La phase ne bascule QU'ICI : le tiroir, lui, n'a jamais eu de routage
    // d'entrée à posséder. À partir de maintenant, molette et Échap
    // appartiennent au panneau.
    store.openPanel()
  }

  /** Le dossier regagne sa place. Le tiroir, lui, reste ouvert. */
  function land() {
    const current = flight.current
    if (!current) return
    current.tween?.kill()

    const { pivot, home, index } = current
    const from = {
      position: pivot.position.clone(),
      quaternion: pivot.quaternion.clone(),
      scale: pivot.scale.x,
    }
    const state = { v: 0 }

    current.tween = gsap.to(state, {
      v: 1,
      duration: FLIGHT_DURATION_S,
      ease: FLIGHT_RETURN_EASE,
      onUpdate: () => {
        pivot.position.lerpVectors(from.position, current.restPosition, state.v)
        pivot.quaternion.copy(from.quaternion).slerp(current.restQuaternion, state.v)
        pivot.scale.setScalar(from.scale + (1 - from.scale) * state.v)
      },
      onComplete: () => {
        for (const part of folders[index].parts) home.attach(part)
        // Le dossier était SOULEVÉ au moment du clic : le rendre à sa place
        // veut dire sa pose de repos, pas celle qu'il avait en partant.
        for (const rest of rig.rests.get(index) ?? []) {
          rest.object.position.copy(rest.position)
          rest.object.quaternion.copy(rest.quaternion)
        }
        pivot.removeFromParent()
        flight.current = null
        useInteraction.getState().setCabinet('open')
        useInteraction.getState().selectProject(null)
      },
    })
  }

  // Le clic décolle ; c'est `Échap` — déjà câblé dans CameraRig — qui fait
  // revenir, en rendant la phase à PARKED.
  useEffect(() => {
    const canvas = gl.domElement
    const onClick = () => {
      if (hovered.current === null) return
      if (useInteraction.getState().cabinet !== 'open') return
      takeOff(hovered.current)
    }
    canvas.addEventListener('click', onClick)

    const unsub = useInteraction.subscribe((state, prev) => {
      if (prev.phase === 'panel' && state.phase !== 'panel') land()
    })

    return () => {
      canvas.removeEventListener('click', onClick)
      unsub()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, rig, folders])

  useEffect(() => {
    const running = tweens.current
    const cursorOwner = gl.domElement
    return () => {
      for (const lines of rig.outlines.values()) disposeOutline(lines)
      for (const tween of running.values()) tween.kill()
      running.clear()
      flight.current?.tween?.kill()
      flight.current?.pivot.removeFromParent()
      flight.current = null
      cursorOwner.style.cursor = ''
    }
  }, [rig, gl])

  useEffect(() => () => material.dispose(), [material])

  useFrame(() => {
    // Un dossier n'est saisissable que dans un tiroir ouvert : pendant qu'il
    // coulisse, l'état n'est ni `open` ni `closed`, et rien ne réagit. En vol,
    // le pivot possède les pièces — le survol ne doit surtout pas les reposer.
    if (flight.current) return
    if (useInteraction.getState().cabinet !== 'open' || rig.targets.length === 0) {
      setHovered(null)
      return
    }

    raycaster.setFromCamera(pointer, camera)
    // Non récursif : les cernes sont enfants des pièces, et se cerner soi-même
    // ferait clignoter le survol.
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
