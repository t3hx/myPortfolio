import { describe, expect, it } from 'vitest'
import { LOCALE_STORAGE_KEY, resolveLocale, t, tm } from '@/lib/locale'

/**
 * La résolution de langue (#33), verrouillée là où elle se décide : dans une
 * fonction pure, sans DOM ni navigateur. C'est le même parti que
 * `resolveExperience`, et pour la même raison — la détection est une règle, pas
 * un effet de bord à observer en intégration.
 */

describe('resolveLocale', () => {
  it('respecte toujours un choix mémorisé, même contre le navigateur', () => {
    // Une décision de l'utilisateur ne se re-devine pas à chaque visite.
    expect(resolveLocale({ stored: 'en', preferred: ['fr-FR'] })).toEqual({
      locale: 'en',
      reason: 'stored',
    })
  })

  it('ignore une valeur mémorisée qui ne veut rien dire', () => {
    // `localStorage` est modifiable à la main, et une clé partagée peut avoir
    // servi à autre chose. On retombe sur la détection, pas sur une erreur.
    const got = resolveLocale({ stored: 'de', preferred: ['fr'] })
    expect(got).toEqual({ locale: 'fr', reason: 'detected' })
  })

  it('lit la LISTE des préférences, pas seulement la première', () => {
    // Un visiteur réglé en allemand puis français parle français. Servir de
    // l'anglais serait un défaut déguisé en détection.
    expect(resolveLocale({ stored: null, preferred: ['de-DE', 'fr-FR', 'en'] })).toEqual({
      locale: 'fr',
      reason: 'detected',
    })
  })

  it('ne regarde que la sous-étiquette de langue, pas la région', () => {
    for (const tag of ['fr', 'fr-FR', 'fr-CA', 'FR-fr']) {
      expect(resolveLocale({ stored: null, preferred: [tag] }).locale, tag).toBe('fr')
    }
  })

  it("retombe sur l'anglais quand aucune préférence n'est comprise", () => {
    expect(resolveLocale({ stored: null, preferred: ['de', 'it'] })).toEqual({
      locale: 'en',
      reason: 'fallback',
    })
    expect(resolveLocale({ stored: null, preferred: [] }).reason).toBe('fallback')
  })

  it('range sa mémoire sous une clé qui dit à quoi elle sert', () => {
    // Même préfixe que le choix 3D/classique : un `localStorage` partagé avec
    // d'autres pages du domaine ne doit pas être ambigu.
    expect(LOCALE_STORAGE_KEY).toBe('portfolio.locale')
  })
})

describe('t et tm', () => {
  it('lisent la langue demandée', () => {
    expect(t({ fr: 'oui', en: 'yes' }, 'en')).toBe('yes')
    expect(t({ fr: ['a'], en: ['b'] }, 'fr')).toEqual(['a'])
  })

  it('laissent passer une valeur neutre', () => {
    // `C1`, `B`, `PostgreSQL` : une chaîne simple dit « neutre par décision »,
    // et l'envelopper en `{ fr: 'C1', en: 'C1' }` mentirait sur l'intention.
    expect(tm('C1', 'fr')).toBe('C1')
    expect(tm('C1', 'en')).toBe('C1')
    expect(tm({ fr: 'natif', en: 'native' }, 'en')).toBe('native')
  })
})
