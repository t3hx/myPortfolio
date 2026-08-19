import { Mesh, MeshBasicMaterial, PlaneGeometry, type Group, type Object3D } from 'three'
import {
  DRAWER_CONTENT_NAMES,
  FOLDER_Z_BACK,
  FOLDER_Z_FRONT,
  LABEL_HEIGHT,
  LABEL_OFFSET_Z,
  LABEL_WIDTH,
} from '@/config/cabinet'
import { DECAL_ALPHA_TEST } from '@/config/renderPipeline'
import type { Project } from '@/content/projects'
import { labelTexture } from '@/lib/folderLabel'

/**
 * Un dossier par projet, dans le tiroir (issue #80).
 *
 * Le `.glb` n'en contient **qu'un** : les autres sont clonés au chargement.
 * C'est le nombre de dossiers qui fabrique la cible du deuxième clic — mesuré,
 * un dossier seul au fond du tiroir n'occupe que quelques pour cent de la
 * hauteur du cadre, alors que cinq échelonnés remplissent le tiroir et donnent
 * des onglets de ~100 × 50 px (`docs/renders/spikes/cabinet-folders-x5.png`).
 */
export interface FolderHandle {
  /** La fiche que ce dossier ouvre. */
  slug: string
  /** Les cinq objets qui bougent ensemble : les quatre pièces + l'étiquette. */
  parts: Object3D[]
  /** Sa place au repos, pour que le survol (#81) sache où le reposer. */
  restZ: number
}

/**
 * La profondeur du i-ème dossier, dans le repère du tiroir fermé.
 *
 * Le pas se DÉRIVE du nombre de projets : à cinq il vaut 0.055, à trois 0.11.
 * Le coder en dur ferait sortir le dossier de devant à travers la façade dès
 * qu'on ajoute une fiche — c'est exactement ce qu'a montré le spike.
 */
export function folderZ(index: number, count: number): number {
  if (count <= 1) return (FOLDER_Z_BACK + FOLDER_Z_FRONT) / 2
  return FOLDER_Z_BACK + (index * (FOLDER_Z_FRONT - FOLDER_Z_BACK)) / (count - 1)
}

/**
 * Fabrique l'objet d'étiquette. Injectable pour une seule raison : la vraie
 * implémentation peint dans un `canvas`, que la suite de tests — délibérément
 * en environnement Node, comme tout ce qui touche au graphe three — n'a pas.
 */
export type LabelFactory = (tab: Object3D, project: Project) => Object3D

/** Le plan de texte posé devant la face de l'étiquette cartonnée. */
export function buildLabel(tab: Object3D, project: Project): Mesh {
  const mesh = new Mesh(
    new PlaneGeometry(LABEL_WIDTH, LABEL_HEIGHT),
    // Traitement `decal` du pipeline maison : découpe par alphaTest, et
    // profondeur écrite normalement. En `transparent` sans écriture de
    // profondeur, l'étiquette se peindrait par-dessus une géométrie pourtant
    // devant elle — invisible ici, fatal pendant le vol vers la caméra (#82).
    new MeshBasicMaterial({
      map: labelTexture(project.tabLabel),
      alphaTest: DECAL_ALPHA_TEST,
      transparent: false,
    }),
  )
  mesh.name = `Folder_Label__${project.slug}`
  mesh.position.set(tab.position.x, tab.position.y, tab.position.z + LABEL_OFFSET_Z)
  return mesh
}

/**
 * Construit un dossier par projet et les échelonne dans le tiroir.
 *
 * Idempotent : les poignées sont mémorisées sur le groupe, parce que
 * `buildDrawerGroup` rend le groupe déjà monté au remontage du composant — et
 * un second passage clonerait cinq dossiers de plus, dans le même tiroir.
 */
export function buildFolders(
  group: Group,
  projects: Project[],
  makeLabel: LabelFactory = buildLabel,
): FolderHandle[] {
  const cached = group.userData.folders as FolderHandle[] | undefined
  if (cached) return cached

  const originals = DRAWER_CONTENT_NAMES.map((name) => group.getObjectByName(name))
  if (originals.some((o) => !o)) {
    console.warn(
      `[cabinet] dossier incomplet dans le .glb (${DRAWER_CONTENT_NAMES.join(', ')}) — aucun projet ne sera présenté.`,
    )
    group.userData.folders = []
    return []
  }
  const parts = originals as Object3D[]

  // Les quatre pièces ne sont pas coplanaires (dos, rabat, page, étiquette) :
  // c'est cet écart qui donne son épaisseur au dossier. On le préserve en
  // déplaçant tout le monde relativement au dos.
  const baseZ = parts[0].position.z
  const offsets = parts.map((p) => p.position.z - baseZ)

  // Zéro projet est un état valide — le tiroir s'ouvre alors sur un tiroir
  // vide, ce que le panneau (#83) commentera. L'exemplaire du .glb, lui, ne
  // doit pas rester là à représenter un projet qui n'existe pas.
  if (projects.length === 0) {
    for (const part of parts) part.visible = false
    group.userData.folders = []
    return []
  }
  for (const part of parts) part.visible = true

  const handles: FolderHandle[] = projects.map((project, i) => {
    const restZ = folderZ(i, projects.length)

    const folderParts = parts.map((source, p) => {
      // Le premier dossier réutilise l'exemplaire du .glb ; les suivants en
      // sont des clones. `.clone()` RECOPIE le nom — or `RoomModel`,
      // `bubbleAnchors` et `LINE_OVERRIDES` résolvent tous par nom, et
      // `getObjectByName` rend le premier venu. D'où un suffixe par projet.
      const part = i === 0 ? source : source.clone()
      if (i > 0) {
        part.name = `${source.name}__${project.slug}`
        group.add(part)
      }
      // Le matériau est cloné pour TOUS, y compris l'original : le survol
      // (#81) le teinte, et un matériau partagé allumerait les cinq dossiers
      // ensemble. Une fois ici, jamais à chaque survol — un `.clone()` par
      // événement de souris fuit un matériau à chaque pixel parcouru.
      const mesh = part as Mesh
      if (mesh.isMesh && !Array.isArray(mesh.material)) mesh.material = mesh.material.clone()
      part.position.z = restZ + offsets[p]
      return part
    })

    const tab = folderParts[DRAWER_CONTENT_NAMES.indexOf('Folder_Tab')]
    const label = makeLabel(tab, project)
    group.add(label)

    return { slug: project.slug, parts: [...folderParts, label], restZ }
  })

  group.userData.folders = handles
  return handles
}
