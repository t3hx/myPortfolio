import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  INK_EMITTER_KEEP,
  INK_SKIP_DEFORMED,
  INK_SKIP_DENSE,
  INK_SKIP_FINE,
  LINE_COLOR,
  LINE_OVERRIDES,
  LINE_WIDTH_PX,
  inkSkipReason,
  lineFactor,
} from '@/config/lineArt'

/**
 * L'encre de #41. Ce que l'œil ne rattrape pas ici :
 *
 *  - une exclusion trop LARGE, qui emporte autre chose que sa cible — le cas
 *    qui a coûté son trait au cadre des affiches ;
 *  - une exclusion qui ne correspond plus à rien après un ré-export ;
 *  - la coque peinte dans une couleur que personne n'a choisie — elle l'a été
 *    pendant tout le spike, et ça ressemblait à une lumière ;
 *  - la boucle de comparaison qui capture avec l'encre, alors que ses
 *    références sont des rendus Blender nus.
 */

// Ce que `RoomModel` marque dans `userData.runtime`.
const EMITTER = 'emissive'
const BAKED = 'unlit'

describe("ce qui émet de la lumière n'est pas encré", () => {
  it("couvre les émetteurs sans qu'aucun soit listé à la main", () => {
    // Un trait sombre de deux pixels sur une LED de deux pixels ne la souligne
    // pas, il l'éteint. La règle est dérivée du traitement que `RoomModel` a
    // déjà choisi pour rendre le matériau.
    expect(inkSkipReason('Mat_KeyboardBacklight', EMITTER)).toBe('emitter')
    expect(inkSkipReason('Mat_HeadsetLED', EMITTER)).toBe('emitter')
    expect(inkSkipReason('Mat_LEDEmissive', EMITTER)).toBe('emitter')
    expect(inkSkipReason('Mat_LEDEmissive', EMITTER)).toBe('emitter')
    expect(inkSkipReason('Mat_CatEyes', EMITTER)).toBe('emitter')
  })

  it('attrape les étoiles et les cordes, qui étaient listées à la main', () => {
    // Les deux entrées écrites en dur avant qu'on regarde de quoi ces objets
    // étaient faits. Elles n'ont plus à exister : c'est la même règle.
    expect(inkSkipReason('Mat_Stars', EMITTER)).toBe('emitter')
    expect(inkSkipReason('Mat_GuitarString', EMITTER)).toBe('emitter')
  })

  it('laisse le décor du dehors encré, lui qui peint plutôt qu’il n’éclaire', () => {
    // La crête cernée est ce qui donne la gravure dans la fenêtre. Ces trois
    // matériaux se servent de l'émissif comme d'un aplat, pas comme d'une lampe.
    for (const mat of INK_EMITTER_KEEP) expect(inkSkipReason(mat, EMITTER)).toBeNull()
    for (const mat of ['Mat_Mountains', 'Mat_Treeline', 'Mat_Ground']) {
      expect(INK_EMITTER_KEEP).toContain(mat)
    }
  })

  it('laisse les hélices de ventilateur encrées', () => {
    // Le contre-exemple qui dit ce que la règle veut vraiment dire : un trait
    // n'éteint un émissif que s'il est plus large que lui. Une LED fait deux
    // pixels, une hélice plusieurs centimètres — cernée, elle donne au boîtier
    // ses dix roues dessinées. Arbitrage produit, tranché sur capture.
    expect(inkSkipReason('Mat_FanBlade', EMITTER)).toBeNull()
    // Le support reste cuit, donc encré par le cas général : les deux moitiés
    // d'un ventilateur doivent porter le même trait, sans quoi seule l'hélice
    // est dessinée et le boîtier a l'air troué.
    expect(inkSkipReason('Mat_FanFrame', BAKED)).toBeNull()
  })
})

