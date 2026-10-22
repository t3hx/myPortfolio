import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { INTRO_NAME_FONT } from '@/config/intro'
import { CX, NAME_Y } from '@/lib/introScene'
import { NAME_SAMPLE_ALPHA, NAME_SAMPLE_STEP, sampleGlyphs } from '@/lib/nameTargets'

/**
 * Les cibles du tourbillon (#146) : les pixels du nom, échantillonnés une fois
 * dans un canvas hors écran. La lecture du canvas n'est pas testable en Node ;
 * ce qui l'est — et ce qui casse en silence — c'est la GRILLE et le REPÈRE.
 * Une cible exprimée dans le repère du canvas ferait converger le tourbillon
 * en haut à gauche du cadre, à côté des lettres.
 */

/** Un faux canvas RGBA : `on` dit quels pixels sont opaques. */
function pixels(
  width: number,
  height: number,
  on: (x: number, y: number) => boolean,
): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) data[(y * width + x) * 4 + 3] = on(x, y) ? 255 : 0
  return data
}

describe('sampleGlyphs', () => {
  const size = { width: 60, height: 24 }
  const origin = { x: 30, y: 12 }

  it('samples on a 6 px grid, and answers in the frame around the name', () => {
    const data = pixels(size.width, size.height, () => true)
    const points = sampleGlyphs(data, size, origin)
    // 6 px de pas depuis x = 2 : dix colonnes, quatre lignes.
    expect(points).toHaveLength(10 * 4)
    for (const [x, y] of points) {
      expect((x - CX + origin.x - 2) % NAME_SAMPLE_STEP).toBe(0)
      expect(Math.abs(x - CX)).toBeLessThanOrEqual(size.width / 2)
      expect(Math.abs(y - NAME_Y)).toBeLessThanOrEqual(size.height / 2)
    }
    // Le repère du nom, pas celui du canvas : le premier point est en haut à
    // gauche DU NOM, donc à gauche du centre du cadre et au-dessus de sa ligne.
    expect(points[0]).toEqual([2 - origin.x + CX, 2 - origin.y + NAME_Y])
  })

  it('keeps only what the glyph actually inks', () => {
    // Une bande opaque sur la moitié gauche : rien à droite ne doit ressortir.
    const data = pixels(size.width, size.height, (x) => x < size.width / 2)
    const points = sampleGlyphs(data, size, origin)
    expect(points.length).toBeGreaterThan(0)
    for (const [x] of points) expect(x).toBeLessThan(CX)
  })

  it('ignores the antialiasing fringe, which is not the letter', () => {
    const faint = pixels(size.width, size.height, () => false)
    for (let i = 3; i < faint.length; i += 4) faint[i] = NAME_SAMPLE_ALPHA
    expect(sampleGlyphs(faint, size, origin)).toEqual([])
  })
})

describe('the sampled font', () => {
  it('describes the same face the DOM will set the name in', () => {
    // Le canvas échantillonne ce que le DOM écrira. Le composant pose la
    // famille, la taille et l'interlettrage EN LIGNE depuis cette constante,
    // donc il n'y a rien à faire diverger — sauf ce raccourci-ci, que
    // `document.fonts.load` et `ctx.font` attendent sous forme abrégée.
    expect(INTRO_NAME_FONT.css).toBe(`${INTRO_NAME_FONT.size}px ${INTRO_NAME_FONT.family}`)
  })

  it('is declared by the app, never fetched from Google (#140)', () => {
    const fonts = readFileSync('src/styles/fonts.css', 'utf8')
    expect(fonts).toMatch(new RegExp(`font-family:\\s*'${INTRO_NAME_FONT.family}'`))
  })
})
