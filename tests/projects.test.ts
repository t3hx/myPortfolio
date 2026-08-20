import { describe, expect, it } from 'vitest'
import { DRAWER_CAPACITY, TAB_LABEL_MAX_CHARS } from '@/config/cabinet'
import { GENERIC_COVER_SRC, PROJECTS, PROJECTS_EMPTY } from '@/content/projects'
import { LOCALES, t } from '@/lib/locale'

/**
 * `PROJECTS` n'est pas qu'une liste de textes : c'est la source du nombre de
 * dossiers à cloner dans le tiroir (#80) et du mot écrit sur chaque étiquette.
 * Deux contraintes de la scène 3D remontent donc jusqu'ici, et aucune des deux
 * ne se voit en relisant le contenu :
 *
 *   - au-delà de cinq dossiers, le tiroir n'a plus la profondeur pour les
 *     échelonner sans qu'ils entrent sous le plateau de la commode ;
 *   - au-delà de onze signes, le libellé déborde de son étiquette.
 *
 * Ajouter un sixième projet, ou en nommer un « Gestionnaire de tâches », ne
 * casserait rien à la compilation : ça casserait le tiroir, à l'écran, et
 * seulement pour qui regarde ce plan-là.
 */

describe('PROJECTS', () => {
  it('tient dans le tiroir', () => {
    expect(PROJECTS.length).toBeLessThanOrEqual(DRAWER_CAPACITY)
  })

  it("n'a pas deux fiches sous la même clé", () => {
    // Le `slug` est destiné à devenir une clé de lien profond : deux fiches
    // homonymes en rendraient une inatteignable.
    const slugs = PROJECTS.map((p) => p.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  it('donne à chaque étiquette un libellé qui rentre', () => {
    for (const p of PROJECTS) {
      expect(p.tabLabel.length, `étiquette « ${p.tabLabel} »`).toBeLessThanOrEqual(
        TAB_LABEL_MAX_CHARS,
      )
      expect(p.tabLabel.trim()).not.toBe('')
    }
  })

  it('remplit ce qu’une fiche promet', () => {
    // Les DEUX langues (#33) : une traduction oubliée laisse un blanc dans la
    // composition, exactement comme un champ vide — et rien ne le dirait.
    for (const p of PROJECTS) {
      expect(p.name.trim(), p.slug).not.toBe('')
      expect(p.year.trim(), p.slug).not.toBe('')
      expect(p.stack.length, p.slug).toBeGreaterThan(0)
      for (const locale of LOCALES) {
        const where = `${p.slug} (${locale})`
        expect(t(p.tagline, locale).trim(), where).not.toBe('')
        expect(t(p.role, locale).trim(), where).not.toBe('')
        expect(t(p.highlights, locale).length, where).toBeGreaterThan(0)
      }
    }
  })

  it("n'affiche jamais de lien mort", () => {
    // Trois des dépôts sont privés. Même discipline que `MENU_SOCIALS` : une
    // entrée sans href n'est pas rendue, plutôt qu'un lien qui mène à un 404.
    // Le champ est donc absent, jamais vide et jamais rempli d'un placeholder.
    for (const p of PROJECTS) {
      if (p.links === undefined) continue
      expect(p.links.length, p.slug).toBeGreaterThan(0)
      for (const link of p.links) {
        for (const locale of LOCALES) {
          expect(t(link.label, locale).trim(), `${p.slug} (${locale})`).not.toBe('')
        }
        expect(link.href, p.slug).toMatch(/^https:\/\//)
      }
    }
  })

  it('ne prétend pas avoir une couverture qui n’existe pas', () => {
    // L'illustration générique est un livrable de la session design (#78) :
    // aucune fiche ne doit pointer un fichier en attendant.
    for (const p of PROJECTS) {
      expect(p.cover, p.slug).toBeUndefined()
    }
  })
})

describe('les replis', () => {
  it('a de quoi remplir un tiroir vide', () => {
    // Zéro projet est un état possible, pas une panne. Et c'est UNE PHRASE, pas
    // un écran : sans dossier à cliquer, aucune fiche ne s'ouvre jamais — le
    // repli prend la place de la bulle de la commode (#78).
    for (const locale of LOCALES) {
      expect(t(PROJECTS_EMPTY, locale).trim(), locale).not.toBe('')
      expect(t(PROJECTS_EMPTY, locale), locale).not.toMatch(/\n/)
    }
  })

  it('vise un seul chemin de couverture générique', () => {
    expect(GENERIC_COVER_SRC.startsWith('/')).toBe(true)
  })
})
