import { BoxGeometry, Mesh, MeshBasicMaterial, Object3D, Raycaster, Vector3 } from 'three'
import { LineMaterial } from 'three/addons/lines/LineMaterial.js'
import { describe, expect, it } from 'vitest'
import { attachOutline, disposeOutline } from '@/lib/folderOutline'

/**
 * Le cerne du dossier survolé (#81). Trois propriétés que le rendu seul ne
 * révélerait qu'en regardant très fort ce plan-là :
 *
 *   1. il est ENFANT de la pièce qu'il cerne — sinon il ne suivrait pas la
 *      surélévation et resterait accroché à la place vide ;
 *   2. il est invisible au repos — un cerne allumé par défaut, ce sont cinq
 *      dossiers surlignés en permanence ;
 *   3. il ne reçoit pas le rayon — sinon il ferait écran au lancer qui vient
 *      de le faire apparaître, et le survol clignoterait.
 */

function part(name: string): Mesh {
  const mesh = new Mesh(new BoxGeometry(0.28, 0.19, 0.0015), new MeshBasicMaterial())
  mesh.name = name
  return mesh
}

const material = () => new LineMaterial({ color: '#8FDBE4' })

describe('attachOutline', () => {
  it('cerne chaque pièce, en enfant de celle-ci', () => {
    const parts = [part('Folder_Back'), part('Folder_Front')]
    const lines = attachOutline(parts, material())

    expect(lines).toHaveLength(2)
    // Enfant : le cerne suit la surélévation sans qu'on le déplace.
    for (let i = 0; i < parts.length; i++) expect(lines[i].parent).toBe(parts[i])
  })

  it('naît éteint', () => {
    const lines = attachOutline([part('Folder_Back')], material())
    expect(lines[0].visible).toBe(false)
  })

  it('ne reçoit pas le rayon', () => {
    const mesh = part('Folder_Back')
    const lines = attachOutline([mesh], material())
    lines[0].visible = true

    const ray = new Raycaster(new Vector3(0, 0, 5), new Vector3(0, 0, -1))
    const hits = ray.intersectObject(mesh, true)

    expect(hits.length).toBeGreaterThan(0)
    expect(hits.every((h) => h.object === mesh)).toBe(true)
  })

  it('ignore ce qui n’est pas un maillage', () => {
    // L'étiquette d'un dossier peut être un objet nu selon la fabrique
    // injectée ; il n'y a alors rien à cerner, et surtout rien à faire planter.
    expect(attachOutline([new Object3D()], material())).toHaveLength(0)
  })

  it('se retire proprement', () => {
    const parts = [part('Folder_Back'), part('Folder_Front')]
    const lines = attachOutline(parts, material())
    disposeOutline(lines)

    for (const p of parts) expect(p.children).toHaveLength(0)
  })
})
