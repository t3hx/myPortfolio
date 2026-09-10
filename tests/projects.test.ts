import { existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { DRAWER_CAPACITY, TAB_LABEL_MAX_CHARS } from '@/config/cabinet'
import type { Project } from '@/content/projects'
import { GENERIC_COVER_SRC, PROJECTS, PROJECTS_EMPTY, SHOTS_MAX } from '@/content/projects'
import { projectMedia, showsStrip, thumbSrc } from '@/lib/projectMedia'
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
    // L'illustration générique est toujours un livrable en attente (#78) :
    // personne ne doit la déclarer avant que le fichier existe.
    //
    // La règle a CHANGÉ de forme avec #126, et c'est la bonne : elle exigeait
    // `cover === undefined` partout, ce qui interdisait aussi la première vraie
    // couverture dessinée. Ce qui compte n'est pas qu'aucune fiche n'ait
    // d'image, c'est qu'aucune n'en promette une qui manque — vérifié pour
    // toutes les images de la fiche par « ne pointe aucun fichier local absent ».
    for (const p of PROJECTS) {
      expect(p.cover, p.slug).not.toBe(GENERIC_COVER_SRC)
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

/**
 * L'ORDRE DU TIROIR (décision de l'auteur, 2026-09-07). Le tableau EST la
 * rangée de dossiers : `buildFolders` place le dossier n° i à `folderZ(i, n)`
 * et ne lit rien d'autre. Rien dans la scène ne dit cet ordre, donc rien ne
 * signalerait qu'il a bougé — sauf en ouvrant le tiroir.
 */
describe("l'ordre de la commode", () => {
  it('range les dossiers dans l’ordre décidé', () => {
    expect(PROJECTS.map((p) => p.slug)).toEqual([
      'portfolio',
      'owlog',
      'solarsys',
      'anima',
      'odysong',
    ])
  })

  it('garde les vraies adresses des dépôts malgré les renommages', () => {
    // Un projet renommé dans le portfolio ne renomme pas son dépôt : les liens
    // pointent vers ce qui existe, pas vers ce qu'on aimerait qui existe.
    const links = PROJECTS.flatMap((p) => p.links ?? []).map((l) => l.href)
    expect(links.every((href) => href.startsWith('https://github.com/'))).toBe(true)
    expect(links).toContain('https://github.com/t3hx/celestial-walker-nuxt')
  })
})

/**
 * Les médias d'une fiche (#126). Trois disciplines, dont deux ne se voient pas
 * en relisant la donnée :
 *
 *   - **l'ordre est celui de la pellicule** : la vidéo d'abord, les captures
 *     ensuite. Il est dit une seule fois, dans `projectMedia`, et le composant
 *     ne le redécide pas ;
 *   - **l'absence d'un média est le repli, jamais une erreur de chargement.**
 *     Aucun `onError` n'est câblé — donc un chemin déclaré doit exister, sinon
 *     le visiteur reçoit une icône cassée que rien ne rattrape ;
 *   - **les vidéos sont servies par le VPS** (décision de l'auteur, 2026-09-08),
 *     pas empaquetées par l'app : une vidéo par projet, c'est un ordre de
 *     grandeur au-dessus du `.glb`, et l'image Docker n'a pas à la porter.
 */
describe('les médias d’une fiche', () => {
  const bare: Project = {
    slug: 'demo',
    name: 'Démo',
    tabLabel: 'Démo',
    tagline: { fr: 'Une phrase.', en: 'One sentence.' },
    year: '2026',
    role: { fr: 'Développement', en: 'Development' },
    stack: ['TypeScript'],
    highlights: { fr: ['Un fait.'], en: ['One fact.'] },
  }
  const shot = (n: number) => ({
    src: `/media/demo-${n}.webp`,
    alt: { fr: `Vue ${n}`, en: `View ${n}` },
  })
  const video = {
    src: 'https://media.example.com/demo.mp4',
    poster: '/media/demo-poster.webp',
    alt: { fr: 'La démo en trente secondes.', en: 'The demo in thirty seconds.' },
  }

  it('ne montre rien quand il n’y a rien à montrer', () => {
    // Zéro média est un état normal : la scène retombe sur `cover`, puis sur le
    // placeholder. Rien ne charge, rien n'échoue, rien ne s'excuse.
    expect(projectMedia(bare)).toEqual([])
    expect(showsStrip(projectMedia(bare))).toBe(false)
  })

  it('range la vidéo en tête et les captures ensuite', () => {
    const media = projectMedia({ ...bare, video, shots: [shot(1), shot(2)] })
    expect(media.map((m) => m.kind)).toEqual(['video', 'shot', 'shot'])
    expect(media[0].src).toBe(video.src)
  })

  it('sait n’avoir que des captures, ou que la vidéo', () => {
    expect(projectMedia({ ...bare, shots: [shot(1), shot(2)] }).map((m) => m.kind)).toEqual([
      'shot',
      'shot',
    ])
    expect(projectMedia({ ...bare, video }).map((m) => m.kind)).toEqual(['video'])
  })

  it('n’ouvre la pellicule qu’à partir de deux médias', () => {
    // Une pellicule d'une vignette répète la scène en plus petit et donne à
    // cliquer sur ce qu'on regarde déjà.
    expect(showsStrip(projectMedia({ ...bare, video }))).toBe(false)
    expect(showsStrip(projectMedia({ ...bare, video, shots: [shot(1)] }))).toBe(true)
  })

  it('donne à la vignette d’une vidéo son affiche, à celle d’une capture l’image même', () => {
    const media = projectMedia({ ...bare, video, shots: [shot(1)] })
    expect(thumbSrc(media[0])).toBe(video.poster)
    expect(thumbSrc(media[1])).toBe(shot(1).src)
    // Sans affiche, la vignette n'a AUCUNE image : la vidéo ne se charge qu'au
    // geste, donc il n'existe pas encore une seule frame à en extraire.
    expect(
      thumbSrc(projectMedia({ ...bare, video: { ...video, poster: undefined } })[0]),
    ).toBeUndefined()
  })

  it('dit ce que chaque média montre, dans les deux langues', () => {
    // La légende sous la scène EST le nom accessible du média : une capture
    // muette, c'est une image dont personne ne peut dire ce qu'elle prouve.
    for (const p of PROJECTS) {
      for (const item of projectMedia(p)) {
        for (const locale of LOCALES) {
          expect(t(item.alt, locale), `${p.slug} · ${item.src} (${locale})`).not.toBe('')
        }
      }
    }
  })

  it('tient dans la pellicule', () => {
    // Au-delà de SHOTS_MAX, la rangée passe à la ligne dans le cadre de 1280 —
    // et une pellicule sur deux lignes n'est plus une pellicule.
    for (const p of PROJECTS) {
      if (p.shots === undefined) continue
      expect(p.shots.length, p.slug).toBeGreaterThan(0)
      expect(p.shots.length, p.slug).toBeLessThanOrEqual(SHOTS_MAX)
    }
  })

  it('ne sert un média que par le VPS ou depuis `public/`', () => {
    // Deux formes admises, et rien d'autre : une URL absolue en https (le VPS,
    // qui garde la main sur le fichier), ou un chemin absolu servi par l'app.
    // Du http en clair ferait tomber la page en contenu mixte, sans un mot.
    for (const p of PROJECTS) {
      for (const src of [p.cover, ...projectMedia(p).flatMap((m) => [m.src, m.poster])]) {
        if (src === undefined) continue
        expect(src.startsWith('https://') || src.startsWith('/'), `${p.slug} · ${src}`).toBe(true)
      }
    }
  })

  it('ne pointe aucun fichier local absent', () => {
    // L'absence d'un média est le repli ; un fichier manquant, lui, est une
    // icône cassée que rien ne rattrape — aucun `onError` n'est câblé nulle
    // part, c'est la donnée qui décide. Un chemin déclaré doit donc exister.
    for (const p of PROJECTS) {
      for (const src of [p.cover, ...projectMedia(p).flatMap((m) => [m.src, m.poster])]) {
        if (src === undefined || !src.startsWith('/')) continue
        expect(existsSync(`public${src}`), `${p.slug} · ${src}`).toBe(true)
      }
    }
  })
})
