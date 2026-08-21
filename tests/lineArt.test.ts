import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { LINE_COLOR, LINE_OVERRIDES, LINE_WIDTH_PX, lineFactor } from '@/config/lineArt'

/**
 * L'encre de #41. Les trois choses que l'œil ne rattrape pas ici :
 *
 *  - une entrée de curation qui ne correspond à rien (un ré-export renomme
 *    l'objet, le trait revient, personne ne regarde ce coin-là ce jour-là) ;
 *  - la coque peinte dans une couleur que personne n'a choisie — elle l'a été
 *    pendant toute la durée du spike, et ça ressemblait à une lumière ;
 *  - la boucle de comparaison qui capture avec l'encre, alors que ses
 *    références sont des rendus Blender nus : les onze arrêts divergeraient
 *    d'un coup et le seul signal qu'elle sait produire serait noyé.
 */

describe('la liste de curation', () => {
  it('éteint le trait sur ce qui est plus fin que le trait', () => {
    // Chacun de ces objets a été mesuré cerné dans les captures de #41 : à
    // 2,2 px, l'encre ne les souligne pas, elle les remplace.
    expect(lineFactor('Outside_Stars')).toBe(0)
    expect(lineFactor('Guitar_Strings')).toBe(0)
    expect(lineFactor('Prop_Keyboard_Keys')).toBe(0)
    expect(lineFactor('Poster_Hellfest_Merged')).toBe(0)
    expect(lineFactor('Poster_Expanse_Merged')).toBe(0)
  })

  it("éteint le trait sur ce que l'encre ne peut pas suivre", () => {
    // Raison différente : le trait n'est pas trop large, il est au mauvais
    // endroit. Les rideaux se déforment dans le vertex shader, l'EdgesGeometry
    // est figée sur la pose au repos — le trait décroche et pend dans le ciel.
    expect(lineFactor('Window_Curtain_Left')).toBe(0)
    expect(lineFactor('Window_Curtain_Right')).toBe(0)
  })

  it('laisse la tringle encrée — elle, ne bouge pas', () => {
    // La correspondance par sous-chaîne est un piège tendu : `Window_Curtain_`
    // ne doit PAS attraper `Window_CurtainRod_*`. C'est le `_` qui tient.
    expect(lineFactor('Window_CurtainRod_Pole')).toBe(1)
    expect(lineFactor('Window_CurtainRod_Finial_L')).toBe(1)
  })

  it("n'éteint pas le reste de la pièce", () => {
    // Le contre-exemple compte autant : une entrée trop large viderait la
    // scène de son encre sans rien casser de visible dans les tests ci-dessus.
    expect(lineFactor('Prop_Mug')).toBe(1)
    expect(lineFactor('Furniture_Desk')).toBe(1)
    expect(lineFactor('Outside_Mountains')).toBe(1)
    expect(lineFactor('Outside_Treeline')).toBe(1)
  })

  it('attrape aussi par le nom des parents', () => {
    // Une maille fusionnée porte souvent un nom de découpe (`..._1`) et ne doit
    // son exclusion qu'à son parent.
    expect(lineFactor('mesh_2', ['Guitar_Strings', 'Scene'])).toBe(0)
    expect(lineFactor('mesh_2', ['Prop_Mug', 'Scene'])).toBe(1)
  })

  it('ne garde que des facteurs 0 ou 1', () => {
    // Les valeurs intermédiaires sont réservées à une largeur par objet, qui
    // n'existe pas : `Outlines` les lirait comme « encre par défaut ».
    for (const factor of Object.values(LINE_OVERRIDES)) expect([0, 1]).toContain(factor)
  })
})

describe('la couleur de la coque', () => {
  it('est dérivée de LINE_COLOR, jamais réécrite en dur', () => {
    // `OutlineEffect.defaultColor` est un triplet BRUT poussé dans l'espace
    // linéaire du moteur. Le triplet écrit à la main valait `#10131f` divisé
    // par 255 — une fraction sRGB dans un emplacement linéaire — et le rendu
    // peignait #474d62, douze fois trop clair : 96 à 100 % des pixels du cerne
    // étaient plus CLAIRS que ce qu'ils recouvraient. Les deux sont des
    // `number` ; seul ce test peut le voir revenir.
    const src = readFileSync(new URL('../src/scene/Outlines.tsx', import.meta.url), 'utf-8')
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
    expect(code).toContain('new Color(LINE_COLOR)')
    expect(code).toContain('defaultColor: [ink.r, ink.g, ink.b]')
    expect(code).not.toMatch(/defaultColor:\s*\[\s*0\.\d/)
  })

  it('reste une encre sombre', () => {
    // #10131f est quasi noir. Une encre claire ne dessine pas, elle auréole.
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(LINE_COLOR.slice(i, i + 2), 16))
    expect(Math.max(r, g, b)).toBeLessThan(64)
  })
})

describe('la boucle de comparaison', () => {
  it('capture sans encre, quel que soit le mode par défaut', () => {
    const src = readFileSync(new URL('./e2e/renderComparison.ts', import.meta.url), 'utf-8')
    expect(src).toContain('&outline=off')
  })
})

describe('la largeur du trait', () => {
  it('reste dans la plage Grease Pencil que le design a validée', () => {
    expect(LINE_WIDTH_PX).toBeGreaterThanOrEqual(1)
    expect(LINE_WIDTH_PX).toBeLessThanOrEqual(3)
  })
})
