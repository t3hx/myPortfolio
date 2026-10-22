import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/**
 * Règle produit (#140) : aucune police ne vient de Google, jamais. Elles sont
 * locales, servies par l'app depuis public/fonts/, déclarées dans
 * src/styles/fonts.css. Ce test lit ces trois choses et rien d'autre — il ne
 * rend pas de texte — mais il suffit à empêcher les deux régressions
 * silencieuses : une balise <link> qui revient dans index.html, et une
 * déclaration @font-face qui pointe vers un fichier absent (le navigateur
 * retombe alors sur la police de secours, sans erreur visible).
 */

const FONTS_CSS = 'src/styles/fonts.css'

type Face = {
  family: string
  weight: [number, number]
  style: 'normal' | 'italic'
  display: string | null
  urls: string[]
}

function parseFaces(css: string): Face[] {
  const faces: Face[] = []
  const blocks = css.matchAll(/@font-face\s*{([^}]*)}/g)
  for (const [, body] of blocks) {
    const prop = (name: string) =>
      body.match(new RegExp(`${name}\\s*:\\s*([^;]+);`))?.[1].trim() ?? null
    const family = prop('font-family')?.replace(/^['"]|['"]$/g, '')
    const weightRaw = prop('font-weight') ?? '400'
    const [lo, hi = lo] = weightRaw.split(/\s+/).map(Number)
    const urls = [...body.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)].map((m) => m[1])
    expect(family, `a @font-face without font-family: ${body}`).toBeTruthy()
    faces.push({
      family: family!,
      weight: [lo, hi],
      style: prop('font-style') === 'italic' ? 'italic' : 'normal',
      display: prop('font-display'),
      urls,
    })
  }
  return faces
}

const covers = (faces: Face[], family: string, weight: number, style: Face['style'] = 'normal') =>
  faces.some(
    (f) =>
      f.family === family && f.style === style && f.weight[0] <= weight && weight <= f.weight[1],
  )

describe('fonts are served by the app, never by Google', () => {
  it('index.html asks nothing from Google Fonts', () => {
    const html = readFileSync('index.html', 'utf8')
    expect(html).not.toMatch(/googleapis|gstatic|fonts\.google/)
  })

  it('main.tsx imports fonts.css before the design system', () => {
    const main = readFileSync('src/main.tsx', 'utf8')
    const fonts = main.indexOf("import '@/styles/fonts.css'")
    const tokens = main.indexOf("import '@/styles/tokens.css'")
    expect(fonts).toBeGreaterThanOrEqual(0)
    expect(fonts).toBeLessThan(tokens)
  })

  it('every @font-face points at a file the app serves', () => {
    const faces = parseFaces(readFileSync(FONTS_CSS, 'utf8'))
    expect(faces.length).toBeGreaterThan(0)
    for (const face of faces) {
      expect(face.urls.length, `${face.family}: no url()`).toBeGreaterThan(0)
      for (const url of face.urls) {
        expect(url, `${face.family}: ${url} must be served from /fonts/`).toMatch(
          /^\/fonts\/[^/]+\.woff2$/,
        )
        expect(existsSync(`public${url}`), `${face.family}: missing public${url}`).toBe(true)
      }
    }
  })

  it('every face swaps in rather than hiding the text', () => {
    const faces = parseFaces(readFileSync(FONTS_CSS, 'utf8'))
    for (const face of faces) expect(face.display, face.family).toBe('swap')
  })

  it('covers every family, weight and style the styles use', () => {
    const faces = parseFaces(readFileSync(FONTS_CSS, 'utf8'))
    // Le nom de l'intro (#146) : Michroma, une seule graisse.
    expect(covers(faces, 'Michroma', 400)).toBe(true)
    // L'UI : Space Grotesk 400 / 500 / 600 (tokens.css, classic.css).
    for (const w of [400, 500, 600])
      expect(covers(faces, 'Space Grotesk', w), `Space Grotesk ${w}`).toBe(true)
    // La voix : Newsreader 300 / 400 / 500, droite et italique.
    for (const w of [300, 400, 500]) {
      expect(covers(faces, 'Newsreader', w), `Newsreader ${w}`).toBe(true)
      expect(covers(faces, 'Newsreader', w, 'italic'), `Newsreader ${w} italic`).toBe(true)
    }
    // La mono du site classique : IBM Plex Mono 400 / 500.
    for (const w of [400, 500])
      expect(covers(faces, 'IBM Plex Mono', w), `IBM Plex Mono ${w}`).toBe(true)
  })

  it('ships the OFL licence of every family it serves', () => {
    const faces = parseFaces(readFileSync(FONTS_CSS, 'utf8'))
    const families = new Set(faces.map((f) => f.family))
    for (const family of families) {
      const slug = family.toLowerCase().replace(/\s+/g, '-')
      expect(existsSync(`public/fonts/OFL-${slug}.txt`), `public/fonts/OFL-${slug}.txt`).toBe(true)
    }
  })
})
