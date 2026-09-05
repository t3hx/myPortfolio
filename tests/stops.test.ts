import { Object3D, PerspectiveCamera, Vector3 } from 'three'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  MOVE_MAX_S,
  MOVE_MIN_S,
  applyPose,
  blendPose,
  emptyPose,
  extractStops,
  moveDuration,
  nextStopIndex,
  orderedStops,
  poseVerticalFov,
  verticalFov,
} from '@/lib/stops'

/**
 * `src/lib/stops.ts` porte le cadrage de toute la visite, et s'est déjà trompé
 * deux fois EN SILENCE :
 *
 *   1. le `yfov` glTF lu comme un champ vertical alors que l'export v12 le
 *      déclare pour un cadre carré — la révélation Home cadrait beaucoup trop
 *      large, sans la moindre erreur ;
 *   2. un nœud `CameraStop_*` sans caméra retombait sur 45°, se parkait au bon
 *      endroit et paraissait sain dans le HUD.
 *
 * Aucune des deux ne se voit à la lecture du code ni dans la console. D'où ces
 * tests : ils transforment deux régressions invisibles en échecs bruyants.
 */

const DEG = 180 / Math.PI
const RAD = Math.PI / 180

/** Une caméra glTF telle que three la charge : `fov` vertical + `aspect`. */
function stopCamera(name: string, yfovDeg: number, aspect: number): PerspectiveCamera {
  const cam = new PerspectiveCamera(yfovDeg, aspect)
  cam.name = name
  return cam
}

