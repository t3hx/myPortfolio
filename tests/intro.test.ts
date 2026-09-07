import { readFileSync } from 'node:fs'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { INTRO_ACCENT, INTRO_BUBBLE_DELAY_MS, INTRO_DELAY_MS, INTRO_GOLD } from '@/config/intro'
import {
  INTRO_BEATS,
  INTRO_DURATION_S,
  INTRO_PHASES,
  introOpening,
  introPhase,
  introTime,
  isSkipGesture,
} from '@/lib/intro'
import { parseAccent } from '@/lib/viewMode'
import { useInteraction } from '@/state/interaction'

/**
 * L'horloge de l'intro (#143). Tout ce qui ne se voit pas : la chronologie,
 * le temps T, la latence de départ, le geste de saut, la bulle qui attend.
 * Vérifié ici, en Node, avant le premier pixel — comme le dialogue (#122),
 * l'origine du temps vit dans le store et le reste est une soustraction.
 */

describe('the timeline', () => {
  it('runs twenty seconds in three phases', () => {
    const total = INTRO_PHASES.reduce((s, p) => s + p.duration, 0)
    expect(total).toBeCloseTo(INTRO_DURATION_S, 6)
    expect(INTRO_PHASES.map((p) => p.name)).toEqual(['idea', 'design', 'realisation'])
    // Les repères des phases, tels que le handoff les a chronométrés.
    expect(INTRO_PHASES.map((p) => p.start)).toEqual([0, 6.5, 13])
  })

  it('orders its beats and keeps them inside the twenty seconds', () => {
    const times = Object.values(INTRO_BEATS)
    for (const t of times) {
      expect(t).toBeGreaterThanOrEqual(0)
      expect(t).toBeLessThanOrEqual(INTRO_DURATION_S)
    }
    // Les temps forts dans l'ordre de la partition : arrivée du triangle,
    // succion, big-bang, plongée, tracé du plan, tourbillon, nom, arc, gravure.
    const { arrival, suck, bang, plunge, draw, swirl, name, arc, etch } = INTRO_BEATS
    expect([arrival, suck, bang, plunge, draw, swirl, name, arc, etch]).toEqual(
      [...[arrival, suck, bang, plunge, draw, swirl, name, arc, etch]].sort((a, b) => a - b),
    )
    // Chaque temps fort tombe dans la phase qui le raconte.
    expect(bang).toBeLessThan(INTRO_PHASES[1].start)
    expect(plunge).toBeGreaterThan(INTRO_PHASES[1].start)
    expect(draw).toBeLessThan(INTRO_PHASES[2].start)
    expect(swirl).toBeGreaterThan(INTRO_PHASES[2].start)
  })
})

describe('the durations and their tokens', () => {
  const tokens = readFileSync('src/styles/tokens.css', 'utf8')
  const token = (name: string) => Number(tokens.match(new RegExp(`--t-${name}:\\s*(\\d+)ms`))![1])

  it('starts a short beat after discovery, under a second', () => {
    expect(INTRO_DELAY_MS).toBeGreaterThan(0)
    expect(INTRO_DELAY_MS).toBeLessThan(1000)
    expect(token('intro-delay')).toBe(INTRO_DELAY_MS)
  })

  it('lets the bubble speak one second after the final image', () => {
    expect(INTRO_BUBBLE_DELAY_MS).toBe(1000)
    expect(token('intro-bubble')).toBe(INTRO_BUBBLE_DELAY_MS)
  })
})

describe('introTime', () => {
  it('is zero before the intro starts', () => {
    expect(introTime({ introStartedAt: null, introDone: false }, 5000)).toBe(0)
  })

  it('counts seconds from the start', () => {
    expect(introTime({ introStartedAt: 1000, introDone: false }, 4200)).toBeCloseTo(3.2, 9)
  })

  it('never passes the final image', () => {
    expect(introTime({ introStartedAt: 0, introDone: false }, 25_000)).toBe(INTRO_DURATION_S)
  })

  it('sits on the final image once done, whatever the clock says', () => {
    expect(introTime({ introStartedAt: 1000, introDone: true }, 1500)).toBe(INTRO_DURATION_S)
    expect(introTime({ introStartedAt: null, introDone: true }, 0)).toBe(INTRO_DURATION_S)
  })
})

describe('introOpening', () => {
  it('plays when the visit starts at Home', () => {
    expect(introOpening({ reducedMotion: false, startsAtHome: true })).toBe('play')
  })

  it('settles on the final image under reduced motion', () => {
    expect(introOpening({ reducedMotion: true, startsAtHome: true })).toBe('settle')
  })

  it('settles on the final image when a deep link lands elsewhere', () => {
    expect(introOpening({ reducedMotion: false, startsAtHome: false })).toBe('settle')
  })
})

