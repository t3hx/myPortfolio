import { describe, expect, it } from 'vitest'
import { GLOW_WIDTHS, TRI_SIDES, applyTriangle } from '@/lib/neonTriangle'
import type { TriangleState } from '@/lib/introScene'

/**
 * Le triangle néon de l'intro (#144), écrit dans le SVG par `applyTriangle`.
 *
 * **Trouvé par la mesure de couverture** (#163) : ce module était à 0 %. Il
 * n'est pas pur — il écrit des attributs dans un `<g>` — mais il ne demande
 * rien d'autre à ses nœuds que `setAttribute`, `removeAttribute` et
 * `children`. Un faux nœud de trente lignes suffit donc, et ce qu'on vérifie
 * alors est la seule chose qui ne se relit pas : l'arithmétique. Une épaisseur
 * divisée par l'échelle, une opacité plafonnée, un côté éteint — à l'écran,
 * tout cela passe pour une décision d'animation.
 */

/** Un faux `<g>` : il retient ce qu'on lui écrit, et rien de plus. */
class FauxNoeud {
  attrs: Record<string, string> = {}
  children: FauxNoeud[] = []
  setAttribute(nom: string, valeur: string) {
    this.attrs[nom] = valeur
  }
  removeAttribute(nom: string) {
    delete this.attrs[nom]
  }
}

/** Le `<g>` que `NeonTriangle` rend : le remplissage, puis trois côtés de
 *  quatre traits. */
function groupe(): FauxNoeud {
  const g = new FauxNoeud()
  g.children.push(new FauxNoeud())
  for (let i = 0; i < TRI_SIDES.length; i++) {
    const côté = new FauxNoeud()
    for (let j = 0; j < GLOW_WIDTHS.length; j++) côté.children.push(new FauxNoeud())
    g.children.push(côté)
  }
  return g
}

const état = (patch: Partial<TriangleState> = {}): TriangleState => ({
  x: 100,
  y: 50,
  size: 19,
  rot: 0,
  glow: 1,
  opacity: 1,
  lit: [0, 1, 2],
  weight: 1,
  ...patch,
})

// `applyTriangle` attend un SVGGElement ; le faux nœud en implémente la part
// utilisée, et c'est tout ce que la fonction touche.
const appliquer = (g: FauxNoeud, t: TriangleState) => applyTriangle(g as unknown as SVGGElement, t)

describe('applyTriangle', () => {
  it('efface le triangle plutôt que de peindre un rien', () => {
    // Sous ces seuils il n'y a plus rien à voir, mais il y aurait encore
    // quelque chose à composer : un `display: none` coûte moins qu'un tracé
    // transparent que le navigateur rastérise quand même.
    for (const t of [état({ opacity: 0.004 }), état({ size: 0.2 })]) {
      const g = groupe()
      appliquer(g, t)
      expect(g.attrs.display).toBe('none')
    }
  })

  it('rend le triangle dès qu’il y a quelque chose à voir', () => {
    const g = groupe()
    appliquer(g, état({ opacity: 0.005, size: 0.21 }))
    expect(g.attrs.display).toBeUndefined()
  })

  it('compose sa transformation autour de son propre centre', () => {
    // Le dernier `translate` ramène le centre du dessin sur l'origine : sans
    // lui, une rotation ferait décrire un arc au triangle au lieu de le faire
    // tourner sur place.
    const g = groupe()
    appliquer(g, état({ x: 12, y: 34, rot: 90, size: 38 }))
    expect(g.attrs.transform).toBe('translate(12 34) rotate(90) scale(2) translate(-16 -13.33)')
    expect(g.attrs.opacity).toBe('1')
  })

  it('divise les épaisseurs par l’échelle, pour qu’elles ne grossissent pas avec lui', () => {
    // C'est le point que rien ne rattrape à l'œil : un trait néon qui grossit
    // avec le triangle devient un pâté quand il arrive en gros plan.
    const g = groupe()
    appliquer(g, état({ size: 38 })) // échelle 2
    expect(g.children[0].attrs['stroke-width']).toBe('1.1')
    const côté = g.children[1]
    expect(côté.children.map((p) => p.attrs['stroke-width'])).toEqual(
      GLOW_WIDTHS.map((w) => String(w / 2)),
    )
  })

  it('pèse les traits par `weight`, et plafonne leur opacité', () => {
    // Le plafond est ce qui empêche un `glow` fort de tout blanchir : au-delà,
    // les quatre traits se rejoignent et le dégradé de halo disparaît.
    const g = groupe()
    appliquer(g, état({ glow: 100, weight: 3 }))
    const côté = g.children[1]
    expect(côté.children[0].attrs['stroke-width']).toBe(String(GLOW_WIDTHS[0] * 3))
    expect(côté.children.map((p) => p.attrs['stroke-opacity'])).toEqual(['0.18', '0.4', '0.7', '1'])
  })

  it('éteint les côtés absents de `lit`, et rallume les autres', () => {
    const g = groupe()
    appliquer(g, état({ lit: [1] }))
    expect(g.children[1].attrs.display).toBe('none')
    expect(g.children[2].attrs.display).toBeUndefined()
    expect(g.children[3].attrs.display).toBe('none')
    // Un côté éteint n'est pas peint : ses traits gardent ce qu'ils avaient.
    expect(g.children[1].children[0].attrs['stroke-width']).toBeUndefined()
  })
})
