import { describe, expect, it } from 'vitest'
import { INTRO_PARTICLES } from '@/config/intro'
import { LAB_PLAN_ORDER } from '@/content/labPlan'
import { INTRO_BEATS, INTRO_DURATION_S, INTRO_PHASES } from '@/lib/intro'
import {
  CX,
  CY,
  LAB_SUBGROUPS,
  NAME_Y,
  cameraA,
  etchTitle,
  flashOpacity,
  flickerOn,
  labDashOffset,
  labOpacity,
  makeParticles,
  makeStars,
  nameLetter,
  novaPoint,
  novaOpacity,
  phaseWordAlpha,
  rings,
  starAlpha,
  swirlActive,
  swirlOpacity,
  swirlPoint,
  triangle1,
  triangle2,
  triangle3,
  worldA,
  worldB,
} from '@/lib/introScene'

/**
 * La phase 1 de l'intro, « L'idée » (#144), en fonctions pures de T. Les
 * nombres sont ceux de la partition du handoff (design/intro/intro-scene.jsx) ;
 * ces tests verrouillent les temps forts et la forme du mouvement, pas chaque
 * valeur — le mouvement se juge en mouvement.
 */
const { arrival, suck, bang, pan, plunge } = INTRO_BEATS

describe('cameraA', () => {
  it('holds the centre and creeps in by 5 % across phase 1', () => {
    expect(cameraA(0)).toEqual({ scale: 1, fx: CX, fy: CY })
    const end = cameraA(INTRO_PHASES[1].start)
    expect(end.scale).toBeCloseTo(1.05, 6)
    expect(end.fx).toBeCloseTo(CX, 6)
  })

  /**
   * LA JOINTURE (#147). Le panoramique et la plongée sont deux séquences pour
   * qui les écrit et UN SEUL mouvement pour qui les regarde. Elles arrivaient
   * toutes deux à vitesse nulle — `sine.inOut` d'un côté, un exposant `u^2,2`
   * plat en zéro de l'autre — et la caméra s'immobilisait entre les deux.
   *
   * Mesuré alors, en vitesse logarithmique (la seule qui se compare : un zoom
   * se perçoit en proportion par seconde) : 0,007 par seconde à la jointure,
   * contre 0,55 au plus fort du panoramique. Rien sur une image fixe, un temps
   * mort à l'œil.
   *
   * Le seuil est le dixième de la vitesse du panoramique : au-dessous, ça ne
   * s'enchaîne plus, ça reprend.
   */
  it('never stands still between the pan and the plunge', () => {
    const dt = 0.01
    const rate = (t: number) => (Math.log(cameraA(t + dt).scale) - Math.log(cameraA(t).scale)) / dt
    let peak = 0
    for (let t = pan; t < plunge; t += dt) peak = Math.max(peak, rate(t))
    for (let t = pan + 0.4; t < plunge + 0.6; t += dt) {
      expect(rate(t)).toBeGreaterThan(peak / 10)
    }
    // Et elle accélère de part et d'autre : le relais passe la vitesse, il ne
    // la rend pas. La pointe de la plongée reste celle d'avant, ~2,7 par
    // seconde — ce n'est pas la plongée qu'on a accélérée, c'est le trou
    // qu'on a enlevé.
    expect(rate(plunge - 0.02)).toBeGreaterThan(rate(pan + 0.4))
    expect(rate(plunge + 0.02)).toBeGreaterThan(rate(plunge - 0.02) * 0.9)
    expect(rate(plunge + 1.5)).toBeGreaterThan(2.4)
    expect(rate(plunge + 1.5)).toBeLessThan(3)
  })

  it('reaches 2.2 at the plunge and never zooms out', () => {
    expect(cameraA(plunge).scale).toBeCloseTo(2.2, 6)
    let last = 0
    for (let t = 0; t <= 10.3; t += 0.05) {
      const s = cameraA(t).scale
      expect(s).toBeGreaterThanOrEqual(last - 1e-9)
      last = s
    }
  })
})

describe('worldA', () => {
  it('is whole through phase 1 and gone after the plunge', () => {
    expect(worldA(0)).toEqual({ opacity: 1, shown: true })
    expect(worldA(bang)).toEqual({ opacity: 1, shown: true })
    expect(worldA(plunge + 1.6).shown).toBe(false)
  })
})

