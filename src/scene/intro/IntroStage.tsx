import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { INTRO_CORE, INTRO_CREAM, INTRO_FRAME, INTRO_PARTICLES } from '@/config/intro'
import { LAB_PLAN_ORDER, loadLabPlan, type LabPlan as LabPlanData } from '@/content/labPlan'
import { introTime } from '@/lib/intro'
import { labPlanSvg, rasterDensity, rasterizeLabPlan } from '@/lib/labRaster'
import {
  CX,
  CY,
  LAB_SUBGROUPS,
  PHASE_WORDS,
  cameraA,
  flashOpacity,
  labDashOffset,
  makeParticles,
  makeStars,
  novaActive,
  novaOpacity,
  novaPoint,
  phaseWordAlpha,
  rings,
  starAlpha,
  triangle1,
  triangle2,
  worldA,
  worldB,
  type Particle,
  type PhaseWordSpec,
  type StarGroup,
} from '@/lib/introScene'
import { useInteraction } from '@/state/interaction'
import { LabPlan } from '@/scene/intro/LabPlan'
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
  incubation: { left: INTRO_FRAME.width - 610, top: INTRO_FRAME.height - 186, textAlign: 'right' },
} satisfies Record<string, CSSProperties>

interface WordRefs {
  root: React.RefObject<HTMLDivElement | null>
  letters: (HTMLSpanElement | null)[]
}

const wordRefs = (): WordRefs => ({ root: { current: null }, letters: [] })

