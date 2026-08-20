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
