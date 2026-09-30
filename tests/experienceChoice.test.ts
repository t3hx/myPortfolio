import { describe, expect, it } from 'vitest'
import { isCoarsePointer, resolveExperience } from '@/lib/experienceChoice'

/**
 * `resolveExperience` est l'aiguillage de l'issue #24. Quatre de ses promesses
 * ne se voient pas à l'œil et ne casseraient rien de bruyant si elles
 * régressaient :
 *
 *   1. un choix « classique » mémorisé ne sonde JAMAIS WebGL — la sonde crée
 *      un contexte, exactement ce que la route classique jure de ne pas faire ;
 *   2. les paramètres d'outillage (`?stop=` en tête, qui alimente la boucle de
 *      comparaison de rendus) court-circuitent l'écran de choix — sinon chaque
 *      capture automatisée photographie deux cartes au lieu d'un cadrage ;
 *   3. WebGL absent = version classique d'office, même si « 3d » est mémorisé ;
 *   4. un pointeur « coarse » (téléphone, tablette — #186) ne route JAMAIS vers
 *      la 3D, même mémorisée : l'écran de choix s'affiche, carte 3D désactivée.
 *      Impossible ≠ déconseillé — WebGL absent reste un repli silencieux, le
 *      pointeur coarse reste un écran qui explique.
 */

const params = (search: string) => new URLSearchParams(search)
const webgl = (available: boolean) => () => available
const webglNeverProbed = () => {
  throw new Error('sonde WebGL appelée alors que la route classique était acquise')
}
const coarse = (isCoarse: boolean) => () => isCoarse
const coarseNeverProbed = () => {
  throw new Error('sonde de pointeur appelée alors que la route était déjà décidée')
}

