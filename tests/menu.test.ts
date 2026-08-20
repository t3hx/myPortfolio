import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { CAMERA_STOPS } from '@/config/cameraStops'
import { MENU_SECTIONS, MENU_SOCIALS } from '@/content/menu'
import { t } from '@/lib/locale'

/**
 * Le menu vise des arrêts par `label`. Renommer un arrêt dans CAMERA_STOPS ou
 * le retirer casse la promesse de l'issue #26 — « un projet en deux clics » —
 * sans rien casser de visible : l'entrée reste dans la barre et ne mène nulle
 * part. Le composant avertit en console ; ce test échoue avant.
 */
describe('menu sections', () => {
  it('every section targets a real stop', () => {
    const labels = CAMERA_STOPS.map((s) => s.label)
    for (const section of MENU_SECTIONS) {
      expect(labels, `"${section.label}" vise "${section.stop}"`).toContain(section.stop)
    }
  })

  it('sends the projects entry to the cabinet, not the desk', () => {
    // Décision produit du 2026-08-18 : les projets sont dans la commode.
    expect(MENU_SECTIONS.find((s) => t(s.label, 'fr') === 'Projets')?.stop).toBe('Cabinet')
  })
})

describe('menu socials', () => {
  it('never ships a link that goes nowhere', () => {
    // Une entrée sans href est filtrée à l'affichage ; celles qui en ont une
    // doivent être absolues (elles ouvrent un autre site).
    for (const social of MENU_SOCIALS.filter((s) => s.href)) {
      expect(social.href, social.title).toMatch(/^https:\/\//)
    }
  })
})

describe('la bascule de langue', () => {
  const tokens = readFileSync('docs/design/tokens.css', 'utf8')
  // Les COMMENTAIRES sont retirés : celui de cette règle explique justement
  // pourquoi `color` n'y est pas, et le mot y apparaît donc forcément.
  const reset = tokens
    .slice(
      tokens.indexOf('.menu__lang button {'),
      tokens.indexOf('}', tokens.indexOf('.menu__lang button {')),
    )
    .replace(/\/\*[\s\S]*?\*\//g, '')

  it("dit quelle langue est active, en couleur d'accent", () => {
    expect(tokens).toMatch(/\.menu__lang-on\s*\{[^}]*color:\s*var\(--glow\)/)
    expect(tokens).toMatch(/\.menu__lang-off\s*\{[^}]*color:\s*rgba\(var\(--cream-rgb\)/)
  })

  it("ne laisse pas la remise à zéro des boutons manger l'accent", () => {
    // Le piège, vécu : `.menu__lang button` est PLUS SPÉCIFIQUE que
    // `.menu__lang-on` (0,1,1 contre 0,1,0). Un `color: inherit` dans la
    // remise à zéro sortait les deux côtés de la même couleur, et il devenait
    // impossible de voir dans quelle langue on était. Les deux règles de
    // couleur posent chacune la leur : la remise à zéro n'a pas à s'en mêler.
    expect(reset).not.toContain('color')
    // Elle doit en revanche neutraliser le chrome système, police comprise :
    // un `<button>` n'hérite pas de `font-family`.
    expect(reset).toContain('appearance: none')
    expect(reset).toContain('font: inherit')
  })
})
