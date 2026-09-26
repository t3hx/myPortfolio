/**
 * Aiguillage 3D / classique (issue #24) — la décision qui précède TOUT
 * chargement de la scène.
 *
 * Quatre promesses à tenir, dans cet ordre :
 *
 *   1. l'écran de choix s'affiche avant le moindre octet du `.glb` — garanti
 *      par le `React.lazy` d'App3D dans `App.tsx`, pas ici ;
 *   2. un visiteur en version classique n'initialise JAMAIS WebGL — d'où le
 *      `probeWebGL` passé en thunk : un choix `classic` mémorisé court-circuite
 *      la sonde, on ne crée même pas de contexte jetable ;
 *   3. WebGL absent = repli automatique vers la version classique, sans écran
 *      de choix (proposer une expérience impossible n'est pas un choix) ;
 *   4. un pointeur primaire « coarse » — téléphone, tablette, iPad Pro compris
 *      (#186, décision du 2026-09-26, `docs/SPEC_MOBILE_CLASSIC.md`) — ne route
 *      JAMAIS vers la 3D, même mémorisée : l'écran s'affiche, carte 3D
 *      désactivée avec son explication. Impossible ≠ déconseillé — c'est ce qui
 *      distingue ce cas du repli sans-WebGL, qui reste silencieux.
 *
 * `resolveExperience` est pur (params + storage + sondes injectées) : c'est lui
 * que `tests/experienceChoice.test.ts` verrouille, en environnement Node.
 */

export type ExperienceChoice = '3d' | 'classic'

export type ExperienceResolution =
  | { kind: 'ask'; coarsePointer: boolean }
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
 * la scène. Ils passent AVANT la règle du pointeur coarse, pour la même
 * raison : la boucle capture par URL, sur n'importe quelle machine.
 */
const DEV_PARAMS = ['stop', 'debug', 'debug-fly', 'outline', 'lw', 'capture', 'accent'] as const

export function resolveExperience(opts: {
  search: URLSearchParams
  stored: string | null
  probeWebGL: () => boolean
  probeCoarsePointer: () => boolean
}): ExperienceResolution {
  const { search, stored, probeWebGL, probeCoarsePointer } = opts

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

  // La règle coarse prime sur un `3d` mémorisé — localStorage est par appareil,
  // mais un navigateur se synchronise et un écran se branche : un choix fait
  // ailleurs ne charge pas 162 Mo de VRAM ici. Elle ne prime pas sur `classic`
  // mémorisé (traité plus haut), qui va dans le même sens.
  if (probeCoarsePointer()) {
    return { kind: 'ask', coarsePointer: true }
  }

  if (!reopen && stored === '3d') {
    return { kind: 'route', choice: '3d', reason: 'stored' }
  }

  return { kind: 'ask', coarsePointer: false }
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

/**
 * Le pointeur PRIMAIRE, à une dimension (#186) : `(pointer: coarse)` dit
 * « l'appareil se pilote au doigt », taille d'écran et orientation ignorées.
 * Un laptop tactile répond `fine` (son pointeur primaire est le trackpad) et
 * garde la 3D. Pas de sniffing d'user-agent.
 *
 * Le défaut en cas d'erreur est `fine` : c'est celui qui AFFICHE l'écran de
 * choix complet au lieu de dégrader l'expérience d'un visiteur que rien n'a
 * mesuré — même philosophie que le localStorage qui lève plus bas.
 */
export function isCoarsePointer(): boolean {
  try {
    return window.matchMedia('(pointer: coarse)').matches
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
