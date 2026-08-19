import { Mesh, MeshBasicMaterial, Object3D } from 'three'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  DRAWER_CAPACITY,
  DRAWER_CONTENT_NAMES,
  FOLDER_Z_BACK,
  FOLDER_Z_FRONT,
} from '@/config/cabinet'
import type { Project } from '@/content/projects'
import { buildDrawerGroup } from '@/lib/cabinetDrawer'
import { buildFolders, folderZ } from '@/lib/folders'

/**
 * Un dossier par projet (#80). Trois pannes possibles, toutes muettes :
 *
 *   1. un dossier rangé hors du couloir — son étiquette entre sous le plateau
 *      de la commode et il ne peut plus se soulever au survol (#81) ;
 *   2. des clones qui gardent le nom de l'original — `getObjectByName` rend
 *      alors le premier venu, et `RoomModel`, `bubbleAnchors` et
 *      `LINE_OVERRIDES` résolvent tous par nom ;
 *   3. un matériau partagé — le survol allumerait les cinq dossiers ensemble.
 *
 * Aucune des trois ne casse la compilation. La première ne se voit même qu'au
 * survol, sur un seul plan de la visite.
 */

const PARTS = [
  'Cabinet_TopDrawer_Front',
  'Cabinet_TopDrawer_Back',
  'Cabinet_TopDrawer_Bottom',
  'Cabinet_TopDrawer_LSide',
  'Cabinet_TopDrawer_RSide',
  'Cabinet_TopDrawer_HandleBar',
  'Cabinet_TopDrawer_HandlePost_L',
  'Cabinet_TopDrawer_HandlePost_R',
]

/** Les quatre pièces du dossier, avec l'écart de profondeur du vrai .glb. */
const FOLDER_Z: Record<string, number> = {
  Folder_Back: -2.102,
  Folder_Front: -2.098,
  Folder_Page: -2.1,
  Folder_Tab: -2.099,
}

function mesh(name: string, z: number): Mesh {
  const m = new Mesh(undefined, new MeshBasicMaterial())
  m.name = name
  m.position.set(1.15, 0.6, z)
  return m
}

function room(): Object3D {
  const scene = new Object3D()
  for (const name of PARTS) scene.add(mesh(name, -2))
  for (const name of DRAWER_CONTENT_NAMES) scene.add(mesh(name, FOLDER_Z[name]))
  return scene
}

/** L'étiquette réelle peint dans un `canvas` : le test tourne en Node. */
const stubLabel = (tab: Object3D, project: Project): Object3D => {
  const o = new Object3D()
  o.name = `Folder_Label__${project.slug}`
  o.position.copy(tab.position)
  return o
}

function project(slug: string): Project {
  return {
    slug,
    name: slug,
    tabLabel: slug,
    tagline: 'x',
    year: '2026',
    role: 'x',
    stack: ['x'],
    highlights: ['x'],
  }
}

const many = (n: number) => Array.from({ length: n }, (_, i) => project(`p${i}`))

afterEach(() => {
  vi.restoreAllMocks()
})

describe('folderZ', () => {
  it('range le premier au fond et le dernier devant', () => {
    expect(folderZ(0, 5)).toBeCloseTo(FOLDER_Z_BACK, 6)
    expect(folderZ(4, 5)).toBeCloseTo(FOLDER_Z_FRONT, 6)
  })

  it('dérive le pas du nombre de projets', () => {
    // Coder le pas en dur ferait traverser la façade au dossier de devant dès
    // qu'on ajoute une fiche — c'est ce que le spike a montré à 0.09.
    expect(folderZ(1, 5) - folderZ(0, 5)).toBeCloseTo(0.055, 6)
    expect(folderZ(1, 3) - folderZ(0, 3)).toBeCloseTo(0.11, 6)
  })

  it('centre un dossier unique plutôt que de le coller au fond', () => {
    expect(folderZ(0, 1)).toBeCloseTo((FOLDER_Z_BACK + FOLDER_Z_FRONT) / 2, 6)
  })

  it('garde tout le monde dans le couloir, jusqu’à pleine capacité', () => {
    // Le couloir, c'est les 0.28 m que le tiroir sort. Au-delà, l'étiquette
    // entre dans le plateau de la commode.
    for (let count = 1; count <= DRAWER_CAPACITY; count++) {
      for (let i = 0; i < count; i++) {
        expect(folderZ(i, count)).toBeGreaterThanOrEqual(FOLDER_Z_BACK)
        expect(folderZ(i, count)).toBeLessThanOrEqual(FOLDER_Z_FRONT)
      }
    }
  })
})

