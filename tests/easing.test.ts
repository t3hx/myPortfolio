import { describe, expect, it } from 'vitest'
import { easeInOutSine, easeOutBack, easeOutQuart, tween } from '@/lib/easing'

/**
 * Les trois eases de l'intro (#143), les mêmes que le prototype : `enter`
 * (power4.out), `draw` (sine.inOut), `pop` (back.out). Trois fonctions pures,
 * pas une timeline : sauter à la fin, c'est T = 20 ; rejouer, c'est T = 0.
 */
describe('the three eases', () => {
  it.each([
    ['easeOutQuart', easeOutQuart],
    ['easeInOutSine', easeInOutSine],
    ['easeOutBack', easeOutBack],
  ])('%s starts at 0 and ends at 1', (_, ease) => {
    expect(ease(0)).toBeCloseTo(0, 9)
    expect(ease(1)).toBeCloseTo(1, 9)
  })

  it('easeOutQuart and easeInOutSine never go back', () => {
    for (const ease of [easeOutQuart, easeInOutSine]) {
      let last = -1
      for (let i = 0; i <= 100; i++) {
        const v = ease(i / 100)
        expect(v).toBeGreaterThanOrEqual(last)
        last = v
      }
    }
  })

  it('easeOutBack overshoots, then settles', () => {
    // C'est ce qui fait « pop » : le triangle dépasse sa taille puis revient.
    const peak = Math.max(...Array.from({ length: 101 }, (_, i) => easeOutBack(i / 100)))
    expect(peak).toBeGreaterThan(1)
    expect(peak).toBeLessThan(1.15)
  })
})

describe('tween', () => {
  const t = tween(10, 20, 2, 4, easeInOutSine)

  it('holds its start value before the window', () => {
    expect(t(0)).toBe(10)
    expect(t(2)).toBe(10)
  })

  it('holds its end value after the window', () => {
    expect(t(4)).toBe(20)
    expect(t(9)).toBe(20)
  })

  it('passes the middle at the middle for a symmetric ease', () => {
    expect(t(3)).toBeCloseTo(15, 9)
  })

  it('runs backwards as easily', () => {
    expect(tween(1, 0, 0, 1, easeOutQuart)(0.5)).toBeCloseTo(1 - easeOutQuart(0.5), 9)
  })
})
