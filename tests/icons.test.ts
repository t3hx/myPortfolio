import { readFileSync, readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { FLAGS, MARKS } from '@/config/icons'

/**
 * Les marques et les drapeaux servis depuis `public/` (#168).
 *
 * **Un masque manquant n'affiche RIEN, et n'émet aucune erreur.** Ni une
 * console, ni un `onError` — un `mask-image` vers un fichier absent laisse une
 * vignette vide, exactement comme une vignette qui n'aurait rien à montrer.
 * C'est la même classe de silence que `@font-face` vers un fichier absent, que
 * `tests/fonts.test.ts` garde depuis #140, et que les images de fiche projet.
 *
 * Le contrôle va donc dans les DEUX SENS, et c'est ce qui le rend utile :
 *
 *   - tout chemin déclaré pointe vers un fichier, sinon la surface est muette ;
 *   - tout fichier du dossier est déclaré, sinon il est servi au visiteur sans
 *     que rien ne l'affiche — du poids mort dans l'image Docker.
 *
 * Ce qui NE se vérifie pas ici, et qu'il faut savoir : l'harmonisation elle-même.
 * Le remplissage de la boîte par le dessin se mesure dans un navigateur, en
 * lisant la boîte englobante des tracés — impossible sans moteur de rendu, et
 * hors de portée d'un environnement Node. Les mesures sont datées dans
 * `src/config/icons.ts` ; ici on garde la FORME du fichier, qui se lit.
 */

/** Le dossier sur le disque. Les chemins déclarés, eux, sont des URL servies :
 *  `/icons/x.svg` côté navigateur vaut `public/icons/x.svg` côté dépôt. */
const ICONS_DIR = 'public/icons'

const files = readdirSync(ICONS_DIR).filter((f) => f.endsWith('.svg'))
const base = (chemin: string) => chemin.slice(chemin.lastIndexOf('/') + 1)
const head = (file: string) => {
  const svg = readFileSync(`${ICONS_DIR}/${file}`, 'utf8')
  return { svg, open: /<svg[^>]*>/.exec(svg)?.[0] ?? '' }
}

describe('les fichiers déclarés', () => {
  it('existent tous', () => {
    for (const [nom, chemin] of Object.entries({ ...MARKS, ...FLAGS })) {
      expect(files, `${nom} → ${chemin}`).toContain(base(chemin))
    }
  })

  it('couvrent tout le dossier, sans fichier orphelin', () => {
    // Un fichier non déclaré est servi au visiteur et affiché par personne.
    const déclarés = Object.values({ ...MARKS, ...FLAGS }).map((c) => c.split('/').pop())
    expect([...files].sort()).toEqual([...déclarés].sort())
  })

  it('ne confond pas une marque et un drapeau', () => {
    // Un drapeau est tricolore : passé en masque il se réduirait à un disque
    // plein. Les deux familles ne se rendent pas de la même façon, donc elles
    // ne doivent jamais se recouvrir.
    const marques = new Set<string>(Object.values(MARKS))
    for (const drapeau of Object.values(FLAGS)) expect(marques.has(drapeau)).toBe(false)
  })
})

describe('les marques', () => {
  const marques = Object.entries(MARKS)

  it('portent un viewBox carré', () => {
    // Rogné sur le dessin puis carré (#168) : c'est ce qui fait que toutes
    // remplissent leur boîte de la même façon, quelle que soit la taille du
    // viewBox du jeu d'icônes d'origine — 24, 32 ou 128 selon la marque.
    for (const [nom, chemin] of marques) {
      const vue = /viewBox="([^"]+)"/.exec(head(base(chemin)).open)
      expect(vue, `${nom} : aucun viewBox`).not.toBeNull()
      const [, , l, h] = vue![1].split(/\s+/).map(Number)
      expect(l, `${nom} : viewBox non carré (${vue![1]})`).toBeCloseTo(h, 2)
    }
  })

  it('ne fixent ni largeur ni hauteur', () => {
    // Une taille écrite dans le fichier contredirait la vignette qui l'affiche.
    for (const [nom, chemin] of marques) {
      expect(head(base(chemin)).open, nom).not.toMatch(/\s(width|height)=/)
    }
  })

  it('se peignent avec la couleur du contexte', () => {
    // `currentColor` est ce qui permet à une seule marque de servir la vignette
    // du CV, la barre de menu et ses 40 % d'opacité de repos.
    for (const [nom, chemin] of marques) {
      expect(head(base(chemin)).svg, nom).toContain('currentColor')
    }
  })

  it('ne figent aucune couleur en dur', () => {
    // Le piège mesuré sur three.js : un `color="#000"` sur un groupe redéfinit
    // `currentColor` pour ses enfants. Le fichier se dit alors contextuel et
    // peint du noir. Sous masque ça ne se voit pas — le jour où il est posé
    // en ligne, si.
    for (const [nom, chemin] of marques) {
      const { svg } = head(base(chemin))
      expect(svg, `${nom} : couleur en dur`).not.toMatch(/(fill|stroke|color)="#/)
    }
  })

  it('ne portent ni feuille de style, ni script, ni image embarquée', () => {
    for (const [nom, chemin] of marques) {
      const { svg } = head(base(chemin))
      for (const balise of ['<style', '<script', '<image']) {
        expect(svg, `${nom} : contient ${balise}`).not.toContain(balise)
      }
    }
  })
})

describe('les drapeaux', () => {
  it('gardent leurs couleurs', () => {
    // Ils sont l'exception, et elle est assumée : un drapeau tricolore ne se
    // rend pas en monochrome. Le gris de la langue inactive vient d'un filtre
    // CSS sur ce même fichier, jamais d'un second fichier (#164).
    for (const [langue, chemin] of Object.entries(FLAGS)) {
      const { svg } = head(base(chemin))
      expect(svg, `${langue} : aucune couleur`).toMatch(/fill="#/)
    }
  })

  it('couvrent chaque langue de l’app', () => {
    expect(Object.keys(FLAGS).sort()).toEqual(['en', 'fr'])
  })
})
