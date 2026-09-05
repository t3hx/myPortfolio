import { useEffect, useRef, type CSSProperties } from 'react'
import { INTRO_CORE, INTRO_CREAM, INTRO_FRAME, INTRO_PARTICLES } from '@/config/intro'
import { introTime } from '@/lib/intro'
import {
  CX,
  CY,
  PHASE_WORDS,
  cameraA,
  flashOpacity,
  makeParticles,
  makeStars,
  novaActive,
  novaOpacity,
  novaPoint,
  phaseWordAlpha,
  rings,
  starAlpha,
  triangle1,
  worldA,
  type Particle,
  type PhaseWordSpec,
  type StarGroup,
} from '@/lib/introScene'
import { useInteraction } from '@/state/interaction'
import { NeonTriangle } from '@/scene/intro/NeonTriangle'
import { applyTriangle } from '@/lib/neonTriangle'

/**
 * La scène de l'intro, dans le cadre 1920 × 1080 posé sur l'écran (#144).
 *
 * Trois techniques, chacune pour ce qu'elle fait le mieux (décision du
 * 2026-09-05) : un `<canvas>` 2D pour ce qui est nombreux et raster — étoiles,
 * particules, ondes, cœur —, du SVG pour ce qui est vectoriel et tracé — les
 * triangles néon, plus tard le plan —, du HTML pour le texte. Le prototype
 * réécrivait 900 particules en attribut `d` à chaque image ; ici c'est 900
 * `arc()` sans toucher au DOM.
 *
 * **Tout est fonction pure de T** (`lib/introScene.ts`) et **rien ne passe
 * par React à chaque image** : la boucle lit T dans le store, écrit le canvas,
 * quelques attributs SVG et quelques styles, et s'arrête d'elle-même sur la
 * dernière image. La caméra A est un `setTransform` sur le canvas et un
 * `transform` sur un `<g>` — vectoriels tous les deux, jamais un transform CSS
 * sur un calque, que le navigateur re-rastériserait à chaque image du zoom.
 */
interface IntroStageProps {
  accent: string
  /** La boîte de l'écran, en px de design, centrée sur le cadre 1920 × 1080. */
  screen: { width: number; height: number }
}

const WORD_STYLE = {
  genesis: { left: 150, top: 168, textAlign: 'left' } as const,
} satisfies Record<string, CSSProperties>

function PhaseWord({
  word,
  style,
  refs,
}: {
  word: string
  style: CSSProperties
  refs: { root: React.RefObject<HTMLDivElement | null>; letters: (HTMLSpanElement | null)[] }
}) {
  return (
    <div ref={refs.root} className="intro-word" style={style}>
      {word.split('').map((ch, i) => (
        <span
          key={i}
          ref={(el) => {
            refs.letters[i] = el
          }}
        >
          {ch}
        </span>
      ))}
    </div>
  )
}

