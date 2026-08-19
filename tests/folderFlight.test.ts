import { BoxGeometry, Mesh, Object3D, PerspectiveCamera } from 'three'
import { describe, expect, it } from 'vitest'
import { FLIGHT_NEAR_MARGIN } from '@/config/cabinet'
import { bodyParts, flightFill, flightPose } from '@/lib/folderFlight'
import { verticalFov } from '@/lib/stops'

/**
 * Le vol du dossier (#82) doit finir en couvrant le cadre **entièrement** :
 * le panneau DOM (#83) prend le relais en fondu, et un dossier qui laisserait
 * voir la pièce sur un bord ferait apparaître ce liseré pendant tout le fondu.
 *
 * Mesuré avant d'écrire ces tests : à remplissage calculé au plus juste, il
 * restait un liseré en haut et à gauche — d'abord parce que les bords
 * coïncidaient exactement, ensuite parce que l'onglet, qui ne dépasse que d'un
 * côté, gonflait la boîte englobante et décentrait le calcul.
 */

/** Le dossier : 0.28 × 0.19, plus un onglet qui dépasse en haut à gauche. */
function folder(): Object3D[] {
  const body = ['Folder_Back', 'Folder_Front', 'Folder_Page'].map((name) => {
    const m = new Mesh(new BoxGeometry(0.28, 0.19, 0.0015))
    m.name = name
    return m
  })
  const tab = new Mesh(new BoxGeometry(0.09, 0.04, 0.0015))
  tab.name = 'Folder_Tab'
  tab.position.set(-0.08, 0.115, 0)
  const label = new Object3D()
  label.name = 'Folder_Label__x'
  return [...body, tab, label]
}

/** Ce que le cadre mesure, en unités monde, à cette distance. */
function frameAt(distance: number, vfovDeg: number, aspect: number) {
  const halfV = Math.tan((vfovDeg * Math.PI) / 360)
  return { width: 2 * distance * halfV * aspect, height: 2 * distance * halfV }
}

describe('flightFill', () => {
  // L'app tient le champ HORIZONTAL constant et dérive le vertical du ratio du
  // viewport (`stops.ts`) : un test qui figerait le `fov` vertical en faisant
  // varier le ratio décrirait une application qui n'existe pas.
  const ASPECTS: [string, number][] = [
    ['16:9', 16 / 9],
    ['16:10', 16 / 10],
    ['ultra-large 21:9', 21 / 9],
    ['4:3', 4 / 3],
    ['portrait', 9 / 16],
  ]
  // Les deux extrêmes du tour, plus le cadrage de la commode.
  const HFOVS: [string, number][] = [
    ['grand angle (GuitarPoster, 84°)', 83.97],
    ['commode (~56°)', 55.79],
    ['téléobjectif (TelescopeMoon, 7.6°)', 7.63],
  ]

  for (const [hname, hfov] of HFOVS) {
    it.each(ASPECTS)(`couvre le cadre en %s — ${hname}`, (_name, aspect) => {
      const vfov = verticalFov(hfov, aspect)
      const { distance, scale } = flightFill(0.28, 0.19, vfov, aspect, 0.1)
      const frame = frameAt(distance, vfov, aspect)

      // Le dossier agrandi doit couvrir, pas le dossier nu : quand le plan
      // proche impose de rester loin, c'est l'échelle qui rend le remplissage.
      expect(0.28 * scale).toBeGreaterThanOrEqual(frame.width)
      expect(0.19 * scale).toBeGreaterThanOrEqual(frame.height)
    })
  }

  it('déborde plutôt que d’affleurer', () => {
    // Des bords qui coïncident au pixel près laissent voir la pièce dès le
    // premier arrondi. Mesuré : liseré en haut et à gauche.
    const vfov = verticalFov(55.79, 16 / 9)
    const { distance, scale } = flightFill(0.28, 0.19, vfov, 16 / 9, 0.1)
    const frame = frameAt(distance, vfov, 16 / 9)
    expect((0.28 * scale) / frame.width).toBeGreaterThan(1.05)
  })

  it('ne franchit jamais le plan proche', () => {
    // Un objet minuscule demanderait de coller la caméra dessus, et se ferait
    // trancher par le clipping au lieu de remplir quoi que ce soit.
    const near = 0.1
    expect(flightFill(0.001, 0.001, 30, 16 / 9, near).distance).toBeCloseTo(
      near * FLIGHT_NEAR_MARGIN,
      6,
    )
  })

  it('n’agrandit rien sur un écran de bureau', () => {
    // L'échelle est un rattrapage, pas une politique de cadrage : sur tous les
    // ratios larges, le dossier remplit le cadre à sa taille réelle. Elle ne se
    // déclenche que là où couvrir la hauteur demanderait de coller la caméra au
    // carton — un viewport en portrait.
    for (const [, hfov] of HFOVS) {
      for (const [, aspect] of ASPECTS.filter(([, a]) => a >= 1)) {
        const vfov = verticalFov(hfov, aspect)
        expect(flightFill(0.28, 0.19, vfov, aspect, 0.1).scale).toBeCloseTo(1, 6)
      }
    }
  })
})

describe('bodyParts', () => {
  it("écarte l'onglet et l'étiquette", () => {
    expect(bodyParts(folder()).map((p) => p.name)).toEqual([
      'Folder_Back',
      'Folder_Front',
      'Folder_Page',
    ])
  })

  it('rend tout plutôt que rien', () => {
    // Un dossier qui ne serait fait que d'onglets n'existe pas — mais un
    // filtre qui rendrait une liste vide ferait s'effondrer la boîte
    // englobante à un point, et le dossier volerait se coller à l'objectif.
    const tab = new Object3D()
    tab.name = 'Folder_Tab'
    expect(bodyParts([tab])).toHaveLength(1)
  })
})

describe('flightPose', () => {
  it('pose le dossier devant la caméra, face à elle', () => {
    const camera = new PerspectiveCamera(30, 16 / 9, 0.1, 100)
    camera.position.set(0.77, 1.24, -0.87)
    camera.lookAt(1.15, 0.6, -2)
    camera.updateMatrixWorld(true)

    const pose = flightPose(camera, folder())

    // Devant : sur l'axe de visée, jamais derrière l'épaule.
    const toFolder = pose.position.clone().sub(camera.position).normalize()
    const forward = camera.getWorldDirection(camera.position.clone())
    expect(toFolder.dot(forward)).toBeCloseTo(1, 5)

    // Face à elle : le plan du dossier est parallèle au plan image.
    expect(pose.quaternion.angleTo(camera.quaternion)).toBeCloseTo(0, 6)
  })
})