describe('triangle1', () => {
  it('is invisible before its arrival, then whole', () => {
    expect(triangle1(arrival - 0.1).opacity).toBe(0)
    expect(triangle1(arrival + 1).opacity).toBeCloseTo(1, 6)
  })

  it('arrives huge and settles to its size before the suction', () => {
    expect(triangle1(arrival).size).toBeCloseTo(1680, 3) // 420 × 6.2 / 1.55
    // À 2 px près : l'ease d'arrivée finit à 3,4 s, juste avant la succion.
    expect(Math.abs(triangle1(suck - 0.5).size - 420)).toBeLessThan(2)
  })

  it('anticipates by growing a little just before being sucked in', () => {
    expect(triangle1(suck).size).toBeGreaterThan(triangle1(suck - 0.5).size)
  })

  it('is sucked to nothing, spinning, and blows out at the bang', () => {
    const late = triangle1(bang - 0.02) // la succion est finie à 5,30 s
    expect(late.size).toBeLessThan(10)
    expect(late.rot).toBeGreaterThan(900)
    expect(late.glow).toBeGreaterThan(3)
    expect(triangle1(bang).opacity).toBe(0)
  })

  it('lights only its top side, with a core that appears mid-suction', () => {
    expect(triangle1(2).lit).toEqual([0])
    expect(triangle1(suck).coreOp).toBe(0)
    expect(triangle1(suck + 1.2).coreOp).toBeGreaterThan(0)
    expect(triangle1(bang + 0.2).coreOp).toBe(0)
  })
})

describe('the stars', () => {
  it('are seeded: the same sky every time', () => {
    expect(makeStars()).toEqual(makeStars())
  })

  it('are six groups, three fine and three bright, spread past the frame', () => {
    const groups = makeStars()
    expect(groups.map((g) => g.points.length)).toEqual([58, 58, 58, 24, 24, 24])
    for (const g of groups)
      for (const [x, y] of g.points) {
        expect(x).toBeGreaterThanOrEqual(-500)
        expect(x).toBeLessThanOrEqual(2420)
        expect(y).toBeGreaterThanOrEqual(-350)
        expect(y).toBeLessThanOrEqual(1430)
      }
  })

  it('fade in one group after the other, then twinkle', () => {
    const [first, , , , , last] = makeStars()
    expect(starAlpha(first, 0)).toBe(0)
    expect(starAlpha(last, 0.5)).toBe(0) // décalé de 5 × 0,22 s
    expect(starAlpha(first, 3)).toBeGreaterThan(0)
    expect(starAlpha(first, 3)).toBeLessThanOrEqual(first.base)
    // Le scintillement : deux instants proches, deux valeurs différentes.
    expect(starAlpha(first, 3)).not.toBeCloseTo(starAlpha(first, 3.7), 3)
  })
})

describe('the particles', () => {
  const parts = makeParticles(INTRO_PARTICLES)

  it('are 900, seeded, in three classes 60 / 30 / 10 %', () => {
    expect(parts).toHaveLength(900)
    expect(makeParticles(INTRO_PARTICLES)).toEqual(parts)
    const count = (c: number) => parts.filter((p) => p.cls === c).length
    expect([count(0), count(1), count(2)]).toEqual([540, 270, 90])
  })

  it('carry the ranges the swirl will need', () => {
    for (const p of parts) {
      expect(p.spd).toBeGreaterThanOrEqual(0.3)
      expect(p.spd).toBeLessThanOrEqual(1.25)
      expect(p.delay).toBeLessThanOrEqual(1.45)
      expect(p.dur).toBeGreaterThanOrEqual(1.6)
      expect(p.rad).toBeGreaterThanOrEqual(700)
      expect(p.rad).toBeLessThanOrEqual(1220)
    }
  })

  it('burst from the centre at the bang and never come back', () => {
    const p = parts[7]
    const out = { x: 0, y: 0 }
    novaPoint(p, bang, out)
    expect(Math.hypot(out.x - CX, out.y - CY)).toBeLessThan(1e-6)
    let last = 0
    for (let t = bang; t <= bang + 6.2; t += 0.1) {
      novaPoint(p, t, out)
      // Le rayon décélère mais ne recule jamais ; l'errance (± 26 px) mise à part.
      const r = Math.hypot(out.x - CX, (out.y - CY) / 0.94)
      expect(r).toBeGreaterThanOrEqual(last - 27)
      last = Math.max(last, r)
    }
    expect(last).toBeCloseTo(p.spd * 1020, -1)
  })

  it('appear with the bang and not before', () => {
    expect(novaOpacity(bang - 0.05)).toBe(0)
    expect(novaOpacity(bang + 0.2)).toBeCloseTo(0.95, 6)
  })
})

