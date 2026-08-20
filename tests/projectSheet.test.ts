import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { BUBBLES, bubbleText } from '@/content/bubbles'
import { PROJECTS, PROJECTS_EMPTY } from '@/content/projects'
import { SHEET_OUT_MS } from '@/ui/ProjectSheet'
import { LOCALES, t } from '@/lib/locale'

/**
 * La fiche projet (#83). Deux choses qu'aucune relecture ne rattraperait :
 *
 *   1. la durée de sortie vit DEUX FOIS — en CSS (`--t-sheet-out`) et en JS
 *      (`SHEET_OUT_MS`, qui décide du démontage). Les désaccorder ne casse rien,
 *      ça laisse juste la fiche disparaître d'un coup ou traîner un cadre vide ;
 *   2. le repli du tiroir vide passe par la BULLE de la commode, pas par un
 *      écran — sans dossier à cliquer, aucune fiche ne s'ouvre jamais.
 */

const tokens = readFileSync('docs/design/tokens.css', 'utf8')

describe('la sortie de la fiche', () => {
  it('dure exactement ce que le CSS annonce', () => {
    const declared = tokens.match(/--t-sheet-out:\s*(\d+)ms/)
    expect(declared, 'jeton --t-sheet-out introuvable dans tokens.css').not.toBeNull()
    expect(Number(declared![1])).toBe(SHEET_OUT_MS)
  })

  it('entre en fondu depuis le vol, pas avant', () => {
    // Le relais démarre à 70 % du vol : la fiche est opaque ~70 ms après
    // l'arrivée du dossier. À 0 ms de délai, on la verrait se poser sur une
    // pièce encore visible.
    const delay = tokens.match(/animation:\s*sheet-in[^;]*?(\d+)ms\s+both/)
    expect(delay, 'délai de sheet-in introuvable').not.toBeNull()
    expect(Number(delay![1])).toBeGreaterThan(400)
  })
})

describe('le repli du tiroir vide', () => {
  const cabinet = BUBBLES.find((b) => b.stop === 'Cabinet')!

  it('remplace la phrase de la commode quand il n’y a aucun projet', () => {
    for (const locale of LOCALES) {
      expect(bubbleText(cabinet, 0, locale), locale).toBe(t(PROJECTS_EMPTY, locale))
    }
  })

  it('laisse la narration intacte dès qu’il y a un projet', () => {
    expect(bubbleText(cabinet, 1, 'fr')).toBe(cabinet.text.fr)
    expect(bubbleText(cabinet, PROJECTS.length, 'fr')).toBe(cabinet.text.fr)
  })

  it('ne touche à aucun autre arrêt, même à zéro projet', () => {
    for (const bubble of BUBBLES) {
      if (bubble.stop === 'Cabinet') continue
      for (const locale of LOCALES) {
        expect(bubbleText(bubble, 0, locale), bubble.stop).toBe(t(bubble.text, locale))
      }
    }
  })
})

describe('la fiche et le contenu', () => {
  it('sait afficher chaque projet sans trou', () => {
    // La fiche lit ces champs sans garde : un projet incomplet laisserait un
    // blanc dans la composition plutôt qu'une erreur.
    for (const p of PROJECTS) {
      expect(p.name, p.slug).toBeTruthy()
      expect(p.year, p.slug).toBeTruthy()
      expect(p.stack.length, p.slug).toBeGreaterThan(0)
      for (const locale of LOCALES) {
        const where = `${p.slug} (${locale})`
        expect(t(p.tagline, locale), where).toBeTruthy()
        expect(t(p.role, locale), where).toBeTruthy()
        expect(t(p.highlights, locale).length, where).toBeGreaterThan(0)
      }
    }
  })

  it('a une anatomie de fiche dans le design system, pas dans le composant', () => {
    // L'app et la maquette partagent une seule définition : si `.sheet` quittait
    // tokens.css pour un CSS local, les deux pourraient diverger en silence.
    for (const cls of ['.sheet', '.sheet__title', '.sheet__tagline', '.sheet__link']) {
      expect(tokens, `${cls} absent de tokens.css`).toContain(cls)
    }
  })
})