export function IntroStage({ accent, screen }: IntroStageProps) {
  // Le cadre est centré dans l'écran : les calques débordent d'autant de chaque
  // côté, pour que les étoiles couvrent le moniteur entier et non un rectangle.
  const ox = (screen.width - INTRO_FRAME.width) / 2
  const oy = (screen.height - INTRO_FRAME.height) / 2
  const cover: CSSProperties = { left: -ox, top: -oy, width: screen.width, height: screen.height }

  const root = useRef<HTMLDivElement>(null)
  const world = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const camera = useRef<SVGGElement>(null)
  const tri1 = useRef<SVGGElement>(null)
  const flash = useRef<HTMLDivElement>(null)
  const genesis = useRef<{
    root: React.RefObject<HTMLDivElement | null>
    letters: (HTMLSpanElement | null)[]
  }>({ root: { current: null }, letters: [] })

  useEffect(() => {
    const rootEl = root.current
    const canvasEl = canvas.current
    const ctx = canvasEl?.getContext('2d')
    if (!rootEl || !canvasEl || !ctx) return

    const stars = makeStars()
    const parts = makeParticles(INTRO_PARTICLES)

    // La densité du canvas suit ce que le cadre mesure VRAIMENT à l'écran
    // (posé en 3D, il n'est jamais à 1:1), bornée à 2 : au-delà, la mémoire
    // monte plus vite que la netteté.
    let density = 1
    const resize = () => {
      const rect = rootEl.getBoundingClientRect()
      density = Math.min(2, (window.devicePixelRatio || 1) * (rect.width / INTRO_FRAME.width))
      if (density <= 0 || !Number.isFinite(density)) density = 1
      canvasEl.width = Math.round(screen.width * density)
      canvasEl.height = Math.round(screen.height * density)
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(rootEl)

    const drawWorld = (T: number) => {
      const cam = cameraA(T)
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, canvasEl.width, canvasEl.height)
      const s = density * cam.scale
      // Le repère du cadre, décalé de (ox, oy) dans le canvas de l'écran.
      ctx.setTransform(
        s,
        0,
        0,
        s,
        density * (ox + CX - cam.fx * cam.scale),
        density * (oy + CY - cam.fy * cam.scale),
      )
      drawStars(ctx, stars, T)
      drawBang(ctx, T, accent)
      const t = triangle1(T)
      if (t.coreOp > 0) {
        ctx.globalAlpha = t.coreOp * 0.18
        ctx.fillStyle = accent
        disc(ctx, CX, CY, t.coreR * 2.6)
        ctx.globalAlpha = t.coreOp
        ctx.fillStyle = INTRO_CORE
        disc(ctx, CX, CY, t.coreR)
      }
      if (novaActive(T)) drawNova(ctx, parts, T, accent)
      ctx.globalAlpha = 1
      camera.current?.setAttribute(
        'transform',
        `translate(${CX - cam.fx * cam.scale} ${CY - cam.fy * cam.scale}) scale(${cam.scale})`,
      )
      if (tri1.current) applyTriangle(tri1.current, t)
    }

    const draw = (T: number) => {
      const wa = worldA(T)
      if (world.current) {
        world.current.style.display = wa.shown ? '' : 'none'
        world.current.style.opacity = String(wa.opacity)
      }
      if (wa.shown) drawWorld(T)
      const f = flashOpacity(T)
      if (flash.current) {
        flash.current.style.display = f > 0.004 ? '' : 'none'
        flash.current.style.opacity = String(f)
      }
      applyWord(genesis.current, T, PHASE_WORDS.genesis)
    }

    let frame = 0
    const render = () => {
      const state = useInteraction.getState()
      draw(introTime(state, performance.now()))
      // La dernière image est dessinée : plus rien ne bouge, la boucle s'arrête.
      if (state.introDone) return
      if (state.introStartedAt !== null) frame = requestAnimationFrame(render)
    }
    const restart = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(render)
    }
    restart()
    const unsubscribe = useInteraction.subscribe((s, prev) => {
      if (s.introStartedAt !== prev.introStartedAt || s.introDone !== prev.introDone) restart()
    })
    return () => {
      cancelAnimationFrame(frame)
      unsubscribe()
      observer.disconnect()
    }
  }, [accent, screen, ox, oy])

  const vars = { '--intro-accent': accent } as CSSProperties

  return (
    <div ref={root} className="intro-stage" style={vars}>
      {/* MONDE A — l'espace, sous la caméra A. Les calques couvrent l'écran. */}
      <div ref={world} className="intro-world" style={cover}>
        <canvas ref={canvas} className="intro-canvas" />
        <svg className="intro-svg" viewBox={`${-ox} ${-oy} ${screen.width} ${screen.height}`}>
          <g ref={camera}>
            <NeonTriangle ref={tri1} accent={accent} core={INTRO_CORE} />
          </g>
        </svg>
      </div>

      {/* FX écran : le flash du big-bang, sur tout l'écran. Pas de vignette :
          elle assombrissait vers les bords du CADRE, et dessinait un rectangle
          dans le moniteur. */}
      <div ref={flash} className="intro-flash" style={{ ...cover, display: 'none' }} />

      <PhaseWord word="GENESIS" style={WORD_STYLE.genesis} refs={genesis.current} />
    </div>
  )
}

function disc(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fill()
}

function drawStars(ctx: CanvasRenderingContext2D, stars: StarGroup[], T: number) {
  ctx.fillStyle = INTRO_CREAM
  for (const g of stars) {
    const alpha = starAlpha(g, T)
    if (alpha <= 0.002) continue
    ctx.globalAlpha = alpha
    ctx.beginPath()
    const r = g.size / 2
    for (const [x, y] of g.points) {
      ctx.moveTo(x + r, y)
      ctx.arc(x, y, r, 0, Math.PI * 2)
    }
    ctx.fill()
  }
}

function drawBang(ctx: CanvasRenderingContext2D, T: number, accent: string) {
  ctx.strokeStyle = accent
  for (const ring of rings(T)) {
    if (!ring.visible) continue
    ctx.globalAlpha = ring.opacity
    ctx.lineWidth = ring.width
    ctx.beginPath()
    ctx.arc(CX, CY, ring.r, 0, Math.PI * 2)
    ctx.stroke()
  }
}

/** Les trois classes de particules : fines, moyennes, grosses et blanches. */
const NOVA_RADIUS = [1.6, 2.4, 3.5] as const
const NOVA_ALPHA = [1, 0.9, 0.95] as const

function drawNova(ctx: CanvasRenderingContext2D, parts: Particle[], T: number, accent: string) {
  const alpha = novaOpacity(T)
  const point = { x: 0, y: 0 }
  for (let cls = 0; cls < 3; cls++) {
    ctx.fillStyle = cls === 2 ? INTRO_CORE : accent
    ctx.globalAlpha = alpha * NOVA_ALPHA[cls]
    ctx.beginPath()
    const r = NOVA_RADIUS[cls]
    for (const p of parts) {
      if (p.cls !== cls) continue
      novaPoint(p, T, point)
      ctx.moveTo(point.x + r, point.y)
      ctx.arc(point.x, point.y, r, 0, Math.PI * 2)
    }
    ctx.fill()
  }
}

function applyWord(
  refs: { root: React.RefObject<HTMLDivElement | null>; letters: (HTMLSpanElement | null)[] },
  T: number,
  spec: PhaseWordSpec,
) {
  const el = refs.root.current
  if (!el) return
  const a = phaseWordAlpha(T, spec)
  if (!a) {
    el.style.display = 'none'
    return
  }
  el.style.display = ''
  el.style.opacity = String(a.opacity)
  a.letters.forEach((alpha, i) => {
    const span = refs.letters[i]
    if (span) span.style.opacity = String(alpha)
  })
}
