import { Euler, Mesh, Object3D, Quaternion } from 'three'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  DRAWER_CONTENT_NAMES,
  DRAWER_GROUP_NAME,
  DRAWER_PART_NAMES,
  DRAWER_STOP_LABEL,
} from '@/config/cabinet'
import { CAMERA_STOPS } from '@/config/cameraStops'
import {
  buildDrawerGroup,
  cabinetStopPresent,
  drawerClosedZ,
  drawerShouldBeOpen,
} from '@/lib/cabinetDrawer'

/**
 * Le tiroir de la commode (#76) repose sur deux faits du `.glb` que rien, dans
 * le code, ne rend visibles :
 *
 *   1. le graphe est **plat** — le « tiroir » n'est pas un objet, c'est douze
 *      nœuds racines qu'il faut réunir au chargement ;
 *   2. trois de ces nœuds (les poignées) portent des quaternions non triviaux,
 *      donc le reparentage doit préserver la transformation MONDE.
 *
 * Une poignée de travers ou un tiroir qui coulisse en laissant sa façade sur
 * place se voit à l'œil — mais seulement si quelqu'un regarde ce plan-là. Ces
 * tests le regardent à chaque exécution.
 */

/** Une pièce du `.glb` : un mesh nommé, posé quelque part dans la scène. */
function part(name: string, z = -2, quaternion?: Quaternion): Mesh {
  const mesh = new Mesh()
  mesh.name = name
  mesh.position.set(1.15, 0.6, z)
  if (quaternion) mesh.quaternion.copy(quaternion)
  return mesh
}

function roomWith(...names: string[]): Object3D {
  const scene = new Object3D()
  for (const name of names) scene.add(part(name))
  return scene
}

/** Un export complet : les douze pièces solidaires du tiroir. */
function fullRoom(): Object3D {
  return roomWith(...DRAWER_PART_NAMES, ...DRAWER_CONTENT_NAMES)
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('buildDrawerGroup', () => {
  it('réunit la caisse ET son contenu sous un seul groupe', () => {
    const scene = fullRoom()
    const group = buildDrawerGroup(scene)

    expect(group).not.toBeNull()
    // Huit pièces de caisse + quatre du dossier : le dossier doit sortir AVEC
    // le tiroir, sinon il resterait suspendu dans la commode.
    expect(group?.children).toHaveLength(DRAWER_PART_NAMES.length + DRAWER_CONTENT_NAMES.length)
    for (const name of [...DRAWER_PART_NAMES, ...DRAWER_CONTENT_NAMES]) {
      expect(group?.getObjectByName(name)).toBeDefined()
    }
  })

  it('déplace le groupe déplace toutes ses pièces', () => {
    const scene = fullRoom()
    const group = buildDrawerGroup(scene)!
    const front = scene.getObjectByName('Cabinet_TopDrawer_Front')!
    const folder = scene.getObjectByName('Folder_Front')!

    group.position.z += 0.28
    group.updateWorldMatrix(true, true)

    // C'est tout l'objet du groupe : une seule écriture, douze pièces bougées.
    expect(front.getWorldPosition(front.position.clone()).z).toBeCloseTo(-1.72, 5)
    expect(folder.getWorldPosition(folder.position.clone()).z).toBeCloseTo(-1.72, 5)
  })

  it("préserve l'orientation MONDE des poignées (attach, pas add)", () => {
    // Les trois poignées sont tournées d'un quart de tour dans le .glb. `add()`
    // réinterpréterait leur transformation locale dans le repère du groupe ;
    // `attach()` la recalcule pour que rien ne bouge à l'écran.
    const turned = new Quaternion().setFromEuler(new Euler(Math.PI / 2, 0, 0))
    const scene = new Object3D()
    for (const name of DRAWER_PART_NAMES) {
      scene.add(part(name, -2, name.includes('Handle') ? turned : undefined))
    }
    for (const name of DRAWER_CONTENT_NAMES) scene.add(part(name))

    const bar = scene.getObjectByName('Cabinet_TopDrawer_HandleBar')!
    buildDrawerGroup(scene)
    scene.updateWorldMatrix(true, true)

    const after = bar.getWorldQuaternion(new Quaternion())
    expect(after.angleTo(turned)).toBeCloseTo(0, 6)
  })

  it('ne reconstruit pas un groupe déjà monté', () => {
    // `useLoader` met la scène en cache : au remontage du composant, un second
    // groupe volerait ses pièces au premier et le tiroir se scinderait en deux.
    const scene = fullRoom()
    const first = buildDrawerGroup(scene)
    const second = buildDrawerGroup(scene)

    expect(second).toBe(first)
    expect(scene.children.filter((c) => c.name === DRAWER_GROUP_NAME)).toHaveLength(1)
    expect(first?.children).toHaveLength(DRAWER_PART_NAMES.length + DRAWER_CONTENT_NAMES.length)
  })

  it('renonce, en le disant, si la façade du tiroir manque', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const scene = roomWith('Cabinet_TopDrawer_Back', 'Folder_Front')

    expect(buildDrawerGroup(scene)).toBeNull()
    expect(warn).toHaveBeenCalledOnce()
    // Rien n'a été reparenté : un export dégradé ne doit pas laisser de moitié
    // de tiroir dans la scène.
    expect(scene.getObjectByName(DRAWER_GROUP_NAME)).toBeUndefined()
  })

  it('avertit des pièces absentes mais fait coulisser le reste', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const scene = roomWith(...DRAWER_PART_NAMES, 'Folder_Front')

    const group = buildDrawerGroup(scene)

    expect(group?.children).toHaveLength(DRAWER_PART_NAMES.length + 1)
    expect(warn).toHaveBeenCalledOnce()
    expect(warn.mock.calls[0][0]).toContain('Folder_Back')
  })
})

