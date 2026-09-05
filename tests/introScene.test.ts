import { describe, expect, it } from 'vitest'
import { INTRO_PARTICLES } from '@/config/intro'
import { INTRO_BEATS, INTRO_PHASES } from '@/lib/intro'
import {
  CX,
  CY,
  cameraA,
  flashOpacity,
  makeParticles,
  makeStars,
  novaPoint,
  novaOpacity,
  phaseWordAlpha,
  rings,
  starAlpha,
  triangle1,
  worldA,
} from '@/lib/introScene'

/**
 * La phase 1 de l'intro, « L'idée » (#144), en fonctions pures de T. Les
 * nombres sont ceux de la partition du handoff (design/intro/intro-scene.jsx) ;
 * ces tests verrouillent les temps forts et la forme du mouvement, pas chaque
 * valeur — le mouvement se juge en mouvement.
 */
const { arrival, suck, bang, plunge } = INTRO_BEATS

describe('cameraA', () => {
  it('holds the centre and creeps in by 5 % across phase 1', () => {
    expect(cameraA(0)).toEqual({ scale: 1, fx: CX, fy: CY })
    const end = cameraA(INTRO_PHASES[1].start)
    expect(end.scale).toBeCloseTo(1.05, 6)
    expect(end.fx).toBeCloseTo(CX, 6)
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
