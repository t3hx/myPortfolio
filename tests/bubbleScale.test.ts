import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/**
 * L'unité du dialogue (#137) — « un pixel du design, redimensionné ».
 *
 * Ce fichier verrouille les deux choses qu'aucune capture ne montre : que
 * l'unité soit une LONGUEUR (une seule des trois bornes en nombre rend le
 * `clamp` invalide, et la police retombe silencieusement à celle du
 * navigateur), et que les tailles réécrites dans le calque projeté disent
 * toujours la même chose que les jetons du design system.
 */

const tokens = readFileSync('src/styles/tokens.css', 'utf8')
const shell = readFileSync('src/styles/styles.css', 'utf8')
const bubble = readFileSync('src/scene/Bubble.tsx', 'utf8')

/** La valeur d'un jeton de `tokens.css`, en pixels. */
function token(name: string): number {
  const m = tokens.match(new RegExp(`--${name}:\\s*(\\d+(?:\\.\\d+)?)px`))
  expect(m, `jeton --${name} introuvable`).not.toBeNull()
  return Number(m![1])
}

describe("l'unité du dialogue", () => {
  it('est une longueur, jamais un facteur', () => {
    // `clamp(1, calc(100vw / 1280), 1.35)` mélange des nombres et une longueur —
    // `100vw / 1280` EST une longueur — et le `clamp` entier devient invalide.
    // Mesuré : la police retombait à 16 px, la taille par défaut du navigateur,
    // ce qui ressemble à s'y méprendre à un réglage qui n'a pas pris.
    const m = shell.match(/--u:\s*clamp\(([^;]+)\);/)
    expect(m, 'unité --u introuvable').not.toBeNull()
    const [min, , max] = m![1].split(/,(?![^(]*\))/).map((p) => p.trim())
    expect(min).toMatch(/px$/)
    expect(max).toMatch(/px$/)
  })

  it('ne change RIEN sous la largeur du cadre du design', () => {
    // Le plancher à 1 px et la référence à 1280 sont le même engagement : en
    // dessous du cadre où la session design a mesuré ses placements, la bulle
    // garde exactement les tailles validées.
    expect(shell).toMatch(/--u:\s*clamp\(1px,\s*calc\(100vw \/ 1280\)/)
  })

  it('plafonne, pour ne pas décoller les bulles de leur ancre', () => {
    // Une bulle plus grosse est une BOÎTE plus grosse, et `clampToSafeArea`
    // décollerait du bord celles dont la marge est la plus courte — or
    // `docs/DESIGN.md` enregistre ces placements comme validés arrêt par arrêt.
    // Mesuré à 1,35 : aucune bulle clampée, ni à 1920×1080 ni à 2560×1440.
    const cap = shell.match(/--u:\s*clamp\([^,]+,[^,]+,\s*([\d.]+)px\)/)
    expect(cap).not.toBeNull()
    expect(Number(cap![1])).toBeGreaterThan(1)
    expect(Number(cap![1])).toBeLessThanOrEqual(1.35)
  })
})

describe('les tailles réécrites disent la même chose que les jetons', () => {
  /**
   * Le calque projeté doit restater les nombres du design — `calc()` ne sait
   * pas diviser une longueur par une longueur, donc `var(--fs-body)` ne peut pas
   * servir de base à un multiple. Ce test est ce qui empêche les deux
   * écritures de se mettre à dire autre chose.
   */
  it('reprend la taille du corps et celle du kicker', () => {
    expect(shell).toContain(`font-size: calc(${token('fs-body')} * var(--u))`)
    expect(shell).toContain(`font-size: calc(${token('fs-kicker')} * var(--u))`)
  })

  it('reprend le rayon de la bulle', () => {
    expect(shell).toContain(`border-radius: calc(${token('r-bubble')} * var(--u))`)
  })

  it('met à l’échelle le rembourrage, pas seulement la police', () => {
    // Grossir le seul texte laisserait un cadre trop serré autour de lui : le
    // rembourrage est de l'anatomie, pas de la décoration.
    expect(shell).toMatch(/padding: calc\(16 \* var\(--u\)\)/)
  })

  it('ne met PAS la largeur maximale à l’échelle', () => {
    // Elle est composée contre la SCÈNE, pas contre le texte : la table de
    // placement la mesure dans le cadre où l'objet occupe une place donnée.
    // Mise à l'échelle, la bulle de l'étagère venait mordre le montant de la
    // bibliothèque à 2560 — une bulle DÉSIGNE son sujet, elle ne le recouvre
    // pas. La boîte grandit en hauteur, où elle n'a personne à recouvrir.
    expect(bubble).not.toContain('calc(${maxWidth}')
    expect(bubble).toContain("maxWidth: maxWidth ?? 'none'")
  })
})

describe('la portée', () => {
  it('est le calque projeté, et lui seul', () => {
    // Les maquettes gardent les tailles que la session design a validées, et
    // l'encadré de la lune comme les cartes de pré-sélection empruntent
    // l'anatomie `.bubble` sans être des bulles du tour.
    expect(tokens).not.toContain('var(--u)')
    for (const rule of shell.match(/^\.[^\n{]*\{/gm) ?? []) {
      if (rule.includes('var(--u)')) expect(rule).toContain('.bubble-layer')
    }
    const scaled = shell.match(/^[^\n]*calc\(\d+ \* var\(--u\)\)[^\n]*$/gm) ?? []
    expect(scaled.length).toBeGreaterThan(4)
  })
})
