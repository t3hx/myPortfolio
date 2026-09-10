import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { BUBBLES, bubblePages } from '@/content/bubbles'
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

const tokens = readFileSync('src/styles/tokens.css', 'utf8')

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
      // Le repli remplace le dialogue ENTIER et n'a qu'un temps : ce n'est
      // pas une page de plus, c'est une autre chose à dire.
      expect(bubblePages(cabinet, 0, locale), locale).toEqual([t(PROJECTS_EMPTY, locale)])
    }
  })

  it('laisse la narration intacte dès qu’il y a un projet', () => {
    expect(bubblePages(cabinet, 1, 'fr')).toEqual([cabinet.text[0].fr])
    expect(bubblePages(cabinet, PROJECTS.length, 'fr')).toEqual([cabinet.text[0].fr])
  })

  it('ne touche à aucun autre arrêt, même à zéro projet', () => {
    for (const bubble of BUBBLES) {
      if (bubble.stop === 'Cabinet') continue
      for (const locale of LOCALES) {
        expect(bubblePages(bubble, 0, locale), bubble.stop).toEqual(
          bubble.text.map((p) => t(p, locale)),
        )
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

/**
 * La vidéo ne part JAMAIS toute seule (#126).
 *
 * Rien à l'écran ne dirait qu'elle vient de le faire : la boucle de comparaison
 * de rendus lit le tampon WebGL, jamais la page, donc aucune capture n'en
 * porterait la trace. Ce qui la retient tient en trois attributs — pas
 * d'`autoPlay`, pas de lecture en boucle, et `preload="none"` — et une relecture
 * distraite pourrait en ajouter un quatrième sans que personne s'en aperçoive.
 *
 * `preload="none"` n'est pas qu'une politesse envers le réseau : c'est ce qui
 * garantit qu'AUCUN octet de vidéo ne part avant un clic. Sur cinq fiches, la
 * simple ouverture de la commode déclencherait sinon des mégaoctets que
 * personne n'a demandés.
 */
const sheet = readFileSync('src/ui/ProjectSheet.tsx', 'utf8')

describe('la vidéo de la fiche', () => {
  it('ne se lance pas sans geste', () => {
    expect(sheet).not.toMatch(/autoPlay/)
  })

  it('ne tourne pas en boucle', () => {
    // Une boucle est le mouvement autonome par excellence — le critère du
    // système, écrit dans le bloc `prefers-reduced-motion` de tokens.css, est
    // l'autonomie et non le déplacement.
    expect(sheet).not.toMatch(/\bloop\b/)
  })

  it('ne télécharge rien avant qu’on la demande', () => {
    expect(sheet).toContain('preload="none"')
  })

  it('laisse Échap sortir de la fiche', () => {
    // `CameraRig` écoute `keydown` sur `window` et ne filtre que `.menu, .hud` :
    // la fiche n'a donc rien à câbler, mais elle n'a pas le droit d'avaler la
    // touche non plus. Un `onKeyDown` posé ici serait le seul moyen de le faire.
    expect(sheet).not.toMatch(/onKeyDown/)
  })
})

describe('l’anatomie des médias', () => {
  it('vit dans le design system, pas dans le composant', () => {
    for (const cls of [
      '.sheet__media',
      '.sheet__stage',
      '.sheet__player',
      '.sheet__caption',
      '.sheet__strip',
      '.sheet__thumb',
    ]) {
      expect(tokens, `${cls} absent de tokens.css`).toContain(cls)
    }
  })

  it('garde le repli hachuré quand il n’y a aucun média', () => {
    // Même règle que les icônes du CV : la donnée décide, aucun `onError`.
    expect(tokens).toContain('.sheet__cover')
    // L'attribut, pas le mot : le composant a le droit d'EXPLIQUER qu'il n'en
    // câble aucun, et c'est même la seule trace lisible de la décision.
    expect(sheet).not.toMatch(/onError=/)
  })
})

describe('la maquette de la fiche', () => {
  const mockup = readFileSync('design/screens/03b-project.html', 'utf8')

  it('montre une vidéo et plusieurs captures', () => {
    expect(mockup).toContain('<video')
    expect(mockup).toContain('sheet__strip')
    expect((mockup.match(/sheet__thumb"/g) ?? []).length).toBeGreaterThanOrEqual(3)
  })

  it('ne fait rien démarrer toute seule non plus', () => {
    expect(mockup).not.toMatch(/autoplay|\bloop\b/i)
    expect(mockup).toContain('preload="none"')
  })

  it('garde tout ce que la fiche disait déjà', () => {
    // Le réagencement ne perd rien : chaque bloc de l'ancienne fiche est
    // toujours là, à une place différente.
    for (const cls of [
      'sheet__kicker',
      'sheet__title',
      'sheet__tagline',
      'sheet__meta',
      'sheet__stack',
      'sheet__points',
      'sheet__links',
      'sheet__key',
      'sheet__close-btn',
    ]) {
      expect(mockup, `${cls} perdu dans le réagencement`).toContain(cls)
    }
  })
})