function sceneWith(...children: Object3D[]): Object3D {
  const scene = new Object3D()
  for (const c of children) scene.add(c)
  return scene
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('verticalFov', () => {
  it('rend le champ horizontal inchangé sur un cadre carré', () => {
    // Un cadre carré ne distingue pas horizontal et vertical.
    expect(verticalFov(54.43, 1)).toBeCloseTo(54.43, 5)
  })

  it('convertit 54,43° horizontaux en ~32,27° verticaux en 16:9', () => {
    // Le couple de référence de la conversion. Il vient de deux exports
    // successifs qui déclaraient la même caméra de deux façons différentes :
    // 54,43° pour un cadre carré d'un côté, 32,27° de champ vertical 16:9 de
    // l'autre. Les deux décrivent le même cadrage — c'est ce que cette
    // fonction doit prouver.
    expect(verticalFov(54.43, 16 / 9)).toBeCloseTo(32.27, 1)
  })

  it("rétrécit le champ vertical quand le viewport s'élargit", () => {
    // La propriété qui DÉFINIT l'ajustement horizontal : un écran plus large
    // ne montre pas plus de scène en hauteur, il en rogne.
    const carre = verticalFov(60, 1)
    const large = verticalFov(60, 16 / 9)
    const tresLarge = verticalFov(60, 21 / 9)
    expect(large).toBeLessThan(carre)
    expect(tresLarge).toBeLessThan(large)
  })

  it('retombe sur un cadre carré si le ratio est absurde', () => {
    // Une division par zéro produirait un fov infini, donc un écran noir.
    expect(verticalFov(50, 0)).toBeCloseTo(50, 5)
    expect(verticalFov(50, -3)).toBeCloseTo(50, 5)
  })
})

describe('extractStops', () => {
  it('dérive le champ horizontal depuis yfov ET aspectRatio', () => {
    // Home dans l'export v12 : yfov 54,43° déclaré pour un cadre CARRÉ.
    // Le champ horizontal vaut donc 54,43° lui aussi — et surtout pas la
    // valeur qu'on obtiendrait en traitant yfov comme un champ 16:9.
    const stops = extractStops(sceneWith(stopCamera('CameraStop_Home', 54.43, 1)))
    expect(stops.get('CameraStop_Home')?.hfov).toBeCloseTo(54.43, 3)
  })

  it("tient compte de l'aspectRatio quand il n'est pas carré", () => {
    const yfov = 30
    const aspect = 16 / 9
    const attendu = 2 * Math.atan(Math.tan((yfov * RAD) / 2) * aspect) * DEG

    const stops = extractStops(sceneWith(stopCamera('CameraStop_Desk', yfov, aspect)))
    expect(stops.get('CameraStop_Desk')?.hfov).toBeCloseTo(attendu, 5)
    // Un cadre large déclare un champ horizontal plus grand que son vertical.
    expect(stops.get('CameraStop_Desk')!.hfov).toBeGreaterThan(yfov)
  })

  it('lit la pose dans le repère MONDE, à travers un parent', () => {
    // Blender exporte parfois la caméra sous un parent porteur de la
    // transformation. Lire la pose locale donnerait un stop au mauvais endroit.
    const parent = new Object3D()
    parent.position.set(10, 0, 0)
    const cam = stopCamera('CameraStop_Cat', 40, 1)
    cam.position.set(0, 5, 0)
    parent.add(cam)

    const stops = extractStops(sceneWith(parent))
    const pose = stops.get('CameraStop_Cat')!
    expect(pose.position.x).toBeCloseTo(10, 5)
    expect(pose.position.y).toBeCloseTo(5, 5)
  })

  it('avertit et saute un nœud qui porte le bon nom mais AUCUNE caméra', () => {
    // Le piège central. Un Empty nommé `CameraStop_*` produisait un stop
    // parfaitement fonctionnel avec un cadrage de 45° que personne n'a
    // autorisé — plausible à l'œil, donc jamais remarqué.
    const avertir = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const empty = new Object3D()
    empty.name = 'CameraStop_Home'

    const stops = extractStops(sceneWith(empty))

    expect(stops.has('CameraStop_Home')).toBe(false)
    // Compter les avertissements de CE type : la scène de test ne contient
    // qu'un nœud, donc les dix autres stops avertissent légitimement qu'ils
    // sont absents du graphe.
    const sansCamera = avertir.mock.calls.filter((c) => String(c[0]).includes('carries no camera'))
    expect(sansCamera).toHaveLength(1)
    expect(sansCamera[0][0]).toContain('CameraStop_Home')
  })

  it("n'invente JAMAIS un champ de 45°", () => {
    // Formulé sur la valeur plutôt que sur le message : même si le garde-fou
    // ci-dessus était réécrit, un 45° surgi de nulle part resterait un échec.
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const empty = new Object3D()
    empty.name = 'CameraStop_Desk'

    const stops = extractStops(sceneWith(empty))

    for (const stop of stops.values()) {
      expect(stop.hfov).not.toBeCloseTo(45, 3)
    }
  })

  it('avertit et saute un stop absent du graphe', () => {
    const avertir = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const stops = extractStops(sceneWith(stopCamera('CameraStop_Home', 50, 1)))

    expect(stops.size).toBe(1)
    expect(avertir.mock.calls.some((c) => String(c[0]).includes('Missing camera node'))).toBe(true)
  })

  it('avertit une fois de plus quand le graphe ne contient aucune caméra', () => {
    const avertir = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const stops = extractStops(sceneWith())

    expect(stops.size).toBe(0)
    expect(avertir.mock.calls.some((c) => String(c[0]).includes('No CameraStop_'))).toBe(true)
  })
})

describe('orderedStops', () => {
  it("suit l'ordre de CAMERA_STOPS, pas celui du graphe", () => {
    // L'ordre de la visite est défini par le code ; le .glb ne garantit rien.
    // Home est déclaré avant Desk dans CAMERA_STOPS.
    const stops = extractStops(
      sceneWith(stopCamera('CameraStop_Desk', 40, 1), stopCamera('CameraStop_Home', 54.43, 1)),
    )
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const ordonnes = orderedStops(stops)

    expect(ordonnes).toHaveLength(2)
    expect(ordonnes[0].hfov).toBeCloseTo(54.43, 3)
    expect(ordonnes[1].hfov).toBeCloseTo(40, 3)
  })

  it('retire les trous sans décaler silencieusement le reste', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const stops = extractStops(sceneWith(stopCamera('CameraStop_Cat', 40, 1)))
    expect(orderedStops(stops)).toHaveLength(1)
  })
})

