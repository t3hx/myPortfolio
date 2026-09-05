import { INTRO_PHASES, INTRO_BEATS } from '@/lib/intro'
import { easeInOutSine, easeOutBack, easeOutQuart, tween } from '@/lib/easing'

/**
 * Le monde A de l'intro — l'espace — en fonctions pures de T (#144).
 *
 * C'est la partition du handoff (design/intro/intro-scene.jsx), reprise
 * nombre pour nombre : le cadre est 1920 × 1080, le centre (960, 540), et
 * chaque grandeur est un `tween` évalué à T. Rien ici ne dessine ; le
 * composant lit ces valeurs dans sa boucle d'images et les écrit dans le
 * canvas, le SVG et le DOM.
 *
 * Trois eases et pas une de plus (discipline « cue-first » du prototype) :
 * `enter` = power4.out, `draw` = sine.inOut, `pop` = back.out.
 */
export const CX = 960
export const CY = 540

const enter = (from: number, to: number, start: number, end: number) =>
  tween(from, to, start, end, easeOutQuart)
const draw = (from: number, to: number, start: number, end: number) =>
  tween(from, to, start, end, easeInOutSine)
const pop = (from: number, to: number, start: number, end: number) =>
  tween(from, to, start, end, easeOutBack)
const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v)
const lerp = (a: number, b: number, u: number) => a + (b - a) * u

const t0 = INTRO_PHASES[0].start
const t1 = INTRO_PHASES[1].start
const t2 = INTRO_PHASES[2].start
const { arrival, suck, bang, pan, plunge } = INTRO_BEATS

/** Un générateur pseudo-aléatoire seedé (mulberry32) : le même ciel à chaque
 *  visite, et une capture comparable à la suivante. */
