import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { INTRO_FRAME, INTRO_SAFE_INSET_PX, INTRO_SCREEN_MARGIN } from '@/config/intro'
import { screenLayout, type LayoutInput } from '@/lib/introLayout'
import { poseVerticalFov, emptyPose } from '@/lib/stops'

/**
 * La pose de l'intro sur l'écran principal (#142) : contenue dans ce que le
 * visiteur voit à Home, hors barre de menu, avec une marge, centrée sur
 * l'écran — jamais rognée, jamais étirée (décisions du 2026-09-05). Le calcul
 * est pur pour être vérifié ici ; le composant ne fait que le poser.
 *
 * Les nombres sont ceux de l'export v13 : l'écran principal fait
 * 0,5816 × 0,3216 m, la caméra Home est à 0,557 m de face, hfov 53,13°,
 * yfov 31,42°, `fit: contain`.
 */
const SCREEN = { width: 0.5816, height: 0.3216 }
const DEPTH = 0.557
const HOME = { ...emptyPose(), hfov: 53.13, yfov: 31.42, contain: 1 }

/** Ce que Home montre de l'écran pour une fenêtre donnée, comme le composant. */
function inputFor(viewport: { width: number; height: number }): LayoutInput {
  const aspect = viewport.width / viewport.height
  const height = 2 * DEPTH * Math.tan((poseVerticalFov(HOME, aspect) * Math.PI) / 360)
  return {
    screen: SCREEN,
    frame: INTRO_FRAME,
    viewport,
    visible: { width: height * aspect, height },
    insetPx: INTRO_SAFE_INSET_PX,
    margin: INTRO_SCREEN_MARGIN,
  }
}

/** Le cadre projeté dans la fenêtre à Home, en px, centré sur l'écran. */
function frameInViewport(viewport: { width: number; height: number }) {
  const input = inputFor(viewport)
  const l = screenLayout(input)
  const pxPerMeter = viewport.width / input.visible.width
  const w = l.frameMeters.width * pxPerMeter
  const h = l.frameMeters.height * pxPerMeter
  return {
    left: viewport.width / 2 - w / 2,
    right: viewport.width / 2 + w / 2,
    top: viewport.height / 2 - h / 2,
    bottom: viewport.height / 2 + h / 2,
    width: w,
    height: h,
  }
}

describe('screenLayout', () => {
  const windows = [
    { width: 1920, height: 1080 },
    { width: 1280, height: 720 },
    { width: 2560, height: 1440 },
    { width: 1440, height: 900 }, // 16:10 — Home rogne les côtés
    { width: 2560, height: 1080 }, // 21:9 — Home rogne le haut et le bas
  ]

  it.each(windows)('stays clear of the menu bar and inside the window at $width×$height', (vp) => {
    const f = frameInViewport(vp)
    const marginPx = vp.height * INTRO_SCREEN_MARGIN
    expect(f.right).toBeLessThanOrEqual(vp.width - INTRO_SAFE_INSET_PX - marginPx + 1e-6)
    expect(f.left).toBeGreaterThanOrEqual(INTRO_SAFE_INSET_PX + marginPx - 1e-6)
    expect(f.top).toBeGreaterThanOrEqual(marginPx - 1e-6)
    expect(f.bottom).toBeLessThanOrEqual(vp.height - marginPx + 1e-6)
  })

  it.each(windows)('keeps 16:9 and touches one bound at $width×$height', (vp) => {
    const f = frameInViewport(vp)
    const marginPx = vp.height * INTRO_SCREEN_MARGIN
    expect(f.width / f.height).toBeCloseTo(16 / 9, 5)
    const safeW = vp.width - 2 * (INTRO_SAFE_INSET_PX + marginPx)
    const safeH = vp.height - 2 * marginPx
    // Contenu, donc aussi grand que possible : une des deux bornes est atteinte.
    expect(Math.min(safeW - f.width, safeH - f.height)).toBeCloseTo(0, 6)
  })

  it('never scales the design pixels: the frame is 1920×1080 on the screen', () => {
    const l = screenLayout(inputFor({ width: 1920, height: 1080 }))
    expect(l.frame).toEqual({ width: 1920, height: 1080 })
    // L'écran est plus grand que le cadre, et garde ses proportions.
    expect(l.screen.width).toBeGreaterThan(l.frame.width)
    expect(l.screen.width / l.screen.height).toBeCloseTo(SCREEN.width / SCREEN.height, 5)
  })

  it('maps the screen box to its size in metres through distanceFactor', () => {
    // drei, mode transform : un élément de P px mesure P × distanceFactor / 400
    // unités monde. La boîte doit donc mesurer exactement l'écran.
    const l = screenLayout(inputFor({ width: 1920, height: 1080 }))
    expect((l.screen.width * l.distanceFactor) / 400).toBeCloseTo(SCREEN.width, 6)
    expect((l.screen.height * l.distanceFactor) / 400).toBeCloseTo(SCREEN.height, 6)
  })

  it('shrinks the frame on a 16:10 window, where Home crops the screen sides', () => {
    const wide = screenLayout(inputFor({ width: 1920, height: 1080 }))
    const tall = screenLayout(inputFor({ width: 1920, height: 1200 }))
    expect(tall.frameMeters.width).toBeLessThan(wide.frameMeters.width)
  })

  it('refuses a margin that eats the frame', () => {
    expect(() =>
      screenLayout({ ...inputFor({ width: 1920, height: 1080 }), margin: 0.5 }),
    ).toThrow()
    expect(() =>
      screenLayout({ ...inputFor({ width: 1920, height: 1080 }), margin: -0.1 }),
    ).toThrow()
  })
})

describe('the intro layer in the stacking order', () => {
  const tokens = readFileSync('src/styles/tokens.css', 'utf8')
  const styles = readFileSync('src/styles/styles.css', 'utf8')

  it('sits between the canvas and the bubbles', () => {
    const z = (name: string) => Number(tokens.match(new RegExp(`--z-${name}:\\s*(\\d+)`))![1])
    expect(z('intro')).toBeGreaterThan(z('canvas'))
    expect(z('intro')).toBeLessThan(z('bubble'))
  })

  it('is a layer nobody can click through to', () => {
    const rule = styles.match(/\.intro-layer\s*{([^}]*)}/)
    expect(rule).not.toBeNull()
    expect(rule![1]).toMatch(/z-index:\s*var\(--z-intro\)/)
    expect(rule![1]).toMatch(/pointer-events:\s*none/)
  })

  it('reserves exactly what the menu bar takes on the right edge', () => {
    // La barre : `.menu { right: 12px; ... width: 52px }` dans tokens.css.
    const menu = tokens.match(/\n\.menu\s*{([^}]*)}/)![1]
    const right = Number(menu.match(/right:\s*(\d+)px/)![1])
    const width = Number(menu.match(/width:\s*(\d+)px/)![1])
    expect(INTRO_SAFE_INSET_PX).toBe(right + width)
  })
})