/**
 * `blendPose` + `applyPose` ont remplacé `applyProgress` (#115) : la première
 * mélange deux poses, la seconde en écrit une dans la caméra. Ce que ces tests
 * verrouillent n'a pas changé — l'interpolation porte sur le champ HORIZONTAL,
 * l'arrivée est exacte, et le cadrage ne dépend pas du rapport d'écran.
 */
describe('blendPose et applyPose', () => {
  const paliers = [
    { position: { x: 0 }, hfov: 40 },
    { position: { x: 10 }, hfov: 80 },
  ]

  function deuxStops() {
    const scene = sceneWith(
      stopCamera('CameraStop_Home', paliers[0].hfov, 1),
      stopCamera('CameraStop_Desk', paliers[1].hfov, 1),
    )
    scene.getObjectByName('CameraStop_Desk')!.position.x = paliers[1].position.x
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    return orderedStops(extractStops(scene))
  }

  it('interpole le champ HORIZONTAL, puis convertit pour le viewport', () => {
    // Le zoom de la lune (270 mm) vient de cette interpolation : si elle se
    // faisait sur le champ vertical, le mouvement dépendrait du ratio d'écran.
    const stops = deuxStops()
    const cam = new PerspectiveCamera(50, 16 / 9)

    const [a, b] = stops
    applyPose(cam, blendPose(emptyPose(), a, b, 0.5))

    expect(cam.fov).toBeCloseTo(verticalFov(60, 16 / 9), 5)
  })

  it('atteint exactement le cadrage autorisé sur un stop entier', () => {
    const stops = deuxStops()
    const cam = new PerspectiveCamera(50, 16 / 9)

    const [a, b] = stops
    applyPose(cam, blendPose(emptyPose(), a, b, 1))

    expect(cam.fov).toBeCloseTo(verticalFov(80, 16 / 9), 5)
    expect(cam.position.x).toBeCloseTo(10, 5)
  })

  it('rend le même cadrage horizontal sur deux ratios différents', () => {
    // La promesse de l'ajustement horizontal : le cadrage Blender survit à
    // tous les écrans, un viewport plus court rogne haut et bas.
    const stops = deuxStops()
    const large = new PerspectiveCamera(50, 21 / 9)
    const carre = new PerspectiveCamera(50, 1)

    const [a] = stops
    applyPose(large, a)
    applyPose(carre, a)

    const hLarge = 2 * Math.atan(Math.tan((large.fov * RAD) / 2) * large.aspect) * DEG
    const hCarre = 2 * Math.atan(Math.tan((carre.fov * RAD) / 2) * carre.aspect) * DEG
    expect(hLarge).toBeCloseTo(hCarre, 5)
    expect(hLarge).toBeCloseTo(40, 5)
  })

  it('rend exactement les poses d’origine aux deux bouts', () => {
    // Le mélange ne doit rien laisser traîner : à t = 1, la caméra est sur le
    // cadrage autorisé par Blender, pas à un epsilon de lui. C'est ce que le
    // mouvement recopie à l'arrivée pour repartir d'un état propre.
    const stops = deuxStops()
    const [a, b] = stops

    const debut = blendPose(emptyPose(), a, b, 0)
    expect(debut.position.x).toBeCloseTo(0, 10)
    expect(debut.hfov).toBeCloseTo(paliers[0].hfov, 10)

    const fin = blendPose(emptyPose(), a, b, 1)
    expect(fin.position.x).toBeCloseTo(10, 10)
    expect(fin.hfov).toBeCloseTo(paliers[1].hfov, 10)
  })

  it('borne les index, pas les poses', () => {
    // Le bornage a changé d'endroit avec #115 : il n'y a plus de progression
    // continue à écrêter, seulement un index d'arrêt. `nextStopIndex` refuse
    // de sortir du tour, et le mouvement borne l'index qu'on lui demande.
    expect(nextStopIndex(0, -1, 2)).toBeNull()
    expect(nextStopIndex(1, 1, 2)).toBe(1)
  })
})

