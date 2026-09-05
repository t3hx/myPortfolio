import type { TriangleState } from '@/lib/introScene'

/**
 * La géométrie et l'animation du triangle néon (#144), hors composant :
 * `scene/intro/NeonTriangle.tsx` ne doit exporter que le composant, sinon Fast
 * Refresh décroche (et `--max-warnings 0` en fait une erreur). Dans `lib/` et
 * pas à côté : deux fichiers qui ne diffèrent que par la casse cassent le
 * type-check sur un disque insensible à la casse.
 */
export const TRI_D = 'M6 7H26L16 26Z'
export const TRI_SIDES = ['M6 7H26', 'M26 7L16 26', 'M16 26L6 7'] as const

/** Les quatre traits superposés d'un côté néon, du plus large au plus fin. */
export const GLOW_WIDTHS = [16, 9, 4.2, 1.8] as const
const GLOW_CAPS = [0.18, 0.4, 0.7, 1] as const
const GLOW_BASE = [0.07, 0.14, 0.32, 0.85] as const

/** Écrit un état de triangle dans le `<g>` rendu par `NeonTriangle`. */
export function applyTriangle(g: SVGGElement, t: TriangleState): void {
  if (t.opacity <= 0.004 || t.size <= 0.2) {
    g.setAttribute('display', 'none')
    return
  }
  g.removeAttribute('display')
  const s = t.size / 19
  g.setAttribute('opacity', String(t.opacity))
  g.setAttribute(
    'transform',
    `translate(${t.x} ${t.y}) rotate(${t.rot}) scale(${s}) translate(-16 -13.33)`,
  )
  const children = g.children
  ;(children[0] as SVGPathElement).setAttribute('stroke-width', String((2.2 * t.weight) / s))
  for (let side = 0; side < 3; side++) {
    const group = children[side + 1] as SVGGElement
    if (!t.lit.includes(side)) {
      group.setAttribute('display', 'none')
      continue
    }
    group.removeAttribute('display')
    for (let i = 0; i < GLOW_WIDTHS.length; i++) {
      const path = group.children[i] as SVGPathElement
      path.setAttribute('stroke-width', String((GLOW_WIDTHS[i] * t.weight) / s))
      path.setAttribute('stroke-opacity', String(Math.min(GLOW_CAPS[i], GLOW_BASE[i] * t.glow)))
    }
  }
}
