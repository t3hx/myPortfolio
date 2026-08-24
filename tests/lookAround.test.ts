import { readFileSync } from 'node:fs'
import { Euler, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { CAMERA_STOPS } from '@/config/cameraStops'
import { LOOK_DEADZONE, LOOK_MAX_DEG, LOOK_MAX_FRAC } from '@/config/lookAround'
import { BUBBLES } from '@/content/bubbles'
import { approachYaw, lookYaw, orbitPose } from '@/lib/lookAround'
import { emptyPose, type StopTransform } from '@/lib/stops'

/**
 * Le regard autour du sujet (2026-08-25).
 *
 * Ce que ce fichier verrouille n'est pas « ça bouge » — ça se voit — mais les
 * deux choses qu'aucune capture ne montre : que le SUJET reste exactement
 * centré, et que le sens de rotation est le bon. Un signe inversé se voit à
 * l'œil et ne se démontre pas dans une revue de diff ; un centrage approché ne
 * se voit pas du tout, il décentre lentement pendant qu'on regarde.
 */

/** Une pose qui plonge et qui lace : c'est le cas qui casse une rotation
 *  écrite dans le repère de la caméra plutôt que dans celui du monde. */
function tiltedPose(): StopTransform {
  const pose = emptyPose()
  pose.position.set(1.4, 1.6, -2.2)
  // Un tangage ET un lacet : c'est le cas qui casse une rotation écrite dans
  // le repère de la caméra au lieu de celui du monde.
  pose.quaternion.setFromEuler(new Euler(-0.34, 0.9, 0))
  pose.hfov = 53.13
  return pose
}

function forwardOf(pose: StopTransform): Vector3 {
  return new Vector3(0, 0, -1).applyQuaternion(pose.quaternion)
}

describe("l'angle visé", () => {
  it('est nul au centre, et dans toute la zone morte', () => {
    // Sans zone morte, le cadrage composé dans Blender n'existerait à aucun
    // moment : il ne serait atteint que si le curseur tombait exactement sur la
    // colonne centrale, au pixel près.
    expect(lookYaw(0, 53)).toBe(0)
    expect(lookYaw(LOOK_DEADZONE * 0.9, 53)).toBe(0)
    expect(lookYaw(-LOOK_DEADZONE * 0.9, 53)).toBe(0)
    expect(lookYaw(LOOK_DEADZONE * 1.5, 53)).not.toBe(0)
  })

  it('atteint son amplitude pleine au bord, malgré la zone morte', () => {
    // La zone morte est retirée PUIS renormalisée. Sans la renormalisation, la
    // course utile serait raccourcie d'autant et l'amplitude maximale ne serait
    // jamais atteinte — le réglage mentirait sur lui-même.
    const hfov = 30
    expect(lookYaw(1, hfov)).toBeCloseTo(LOOK_MAX_FRAC * hfov, 6)
    expect(lookYaw(-1, hfov)).toBeCloseTo(-LOOK_MAX_FRAC * hfov, 6)
  })

  it('donne la même part de cadre sur un arrêt large et sur un arrêt serré', () => {
    // C'est TOUT l'intérêt de l'amplitude relative : ce qui se lit comme « un
    // peu » n'est pas un angle, c'est la part du cadre qui bouge. Le tour va de
    // 27° au CV à 84° sur la guitare — un 5° fixe y serait trois fois plus
    // visible d'un arrêt à l'autre.
    expect(lookYaw(1, 27) / 27).toBeCloseTo(lookYaw(1, 40) / 40, 6)
  })

  it('plafonne pour ne pas envoyer la caméra dans un mur', () => {
    // L'amplitude relative ne borne pas le DÉPLACEMENT : la caméra parcourt un
    // arc de rayon × angle, et sur un arrêt large et lointain 9 % du champ font
    // des dizaines de centimètres.
    expect(lookYaw(1, 84)).toBeLessThanOrEqual(LOOK_MAX_DEG)
    expect(LOOK_MAX_FRAC * 84).toBeGreaterThan(LOOK_MAX_DEG)
  })

  it('ne dépasse jamais les bornes, curseur hors cadre compris', () => {
    expect(lookYaw(12, 53)).toBeCloseTo(lookYaw(1, 53), 6)
    expect(lookYaw(-12, 53)).toBeCloseTo(lookYaw(-1, 53), 6)
  })

  it('converge au lieu de diverger', () => {
    let a = 0
    for (let i = 0; i < 300; i++) a = approachYaw(a, 5)
    expect(a).toBeCloseTo(5, 3)
  })
})

describe("l'orbite", () => {
  const RADIUS = 2.4

  it('garde le sujet EXACTEMENT devant la caméra', () => {
    // L'invariant qui rend vraie la phrase « en gardant son focus sur le
    // sujet ». Il n'est pas approché : le pivot est sur l'axe de visée, donc
    // après rotation il est encore à la même distance devant la caméra. Un
    // centrage approché ne se verrait pas — il décentrerait lentement.
    const pose = tiltedPose()
    const pivot = pose.position.clone().addScaledVector(forwardOf(pose), RADIUS)

    for (const angle of [-6, -2.5, 2.5, 6]) {
      const out = orbitPose(emptyPose(), pose, RADIUS, angle)
      const toPivot = pivot.clone().sub(out.position)
      // Toujours à la même distance…
      expect(toPivot.length()).toBeCloseTo(RADIUS, 6)
      // …et toujours pile dans l'axe : le produit scalaire avec la nouvelle
      // direction de visée vaut la distance entière, donc l'angle est nul.
      expect(toPivot.dot(forwardOf(out))).toBeCloseTo(RADIUS, 6)
    }
  })

  it("n'incline jamais l'horizon", () => {
    // La rotation se fait autour de l'axe du MONDE. Écrite dans le repère de la
    // caméra — `pose.quaternion.multiply(spin)` au lieu de l'inverse — elle
    // ajouterait du roulis sur tout arrêt qui plonge, et le tour en compte.
    const pose = tiltedPose()
    const before = new Vector3(0, 1, 0).applyQuaternion(pose.quaternion)
    const out = orbitPose(emptyPose(), pose, RADIUS, 6)
    const after = new Vector3(0, 1, 0).applyQuaternion(out.quaternion)
    // Le haut de la caméra reste dans le plan vertical de sa visée : sa
    // composante horizontale a tourné avec elle, sa hauteur n'a pas bougé.
    expect(after.y).toBeCloseTo(before.y, 6)
  })

  it('ne touche pas au champ — un regard ne zoome pas', () => {
    const pose = tiltedPose()
    const out = orbitPose(emptyPose(), pose, RADIUS, 6)
    expect(out.hfov).toBe(pose.hfov)
  })

  it('laisse la pose d’origine intacte', () => {
    // C'est ce qui permet de composer le regard au moment d'écrire dans la
    // caméra. Fondu dans `pose`, il la ferait dériver à chaque mouvement de
    // souris : le mouvement suivant partirait d'un ailleurs que personne n'a
    // composé, et rien ne le dirait.
    const pose = tiltedPose()
    const p0 = pose.position.clone()
    const q0 = pose.quaternion.clone()
    orbitPose(emptyPose(), pose, RADIUS, 6)
    expect(pose.position.distanceTo(p0)).toBe(0)
    expect(pose.quaternion.angleTo(q0)).toBe(0)
  })

  it('rend la pose telle quelle à angle nul, et sans rayon', () => {
    // Un arrêt qui refuse le regard porte un rayon de 0 : l'exception se règle
    // dans la donnée, aucun appelant n'a à la connaître.
    const pose = tiltedPose()
    for (const [r, a] of [
      [RADIUS, 0],
      [0, 6],
    ]) {
      const out = orbitPose(emptyPose(), pose, r, a)
      expect(out.position.distanceTo(pose.position)).toBe(0)
      expect(out.quaternion.angleTo(pose.quaternion)).toBe(0)
    }
  })

  it('porte la caméra vers SA gauche quand le curseur va à gauche', () => {
    // Le sens est une décision produit — « souris à gauche, la caméra tourne un
    // peu sur la gauche » — et un signe inversé se voit à l'œil sans jamais se
    // démontrer dans une revue de diff.
    const pose = tiltedPose()
    const right = new Vector3(1, 0, 0).applyQuaternion(pose.quaternion)
    const out = orbitPose(emptyPose(), pose, RADIUS, lookYaw(-1, pose.hfov))
    const moved = out.position.clone().sub(pose.position)
    expect(moved.dot(right)).toBeLessThan(0)
  })
})

describe('les exceptions', () => {
  it('sont une liste, pas un réglage à remplir', () => {
    // Le regard est la RÈGLE : un arrêt ajouté demain l'aura sans qu'on y
    // pense, et l'oubli va donc dans le bon sens. Le type l'impose — la
    // propriété ne peut valoir que `false`.
    const opted = CAMERA_STOPS.filter((s) => s.lookAround === false)
    expect(opted.length).toBeLessThan(CAMERA_STOPS.length / 2)
    expect(opted.map((s) => s.label).sort()).toEqual(['CV', 'Scoreboard'])
  })

  it('excluent le CV, qui n’est pas ancré dans le monde', () => {
    // `CvScreen` est un panneau du DOM posé dans le repère de l'ÉCRAN, dont
    // tout le travail est de se lire comme affiché PAR le second moniteur.
    // La caméra orbite, le moniteur glisse, le CV reste cloué au viewport : les
    // deux se décollent, ce qui est le défaut contre lequel cet écran est
    // écrit. Une bulle, elle, est ancrée dans le monde et suit toute seule.
    const cv = CAMERA_STOPS.find((s) => s.label === 'CV')
    expect(cv?.lookAround).toBe(false)
  })

  it('donnent un rayon nul, jamais une exception à connaître ailleurs', () => {
    const source = readFileSync('src/lib/lookAround.ts', 'utf8')
    expect(source).toContain('config.lookAround === false) return 0')
  })
})

describe('le sujet du regard est celui de la bulle', () => {
  it('ne se déclare pas une seconde fois', () => {
    // Deux vérités pour « ce que cet arrêt regarde », et la première à dériver
    // aurait été la plus silencieuse : un pivot faux ne casse rien, il décentre
    // lentement le sujet pendant qu'on le regarde.
    const source = readFileSync('src/lib/lookAround.ts', 'utf8')
    expect(source).toContain('anchorDepth(scene, bubble.objects, stop)')
    // Chaque arrêt qui accepte le regard a bien une bulle d'où tirer sa
    // profondeur : sans elle, `resolveLookPivots` rend 0 et le regard serait
    // muet sans que rien ne le dise.
    for (const stop of CAMERA_STOPS) {
      if (stop.lookAround === false) continue
      const bubble = BUBBLES.find((b) => b.stop === stop.label)
      expect(bubble, `aucune bulle pour l'arrêt « ${stop.label} »`).toBeDefined()
      expect(bubble!.objects.length).toBeGreaterThan(0)
    }
  })
})

describe('la coupure sous mouvement réduit', () => {
  it('est évaluée dans le calcul de la cible, pas après', () => {
    // Un élément qui suit le curseur bouge à chaque mouvement de souris, pour
    // n'importe quelle raison : c'est le cas d'école de ce que le réglage vise
    // — même arbitrage que les pupilles du chat. C'est aussi ce qui garde la
    // boucle de comparaison déterministe, puisqu'elle capture en mouvement
    // réduit.
    const rig = readFileSync('src/scene/CameraRig.tsx', 'utf8')
    const target = rig.slice(
      rig.indexOf('const target ='),
      rig.indexOf('yaw.current = approachYaw'),
    )
    expect(target).toContain('!reducedMotion()')
    expect(target).toContain("phase === 'parked'")
  })

  it('ne fond jamais le regard dans la pose du tour', () => {
    const rig = readFileSync('src/scene/CameraRig.tsx', 'utf8')
    expect(rig).toContain('orbitPose(looked, pose, radius, yaw.current)')
    expect(rig).not.toMatch(/orbitPose\(\s*pose\s*,/)
  })
})
