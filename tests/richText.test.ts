import { describe, expect, it } from 'vitest'
import { parseCues, plainText } from '@/lib/richText'

/**
 * Le marquage des consignes (#129). Il est pur pour être vérifié ici plutôt
 * qu'à l'œil sur un balayage qui passe toutes les trois secondes.
 */
describe('parseCues', () => {
  it('rend un seul segment quand rien n’est marqué', () => {
    expect(parseCues('Le télescope pointe la fenêtre.')).toEqual([
      { text: 'Le télescope pointe la fenêtre.', cue: false },
    ])
  })

  it('isole les mots marqués au milieu d’une phrase', () => {
    // Le cas réel : une consigne vit au milieu d'un texte qui raconte.
    expect(parseCues('Bienvenue — **faites défiler** pour commencer.')).toEqual([
      { text: 'Bienvenue — ', cue: false },
      { text: 'faites défiler', cue: true },
      { text: ' pour commencer.', cue: false },
    ])
  })

  it('accepte plusieurs consignes dans la même phrase', () => {
    expect(parseCues('**Cliquez** ici, ou **défilez**.').filter((s) => s.cue)).toEqual([
      { text: 'Cliquez', cue: true },
      { text: 'défilez', cue: true },
    ])
  })

  it('laisse un marqueur non refermé tel quel', () => {
    // Ce n'est pas une consigne à moitié : c'est du texte. Deviner où elle
    // finirait reviendrait à inventer une intention que personne n'a écrite.
    expect(plainText('Deux astérisques ** isolés')).toBe('Deux astérisques ** isolés')
  })
})

describe('plainText', () => {
  it('rend la phrase telle que le visiteur la lit', () => {
    expect(plainText('Bienvenue — **faites défiler** pour commencer.')).toBe(
      'Bienvenue — faites défiler pour commencer.',
    )
  })

  it('est ce sur quoi la frappe se compte', () => {
    // Les marqueurs ne s'affichent pas, donc ils ne doivent pas coûter de
    // millisecondes : sinon la durée d'une phrase dépendrait de son balisage.
    expect(plainText('**abc**').length).toBe(3)
  })
})
