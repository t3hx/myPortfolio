import { describe, expect, it } from 'vitest'
import { resolveExperience } from '@/lib/experienceChoice'

/**
 * `resolveExperience` est l'aiguillage de l'issue #24. Trois de ses promesses
 * ne se voient pas à l'œil et ne casseraient rien de bruyant si elles
 * régressaient :
 *
 *   1. un choix « classique » mémorisé ne sonde JAMAIS WebGL — la sonde crée
 *      un contexte, exactement ce que la route classique jure de ne pas faire ;
 *   2. les paramètres d'outillage (`?stop=` en tête, qui alimente la boucle de
 *      comparaison de rendus) court-circuitent l'écran de choix — sinon chaque
 *      capture automatisée photographie deux cartes au lieu d'un cadrage ;
 *   3. WebGL absent = version classique d'office, même si « 3d » est mémorisé.
 */

const params = (search: string) => new URLSearchParams(search)
const webgl = (available: boolean) => () => available
const webglNeverProbed = () => {
  throw new Error('sonde WebGL appelée alors que la route classique était acquise')
}

describe('resolveExperience', () => {
  it("demande le choix quand rien n'est mémorisé et que WebGL répond", () => {
    expect(
      resolveExperience({ search: params(''), stored: null, probeWebGL: webgl(true) }),
    ).toEqual({ kind: 'ask' })
  })

  it('route vers le choix mémorisé', () => {
    expect(
      resolveExperience({ search: params(''), stored: '3d', probeWebGL: webgl(true) }),
    ).toEqual({ kind: 'route', choice: '3d', reason: 'stored' })
  })

  it('honore un choix classique mémorisé sans jamais sonder WebGL', () => {
    expect(
      resolveExperience({ search: params(''), stored: 'classic', probeWebGL: webglNeverProbed }),
    ).toEqual({ kind: 'route', choice: 'classic', reason: 'stored' })
  })

  it('replie automatiquement vers la version classique sans WebGL', () => {
    expect(
      resolveExperience({ search: params(''), stored: null, probeWebGL: webgl(false) }),
    ).toEqual({ kind: 'route', choice: 'classic', reason: 'no-webgl' })
  })

  it('replie vers la classique sans WebGL même quand « 3d » est mémorisé', () => {
    expect(
      resolveExperience({ search: params(''), stored: '3d', probeWebGL: webgl(false) }),
    ).toEqual({ kind: 'route', choice: 'classic', reason: 'no-webgl' })
  })

  it("court-circuite l'écran pour chaque paramètre d'outillage", () => {
    for (const search of ['?stop=Home', '?debug', '?debug-fly', '?outline=hull', '?lw=2']) {
      // même un choix classique mémorisé ne bloque pas l'outillage : la boucle
      // de comparaison doit rester déterministe sur n'importe quel navigateur
      expect(
        resolveExperience({ search: params(search), stored: 'classic', probeWebGL: webgl(true) }),
      ).toEqual({ kind: 'route', choice: '3d', reason: 'dev-params' })
    }
  })

  it('rouvre le choix avec ?choose malgré une préférence mémorisée', () => {
    for (const stored of ['3d', 'classic']) {
      expect(
        resolveExperience({ search: params('?choose'), stored, probeWebGL: webgl(true) }),
      ).toEqual({ kind: 'ask' })
    }
  })

  it('?choose sans WebGL ne propose pas un choix impossible', () => {
    expect(
      resolveExperience({ search: params('?choose'), stored: '3d', probeWebGL: webgl(false) }),
    ).toEqual({ kind: 'route', choice: 'classic', reason: 'no-webgl' })
  })

  it('ignore une valeur mémorisée corrompue et redemande', () => {
    expect(
      resolveExperience({ search: params(''), stored: 'garbage', probeWebGL: webgl(true) }),
    ).toEqual({ kind: 'ask' })
  })
})