export function rng32(seed: number): () => number {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ---------------------------------------------------------------- caméra A
export interface CameraA {
  scale: number
  /** Le point visé, en px du cadre : la caméra le tient au centre. */
  fx: number
  fy: number
}

/** La dérive du second triangle, celui dans lequel on plonge (#145). */
export function triangle2Centre(T: number): { x: number; y: number } {
  return { x: CX - 620 + 14 * Math.sin(T * 0.31), y: CY - 250 + 10 * Math.cos(T * 0.23) }
}

/**
 * La caméra de l'espace : un zoom lent sur toute la phase 1, un panoramique
 * vers le second triangle, puis la plongée exponentielle dedans (#145).
 */
export function cameraA(T: number): CameraA {
  const c2 = triangle2Centre(T)
  const panU = draw(0, 1, pan, plunge)(T)
  const plungeU = clamp((T - plunge) / 1.5, 0, 1)
  const preZoom = 1 + 0.05 * draw(0, 1, t0, t1)(T)
  const scale =
    T < plunge ? lerp(preZoom, 2.2, panU) : 2.2 * Math.pow(16 / 2.2, Math.pow(plungeU, 2.2))
  return { scale, fx: lerp(CX, c2.x, panU), fy: lerp(CY, c2.y, panU) }
}

/** Le monde A s'efface pendant la plongée, puis cesse d'exister. */
export function worldA(T: number): { opacity: number; shown: boolean } {
  return {
    opacity: 1 - draw(0, 1, plunge + 1.05, plunge + 1.55)(T),
    shown: T < plunge + 1.6,
  }
}

// ---------------------------------------------------------------- triangle 1
export interface TriangleState {
  x: number
  y: number
  size: number
  rot: number
  glow: number
  opacity: number
  /** Les côtés en emphase néon : 0 haut, 1 droite, 2 gauche. */
  lit: readonly number[]
  weight: number
}

/**
 * Le premier triangle : arrivée théâtrale, anticipation, succion, et le cœur
 * lumineux qui grossit au centre juste avant le big-bang.
 */
export function triangle1(T: number): TriangleState & { coreR: number; coreOp: number } {
  const arrScale = enter(6.2, 1.55, arrival, arrival + 2.2)(T)
  const arrRot = pop(-160, 0, arrival, arrival + 2.4)(T)
  const arrOp = enter(0, 1, arrival, arrival + 0.9)(T)
  const antic = pop(0, 0.09, suck - 0.35, suck + 0.05)(T)
  const suckU = clamp((T - suck) / 1.75, 0, 1)
  const shrink = Math.pow(suckU, 1.9)
  const scale = arrScale * (1 + antic) * (1 - 0.988 * shrink)
  return {
    x: CX,
    y: CY,
    size: (420 * scale) / 1.55,
    rot: arrRot + 980 * Math.pow(suckU, 2.6),
    glow: 1 + 2.2 * suckU,
    opacity: arrOp * clamp((bang - T) / 0.06, 0, 1),
    lit: [0],
    weight: 1,
    coreR: 30 * Math.pow(suckU, 1.6),
    coreOp: clamp((suckU - 0.25) / 0.5, 0, 1) * clamp((bang + 0.05 - T) / 0.1, 0, 1),
  }
}

// ---------------------------------------------------------------- étoiles
export interface StarGroup {
  points: [number, number][]
  /** Diamètre du point, en px du cadre. */
  size: number
  /** Fréquence et phase du scintillement. */
  f: number
  ph: number
  /** Opacité de croisière. */
  base: number
  /** Retard d'allumage, en secondes. */
  delay: number
}

/** Six groupes d'étoiles seedés : trois fins, trois brillants. */
export function makeStars(): StarGroup[] {
  const r = rng32(7)
  const points = (n: number): [number, number][] =>
    Array.from({ length: n }, () => [-500 + r() * 2920, -350 + r() * 1780])
  const groups: StarGroup[] = []
  for (let g = 0; g < 3; g++)
    groups.push({
      points: points(58),
      size: 2.2,
      f: 0.9 + g * 0.35,
      ph: g * 2.1,
      base: 0.5,
      delay: g * 0.22,
    })
  for (let g = 0; g < 3; g++)
    groups.push({
      points: points(24),
      size: 3.4,
      f: 0.7 + g * 0.3,
      ph: 1 + g * 1.7,
      base: 0.8,
      delay: (3 + g) * 0.22,
    })
  return groups
}

/** L'opacité d'un groupe d'étoiles : un allumage décalé, puis un scintillement. */
export function starAlpha(group: StarGroup, T: number): number {
  const on = enter(0, 1, t0 + group.delay, t0 + 1.5 + group.delay)(T)
  return on * group.base * (0.62 + 0.38 * Math.sin(T * group.f + group.ph))
}

// ---------------------------------------------------------------- particules
export interface Particle {
  ang: number
  spd: number
  /** 0 fines (60 %), 1 moyennes (30 %), 2 grosses et blanches (10 %). */
  cls: 0 | 1 | 2
  f: number
  ph: number
  /** Le tourbillon (#146) : retard, durée, rayon de départ. */
  delay: number
  dur: number
  rad: number
}

/** Les particules seedées ; les classes tournent 6 / 3 / 1 sur dix. */
export function makeParticles(n: number): Particle[] {
  const r = rng32(31)
  const out: Particle[] = []
  for (let i = 0; i < n; i++) {
    const tenth = i % 10
    out.push({
      ang: r() * Math.PI * 2,
      spd: 0.3 + r() * 0.95,
      cls: tenth < 6 ? 0 : tenth < 9 ? 1 : 2,
      f: 0.4 + r() * 1.2,
      ph: r() * 6.28,
      delay: r() * 1.45,
      dur: 1.6 + r() * 0.8,
      rad: 700 + r() * 520,
    })
  }
  return out
}

/** La nova est éjectée au big-bang et s'éteint avec le monde A. */
export function novaActive(T: number): boolean {
  return T >= bang - 0.02 && worldA(T).shown
}

export function novaOpacity(T: number): number {
  return enter(0, 0.95, bang, bang + 0.18)(T)
}

/**
 * La position d'une particule de la nova à T, écrite dans `out` : un rayon
 * qui décélère sans jamais reculer, et une errance latérale qui grandit.
 */
export function novaPoint(p: Particle, T: number, out: { x: number; y: number }): void {
  const u = clamp((T - bang) / 6.2, 0, 1)
  const e = 1 - Math.pow(1 - u, 4)
  const r = p.spd * 1020 * e
  const wob = 26 * u * Math.sin(T * p.f + p.ph)
  out.x = CX + Math.cos(p.ang) * r + Math.cos(p.ang + 1.57) * wob
  out.y = CY + Math.sin(p.ang) * r * 0.94 + Math.sin(p.ang + 1.57) * wob
}

// ---------------------------------------------------------------- big-bang
export interface Ring {
  r: number
  width: number
  opacity: number
  visible: boolean
}

/** Les deux ondes du big-bang : rapide et large, puis lente et courte. */
export function rings(T: number): [Ring, Ring] {
  const ring = (rMax: number, dur: number, op: number, w: number): Ring => {
    const u = clamp((T - bang) / dur, 0, 1)
    return {
      r: enter(rMax === 910 ? 30 : 20, rMax, bang, bang + dur)(T),
      width: 0.5 + w * (1 - u),
      opacity: op * (1 - u),
      visible: u > 0 && u < 1,
    }
  }
  return [ring(910, 1.5, 0.55, 5), ring(520, 2.3, 0.25, 2.5)]
}

/** Le flash du big-bang, en espace écran : monte en 0,14 s, retombe en 0,54 s. */
export function flashOpacity(T: number): number {
  return (
    Math.min(enter(0, 1, bang - 0.08, bang + 0.06)(T), draw(1, 0, bang + 0.06, bang + 0.6)(T)) *
    0.95
  )
}

// ---------------------------------------------------------------- mots de phase
export interface PhaseWordSpec {
  start: number
  end: number
  letters: number
}

/**
 * Un mot de phase : lettre par lettre (90 ms chacune, jusqu'à 85 %), puis un
 * fondu d'ensemble en 0,6 s à sa fin. `null` tant qu'il n'existe pas.
 */
export function phaseWordAlpha(
  T: number,
  word: PhaseWordSpec,
): { opacity: number; letters: number[] } | null {
  const gone = 1 - draw(0, 1, word.end, word.end + 0.6)(T)
  if (T < word.start - 0.1 || gone <= 0.004) return null
  const letters = Array.from({ length: word.letters }, (_, i) =>
    enter(0, 0.85, word.start + i * 0.09, word.start + i * 0.09 + 0.2)(T),
  )
  return { opacity: gone, letters }
}

/** Les trois mots de phase, avec le compte de lettres qu'ils écrivent. */
export const PHASE_WORDS = {
  genesis: { start: INTRO_BEATS.genesis, end: 4.9, letters: 7 },
  incubation: { start: INTRO_BEATS.incubation, end: t2 - 0.35, letters: 10 },
  emergence: { start: INTRO_BEATS.emergence, end: t2 + 5.1, letters: 9 },
} as const