describe('the bang', () => {
  it('sends two waves that thin out as they grow', () => {
    const [r1, r2] = rings(bang + 0.01)
    expect(r1.visible && r2.visible).toBe(true)
    // Elles partent vite (power4.out) : déjà quelques dizaines de px à 10 ms.
    expect(r1.r).toBeGreaterThan(30)
    expect(r1.r).toBeLessThan(60)
    expect(r2.r).toBeGreaterThan(20)
    expect(r2.r).toBeLessThan(45)
    const [l1] = rings(bang + 1.4)
    expect(l1.r).toBeGreaterThan(800)
    expect(l1.opacity).toBeLessThan(r1.opacity)
    expect(l1.width).toBeLessThan(r1.width)
    expect(rings(bang + 1.6)[0].visible).toBe(false)
    expect(rings(bang + 1.6)[1].visible).toBe(true)
    expect(rings(bang + 2.4)[1].visible).toBe(false)
  })

  it('flashes: a fast rise, a slower fall', () => {
    expect(flashOpacity(bang - 0.2)).toBe(0)
    expect(flashOpacity(bang + 0.06)).toBeCloseTo(0.95, 6)
    expect(flashOpacity(bang + 0.3)).toBeGreaterThan(0)
    expect(flashOpacity(bang + 0.3)).toBeLessThan(0.95)
    expect(flashOpacity(bang + 0.7)).toBe(0)
  })
})

describe('phaseWordAlpha', () => {
  const genesis = { start: INTRO_BEATS.genesis, end: 4.9, letters: 7 }

  it('is hidden before its cue and after its fade', () => {
    expect(phaseWordAlpha(genesis.start - 0.2, genesis)).toBeNull()
    expect(phaseWordAlpha(genesis.end + 0.7, genesis)).toBeNull()
  })

  it('writes letter by letter, 90 ms apart, to 85 %', () => {
    const a = phaseWordAlpha(genesis.start + 0.25, genesis)!
    expect(a.letters[0]).toBeCloseTo(0.85, 6)
    expect(a.letters[6]).toBe(0)
    expect(a.letters[1]).toBeGreaterThan(a.letters[2])
    expect(a.opacity).toBe(1)
  })

  it('fades as a whole at its end', () => {
    const mid = phaseWordAlpha(genesis.end + 0.3, genesis)!
    expect(mid.opacity).toBeGreaterThan(0)
    expect(mid.opacity).toBeLessThan(1)
  })
})

/**
 * La phase 2, « La conception » (#145). Le panoramique, la plongée et la
 * dérive des particules sont déjà verrouillés plus haut : ils appartiennent à
 * la caméra A et à la nova, écrites avec la phase 1. Restent la cible de la
 * plongée, le monde qui surgit dedans, et le plan qui se dessine.
 */
describe('triangle2', () => {
  it('drifts slowly around the point the camera pans to', () => {
    for (const T of [0, 3, 6.65, 8.8, 11]) {
      const t = triangle2(T)
      expect(t.x).toBeGreaterThan(CX - 620 - 15)
      expect(t.x).toBeLessThan(CX - 620 + 15)
      expect(t.y).toBeGreaterThan(CY - 250 - 11)
      expect(t.y).toBeLessThan(CY - 250 + 11)
    }
    expect(triangle2(0).x).not.toBeCloseTo(triangle2(6).x, 3)
  })

  it('is the camera target: it must be whole before the pan arrives', () => {
    // Il s'allume 7,0 → 8,0, pendant le panoramique (6,65 → 8,8) et non à son
    // terme : une cible qui apparaîtrait à l'arrivée dirait que la caméra a
    // bougé pour rien.
    expect(triangle2(INTRO_PHASES[1].start).opacity).toBe(0)
    expect(triangle2(INTRO_BEATS.pan + 0.5).opacity).toBeGreaterThan(0)
    expect(triangle2(INTRO_BEATS.plunge).opacity).toBeCloseTo(1, 6)
  })

  it('lights two sides, where the first triangle lit only its top', () => {
    expect(triangle2(9).lit).toEqual([0, 1])
    expect(triangle1(3).lit).toEqual([0])
  })
})

