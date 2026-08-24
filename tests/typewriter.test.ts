import { describe, expect, it } from 'vitest'
import { TYPE_MS_PER_CHAR, typeDuration, typedLength } from '@/lib/typewriter'

/**
 * La machine à écrire des bulles (#121). Elle est pure justement pour que sa
 * règle se vérifie ici plutôt qu'à l'œil sur une animation qui dure deux
 * secondes.
 */
describe('typedLength', () => {
  const phrase = 'Deux écrans, un clavier bruyant.'

  it('n’a rien écrit au premier instant', () => {
    expect(typedLength(phrase, 0)).toBe(0)
  })

  it('écrit à cadence constante', () => {
    expect(typedLength(phrase, TYPE_MS_PER_CHAR * 5)).toBe(5)
    expect(typedLength(phrase, TYPE_MS_PER_CHAR * 5.9)).toBe(5)
    expect(typedLength(phrase, TYPE_MS_PER_CHAR * 6)).toBe(6)
  })

  it('ne dépasse jamais la fin du texte', () => {
    expect(typedLength(phrase, typeDuration(phrase) * 10)).toBe(phrase.length)
  })

  it('affiche TOUT quand il n’y a pas d’horloge', () => {
    // `null` est le contrat de `useElapsed` : avant le départ, après la fin, et
    // sous `prefers-reduced-motion`. C'est ce qui fait que couper l'animation
    // montre la phrase au lieu de l'effacer — une frappe auto-déclenchée doit
    // DISPARAÎTRE sous « mouvement réduit », pas s'accélérer.
    expect(typedLength(phrase, null)).toBe(phrase.length)
  })

  it('ne recule pas si l’horloge remonte le temps', () => {
    expect(typedLength(phrase, -50)).toBe(0)
  })

  it('écrit une phrase du tour dans un temps tenable', () => {
    // Les dix phrases françaises font de 58 à 101 caractères. La borne haute
    // est ce qui décide : au-delà de trois secondes, on attend la machine.
    expect(typeDuration('x'.repeat(101))).toBeLessThan(3000)
    expect(typeDuration('x'.repeat(58))).toBeGreaterThan(1000)
  })
})