describe('buildFolders', () => {
  it('fabrique un dossier par projet', () => {
    const group = buildDrawerGroup(room())!
    const handles = buildFolders(group, many(5), stubLabel)

    expect(handles).toHaveLength(5)
    expect(handles.map((h) => h.slug)).toEqual(['p0', 'p1', 'p2', 'p3', 'p4'])
    // Quatre pièces + l'étiquette bougent ensemble au survol.
    for (const h of handles) expect(h.parts).toHaveLength(DRAWER_CONTENT_NAMES.length + 1)
  })

  it('donne un nom distinct à chaque clone', () => {
    const group = buildDrawerGroup(room())!
    buildFolders(group, many(3), stubLabel)

    const names = group.children.map((c) => c.name).filter((n) => n.startsWith('Folder_Front'))
    expect(new Set(names).size).toBe(names.length)
    expect(names).toContain('Folder_Front__p1')
    // Le premier dossier réutilise l'exemplaire du .glb, sous son nom d'origine.
    expect(names).toContain('Folder_Front')
  })

  it('donne à chaque dossier son propre matériau', () => {
    const group = buildDrawerGroup(room())!
    const handles = buildFolders(group, many(3), stubLabel)

    const fronts = handles.map((h) => h.parts[DRAWER_CONTENT_NAMES.indexOf('Folder_Front')] as Mesh)
    const uuids = fronts.map((f) => (f.material as MeshBasicMaterial).uuid)
    expect(new Set(uuids).size).toBe(3)
  })

  it('préserve l’épaisseur du dossier en le déplaçant', () => {
    // Les quatre pièces ne sont pas coplanaires : c'est cet écart qui fait le
    // volume. Les aligner à plat écraserait le dossier sur lui-même.
    const group = buildDrawerGroup(room())!
    const [first] = buildFolders(group, many(2), stubLabel)

    const back = first.parts[DRAWER_CONTENT_NAMES.indexOf('Folder_Back')]
    const front = first.parts[DRAWER_CONTENT_NAMES.indexOf('Folder_Front')]
    expect(back.position.z).toBeCloseTo(first.restZ, 6)
    expect(front.position.z - back.position.z).toBeCloseTo(0.004, 6)
  })

  it('ne clone rien une seconde fois', () => {
    // `buildDrawerGroup` rend le groupe DÉJÀ monté au remontage du composant :
    // un second passage doublerait le contenu du tiroir.
    const group = buildDrawerGroup(room())!
    const first = buildFolders(group, many(5), stubLabel)
    const before = group.children.length
    const second = buildFolders(group, many(5), stubLabel)

    expect(second).toBe(first)
    expect(group.children.length).toBe(before)
  })

  it('ouvre un tiroir vide plutôt que de montrer un dossier fantôme', () => {
    // Zéro projet est un état valide. L'exemplaire du .glb ne doit pas rester
    // là à représenter un projet qui n'existe pas.
    const group = buildDrawerGroup(room())!
    expect(buildFolders(group, [], stubLabel)).toEqual([])
    for (const name of DRAWER_CONTENT_NAMES) {
      expect(group.getObjectByName(name)!.visible, name).toBe(false)
    }
  })

  it('renonce, en le disant, si le dossier manque au .glb', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const scene = new Object3D()
    for (const name of PARTS) scene.add(mesh(name, -2))
    const group = buildDrawerGroup(scene)!

    expect(buildFolders(group, many(3), stubLabel)).toEqual([])
    expect(warn).toHaveBeenCalled()
  })
})