describe('worldB', () => {
  it('is a seed until the plunge is under way, then fills the frame', () => {
    expect(worldB(0).scale).toBeCloseTo(0.07, 6)
    expect(worldB(plunge + 0.55).scale).toBeCloseTo(0.07, 6)
    expect(worldB(plunge + 1.85).scale).toBeCloseTo(1, 6)
    expect(worldB(plunge + 1.2).scale).toBeGreaterThan(0.07)
    expect(worldB(plunge + 1.2).scale).toBeLessThan(1)
  })

  it('only appears once world A has started to go', () => {
    // Le monde A s'efface 9,85 → 10,35 ; le monde B apparaît 9,5 → 10,15.
    // Les deux fondus se croisent : rien ne montre un écran vide.
    expect(worldB(plunge + 0.69).opacity).toBe(0)
    expect(worldB(plunge + 1.35).opacity).toBeCloseTo(1, 6)
    expect(worldA(plunge + 1.35).opacity).toBeLessThan(1)
    expect(worldA(plunge + 1.35).opacity).toBeGreaterThan(0)
  })
})

describe('the lab plan drawing', () => {
  const order = LAB_PLAN_ORDER
  const last = order.length - 1

  // Le dernier trait du dernier lot part à `draw + 10 × 0,26 + 4 × 0,06`.
  // Écrit en absolu, ce repère mentait dès que la partition bougeait — il
  // disait 12,33 quand le tracé commençait à 9,5, et le retiming de #147 l'a
  // laissé sur place sans que son intention change d'un mot.
  const lastStroke = INTRO_BEATS.draw + last * 0.26 + (LAB_SUBGROUPS - 1) * 0.06

  it('holds every stroke hidden until its batch is called', () => {
    expect(labDashOffset(0, 0, INTRO_BEATS.draw - 0.01)).toBe(1)
    expect(labDashOffset(last, LAB_SUBGROUPS - 1, lastStroke - 0.01)).toBe(1)
  })

  it('starts batch k at `draw` + k · 0.26, and its five waves 0.06 s apart', () => {
    const started = (b: number, s: number, T: number) => labDashOffset(b, s, T) < 1
    for (let b = 0; b < order.length; b++) {
      const start = INTRO_BEATS.draw + b * 0.26
      expect(started(b, 0, start - 0.001)).toBe(false)
      expect(started(b, 0, start + 0.001)).toBe(true)
      expect(started(b, 4, start + 0.239)).toBe(false)
      expect(started(b, 4, start + 0.241)).toBe(true)
    }
  })

  it('draws each wave in 0.72 s, and never un-draws it', () => {
    expect(labDashOffset(0, 0, INTRO_BEATS.draw + 0.72)).toBe(0)
    let previous = 1
    for (let T = 9; T <= 13.2; T += 0.02) {
      const v = labDashOffset(3, 2, T)
      expect(v).toBeLessThanOrEqual(previous + 1e-9)
      previous = v
    }
  })

  it('has the whole plan drawn BEFORE the last phase opens', () => {
    const t2 = INTRO_PHASES[2].start
    for (let b = 0; b < order.length; b++)
      for (let s = 0; s < LAB_SUBGROUPS; s++) expect(labDashOffset(b, s, t2)).toBe(0)
    // Le dernier trait se posait à 13,06 : le handoff écrivait « 9,5 → 13 » et
    // sa propre arithmétique débordait de 60 ms sur la phase 3, où le
    // tourbillon part à 13,05. En avançant le tracé à 9,0 (#147) il se pose à
    // 12,56, et la phase 3 s'ouvre sur un plan fini — pas sur un plan qui
    // finit. La marge est vérifiée, pas seulement l'ordre.
    expect(labDashOffset(last, LAB_SUBGROUPS - 1, lastStroke + 0.72)).toBe(0)
    expect(lastStroke + 0.72).toBeLessThan(t2)
  })

  it('is five waves per batch, 55 in all — the whole plan and nothing twice', () => {
    expect(order.length * LAB_SUBGROUPS).toBe(55)
  })
})

