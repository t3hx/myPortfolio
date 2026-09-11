import { describe, expect, it } from 'vitest'
import { layout, parseCues, plainLength, plainText } from '@/lib/richText'

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

/**
 * Les LIGNES (#32). La rédaction a besoin de casser une phrase à un endroit
 * choisi, et pas seulement là où la largeur de la bulle décide. C'est un `\n`
 * dans la chaîne, et `layout` est ce qui le transforme en lignes.
 *
 * La fonction est pure pour une raison précise : elle porte trois découpes à
 * la fois — le marquage des consignes, les sauts de ligne et l'avancée de la
 * frappe — et aucune des trois ne se voit dans le DOM autrement qu'à l'œil,
 * sur une animation de deux secondes. `Typed` ne fait plus que la rendre.
 */
describe('layout', () => {
  it('rend une seule ligne quand le texte n’en demande pas', () => {
    expect(layout('Pixel, contrôle qualité.', 99)).toEqual([
      [
        {
          text: 'Pixel, contrôle qualité.',
          cue: false,
          written: 'Pixel, contrôle qualité.',
          pending: '',
        },
      ],
    ])
  })

  it('coupe sur chaque saut, et ne garde pas le saut dans le texte', () => {
    // Le `\n` est une INSTRUCTION, pas un caractère à peindre : le rendre
    // laisserait une espace en fin de ligne, visible à la sélection.
    const lignes = layout('Montagnes, nuit claire.\nEt un télescope.', 99)
    expect(lignes.map((l) => l.map((s) => s.text).join(''))).toEqual([
      'Montagnes, nuit claire.',
      'Et un télescope.',
    ])
  })

  it('laisse une ligne vide quand la rédaction en demande deux', () => {
    expect(layout('Un.\n\nDeux.', 99).map((l) => l.map((s) => s.text).join(''))).toEqual([
      'Un.',
      '',
      'Deux.',
    ])
  })

  it('garde l’accent d’une consigne qui enjambe un saut', () => {
    // Une consigne coupée reste une consigne des deux côtés : sinon la moitié
    // basse du mot repasserait en crème, ce que personne n’a demandé.
    const lignes = layout('**Bougez\nvotre souris**', 99)
    expect(lignes.map((l) => l.map((s) => ({ text: s.text, cue: s.cue })))).toEqual([
      [{ text: 'Bougez', cue: true }],
      [{ text: 'votre souris', cue: true }],
    ])
  })

  it('écrit les lignes dans l’ordre, et le saut coûte un caractère', () => {
    // Le saut s'affiche — comme une rupture — donc il se paie comme le reste.
    // Les marqueurs, eux, ne s'affichent pas et ne coûtent rien.
    const source = 'abc\ndef'
    expect(
      layout(source, 0)
        .flat()
        .map((s) => s.written),
    ).toEqual(['', ''])
    expect(
      layout(source, 3)
        .flat()
        .map((s) => s.written),
    ).toEqual(['abc', ''])
    // 4 = les trois lettres plus le saut : la deuxième ligne n'a encore rien.
    expect(
      layout(source, 4)
        .flat()
        .map((s) => s.written),
    ).toEqual(['abc', ''])
    expect(
      layout(source, 5)
        .flat()
        .map((s) => s.written),
    ).toEqual(['abc', 'd'])
    expect(
      layout(source, 99)
        .flat()
        .map((s) => s.written),
    ).toEqual(['abc', 'def'])
  })

  it('réserve la place du reste à écrire', () => {
    // C'est ce qui fixe la hauteur de la bulle dès le premier caractère : la
    // part non écrite est rendue, mais invisible.
    expect(layout('**Cliquez** ici', 3)).toEqual([
      [
        { text: 'Cliquez', cue: true, written: 'Cli', pending: 'quez' },
        { text: ' ici', cue: false, written: '', pending: ' ici' },
      ],
    ])
  })

  it('ne coupe jamais un caractère en deux moitiés', () => {
    // Une émoticône occupe DEUX unités UTF-16 : comptée en unités, la frappe
    // s'arrête un instant au milieu de la paire et le navigateur peint un
    // glyphe cassé. La frappe compte donc en caractères vus.
    const source = 'a😅b'
    expect(layout(source, 2).flat()[0].written).toBe('a😅')
    expect(layout(source, 3).flat()[0].written).toBe('a😅b')
  })
})

describe('plainLength', () => {
  it('compte ce que le visiteur voit, pas des unités UTF-16', () => {
    expect(plainLength('a😅b')).toBe(3)
  })

  it('ne compte pas les marqueurs de consigne', () => {
    expect(plainLength('**abc**')).toBe(3)
  })

  it('compte le saut de ligne, parce qu’il s’affiche', () => {
    expect(plainLength('abc\ndef')).toBe(7)
  })
})
