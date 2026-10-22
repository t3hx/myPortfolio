import { describe, expect, it } from 'vitest'
import { TYPE_MS_PER_CHAR, typeDuration, typedLength } from '@/lib/typewriter'

/**
 * La machine à écrire des bulles (#121). Elle est pure justement pour que sa
 * règle se vérifie ici plutôt qu'à l'œil sur une animation de deux secondes.
 */
describe('typedLength', () => {
  const phrase = 'Deux écrans, un clavier bruyant.'
  const durée = typeDuration(phrase)

  it('n’a rien écrit au premier instant', () => {
    expect(typedLength(phrase, 0, durée)).toBe(0)
  })

  it('écrit à cadence constante', () => {
    expect(typedLength(phrase, TYPE_MS_PER_CHAR * 5, durée)).toBe(5)
    expect(typedLength(phrase, TYPE_MS_PER_CHAR * 5.9, durée)).toBe(5)
    expect(typedLength(phrase, TYPE_MS_PER_CHAR * 6, durée)).toBe(6)
  })

  it('affiche tout dès que la durée est écoulée', () => {
    expect(typedLength(phrase, durée, durée)).toBe(phrase.length)
    expect(typedLength(phrase, durée * 10, durée)).toBe(phrase.length)
  })

  it('affiche tout d’emblée quand la frappe ne dure pas', () => {
    // C'est ainsi que « mouvement réduit » est exprimé : une durée nulle, ce
    // qui dit exactement ce qu'on veut dire — la frappe ne dure pas — plutôt
    // qu'un drapeau que chaque appelant devrait interpréter.
    expect(typedLength(phrase, 0, 0)).toBe(phrase.length)
  })

  it('ne recule pas si l’horloge remonte le temps', () => {
    expect(typedLength(phrase, -50, durée)).toBe(0)
  })

  it('compte une émoticône pour un caractère, pas pour deux', () => {
    // Une émoticône occupe deux unités UTF-16. Comptée en unités, elle coûtait
    // deux temps de frappe et, surtout, la frappe s'arrêtait un instant au
    // milieu de la paire — moitié de paire que le navigateur peint en glyphe
    // cassé. La copy de l'étagère en porte une (#32).
    expect(typeDuration('😅')).toBe(TYPE_MS_PER_CHAR)
    expect(typedLength('a😅b', TYPE_MS_PER_CHAR * 2, TYPE_MS_PER_CHAR * 3)).toBe(2)
  })

  it('écrit une page du tour dans un temps tenable', () => {
    // Les quinze pages françaises livrées par #32 font de 51 à 101 caractères.
    // La borne haute est ce qui décide : au-delà de trois secondes, on attend
    // la machine. La borne basse, elle, doit rester assez longue pour qu'on
    // VOIE écrire — sous la seconde, c'est un fondu.
    expect(typeDuration('x'.repeat(101))).toBeLessThan(3000)
    expect(typeDuration('x'.repeat(51))).toBeGreaterThan(1000)
  })
})
