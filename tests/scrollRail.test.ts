import { describe, expect, it } from 'vitest'
import { RAIL_MIN_FRACTION, railThumb } from '@/lib/scrollRail'

/**
 * Le rail de défilement du CV (#194) — la géométrie est une fonction pure,
 * parce que c'est la seule partie qui se trompe en silence : un curseur qui
 * dépasse sa piste ou qui ment sur la position ne lève aucune erreur, il a
 * juste l'air cassé. `CvScreen` ne fait qu'écrire le résultat en style inline.
 */
describe('railThumb', () => {
  it('rend null quand rien ne déborde — le rail n’a rien à dire', () => {
    expect(railThumb({ scrollTop: 0, scrollHeight: 700, clientHeight: 700 })).toBeNull()
  })

  it('rend null sous un pixel de débordement — le bruit d’arrondi n’est pas un scroll', () => {
    expect(railThumb({ scrollTop: 0, scrollHeight: 700.5, clientHeight: 700 })).toBeNull()
  })

  it('donne au curseur la part visible du contenu', () => {
    const pos = railThumb({ scrollTop: 0, scrollHeight: 1000, clientHeight: 500 })
    expect(pos).toEqual({ size: 0.5, offset: 0 })
  })

  it('amène le curseur en butée basse quand le contenu y est', () => {
    const pos = railThumb({ scrollTop: 500, scrollHeight: 1000, clientHeight: 500 })!
    expect(pos.offset + pos.size).toBeCloseTo(1)
  })

  it('ne descend jamais sous la fraction minimale, sinon un long CV donne un curseur-miette', () => {
    const pos = railThumb({ scrollTop: 0, scrollHeight: 50_000, clientHeight: 500 })!
    expect(pos.size).toBe(RAIL_MIN_FRACTION)
  })

  it('bride le scroll aux butées — l’élastique de Gecko ne doit pas sortir le curseur de la piste', () => {
    const over = railThumb({ scrollTop: 900, scrollHeight: 1000, clientHeight: 500 })!
    expect(over.offset + over.size).toBeCloseTo(1)
    const under = railThumb({ scrollTop: -40, scrollHeight: 1000, clientHeight: 500 })!
    expect(under.offset).toBe(0)
  })
})
