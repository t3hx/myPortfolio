import {
  BufferAttribute,
  BufferGeometry,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PlaneGeometry,
  Quaternion,
  Vector3,
} from 'three'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { findScreenPlane } from '@/lib/screenPlane'

/**
 * Le plan de l'écran principal (#142) est DÉRIVÉ du `.glb`, jamais écrit en
 * dur : `Mat_MonitorScreen` est un seul matériau sur une seule primitive de
 * huit sommets, deux rectangles disjoints — l'écran horizontal (celui que
 * `CameraStop_Home` regarde de face, à 0,00°) et l'écran vertical, tourné de
 * 10° en Y. Choisir par l'ordre des sommets marcherait aujourd'hui et
 * casserait au prochain export ; choisir « la face qui regarde la caméra Home
 * et se trouve sur son axe » survit à tout ré-export qui garde la scène.
 *
 * Les dimensions ci-dessous sont celles mesurées dans l'export v13.
 */

const MATERIAL = 'Mat_MonitorScreen'
const MAIN = { center: new Vector3(0, 1.1, -2.275), width: 0.5816, height: 0.3216 }
const VERTICAL = { center: new Vector3(-0.5058, 1.1, -2.2442), width: 0.2816, height: 0.5116 }
const HOME = { position: new Vector3(0, 1.1, -1.718), quaternion: new Quaternion() }

function screenMesh(width: number, height: number, name = MATERIAL): Mesh {
  const material = new MeshBasicMaterial()
  material.name = name
  // PlaneGeometry regarde +Z, comme l'écran principal regarde la caméra Home.
  return new Mesh(new PlaneGeometry(width, height), material)
}

function sceneWith(...children: Object3D[]): Object3D {
  const scene = new Object3D()
  for (const c of children) scene.add(c)
  scene.updateMatrixWorld(true)
  return scene
}

/** Les deux écrans dans UNE géométrie de huit sommets, comme dans le .glb. */
function mergedScreens(): Mesh {
  const verts: number[] = []
  const push = (v: Vector3) => verts.push(v.x, v.y, v.z)
  const quad = (c: Vector3, right: Vector3, up: Vector3, w: number, h: number) => {
    const r = right.clone().multiplyScalar(w / 2)
    const u = up.clone().multiplyScalar(h / 2)
    push(c.clone().sub(r).add(u))
    push(c.clone().sub(r).sub(u))
    push(c.clone().add(r).add(u))
    push(c.clone().add(r).sub(u))
  }
  // Le vertical d'abord, comme dans l'export : l'ordre ne doit rien décider.
  const yaw = (10.06 * Math.PI) / 180
  quad(
    VERTICAL.center,
    new Vector3(Math.cos(yaw), 0, -Math.sin(yaw)),
    new Vector3(0, 1, 0),
    VERTICAL.width,
    VERTICAL.height,
  )
  quad(MAIN.center, new Vector3(1, 0, 0), new Vector3(0, 1, 0), MAIN.width, MAIN.height)
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(verts), 3))
  geometry.setIndex([0, 1, 2, 1, 3, 2, 4, 5, 6, 5, 7, 6])
  const material = new MeshBasicMaterial()
  material.name = MATERIAL
  return new Mesh(geometry, material)
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('findScreenPlane', () => {
  it('finds the main screen among the two quads of one merged geometry', () => {
    const plane = findScreenPlane(sceneWith(mergedScreens()), MATERIAL, HOME)
    expect(plane).not.toBeNull()
    expect(plane!.width).toBeCloseTo(MAIN.width, 4)
    expect(plane!.height).toBeCloseTo(MAIN.height, 4)
    expect(plane!.center.distanceTo(MAIN.center)).toBeLessThan(1e-4)
    // La normale regarde la caméra, quelle que soit l'orientation des faces.
    expect(plane!.normal.z).toBeCloseTo(1, 5)
    expect(plane!.up.y).toBeCloseTo(1, 5)
    expect(plane!.right.x).toBeCloseTo(1, 5)
  })

  it('prefers the quad on the camera axis over a bigger one beside it', () => {
    // Un écran plus grand mais décalé ne doit pas gagner : c'est l'axe qui
    // désigne l'écran que Home cadre, pas la surface.
    const main = screenMesh(MAIN.width, MAIN.height)
    main.position.copy(MAIN.center)
    const big = screenMesh(1.2, 0.8)
    big.position.set(0.9, 1.1, -2.3)
    const plane = findScreenPlane(sceneWith(big, main), MATERIAL, HOME)
    expect(plane!.width).toBeCloseTo(MAIN.width, 4)
  })

  it('applies the mesh transform before measuring', () => {
    // Le .glb pose la translation sur le NŒUD, pas dans les sommets.
    const main = screenMesh(MAIN.width, MAIN.height)
    main.position.copy(MAIN.center)
    main.scale.setScalar(2)
    const plane = findScreenPlane(sceneWith(main), MATERIAL, HOME)
    expect(plane!.width).toBeCloseTo(MAIN.width * 2, 4)
    expect(plane!.center.distanceTo(MAIN.center)).toBeLessThan(1e-4)
  })

  it('turns a face that looks away toward the camera', () => {
    // Le matériau est double face dans l'export : l'ordre d'enroulement des
    // triangles ne doit rien décider non plus.
    const main = screenMesh(MAIN.width, MAIN.height)
    main.position.copy(MAIN.center)
    main.rotation.y = Math.PI
    const plane = findScreenPlane(sceneWith(main), MATERIAL, HOME)
    expect(plane!.normal.z).toBeCloseTo(1, 5)
    expect(plane!.right.x).toBeCloseTo(1, 5)
    expect(plane!.up.y).toBeCloseTo(1, 5)
  })

  it('ignores a screen behind the camera', () => {
    const behind = screenMesh(MAIN.width, MAIN.height)
    behind.position.set(0, 1.1, -1.0)
    expect(findScreenPlane(sceneWith(behind), MATERIAL, HOME)).toBeNull()
  })

  it('warns and returns null when the material is missing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const other = screenMesh(MAIN.width, MAIN.height, 'Mat_Other')
    other.position.copy(MAIN.center)
    expect(findScreenPlane(sceneWith(other), MATERIAL, HOME)).toBeNull()
    expect(warn).toHaveBeenCalledOnce()
    expect(warn.mock.calls[0][0]).toContain(MATERIAL)
  })
})
