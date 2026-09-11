import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { CAMERA_STOPS } from '@/config/cameraStops'
import { MARKS } from '@/config/icons'
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

const tokens = readFileSync('src/styles/tokens.css', 'utf8')
const menu = readFileSync('src/ui/Menu.tsx', 'utf8')

describe('menu socials', () => {
  it('never ships a link that goes nowhere', () => {
    // Une entrée sans href est filtrée à l'affichage ; celles qui en ont une
    // doivent être absolues (elles ouvrent un autre site).
    for (const social of MENU_SOCIALS.filter((s) => s.href)) {
      expect(social.href, social.title).toMatch(/^https:\/\//)
    }
  })

  it('porte une marque déclarée, et garde ses deux lettres en repli', () => {
    // La marque est un chemin de `MARKS` (#170) : c'est `tests/icons.test.ts`
    // qui garantit que le fichier existe, parce qu'un masque absent n'affiche
    // rien du tout et n'émet aucune erreur. Le `label` reste, et ce n'est pas
    // redondant : c'est ce qui s'affiche si une marque vient à manquer.
    const marques = new Set<string>(Object.values(MARKS))
    for (const social of MENU_SOCIALS) {
      expect(social.label.trim(), social.title).not.toBe('')
      if (social.icon === undefined) continue
      expect(marques.has(social.icon), `${social.title} : ${social.icon}`).toBe(true)
    }
  })

  it('dit son nom en TEXTE, même quand la marque est un masque', () => {
    // Un masque CSS n'a pas de contenu : sans nom accessible, le lien s'annonce
    // par son URL. `title` seul ne suffit pas — les technologies d'assistance
    // ne le lisent pas de façon fiable, et il n'apparaît qu'au survol souris.
    expect(menu).toContain('aria-label={social.title}')
  })

  it('laisse la marque prendre la couleur de la barre', () => {
    // C'est tout l'intérêt du masque : la marque hérite du repos à 72 % et du
    // survol sans qu'on lui donne une couleur. Une `<img>` aurait imposé la
    // sienne — et pour ces fichiers-là, du noir.
    const règle = tokens.slice(
      tokens.indexOf('.menu__social {'),
      tokens.indexOf('.menu__social:hover'),
    )
    expect(règle, '.menu__social doit dimensionner la marque').toMatch(/--mark-size:/)
    expect(règle).toMatch(/color:/)
  })
})

describe('la bascule de langue', () => {
  // Les COMMENTAIRES sont retirés : celui de cette règle explique justement
  // pourquoi `color` n'y est pas, et le mot y apparaît donc forcément.
  const reset = tokens
    .slice(
      tokens.indexOf('.menu__lang button {'),
      tokens.indexOf('}', tokens.indexOf('.menu__lang button {')),
    )
    .replace(/\/\*[\s\S]*?\*\//g, '')

  it('dit quelle langue est active par la COULEUR du drapeau', () => {
    // **Le signal a changé de nature avec #164** : les deux lettres se
    // distinguaient par leur teinte, accent contre crème. Les drapeaux se
    // distinguent par la saturation — celui de la langue active garde ses
    // couleurs, l'autre passe en gris. C'est le même rôle, joué autrement, et
    // il reste le seul indicateur de « dans quelle langue suis-je ».
    expect(tokens).toMatch(/\.menu__lang-off[^{]*\{[^}]*grayscale\(1\)/)
    // Le drapeau vient de `FLAGS`, donc d'un fichier dont `tests/icons.test.ts`
    // garantit l'existence : une image absente ne dit rien, elle ne s'affiche
    // simplement pas.
    expect(menu).toContain('FLAGS[code]')
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

  it('nomme la langue en TEXTE, et jamais un pays', () => {
    // Un drapeau n'est pas une langue — l'anglais n'en a pas, et le fichier en
    // choisit un. Le nom accessible dit donc la langue, et il doit exister :
    // une image décorative dans un bouton laisse un bouton sans nom, que les
    // technologies d'assistance annoncent « bouton ». `title` ne suffit pas,
    // il n'est ni lu de façon fiable ni visible hors survol souris.
    expect(menu).toContain('aria-label={t(UI.menu.switchTo, code)}')
    expect(menu).toContain('alt=""')
  })
})

/**
 * LE ROUTAGE DES SURFACES. Chaque surface posée sur la scène garde ce qu'elle
 * a de propre : le panneau garde sa molette, la barre de menu ses flèches, et
 * le HUD `?debug` les deux — sa liste d'arrêts navigue aux flèches, et ses
 * boutons sont dans `.stage`, donc un clic dessus faisait AUSSI parler l'arrêt.
 *
 * Mesuré avant la correction : ouvrir la fiche projet depuis Bookshelf laissait
 * la caméra sur Cat, parce que le dialogue de Bookshelf était épuisé et qu'un
 * geste de plus, sur la dernière phrase, veut dire « arrêt suivant ».
 *
 * Ces exclusions sont des sélecteurs dans un écouteur : rien d'autre qu'une
 * lecture du source ne peut dire qu'elles sont là, et leur oubli ne casse rien
 * — il déplace la caméra.
 */
describe('input routing between the scene and the surfaces on top of it', () => {
  const rig = readFileSync('src/scene/CameraRig.tsx', 'utf8')

  it('leaves a click on a panel, on the menu bar or on the HUD to that surface', () => {
    expect(rig).toContain("closest('.panel, .menu, .hud')")
  })

  it('leaves the arrows to the menu bar and to the HUD, which both navigate', () => {
    expect(rig).toContain("closest('.menu, .hud')")
  })

  it('never lets a panel wheel reach the tour', () => {
    expect(rig).toContain("closest('.panel')")
  })
})