/**
 * La phase 3, « La réalisation » (#146). Le tourbillon, le nom, le triangle en
 * arc, la gravure et le clignotement — encore une fois en fonctions pures de
 * T, avec les nombres de la partition.
 */
const { swirl, name: nameBeat, arc, etch, flicker } = INTRO_BEATS

describe('the swirl', () => {
  const parts = makeParticles(INTRO_PARTICLES)

  it('opens with the last phase and is out before the arc lands', () => {
    expect(swirlOpacity(swirl - 0.05)).toBe(0)
    expect(swirlOpacity(swirl + 0.5)).toBeCloseTo(0.95, 6)
    // Éteint 15,5 → 16,3, pendant que les vraies lettres s'écrivent.
    expect(swirlOpacity(15.9)).toBeGreaterThan(0)
    expect(swirlOpacity(15.9)).toBeLessThan(0.95)
    expect(swirlOpacity(16.3)).toBe(0)
    expect(swirlActive(16.4)).toBe(false)
  })

  it('spirals each particle onto its pixel of the name', () => {
    const out = { x: 0, y: 0 }
    const target = { x: CX + 120, y: NAME_Y - 8 }
    for (const p of [parts[0], parts[123], parts[899]]) {
      // Au départ, à son rayon, quelque part sur le cercle.
      swirlPoint(p, target.x, target.y, swirl + p.delay, out)
      expect(Math.hypot(out.x - target.x, (out.y - target.y) / 0.9)).toBeCloseTo(p.rad, 6)
      // À l'arrivée, exactement sur le pixel visé.
      swirlPoint(p, target.x, target.y, swirl + p.delay + p.dur, out)
      expect(out.x).toBeCloseTo(target.x, 9)
      expect(out.y).toBeCloseTo(target.y, 9)
    }
  })

  it('winds by 4.3 rad and never unwinds', () => {
    const p = parts[42]
    const out = { x: 0, y: 0 }
    let previous = Infinity
    for (let T = swirl; T <= swirl + p.delay + p.dur + 0.5; T += 0.02) {
      swirlPoint(p, CX, NAME_Y, T, out)
      const r = Math.hypot(out.x - CX, (out.y - NAME_Y) / 0.9)
      expect(r).toBeLessThanOrEqual(previous + 1e-9)
      previous = r
    }
    // L'enroulement complet : l'angle a gagné 4,3 rad quand le rayon est nul.
    const half = swirl + p.delay + p.dur / 2
    swirlPoint(p, CX, NAME_Y, half, out)
    const angle = Math.atan2((out.y - NAME_Y) / 0.9, out.x - CX)
    expect(Math.abs(Math.sin(angle - (p.ang + 4.3 * 0.5)))).toBeLessThan(1e-6)
  })

  it('holds every particle still until its own delay', () => {
    const out = { x: 0, y: 0 }
    const late = parts.reduce((a, b) => (a.delay > b.delay ? a : b))
    swirlPoint(late, CX, NAME_Y, swirl + late.delay - 0.01, out)
    expect(Math.hypot(out.x - CX, (out.y - NAME_Y) / 0.9)).toBeCloseTo(late.rad, 6)
  })
})

describe('the name', () => {
  it('writes letter by letter, 45 ms apart, rising into place', () => {
    expect(nameLetter(0, nameBeat - 0.01)).toEqual({ opacity: 0, shift: 12 })
    expect(nameLetter(0, nameBeat + 0.55).opacity).toBeCloseTo(1, 6)
    expect(nameLetter(0, nameBeat + 0.55).shift).toBeCloseTo(0, 6)
    // La quatorzième part 0,045 s × 14 plus tard.
    expect(nameLetter(14, nameBeat + 0.6)).toEqual(nameLetter(0, nameBeat + 0.6 - 14 * 0.045))
    const mid = nameLetter(3, nameBeat + 3 * 0.045 + 0.275)
    expect(mid.shift).toBeCloseTo((1 - mid.opacity) * 12, 9)
  })

  it('is whole and still by the time the title is etched', () => {
    for (let i = 0; i < 20; i++) expect(nameLetter(i, etch)).toEqual({ opacity: 1, shift: 0 })
  })
})