describe('resolveExperience', () => {
  it("demande le choix quand rien n'est mémorisé et que WebGL répond", () => {
    expect(
      resolveExperience({
        search: params(''),
        stored: null,
        probeWebGL: webgl(true),
        probeCoarsePointer: coarse(false),
      }),
    ).toEqual({ kind: 'ask', coarsePointer: false })
  })

  it('route vers le choix mémorisé', () => {
    expect(
      resolveExperience({
        search: params(''),
        stored: '3d',
        probeWebGL: webgl(true),
        probeCoarsePointer: coarse(false),
      }),
    ).toEqual({ kind: 'route', choice: '3d', reason: 'stored' })
  })

  it('honore un choix classique mémorisé sans sonder ni WebGL ni le pointeur', () => {
    expect(
      resolveExperience({
        search: params(''),
        stored: 'classic',
        probeWebGL: webglNeverProbed,
        probeCoarsePointer: coarseNeverProbed,
      }),
    ).toEqual({ kind: 'route', choice: 'classic', reason: 'stored' })
  })

  it('replie automatiquement vers la version classique sans WebGL', () => {
    expect(
      resolveExperience({
        search: params(''),
        stored: null,
        probeWebGL: webgl(false),
        probeCoarsePointer: coarse(false),
      }),
    ).toEqual({ kind: 'route', choice: 'classic', reason: 'no-webgl' })
  })

  it('replie vers la classique sans WebGL même quand « 3d » est mémorisé', () => {
    expect(
      resolveExperience({
        search: params(''),
        stored: '3d',
        probeWebGL: webgl(false),
        probeCoarsePointer: coarse(false),
      }),
    ).toEqual({ kind: 'route', choice: 'classic', reason: 'no-webgl' })
  })

  it("court-circuite l'écran pour chaque paramètre d'outillage", () => {
    for (const search of [
      '?stop=Home',
      '?debug',
      '?debug-fly',
      '?outline=hull',
      '?lw=2',
      '?capture',
      '?accent=00C0E8',
    ]) {
      // même un choix classique mémorisé ne bloque pas l'outillage : la boucle
      // de comparaison doit rester déterministe sur n'importe quel navigateur
      expect(
        resolveExperience({
          search: params(search),
          stored: 'classic',
          probeWebGL: webgl(true),
          probeCoarsePointer: coarse(false),
        }),
      ).toEqual({ kind: 'route', choice: '3d', reason: 'dev-params' })
    }
  })

  it('rouvre le choix avec ?choose malgré une préférence mémorisée', () => {
    for (const stored of ['3d', 'classic']) {
      expect(
        resolveExperience({
          search: params('?choose'),
          stored,
          probeWebGL: webgl(true),
          probeCoarsePointer: coarse(false),
        }),
      ).toEqual({ kind: 'ask', coarsePointer: false })
    }
  })

  it('?choose sans WebGL ne propose pas un choix impossible', () => {
    expect(
      resolveExperience({
        search: params('?choose'),
        stored: '3d',
        probeWebGL: webgl(false),
        probeCoarsePointer: coarse(false),
      }),
    ).toEqual({ kind: 'route', choice: 'classic', reason: 'no-webgl' })
  })

  it('ignore une valeur mémorisée corrompue et redemande', () => {
    expect(
      resolveExperience({
        search: params(''),
        stored: 'garbage',
        probeWebGL: webgl(true),
        probeCoarsePointer: coarse(false),
      }),
    ).toEqual({ kind: 'ask', coarsePointer: false })
  })

  /**
   * Le pointeur coarse (#186, décision du 2026-09-26, `docs/SPEC_MOBILE_CLASSIC.md`) :
   * téléphones ET tablettes vont au classic. Le critère est à UNE dimension —
   * le pointeur primaire — taille d'écran et orientation ignorées.
   */
  describe('pointeur coarse', () => {
    it("affiche l'écran avec la carte 3D désactivée quand rien n'est mémorisé", () => {
      expect(
        resolveExperience({
          search: params(''),
          stored: null,
          probeWebGL: webgl(true),
          probeCoarsePointer: coarse(true),
        }),
      ).toEqual({ kind: 'ask', coarsePointer: true })
    })

    it("prime sur un choix « 3d » mémorisé — l'appareil a pu changer, la règle non", () => {
      // localStorage est par appareil, mais un navigateur se synchronise et un
      // écran se branche : un « 3d » mémorisé ailleurs ne charge pas la scène ici.
      expect(
        resolveExperience({
          search: params(''),
          stored: '3d',
          probeWebGL: webgl(true),
          probeCoarsePointer: coarse(true),
        }),
      ).toEqual({ kind: 'ask', coarsePointer: true })
    })

    it('ne prime PAS sur un choix classique mémorisé, qui va dans le même sens', () => {
      expect(
        resolveExperience({
          search: params(''),
          stored: 'classic',
          probeWebGL: webglNeverProbed,
          probeCoarsePointer: coarseNeverProbed,
        }),
      ).toEqual({ kind: 'route', choice: 'classic', reason: 'stored' })
    })

    it("cède aux paramètres d'outillage, qui passent AVANT tout", () => {
      // la boucle de comparaison capture par URL, sur n'importe quelle machine :
      // un runner CI qui répondrait « coarse » ne doit pas casser les captures
      expect(
        resolveExperience({
          search: params('?stop=Home'),
          stored: null,
          probeWebGL: webgl(true),
          probeCoarsePointer: coarseNeverProbed,
        }),
      ).toEqual({ kind: 'route', choice: '3d', reason: 'dev-params' })
    })

    it('cède au repli sans-WebGL : impossible ≠ déconseillé', () => {
      // sans WebGL l'écran n'aurait qu'une carte cliquable et rien à recommander :
      // ce cas reste le repli silencieux existant, pas un écran de choix
      expect(
        resolveExperience({
          search: params(''),
          stored: null,
          probeWebGL: webgl(false),
          probeCoarsePointer: coarse(true),
        }),
      ).toEqual({ kind: 'route', choice: 'classic', reason: 'no-webgl' })
    })

    it('?choose rouvre le même écran, carte 3D toujours désactivée', () => {
      expect(
        resolveExperience({
          search: params('?choose'),
          stored: '3d',
          probeWebGL: webgl(true),
          probeCoarsePointer: coarse(true),
        }),
      ).toEqual({ kind: 'ask', coarsePointer: true })
    })
  })
})

describe('isCoarsePointer', () => {
  it("répond « fine » quand la sonde n'a pas de navigateur — le défaut sûr", () => {
    // En Node, `window` n'existe pas : la sonde doit avaler l'erreur et
    // répondre `false` — le défaut qui AFFICHE l'écran de choix au lieu de
    // dégrader l'expérience d'un visiteur que rien n'a mesuré.
    expect(isCoarsePointer()).toBe(false)
  })
})
