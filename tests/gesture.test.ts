import { describe, expect, it } from 'vitest'
import {
  GESTURE_RESET_MS,
  MIN_COUNTED_DELTA,
  feedWheel,
  idleGesture,
  type GestureState,
} from '@/lib/gesture'

/**
 * Le détecteur de geste, la seule pièce de la navigation qu'aucun test ne
 * couvrait — et celle qui a régressé deux fois (#116).
 *
 * Les trains d'événements ci-dessous reproduisent ce que les périphériques
 * émettent vraiment : une chiquenaude de trackpad monte puis décroît en
 * momentum, un défilement maintenu monte et se maintient, une molette envoie
 * des crans isolés séparés de silences.
 */

/** Rejoue un train d'événements et renvoie les pas tirés, dans l'ordre. */
function play(
  events: { delta: number; at: number }[],
  from: GestureState = idleGesture(),
): { steps: number[]; state: GestureState } {
  let state = from
  const steps: number[] = []
  for (const e of events) {
    const out = feedWheel(state, e.delta, e.at)
    state = out.state
    if (out.step !== 0) steps.push(out.step)
  }
  return { steps, state }
}

describe('feedWheel', () => {
  it('ne tire rien tant que le seuil n’est pas atteint', () => {
    const { steps } = play([
      { delta: 10, at: 1000 },
      { delta: 12, at: 1016 },
      { delta: 14, at: 1032 },
    ])
    expect(steps).toEqual([])
  })

  it('tire un pas en avant, puis un en arrière au demi-tour', () => {
    const { steps } = play([
      { delta: 40, at: 1000 },
      { delta: 40, at: 1016 },
      // Demi-tour franc : le momentum ne s'inverse jamais, donc c'est une
      // intention neuve et elle doit répondre sans attendre le silence.
      { delta: -40, at: 1200 },
      { delta: -40, at: 1216 },
    ])
    expect(steps).toEqual([1, -1])
  })

  it('une chiquenaude vaut UN pas, momentum compris', () => {
    // Le profil d'une chiquenaude de trackpad : ça monte, ça franchit le
    // seuil, puis ça décroît pendant presque une seconde.
    const events = [
      { delta: 18, at: 1000 },
      { delta: 34, at: 1016 },
      { delta: 52, at: 1032 },
      { delta: 44, at: 1048 },
      { delta: 30, at: 1064 },
      { delta: 21, at: 1080 },
      { delta: 14, at: 1096 },
      { delta: 9, at: 1112 },
      { delta: 7, at: 1128 },
    ]
    expect(play(events).steps).toEqual([1])
  })

  it('un défilement APPUYÉ vaut un pas, pas deux', () => {
    // Le défaut de #116 : les deltas d'un geste appuyé CROISSENT, donc ils
    // franchissent le pic du geste. L'ancien détecteur y lisait « intention
    // fraîche », se réarmait au milieu de la course et tirait un second pas.
    const events = Array.from({ length: 20 }, (_, i) => ({
      delta: 20 + i * 6, // 20, 26, 32… jusqu'à 134
      at: 1000 + i * 16, // ~60 Hz, aucun silence
    }))
    expect(play(events).steps).toEqual([1])
  })

  it('un défilement MAINTENU vaut un pas : enchaîner exige un geste neuf', () => {
    // Décision produit du 2026-08-24, qui en remplace une autre : le
    // défilement maintenu enchaînait les arrêts un par un. Ce test est là pour
    // que la règle retirée ne revienne pas par inadvertance.
    const events = Array.from({ length: 60 }, (_, i) => ({
      delta: 30,
      at: 1000 + i * 16, // une seconde entière sans silence
    }))
    expect(play(events).steps).toEqual([1])
  })

  it('deux gestes séparés par un silence valent deux pas', () => {
    const first = Array.from({ length: 4 }, (_, i) => ({ delta: 30, at: 1000 + i * 16 }))
    const second = Array.from({ length: 4 }, (_, i) => ({
      delta: 30,
      at: 1000 + 3 * 16 + GESTURE_RESET_MS + 40 + i * 16,
    }))
    expect(play([...first, ...second]).steps).toEqual([1, 1])
  })

  it('compte une deuxième chiquenaude même si la caméra vole encore', () => {
    // Mesuré dans le navigateur : une course dure 1,2 s et on enchaîne bien
    // avant. Une première version interdisait de réarmer pendant la course —
    // elle empêchait surtout la deuxième chiquenaude d'exister.
    const flick = (t0: number) => [
      { delta: 25, at: t0 },
      { delta: 45, at: t0 + 16 },
      { delta: 60, at: t0 + 32 },
      { delta: 22, at: t0 + 48 },
    ]
    expect(play([...flick(1000), ...flick(1900)]).steps).toEqual([1, 1])
  })

  it('ignore le tremblement sub-pixel sans le prendre pour un silence', () => {
    const jitter = MIN_COUNTED_DELTA - 1
    const events = [
      { delta: 40, at: 1000 },
      { delta: 40, at: 1016 }, // → un pas
      // Du tremblement pendant plus longtemps que GESTURE_RESET_MS, mais
      // ininterrompu : c'est encore le même geste, il ne doit pas se réarmer.
      ...Array.from({ length: 30 }, (_, i) => ({ delta: jitter, at: 1032 + i * 16 })),
      { delta: 40, at: 1032 + 30 * 16 },
      { delta: 40, at: 1032 + 31 * 16 },
    ]
    expect(play(events).steps).toEqual([1])
  })

  it('un rebond de fin de course ne tire pas de pas en arrière', () => {
    // Certains trackpads terminent leur momentum par quelques deltas de signe
    // opposé. Ils réarment — un demi-tour est une intention neuve — mais
    // `acc` repart de zéro, et un rebond mourant n'atteint jamais le seuil.
    const events = [
      { delta: 40, at: 1000 },
      { delta: 40, at: 1016 },
      { delta: 20, at: 1032 },
      { delta: -12, at: 1048 },
      { delta: -8, at: 1064 },
      { delta: -7, at: 1080 },
    ]
    expect(play(events).steps).toEqual([1])
  })
})
