import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { CV_COLUMN_FRACTION, CV_COLUMN_PX } from '@/lib/stops'

/**
 * #194 — le CV est invariant d'échelle : sur l'écran de n'importe quel
 * utilisateur, le moniteur modélisé occupe la même part de la fenêtre (le
 * cadrage caméra n'a pas bougé) et le contenu du CV occupe la même part du
 * moniteur. La capture d'un visiteur en 2560 ressemble trait pour trait à
 * celle d'un visiteur en 1280.
 *
 * Le mécanisme est l'unité `--cv-u`, « un pixel du design du CV, redimensionné »
 * — le précédent de la bulle (#137). Elle vaut `100vw / 1280` avec un plancher
 * à 1 px : sous la largeur du cadre du design, rien ne change, et c'est
 * `columnHfov` qui garantit déjà la colonne côté caméra.
 *
 * Trois choses sont verrouillées ici :
 *   1. la formule de l'unité redit le cadre du design que `CV_COLUMN_FRACTION`
 *      et `CV_COLUMN_PX` décrivent déjà — deux moteurs, une seule vérité ;
 *   2. l'anatomie du CV dans `tokens.css` ne contient plus un seul pixel nu :
 *      un `14px` réintroduit resterait figé pendant que tout grandit autour,
 *      et c'est exactement le défaut (« étiré ») que #194 corrige ;
 *   3. chaque usage de l'unité garde son repli `1px` : les maquettes de
 *      `design/screens/` chargent `tokens.css` sans `styles.css`, et sans
 *      repli elles perdraient les tailles que la session design a validées.
 */

const styles = readFileSync('src/styles/styles.css', 'utf8')
const tokens = readFileSync('src/styles/tokens.css', 'utf8')

/** L'anatomie du CV : de la boîte jusqu'aux keyframes d'entrée, exclues. */
function cvAnatomy(): string {
  const start = tokens.indexOf('\n.cv {')
  const end = tokens.indexOf('@keyframes cv-in')
  expect(start, "section d'anatomie `.cv` introuvable dans tokens.css").toBeGreaterThan(-1)
  expect(end, 'borne `@keyframes cv-in` introuvable dans tokens.css').toBeGreaterThan(start)
  return tokens.slice(start, end)
}

describe("l'unité --cv-u (#194)", () => {
  it('est déclarée dans styles.css, plancher 1 px, et redit le cadre du design', () => {
    const rule = styles.match(/--cv-u:\s*max\(1px,\s*calc\(100vw\s*\/\s*(\d+)\)\)/)
    expect(
      rule,
      '--cv-u introuvable dans styles.css (forme max(1px, calc(100vw / N)))',
    ).not.toBeNull()
    const frame = Number(rule![1])
    // Le cadre de l'unité et la paire fraction/pixels de `lib/stops.ts`
    // décrivent le même design : 573 px dans un cadre de 1280 = 44,8 %.
    expect(Math.round((CV_COLUMN_PX / frame) * 1000) / 1000).toBe(CV_COLUMN_FRACTION)
  })

  it("n'existe pas dans tokens.css : les maquettes doivent retomber sur le repli", () => {
    expect(tokens).not.toContain('--cv-u:')
  })
})

describe("l'anatomie du CV est écrite en unités (#194)", () => {
  it('ne contient plus un seul pixel nu', () => {
    const anatomy = cvAnatomy()
      // Les commentaires citent des mesures en px, et c'est leur rôle.
      .replace(/\/\*[\s\S]*?\*\//g, '')
      // Les replis `var(--x, Npx)` sont la valeur des maquettes, pas un oubli.
      .replace(/var\(--[\w-]+,\s*[\d.]+px\)/g, 'var()')
      // Le repli téléphone (< 720 px) appartient au chantier responsive (#187).
      .replace(/@media \(max-width: 720px\) \{[\s\S]*?\n\}/, '')
      // La colonne, elle, est volontairement en px : `tests/stops.test.ts` la
      // verrouille contre le cadrage 3D, elle est l'accord entre les moteurs.
      .replace(/--cv-column:[^;]*;/, '')
    expect(anatomy).not.toMatch(/[\d.]+px/)
  })

  it("chaque usage de l'unité garde le repli des maquettes", () => {
    expect(cvAnatomy()).not.toMatch(/var\(--cv-u\)/)
  })

  it("l'entretoise aligne le CV en haut, à l'air latéral près", () => {
    // Décision du 2026-10-21 (#194) : le contenu s'aligne en haut de l'écran,
    // et l'air au-dessus du nom vaut l'air latéral entre la colonne et le
    // bezel du moniteur — (50,99 % − 44,8 %) / 2 du cadre, soit 39,6u, dont
    // 24u sont déjà portés par le `padding-block` de `.cv`.
    const before = tokens.slice(
      tokens.indexOf('.cv::before {'),
      tokens.indexOf('}', tokens.indexOf('.cv::before {')),
    )
    expect(before).toContain('height: calc(16 * var(--cv-u, 1px))')
    expect(before).not.toContain('vh')
  })

  it('le rail remplace la barre native, posé dans l’air latéral (#194)', () => {
    // Gecko ne style une barre native qu'en largeur et couleur — ni rayon, ni
    // décalage. La barre est donc masquée et le rail est un élément, pur
    // indicateur : la molette garde le passe-plat de `CvScreen`.
    const cv = tokens.slice(tokens.indexOf('\n.cv {'), tokens.indexOf('.cv::before'))
    expect(cv).toContain('scrollbar-width: none')
    const rail = tokens.slice(tokens.indexOf('.cv-rail {'), tokens.indexOf('.cv-rail__thumb'))
    expect(rail).toContain('left: calc(50% + var(--cv-column) / 2 + 26 * var(--cv-u, 1px))')
    expect(rail).toContain('pointer-events: none')
  })

  it('les marques des vignettes suivent l’unité sans toucher la barre de menu', () => {
    const mark = tokens.slice(
      tokens.indexOf('.cv__tile-mark {'),
      tokens.indexOf('}', tokens.indexOf('.cv__tile-mark {')),
    )
    expect(mark).toContain('--mark-size: calc(16 * var(--cv-u, 1px))')
    expect(mark).toContain('--mark-slab: calc(13 * var(--cv-u, 1px))')
    // La barre, elle, garde ses 16 px : sa taille ne suit pas la fenêtre.
    expect(tokens).toMatch(/\.menu__social[^}]*--mark-size: 16px/)
  })
})