describe('nextStopIndex', () => {
  it('avance d’un arrêt au suivant', () => {
    expect(nextStopIndex(0, 1, 10)).toBe(1)
    expect(nextStopIndex(4, 1, 10)).toBe(5)
  })

  it('boucle du dernier arrêt vers le PREMIER ARRÊT, jamais vers l’accueil', () => {
    // La décision produit du 2026-08-24 : l'accueil est le seuil du parcours,
    // pas une étape de la boucle. Un modulo rendrait 0 et rejouerait la
    // révélation de la pièce à chaque tour.
    expect(nextStopIndex(9, 1, 10)).toBe(1)
    expect(nextStopIndex(9, 1, 10)).not.toBe(0)
  })

  it('recule jusqu’à l’accueil, et s’y arrête', () => {
    expect(nextStopIndex(1, -1, 10)).toBe(0)
    expect(nextStopIndex(0, -1, 10)).toBeNull()
  })

  it('ne boucle pas sur un tour qui n’a que l’accueil', () => {
    expect(nextStopIndex(0, 1, 1)).toBeNull()
    expect(nextStopIndex(0, 1, 0)).toBeNull()
  })
})

describe('moveDuration', () => {
  const pose = (x: number, hfov: number, yaw = 0) => {
    const p = emptyPose()
    p.position.set(x, 0, 0)
    p.hfov = hfov
    p.quaternion.setFromAxisAngle(new Vector3(0, 1, 0), yaw)
    return p
  }

  it('reste dans ses bornes', () => {
    expect(moveDuration(pose(0, 50), pose(0, 50))).toBeCloseTo(MOVE_MIN_S, 5)
    expect(moveDuration(pose(0, 50), pose(100, 50))).toBeCloseTo(MOVE_MAX_S, 5)
  })

  it('ne se laisse pas piloter par la seule distance', () => {
    // Le fait mesuré qui justifie les trois termes : sur cette scène, le pas
    // le plus COURT (0,72 m) est un demi-tour de 157°, et le plus LONG
    // (3,04 m) ne tourne que de 26°. Sur la distance seule, le demi-tour
    // serait le mouvement le plus rapide de la visite.
    const demiTour = moveDuration(pose(0, 50), pose(0.72, 50, Math.PI * 0.87))
    const traversee = moveDuration(pose(0, 50), pose(3.04, 50, 0.46))
    expect(demiTour).toBeGreaterThan(traversee * 0.9)
  })

  it('compte un changement de focale comme un mouvement', () => {
    // Un zoom se lit comme un travelling, même sans un centimètre parcouru.
    const surPlace = moveDuration(pose(0, 20), pose(0, 20))
    const zoom = moveDuration(pose(0, 20), pose(0, 64))
    expect(zoom).toBeGreaterThan(surPlace)
  })

  it('est symétrique : l’aller et le retour durent autant', () => {
    const a = pose(0, 30)
    const b = pose(2, 60, 1.1)
    expect(moveDuration(a, b)).toBeCloseTo(moveDuration(b, a), 10)
  })
})

describe('poseVerticalFov', () => {
  const pose = { ...emptyPose(), hfov: 53.13, yfov: 31.42 }

  it('keeps the horizontal fit on a free stop, whatever the window', () => {
    // Fenêtre plus haute que 16:9 : le champ vertical GRANDIT, rien ne le borne.
    expect(poseVerticalFov({ ...pose, contain: 0 }, 1.6)).toBeCloseTo(verticalFov(53.13, 1.6), 6)
    expect(poseVerticalFov({ ...pose, contain: 0 }, 1.6)).toBeGreaterThan(31.42)
  })

  it('caps a contained stop at its authored vertical field on a taller window', () => {
    expect(poseVerticalFov({ ...pose, contain: 1 }, 1.6)).toBeCloseTo(31.42, 6)
    // Et ne change rien sur une fenêtre au moins aussi large que composée.
    expect(poseVerticalFov({ ...pose, contain: 1 }, 2.37)).toBeCloseTo(verticalFov(53.13, 2.37), 6)
  })
})
