/**
 * L'horloge de l'intro (#143) : la chronologie, le temps T, et les règles qui
 * ne se voient pas. Tout est pur ; l'origine du temps vit dans le store.
 *
 * Le vocabulaire est celui de CONTEXT.md : découverte, dernière image, geste
 * de saut.
 */

/** La durée de l'intro, en secondes. À T = 20, la dernière image. */
export const INTRO_DURATION_S = 20

/**
 * Les trois phases, telles que le handoff les a chronométrées. Leurs départs
 * sont les repères (« cues ») auxquels les temps forts se rapportent.
 */
export const INTRO_PHASES = [
  { name: 'idea', start: 0, duration: 6.5 },
  { name: 'design', start: 6.5, duration: 6.5 },
  { name: 'realisation', start: 13, duration: 7 },
] as const

/**
 * Les temps forts, en secondes absolues. Le handoff les écrit relativement au
 * départ de chaque phase (`t0 + 1.2`, `t1 + 2.3`, `t2 + 0.05`…) ; ils sont
 * résolus ici une fois pour toutes, et `tests/intro.test.ts` vérifie qu'ils
 * restent dans l'ordre de la partition et dans la phase qui les raconte.
 */
export const INTRO_BEATS = {
  /** Le triangle arrive de loin. */
  arrival: 1.2,
  /** « GENESIS », lettre par lettre. */
  genesis: 2.2,
  /** Anticipation puis succion du triangle. */
  suck: 3.55,
  /** Le big-bang : flash, ondes, particules. */
  bang: 5.35,
  /** Le panoramique vers le second triangle. */
  pan: 6.65,
  /** La plongée dans le triangle. */
  plunge: 8.8,
  /** Le plan se dessine, lot après lot. */
  draw: 9.5,
  /** « INCUBATION ». */
  incubation: 10.3,
  /** Le tourbillon des particules vers le nom. */
  swirl: 13.05,
  /** « EMERGENCE ». */
  emergence: 13.5,
  /** Les vraies lettres du nom. */
  name: 15.35,
  /** Le troisième triangle, en arc, derrière le nom. */
  arc: 15.9,
  /** La gravure laser du titre. */
  etch: 16.9,
  /** « CREATIVE » commence à clignoter, pour toujours. */
  flicker: 18.75,
} as const

/** Ce que l'horloge lit dans le store — et rien d'autre. */
export interface IntroClockState {
  /** `performance.now()` du T = 0, ou `null` tant que l'intro n'a pas démarré. */
  introStartedAt: number | null
  /** La dernière image est atteinte : par le temps, par un geste, ou d'emblée. */
  introDone: boolean
}

/**
 * Le temps T de l'intro, en secondes, à l'heure `now`. Zéro avant le départ,
 * borné à la dernière image ; et la dernière image sans discussion une fois
 * `introDone` — c'est ce qui fait qu'un saut est une coupe franche.
 */
export function introTime(state: IntroClockState, now: number): number {
  if (state.introDone) return INTRO_DURATION_S
  if (state.introStartedAt === null) return 0
  return Math.min(INTRO_DURATION_S, (now - state.introStartedAt) / 1000)
}

/**
 * Comment l'intro s'ouvre. `play` : elle joue, après la latence de départ.
 * `settle` : la dernière image d'emblée — sous `prefers-reduced-motion`
 * (auto-déclenchée, donc coupée, comme toute animation du site), ou quand un
 * lien direct fait commencer la visite ailleurs qu'à Home.
 */
export function introOpening(input: { reducedMotion: boolean; startsAtHome: boolean }) {
  return input.reducedMotion || !input.startsAtHome ? 'settle' : 'play'
}

export interface SkipContext {
  /** L'intro joue : démarrée et pas encore sur sa dernière image. */
  running: boolean
  /** La caméra est parquée à Home, devant l'écran qui joue. */
  atHome: boolean
}

/**
 * Le geste de saut : la molette, dans les deux sens, ou la touche Échap,
 * pendant que l'intro joue à Home. Il coupe à la dernière image et ne fait
 * rien d'autre — la caméra ne bouge pas. Les flèches n'en sont pas : elles
 * traversent toujours le tour.
 */
export function isSkipGesture(
  event: { type: string; key?: string; deltaY?: number },
  ctx: SkipContext,
): boolean {
  if (!ctx.running || !ctx.atHome) return false
  if (event.type === 'wheel') return true
  return event.type === 'keydown' && event.key === 'Escape'
}
