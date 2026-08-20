import { describe, expect, it } from 'vitest'
import {
  BLINK_GAP_MAX,
  BLINK_GAP_MIN,
  BLINK_SQUASH,
  CAT_PUPILS,
  CAT_TAIL,
  TAIL_SWING,
} from '@/config/cat'
import { readFileSync } from 'node:fs'
import { blinkScale, pupilOffset, tailOffset } from '@/lib/cat'

/**
 * Le chat vivant (#37). Trois animations, trois pièges que l'œil ne rattrape
 * pas : une pupille qui sort de l'œil dans les diagonales, une queue qui se
 * translate en bloc au lieu d'onduler, et un clignement au rythme de
 * métronome.
 */

describe('la pupille', () => {
  it("reste dans le DISQUE de l'œil, y compris en diagonale", () => {
    // Borner chaque axe séparément donnerait un carré : dans les coins, la
    // pupille sortirait du blanc. C'est la norme du vecteur qui est limitée.
    const r = 0.004
    for (const [x, y] of [
      [1, 1],
      [-1, 1],
      [3, -4],
      [0.2, 0.1],
    ]) {
      const [ox, oy] = pupilOffset(x, y, r)
      expect(Math.hypot(ox, oy), `${x},${y}`).toBeLessThanOrEqual(r + 1e-9)
    }
  })

  it('ne déforme pas les petits mouvements', () => {
    // Dans le disque unité, le suivi doit rester proportionnel : sinon le
    // regard « saute » dès qu'on approche du bord.
    const [ox, oy] = pupilOffset(0.5, 0, 0.004)
    expect(ox).toBeCloseTo(0.002, 6)
    expect(oy).toBe(0)
  })

  it('a autant de pupilles que la scène en contient', () => {
    expect(CAT_PUPILS.length).toBe(2)
  })
})

describe('la queue', () => {
  const n = CAT_TAIL.length

  it('ne bouge pas à la base et fouette à la pointe', () => {
    // Une queue tient au corps : si le premier segment se déplace, elle se
    // décroche visuellement du chat.
    let baseMax = 0
    let tipMax = 0
    for (let t = 0; t < 8; t += 0.05) {
      baseMax = Math.max(baseMax, Math.abs(tailOffset(0, n, t)))
      tipMax = Math.max(tipMax, Math.abs(tailOffset(n - 1, n, t)))
    }
    expect(baseMax).toBeCloseTo(0, 6)
    expect(tipMax).toBeCloseTo(TAIL_SWING, 3)
  })

  it('ondule au lieu de se translater en bloc', () => {
    // C'est le décalage de phase qui fait l'onde. Sans lui, tous les segments
    // partagent le même déplacement au même instant et la queue glisse
    // latéralement d'une pièce, ce qui ne ressemble à rien.
    const t = 1.2
    const middle = tailOffset(Math.floor(n / 2), n, t)
    const tip = tailOffset(n - 1, n, t)
    // Normalisés par leur portée respective, deux segments éloignés ne doivent
    // pas être au même endroit du cycle.
    const reachMid = Math.floor(n / 2) / (n - 1)
    expect(Math.abs(middle / reachMid - tip)).toBeGreaterThan(TAIL_SWING * 0.1)
  })
})

describe('le clignement', () => {
  it("laisse l'œil ouvert la plupart du temps", () => {
    let closedish = 0
    const samples = 4000
    for (let i = 0; i < samples; i++) {
      if (blinkScale((i / samples) * 60) < 0.9) closedish++
    }
    // Sur une minute, un chat cligne quelques dizaines de fois pendant 160 ms :
    // très en dessous de 5 % du temps. Au-delà, il a l'air de dormir.
    expect(closedish / samples).toBeLessThan(0.05)
  })

  it("ferme vraiment l'œil, sans le faire disparaître", () => {
    // À zéro, la paupière n'existant pas, on verrait à travers la tête.
    let min = 1
    for (let t = 0; t < 60; t += 0.005) min = Math.min(min, blinkScale(t))
    expect(min).toBeLessThan(0.2)
    expect(min).toBeGreaterThanOrEqual(BLINK_SQUASH - 1e-9)
  })

  it("n'est pas un métronome", () => {
    // Un intervalle fixe s'entend au bout de trois répétitions. Les écarts
    // sont tirés d'une suite déterministe — reproductible, donc testable —
    // mais irrégulière.
    const starts: number[] = []
    let wasOpen = true
    for (let t = 0; t < 120; t += 0.005) {
      const open = blinkScale(t) > 0.99
      if (wasOpen && !open) starts.push(t)
      wasOpen = open
    }
    expect(starts.length).toBeGreaterThan(10)
    const gaps = starts.slice(1).map((t, i) => t - starts[i])
    for (const g of gaps) {
      expect(g).toBeGreaterThanOrEqual(BLINK_GAP_MIN - 0.05)
      expect(g).toBeLessThanOrEqual(BLINK_GAP_MAX + 0.3)
    }
    expect(new Set(gaps.map((g) => g.toFixed(1))).size).toBeGreaterThan(3)
  })

  it('rend la même image à la même seconde', () => {
    // Déterministe : un `Math.random()` rendrait la fonction intestable, et
    // le clignement dépendrait du nombre de rendus React.
    expect(blinkScale(12.345)).toBe(blinkScale(12.345))
  })
})

describe('le mouvement réduit', () => {
  const component = readFileSync('src/scene/CatAlive.tsx', 'utf8')
  const frame = component.slice(component.indexOf('useFrame(('))

  it('coupe TOUT, y compris le regard', () => {
    // La garde doit être la PREMIÈRE instruction de la boucle : sous elle, le
    // composant ne touche plus un seul objet. C'est ce qui rend la boucle de
    // comparaison de renders reproductible, puisqu'elle capture en mouvement
    // réduit — un lissage de regard qui converge encore au moment de la
    // capture faisait varier l'écart mesuré d'une exécution à l'autre.
    const body = frame.slice(frame.indexOf('{') + 1)
    expect(body.trimStart().startsWith('if (reduced) return')).toBe(true)
  })

  it('est demandé par la boucle de comparaison, EXPLICITEMENT', () => {
    // Il l'a d'abord été via `use: { reducedMotion: 'reduce' }` dans la
    // configuration — et cette option n'arrivait PAS jusqu'à la page : mesuré,
    // `matchMedia` y répondait `false` alors que `viewport`, posé juste à côté,
    // s'appliquait. La queue du chat tournait donc pendant les captures, sous
    // la tolérance et sans que rien ne le dise. Un appel explicite dans
    // `captureStop` ne peut pas être avalé en silence.
    const capture = readFileSync('tests/e2e/renderComparison.ts', 'utf8')
    expect(capture).toContain("emulateMedia({ reducedMotion: 'reduce' })")
    expect(capture.indexOf('emulateMedia')).toBeLessThan(capture.indexOf('page.goto'))
  })
})
