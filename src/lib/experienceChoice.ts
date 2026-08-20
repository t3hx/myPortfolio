/**
 * Aiguillage 3D / classique (issue #24) — la décision qui précède TOUT
 * chargement de la scène.
 *
 * Trois promesses à tenir, dans cet ordre :
 *
 *   1. l'écran de choix s'affiche avant le moindre octet du `.glb` — garanti
 *      par le `React.lazy` d'App3D dans `App.tsx`, pas ici ;
 *   2. un visiteur en version classique n'initialise JAMAIS WebGL — d'où le
 *      `probeWebGL` passé en thunk : un choix `classic` mémorisé court-circuite
 *      la sonde, on ne crée même pas de contexte jetable ;
 *   3. WebGL absent = repli automatique vers la version classique, sans écran
 *      de choix (proposer une expérience impossible n'est pas un choix).
 *
 * `resolveExperience` est pur (params + storage + sonde injectés) : c'est lui
 * que `tests/experienceChoice.test.ts` verrouille, en environnement Node.
 */

export type ExperienceChoice = '3d' | 'classic'

export type ExperienceResolution =
  | { kind: 'ask' }
  | {
      kind: 'route'
      choice: ExperienceChoice
      reason: 'dev-params' | 'stored' | 'no-webgl' | 'chosen'
    }

export const CHOICE_STORAGE_KEY = 'portfolio.experience'

/**
 * Paramètres d'outillage (voir « URL parameters » dans CLAUDE.md) : ils ciblent
 * la scène 3D et doivent rester déterministes. `?stop=` alimente la boucle de
 * comparaison de rendus — un écran de choix devant elle casserait chaque
 * capture ; les autres sont des modes de diagnostic qui n'ont pas de sens sans
 * la scène.
 */
const DEV_PARAMS = ['stop', 'debug', 'debug-fly', 'outline', 'lw'] as const

export function resolveExperience(opts: {
  search: URLSearchParams
  stored: string | null
  probeWebGL: () => boolean
}): ExperienceResolution {
  const { search, stored, probeWebGL } = opts

  if (DEV_PARAMS.some((p) => search.has(p))) {
    return { kind: 'route', choice: '3d', reason: 'dev-params' }
  }

  // `?choose` rouvre l'écran malgré un choix mémorisé — la porte de sortie
  // promise par la maquette (« modifiable à tout moment depuis le menu »),
  // utilisable dès maintenant, avant que le menu n'existe.
  const reopen = search.has('choose')

  if (!reopen && stored === 'classic') {
    return { kind: 'route', choice: 'classic', reason: 'stored' }
  }

  if (!probeWebGL()) {
    return { kind: 'route', choice: 'classic', reason: 'no-webgl' }
  }

  if (!reopen && stored === '3d') {
    return { kind: 'route', choice: '3d', reason: 'stored' }
  }

  return { kind: 'ask' }
}

/* --- Adaptateurs navigateur ------------------------------------------------------- */

/**
 * Sonde WebGL sur un canvas jetable, jamais attaché au DOM. N'est appelée que
 * lorsque la route 3D est encore possible (voir l'ordre dans
 * `resolveExperience`).
 */
export function isWebGLAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas')
    return canvas.getContext('webgl2') !== null || canvas.getContext('webgl') !== null
  } catch {
    return false
  }
}

/* localStorage peut lever (navigation privée, quotas) : dans ce cas le choix ne
   survit pas à la session courante — dégradation acceptable, jamais bloquante. */

export function readStoredChoice(): string | null {
  try {
    return window.localStorage.getItem(CHOICE_STORAGE_KEY)
  } catch {
    return null
  }
}

export function storeChoice(choice: ExperienceChoice): void {
  try {
    window.localStorage.setItem(CHOICE_STORAGE_KEY, choice)
  } catch {
    /* voir ci-dessus */
  }
}

export function clearStoredChoice(): void {
  try {
    window.localStorage.removeItem(CHOICE_STORAGE_KEY)
  } catch {
    /* voir ci-dessus */
  }
}