describe('isSkipGesture', () => {
  const running = { running: true, atHome: true }

  it('is the wheel, in both directions, while the intro plays at Home', () => {
    expect(isSkipGesture({ type: 'wheel', deltaY: 120 }, running)).toBe(true)
    expect(isSkipGesture({ type: 'wheel', deltaY: -3 }, running)).toBe(true)
  })

  it('is the Escape key', () => {
    expect(isSkipGesture({ type: 'keydown', key: 'Escape' }, running)).toBe(true)
  })

  it('is not an arrow: arrows always traverse the tour', () => {
    expect(isSkipGesture({ type: 'keydown', key: 'ArrowDown' }, running)).toBe(false)
    expect(isSkipGesture({ type: 'keydown', key: 'PageDown' }, running)).toBe(false)
  })

  it('is nothing once the intro is on its final image', () => {
    expect(isSkipGesture({ type: 'wheel', deltaY: 120 }, { running: false, atHome: true })).toBe(
      false,
    )
    expect(
      isSkipGesture({ type: 'keydown', key: 'Escape' }, { running: false, atHome: true }),
    ).toBe(false)
  })

  it('is nothing away from Home: the tour keeps its gestures', () => {
    expect(isSkipGesture({ type: 'wheel', deltaY: 120 }, { running: true, atHome: false })).toBe(
      false,
    )
  })
})

describe('the store', () => {
  const store = () => useInteraction.getState()
  beforeEach(() => store().replayIntro())

  it('starts untouched: not started, not done, nothing released', () => {
    expect(store().introStartedAt).toBeNull()
    expect(store().introDone).toBe(false)
    expect(store().introReleased).toBe(false)
  })

  it('records the start, then the final image, then the release', () => {
    store().startIntro(1000)
    expect(store().introStartedAt).toBe(1000)
    store().finishIntro()
    expect(store().introDone).toBe(true)
    expect(store().introReleased).toBe(false)
    store().releaseIntro()
    expect(store().introReleased).toBe(true)
  })

  it('can finish without ever starting: the settled opening', () => {
    store().finishIntro()
    expect(introTime(store(), 0)).toBe(INTRO_DURATION_S)
  })

  it('does not release before the final image', () => {
    store().startIntro(1000)
    store().releaseIntro()
    expect(store().introReleased).toBe(false)
  })

  it('replays from nothing', () => {
    store().startIntro(1000)
    store().finishIntro()
    store().releaseIntro()
    store().replayIntro()
    expect(store().introStartedAt).toBeNull()
    expect(store().introDone).toBe(false)
    expect(store().introReleased).toBe(false)
  })
})

/**
 * L'outillage d'arbitrage (#147). Il ne se voit pas dans le produit fini : la
 * couleur retenue devient un token, et ces trois boutons disparaissent. Ce qui
 * doit rester vrai, c'est qu'ils comparent bien ce qu'ils annoncent.
 */
describe('the arbitration tooling', () => {
  it('names the phase playing at T, with no gap before or after', () => {
    expect(introPhase(0)).toBe('idea')
    expect(introPhase(INTRO_PHASES[1].start - 0.01)).toBe('idea')
    expect(introPhase(INTRO_PHASES[1].start)).toBe('design')
    expect(introPhase(INTRO_PHASES[2].start)).toBe('realisation')
    // Avant le départ et après la dernière image, la partition répond quand
    // même : une sonde muette se lit comme une horloge arrêtée.
    expect(introPhase(-5)).toBe('idea')
    expect(introPhase(INTRO_DURATION_S + 5)).toBe('realisation')
  })

  it('reads ?accent= without its hash, since a hash would open the URL fragment', () => {
    expect(parseAccent('00C0E8')).toBe('#00C0E8')
    expect(parseAccent('#00C0E8')).toBe('#00C0E8')
    expect(parseAccent('bff7ff')).toBe('#bff7ff')
    expect(parseAccent('fff')).toBe('#fff')
  })

  it('refuses what is not a colour, out loud', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    // Repris en silence, l'accent par défaut serait comparé à lui-même.
    expect(parseAccent('rouge')).toBeNull()
    expect(parseAccent('#12345')).toBeNull()
    expect(parseAccent('')).toBeNull()
    expect(parseAccent(null)).toBeNull()
    expect(warn).toHaveBeenCalledTimes(2)
    warn.mockRestore()
  })

  /**
   * Les deux couleurs arbitrées sont écrites DEUX FOIS, et il n'y a pas de
   * moyen d'y couper : le CSS peint le texte et les tirets, le canvas peint les
   * particules et les ondes en JavaScript, et aucun des deux ne lit la
   * déclaration de l'autre. Divergentes, elles donneraient une animation en
   * deux teintes — sans erreur, et sans que rien ne le dise.
   */
  it('paints one accent and one gold, whatever paints them', () => {
    const css = readFileSync('src/styles/tokens.css', 'utf8')
    const hex = (name: string) => css.match(new RegExp(`--${name}:\\s*(#[0-9A-Fa-f]{6})`))![1]
    expect(hex('intro-accent')).toBe(INTRO_ACCENT)
    expect(hex('intro-gold')).toBe(INTRO_GOLD)
    expect(parseAccent(INTRO_ACCENT)).toBe(INTRO_ACCENT)
  })
})