describe('the plan behind the name', () => {
  it('drops to 32 % while the real letters appear', () => {
    expect(labOpacity(14.6)).toBeCloseTo(1, 6)
    expect(labOpacity(16.1)).toBeCloseTo(0.32, 6)
    expect(labOpacity(15.35)).toBeLessThan(1)
    expect(labOpacity(15.35)).toBeGreaterThan(0.32)
    // Il ne s'éclaircit plus jamais : la dernière image le montre à 32 %.
    expect(labOpacity(INTRO_DURATION_S)).toBeCloseTo(0.32, 6)
  })
})

describe('triangle3', () => {
  it('flies an arc from the left and lands behind the name', () => {
    const start = triangle3(arc + 0.001)
    expect(Math.hypot(start.x - CX, start.y - (NAME_Y + 14))).toBeGreaterThan(700)
    const landed = triangle3(arc + 2.3)
    expect(landed.x).toBeCloseTo(CX, 6)
    expect(landed.y).toBeCloseTo(NAME_Y + 14, 6)
    expect(landed.size).toBeCloseTo(470, 6)
    expect(landed.rot).toBeCloseTo(0, 6)
  })

  it('comes in on a circle, never in a straight line', () => {
    // Le rayon décroît de 760 à 0 pendant que l'angle balaie −215° → −90° :
    // le point ne passe donc jamais par la corde entre départ et arrivée.
    const mid = triangle3(arc + 1.15)
    const theta = Math.atan2(mid.y - (NAME_Y + 14), mid.x - CX)
    expect(theta).toBeGreaterThan((-215 * Math.PI) / 180)
    expect(theta).toBeLessThan((-90 * Math.PI) / 180)
  })

  it('lights all three sides, thick, where the others lit one or two', () => {
    expect(triangle3(arc + 1).lit).toEqual([0, 1, 2])
    expect(triangle3(arc + 1).weight).toBe(1.8)
  })

  it('dims once it is posed, to leave the text the stage', () => {
    const posed = triangle3(arc + 2.3)
    const dimmed = triangle3(arc + 3.4)
    expect(dimmed.opacity).toBeCloseTo(posed.opacity * 0.52, 6)
    expect(dimmed.glow).toBeCloseTo(1.15, 6)
    expect(posed.glow).toBeCloseTo(2.2, 6)
    // 18,2 → 19,3 : l'assombrissement est fini avant la dernière image.
    expect(triangle3(INTRO_DURATION_S)).toEqual(dimmed)
  })
})

describe('the laser etching', () => {
  it('uncovers the title from the left in 1.7 s', () => {
    expect(etchTitle(etch - 0.01).progress).toBe(0)
    expect(etchTitle(etch + 1.7).progress).toBeCloseTo(1, 6)
    expect(etchTitle(etch + 0.85).progress).toBeCloseTo(0.5, 6)
  })

  it('shows a spark only while the beam travels', () => {
    expect(etchTitle(etch).sparkVisible).toBe(false)
    expect(etchTitle(etch + 0.85).sparkVisible).toBe(true)
    expect(etchTitle(etch + 1.7).sparkVisible).toBe(false)
    expect(etchTitle(INTRO_DURATION_S).sparkVisible).toBe(false)
  })

  it('makes the spark shimmer, always visible, never steady', () => {
    for (const T of [17, 17.5, 18]) {
      const s = etchTitle(T).sparkOpacity
      expect(s).toBeGreaterThanOrEqual(0.5)
      expect(s).toBeLessThanOrEqual(1)
    }
    expect(etchTitle(17).sparkOpacity).not.toBeCloseTo(etchTitle(17.04).sparkOpacity, 3)
  })
})

describe('the flicker', () => {
  it('starts once the etching is done and never stops', () => {
    expect(flickerOn(etch)).toBe(false)
    expect(flickerOn(flicker - 0.01)).toBe(false)
    expect(flickerOn(flicker + 0.01)).toBe(true)
    // La dernière image le laisse allumé : la boucle CSS survit à l'horloge.
    expect(flickerOn(INTRO_DURATION_S)).toBe(true)
  })
})