function PhaseWord({ word, style, refs }: { word: string; style: CSSProperties; refs: WordRefs }) {
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
  const worldBRoot = useRef<HTMLDivElement>(null)
  const worldBCam = useRef<SVGGElement>(null)
  const tri2 = useRef<SVGGElement>(null)
  const genesis = useRef<WordRefs>(wordRefs())
  const incubation = useRef<WordRefs>(wordRefs())

  // Le plan est demandé à T = 0 et dessiné à 9,5 s : 94 Ko de chemins n'ont
  // rien à faire dans le chunk d'App3D (#141). Un chargement en retard ne
  // bloque pas l'horloge — le plan apparaît là où le tracé en est.
  const [plan, setPlan] = useState<LabPlanData | null>(null)
  useEffect(() => {
    let alive = true
    loadLabPlan().then(
      (loaded) => {
        if (alive) setPlan(loaded)
      },
      (error: unknown) => {
        console.warn('[intro] le plan du lab ne se charge pas, la phase 2 restera vide', error)
      },
    )
    return () => {
      alive = false
    }
  }, [])

  // Les 55 groupes de vagues, relevés une fois le plan monté : la boucle les
  // adresse par leur rang dans la chronologie, jamais par l'ordre du document.
  // `offsets` retient ce qui est écrit dans chacun, pour ne réécrire que ce
  // qui change — et il n'enregistre QUE des écritures réelles, sinon les
  // images jouées avant l'arrivée du plan prétendraient l'avoir dessiné.
  const waves = useRef<(SVGGElement | null)[]>([])
  const offsets = useRef(new Float64Array(LAB_PLAN_ORDER.length * LAB_SUBGROUPS).fill(NaN))
  const drawLabRef = useRef<((T: number) => void) | null>(null)
  useEffect(() => {
    const found = worldBRoot.current?.querySelectorAll<SVGGElement>('.intro-lab > g[data-wave]')
    waves.current = []
    found?.forEach((g) => {
      waves.current[Number(g.dataset.wave)] = g
    })
    // Et on dessine tout de suite, car la boucle peut très bien être arrêtée :
    // sur la dernière image d'emblée (mouvement réduit, lien direct ailleurs
    // qu'à Home) elle rend une seule image, AVANT que le plan n'existe. Sans
    // ce tracé-là, le plan restait entièrement en pointillé sur les deux
    // chemins où personne ne le voit se dessiner — donc où il doit être fini.
    drawLabRef.current?.(introTime(useInteraction.getState(), performance.now()))
  }, [plan])

  // Le plan aplati en image, une fois qu'il ne se dessine plus. Tant que
  // l'intro joue il reste vectoriel — il s'écrit ; à la dernière image il
  // devient un bitmap, parce que la révélation qui suit re-rastériserait ses
  // 2 346 tracés à chaque image du recul (voir lib/labRaster.ts : mesuré, un
  // tiers des images du recul sous Gecko). La caméra ne peut pas partir plus
  // tôt : pendant l'intro la molette est le geste de saut.
  const introDone = useInteraction((s) => s.introDone)
  const [flattened, setFlattened] = useState<string | null>(null)
  useEffect(() => {
    if (!plan || !introDone) return
    let url: string | null = null
    rasterizeLabPlan(labPlanSvg(plan, accent), rasterDensity(window.devicePixelRatio)).then(
      (made) => {
        url = made
        setFlattened(made)
      },
      (error: unknown) => {
        // Le plan reste vectoriel : moins fluide au recul, mais présent.
        console.warn('[intro] le plan du lab reste vectoriel', error)
      },
    )
    return () => {
      if (url) URL.revokeObjectURL(url)
      setFlattened(null)
    }
  }, [plan, introDone, accent])

  // La poussière du monde B : le premier groupe d'étoiles, figé, très discret.
  // Un fond parfaitement noir derrière le plan se lit comme un cache posé sur
  // l'écran ; ces points disent qu'on est toujours dans le même espace.
  const dust = useMemo(
    () =>
      makeStars()[0]
        .points.map(([x, y]) => `M${x.toFixed(1)} ${y.toFixed(1)}h.01`)
        .join(''),
    [],
  )

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
      if (tri2.current) applyTriangle(tri2.current, triangle2(T))
    }

    const drawLab = (T: number) => {
      const el = worldBRoot.current
      if (!el) return
      const wb = worldB(T)
      el.style.opacity = String(wb.opacity)
      worldBCam.current?.setAttribute(
        'transform',
        `translate(${CX - CX * wb.scale} ${CY - CY * wb.scale}) scale(${wb.scale})`,
      )
      for (let b = 0; b < LAB_PLAN_ORDER.length; b++) {
        for (let wave = 0; wave < LAB_SUBGROUPS; wave++) {
          const slot = b * LAB_SUBGROUPS + wave
          const group = waves.current[slot]
          if (!group) continue
          const offset = labDashOffset(b, wave, T)
          // Une vague pas encore partie (1) ou déjà finie (0) n'a plus rien à
          // dire, et chaque écriture invalide le style des ~45 tracés du
          // groupe : on ne réécrit que ce qui change.
          if (offset === offsets.current[slot]) continue
          offsets.current[slot] = offset
          group.style.strokeDashoffset = offset.toFixed(4)
        }
      }
    }

    drawLabRef.current = drawLab

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
      drawLab(T)
      applyWord(genesis.current, T, PHASE_WORDS.genesis)
      applyWord(incubation.current, T, PHASE_WORDS.incubation)
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
      drawLabRef.current = null
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
            <NeonTriangle ref={tri2} accent={accent} core={INTRO_CORE} />
            <NeonTriangle ref={tri1} accent={accent} core={INTRO_CORE} />
          </g>
        </svg>
      </div>

      {/* MONDE B — l'intérieur du triangle. Il vit dans le CADRE, pas sur
          l'écran : à l'échelle 1 il le remplit exactement, c'est ce qui donne
          au plan la taille pour laquelle il a été dessiné.

          Il est monté dès que le plan est chargé, bien avant d'être visible,
          et n'est jamais caché : poser 2 346 chemins dans le document coûte
          une mise en page, et cette mise en page ne doit pas tomber sur la
          plongée. Invisible, il ne coûte rien à peindre — tous ses traits sont
          encore entièrement en pointillé.

          Le zoom est un `transform` sur un `<g>`, vectoriel : un transform CSS
          sur le calque re-rastériserait les 2 346 tracés à chaque image du
          zoom (note de perf du handoff, mesurée sur le prototype). */}
      <div ref={worldBRoot} className="intro-world-b" style={{ opacity: 0 }}>
        <svg className="intro-svg" viewBox={`0 0 ${INTRO_FRAME.width} ${INTRO_FRAME.height}`}>
          <g ref={worldBCam}>
            <path className="intro-dust" d={dust} />
            {/* On ne retire le vectoriel qu'une fois l'image PRÊTE : les
                échanger sur un `introDone` ferait clignoter le plan. */}
            {flattened ? (
              <image
                href={flattened}
                x="0"
                y="0"
                width={INTRO_FRAME.width}
                height={INTRO_FRAME.height}
              />
            ) : (
              plan && <LabPlan plan={plan} />
            )}
          </g>
        </svg>
      </div>

      {/* FX écran : le flash du big-bang, sur tout l'écran. Pas de vignette :
          elle assombrissait vers les bords du CADRE, et dessinait un rectangle
          dans le moniteur. */}
      <div ref={flash} className="intro-flash" style={{ ...cover, display: 'none' }} />

      <PhaseWord word="GENESIS" style={WORD_STYLE.genesis} refs={genesis.current} />
      <PhaseWord word="INCUBATION" style={WORD_STYLE.incubation} refs={incubation.current} />
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