describe('drawerShouldBeOpen', () => {
  const cabinetIndex = CAMERA_STOPS.findIndex((s) => s.label === DRAWER_STOP_LABEL)

  it("s'ouvre à l'arrêt sur la commode", () => {
    expect(drawerShouldBeOpen('parked', cabinetIndex)).toBe(true)
  })

  it("reste fermé pendant qu'on y va", () => {
    // `goToIndex` publie l'arrêt de destination au DÉPART de la course — c'est
    // ce qui allume l'item du menu en partant. Sans la condition de phase, le
    // tiroir s'ouvrirait à l'autre bout de la pièce.
    expect(drawerShouldBeOpen('touring', cabinetIndex)).toBe(false)
  })

  it('reste ouvert quand un panneau prend la main', () => {
    // #82 : le dossier vole vers la caméra et la phase passe à PANEL. Le tiroir
    // doit rester sorti derrière lui.
    expect(drawerShouldBeOpen('panel', cabinetIndex)).toBe(true)
  })

  it("ne s'ouvre à aucun autre arrêt", () => {
    for (let i = 0; i < CAMERA_STOPS.length; i++) {
      if (i === cabinetIndex) continue
      expect(drawerShouldBeOpen('parked', i)).toBe(false)
    }
  })

  it('ne suppose rien hors des bornes', () => {
    expect(drawerShouldBeOpen('parked', -1)).toBe(false)
    expect(drawerShouldBeOpen('parked', CAMERA_STOPS.length)).toBe(false)
  })
})

describe('cabinetStopPresent', () => {
  it("reconnaît l'arrêt quand sa caméra est là", () => {
    const scene = new Object3D()
    const cam = new Object3D()
    cam.name = 'CameraStop_Cabinet'
    scene.add(cam)

    expect(cabinetStopPresent(scene)).toBe(true)
  })

  it("renonce, en le disant, si la caméra de l'arrêt manque", () => {
    // Sans elle, `orderedStops` retire l'arrêt et tous les index suivants
    // glissent d'un cran : `CAMERA_STOPS[5]` désignerait alors le chat, et le
    // tiroir s'ouvrirait sur un plan qui n'a rien à voir.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const scene = roomWith(...DRAWER_PART_NAMES, ...DRAWER_CONTENT_NAMES)

    expect(cabinetStopPresent(scene)).toBe(false)
    expect(warn).toHaveBeenCalledOnce()
  })
})

describe('drawerClosedZ', () => {
  it('mémorise la position fermée sur le groupe, pas dans un effet', () => {
    // `buildDrawerGroup` rend le groupe DÉJÀ monté au remontage du composant.
    // Relire `group.position.z` à ce moment-là prendrait la position ouverte
    // pour la position fermée, et l'ouverture suivante viserait deux fois plus
    // loin — sans qu'aucune mesure de la course ne s'en aperçoive.
    const scene = fullRoom()
    const group = buildDrawerGroup(scene)!
    const closed = drawerClosedZ(group)

    group.position.z = closed + 0.28 // tiroir ouvert
    expect(drawerClosedZ(group)).toBe(closed)

    // Et à travers une reconstruction, qui rend le même groupe.
    expect(drawerClosedZ(buildDrawerGroup(scene)!)).toBe(closed)
  })
})