describe('les exclusions par matériau', () => {
  it("saute la grille de l'ampli et le dessin des affiches", () => {
    expect(inkSkipReason('Mat_Amp_Grille', BAKED)).toBe('fine')
    expect(inkSkipReason('Mat_Amp_GrilleWire', BAKED)).toBe('fine')
    expect(inkSkipReason('Mat_Poster_Hellfest', BAKED)).toBe('fine')
    expect(inkSkipReason('Mat_Poster_Expanse', BAKED)).toBe('fine')
  })

  it('GARDE le trait sur le cadre des affiches', () => {
    // Le cas qui a imposé de trancher par matériau plutôt que par objet :
    // `Poster_Hellfest_Merged` porte le dessin ET son cadre, et une exclusion
    // par nom d'objet emportait les deux. C'est le cadre, l'objet.
    expect(inkSkipReason('Mat_PosterFrame', BAKED)).toBeNull()
    expect(inkSkipReason('Mat_PosterFrame_H', BAKED)).toBeNull()
  })

  it('garde le corps et les boutons de l’ampli', () => {
    // Même piège, de l'autre côté : « l'ampli » n'est pas une cible, sa grille
    // en est une.
    expect(inkSkipReason('Mat_Amp_Tolex', BAKED)).toBeNull()
    expect(inkSkipReason('Mat_Amp_Knob', BAKED)).toBeNull()
    expect(inkSkipReason('Mat_Amp_Gold', BAKED)).toBeNull()
  })

  it('saute la lune et le ciel, dont les plis virent au grillage', () => {
    expect(inkSkipReason('Mat_Moon', BAKED)).toBe('dense')
    expect(inkSkipReason('Mat_MoonDetailed', BAKED)).toBe('dense')
    expect(inkSkipReason('Mat_Sky', BAKED)).toBe('dense')
  })

  it("saute le rideau, que l'encre ne peut pas suivre", () => {
    // Raison différente des autres : le trait n'est pas trop large, il est au
    // mauvais endroit. Les sommets partent dans le shader, l'`EdgesGeometry`
    // reste sur la pose au repos.
    expect(inkSkipReason('Mat_Curtain', BAKED)).toBe('deformed')
  })

  it("n'éteint pas le reste de la pièce", () => {
    // Le contre-exemple compte autant : une entrée trop large viderait la
    // scène de son encre sans rien casser des tests ci-dessus.
    for (const mat of [
      'Mat_Parquet',
      'Mat_GuitarBody',
      'Mat_CabinetFront',
      'Mat_KeyTop',
      'Mat_Mug',
    ]) {
      expect(inkSkipReason(mat, BAKED)).toBeNull()
    }
  })

  it('ne liste jamais deux fois le même matériau', () => {
    const all = [...INK_SKIP_FINE, ...INK_SKIP_DENSE, ...INK_SKIP_DEFORMED, ...INK_EMITTER_KEEP]
    expect(new Set(all).size).toBe(all.length)
  })

  it('compare les noms de matériaux en ENTIER, jamais par sous-chaîne', () => {
    // `Mat_Amp_Grille` ne doit pas attraper un futur `Mat_Amp_GrilleTrim`, et
    // surtout `Mat_Poster_Expanse` ne doit rien dire de `Mat_PosterFrame`.
    expect(inkSkipReason('Mat_Amp_Grille_Extra', BAKED)).toBeNull()
    expect(inkSkipReason('Mat_Moonlight', BAKED)).toBeNull()
  })
})

describe('le repli par nom d’objet', () => {
  it('est vide — tout a trouvé son matériau', () => {
    // Deux mécanismes pour une même question finissent par se contredire. Il
    // reste pour le jour où deux objets partageront un matériau sans devoir
    // partager son traitement.
    expect(Object.keys(LINE_OVERRIDES)).toHaveLength(0)
  })

  it('resterait une correspondance par sous-chaîne, parents compris', () => {
    // Le piège tendu, verrouillé même à vide : `Window_Curtain_` ne doit pas
    // attraper `Window_CurtainRod_Pole`. C'est le `_` final qui tient.
    const overrides = { Window_Curtain_: 0 }
    const factor = (name: string) =>
      Object.entries(overrides).some(([m]) => name.includes(m)) ? 0 : 1
    expect(factor('Window_Curtain_Left')).toBe(0)
    expect(factor('Window_CurtainRod_Pole')).toBe(1)
    // Et l'implémentation réelle répond bien 1 partout puisque la liste est vide.
    expect(lineFactor('Window_Curtain_Left')).toBe(1)
    expect(lineFactor('mesh_2', ['Guitar_Strings'])).toBe(1)
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

describe('le traitement est marqué, pas re-dérivé', () => {
  it('RoomModel écrit `userData.runtime` sur chaque matériau reconstruit', () => {
    // Sans ce marquage, `Outlines` devrait refaire la classification — deux
    // sources pour une décision, et la seconde finit par mentir.
    const src = readFileSync(new URL('../src/scene/RoomModel.tsx', import.meta.url), 'utf-8')
    expect(src).toContain('out.userData.runtime = tag')
  })
})

describe('la boucle de comparaison', () => {
  it('capture sans encre, quel que soit le mode par défaut', () => {
    const src = readFileSync(new URL('./e2e/renderComparison.ts', import.meta.url), 'utf-8')
    expect(src).toContain('&outline=off')
  })
})

describe('la largeur du trait', () => {
  it('reste sous les 2 px', () => {
    // À 2,2 px le trait était plus large que la moitié de ce qu'il cernait, et
    // il fallait exclure objet après objet pour compenser une épaisseur. La
    // largeur se règle avant la liste, pas après.
    expect(LINE_WIDTH_PX).toBeGreaterThanOrEqual(0.8)
    expect(LINE_WIDTH_PX).toBeLessThanOrEqual(2)
  })
})
