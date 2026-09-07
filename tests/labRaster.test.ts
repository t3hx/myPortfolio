import { describe, expect, it } from 'vitest'
import { INTRO_FRAME } from '@/config/intro'
import { loadLabPlan } from '@/content/labPlan'
import { labPlanSvg, rasterDensity } from '@/lib/labRaster'

/**
 * Le plan aplati en image (#145). Le document SVG est la seule moitié du
 * travail qui puisse se tromper en silence : chargé dans une `Image`, il est
 * isolé de la page, donc tout ce que `.intro-lab` déclare en CSS doit y être
 * redit en attributs — sinon le plan se rastérise sans encre et le recul,
 * lui, devient parfaitement fluide.
 */
describe('labPlanSvg', () => {
  it('carries every stroke of the plan, each with its width', async () => {
    const plan = await loadLabPlan()
    const svg = labPlanSvg(plan, '#00C0E8')
    expect(svg.match(/<path /g)).toHaveLength(2346)
    for (const batch of plan.order)
      for (const [d, width] of plan.batches[batch])
        expect(svg).toContain(`<path d="${d}" stroke-width="${width}"/>`)
  })

  it('redeclares the ink the stylesheet cannot reach', async () => {
    const svg = labPlanSvg(await loadLabPlan(), '#00C0E8')
    expect(svg).toContain('fill="none"')
    expect(svg).toContain('stroke="#00C0E8"')
    expect(svg).toContain('stroke-linecap="round"')
    // Le pointillé n'est PAS repris : le dessin est fini, et le reprendre
    // rendrait une image entièrement vide.
    expect(svg).not.toContain('dasharray')
    expect(svg).not.toContain('dashoffset')
  })

  it('frames the plan exactly as the component does', async () => {
    const svg = labPlanSvg(await loadLabPlan(), '#00C0E8')
    expect(svg).toContain(`viewBox="0 0 ${INTRO_FRAME.width} ${INTRO_FRAME.height}"`)
    // Le plan est cadré 1920 × 1050, l'intro en 1920 × 1080 : sans ce décalage
    // l'image se poserait 15 px trop haut sur un dessin déjà vu en place.
    expect(svg).toContain('transform="translate(0 15)"')
  })
})

describe('rasterDensity', () => {
  it('follows the screen, and stops at 2', () => {
    expect(rasterDensity(1)).toBe(1)
    expect(rasterDensity(2)).toBe(2)
    expect(rasterDensity(3)).toBe(2)
  })

  it('never rasterises below the design frame', () => {
    // Un navigateur qui ne déclare rien, ou un écran annoncé en dessous de 1 :
    // rastériser plus petit que le cadre rendrait le plan plus mou qu'avant.
    expect(rasterDensity(0)).toBe(1)
    expect(rasterDensity(0.5)).toBe(1)
    expect(rasterDensity(NaN)).toBe(1)
  })
})
