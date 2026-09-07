import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import {
  INTRO_CORE,
  INTRO_CREAM,
  INTRO_FRAME,
  INTRO_GOLD,
  INTRO_NAME_FONT,
  INTRO_PARTICLES,
  INTRO_TITLE,
  INTRO_TITLE_WIDTH,
} from '@/config/intro'
import { CV } from '@/content/cv'
import { LAB_PLAN_ORDER, loadLabPlan, type LabPlan as LabPlanData } from '@/content/labPlan'
import { introPhase, introTime } from '@/lib/intro'
import { nameTargets, type NameTarget } from '@/lib/nameTargets'
import { labPlanSvg, rasterDensity, rasterizeLabPlan } from '@/lib/labRaster'
import {
  CX,
  CY,
  LAB_SUBGROUPS,
  NAME_Y,
  PHASE_WORDS,
  cameraA,
  etchTitle,
  flashOpacity,
  flickerOn,
  labDashOffset,
  labOpacity,
  makeParticles,
  makeStars,
  nameLetter,
  novaActive,
  novaOpacity,
  novaPoint,
  phaseWordAlpha,
  rings,
  starAlpha,
  swirlActive,
  swirlOpacity,
  swirlPoint,
  triangle1,
  triangle2,
  triangle3,
  worldA,
  worldB,
  type Particle,
  type PhaseWordSpec,
  type StarGroup,
} from '@/lib/introScene'
import { viewMode } from '@/lib/viewMode'
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

/**
 * Où chaque mot se pose, en px du cadre. Les trois sont à 150 px de LEUR bord,
 * et c'est le bord qui les ancre : la boîte se dimensionne maintenant sur son
 * contenu (#147), donc un `left` sur les mots de droite les ferait dépasser du
 * cadre à la première lettre ajoutée.
 *
 * Les positions sont celles du handoff, inchangées. Le placement d'INCUBATION
 * et d'EMERGENCE reste à trancher : mesuré sur les 2 346 tracés du plan, ils
 * tombent sur 20,7 et 14,6 unités d'encre pour 1000 px², là où le creux du
 * plan — la bande basse, sous le nom et sous le titre gravé — en compte 0,3.
 * GENESIS, lui, joue à 2,2 s : le plan n'existe pas encore derrière lui.
 */
const WORD_STYLE = {
  genesis: { left: 150, top: 168 },
  // INCUBATION est le seul des trois à être ancré par son CENTRE, et le nombre
  // est mesuré, pas choisi : à sa hauteur, le plan du lab est strictement vide
  // entre les centres 1030 et 1120, et plein partout ailleurs. 1050 est le
  // point le plus proche du centre du cadre (960) qui garde de la marge dans
  // ce vide. Il tombait avant sur 14,3 unités d'encre pour 1000 px².
  incubation: { left: 1050, top: INTRO_FRAME.height - 186, transform: 'translateX(-50%)' },
  // EMERGENCE reste où le handoff l'a posé (arbitrage de l'auteur, 2026-09-07) :
  // sa phase n'offre pas de meilleure place. Elle vaut 20,7 d'encre — c'est le
  // doré, et non le placement, qui la fait tenir sur le plan.
  emergence: { right: 150, top: 152 },
} satisfies Record<string, CSSProperties>

interface WordRefs {
  root: React.RefObject<HTMLDivElement | null>
  letters: (HTMLSpanElement | null)[]
  /** Les deux tirets d'accent : celui d'avant le mot, celui d'après. */
  rules: (HTMLSpanElement | null)[]
}

const wordRefs = (): WordRefs => ({ root: { current: null }, letters: [], rules: [] })

function PhaseWord({ word, style, refs }: { word: string; style: CSSProperties; refs: WordRefs }) {
  return (
    <div ref={refs.root} className="intro-word" style={style}>
      <span
        className="intro-word__rule"
        ref={(el) => {
          refs.rules[0] = el
        }}
      />
      <span className="intro-word__text">
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
      </span>
      <span
        className="intro-word__rule"
        ref={(el) => {
          refs.rules[1] = el
        }}
      />
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
  const canvasB = useRef<HTMLCanvasElement>(null)
  const labWrap = useRef<SVGGElement>(null)
  const tri3 = useRef<SVGGElement>(null)
  const identity = useRef<HTMLDivElement>(null)
  const nameLetters = useRef<(HTMLSpanElement | null)[]>([])
  const titleText = useRef<HTMLDivElement>(null)
  const spark = useRef<HTMLDivElement>(null)
  const creative = useRef<HTMLSpanElement>(null)
  const genesis = useRef<WordRefs>(wordRefs())
  const incubation = useRef<WordRefs>(wordRefs())
  const emergence = useRef<WordRefs>(wordRefs())

  // Le nom vient du CV, pas d'une chaîne recopiée ici : c'est la même personne,
  // et deux orthographes d'un nom propre sur le même site ne se remarqueraient
  // qu'une fois en ligne. L'intro l'écrit en capitales, le CV comme il est.
  const nameChars = useMemo(() => [...CV.identity.name.toUpperCase()], [])

  // Les cibles du tourbillon : les pixels du nom, relevés UNE fois, à T = 0,
  // et jamais à 13 s — la fonte doit être chargée, et l'attendre au moment de
  // s'en servir ferait démarrer le tourbillon en retard ou à côté.
  const targets = useRef<NameTarget[]>([])
  useEffect(() => {
    let alive = true
    nameTargets(nameChars.join('')).then(
      (found) => {
        if (alive) targets.current = found
      },
      (error: unknown) => {
        // Sans cibles il n'y a pas de tourbillon ; le nom s'écrit quand même.
        console.warn("[intro] le nom ne s'échantillonne pas, pas de tourbillon", error)
      },
    )
    return () => {
      alive = false
    }
  }, [nameChars])

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
    const canvasBEl = canvasB.current
    const ctxB = canvasBEl?.getContext('2d')
    if (!rootEl || !canvasEl || !ctx || !canvasBEl || !ctxB) return

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
      for (const c of [canvasEl, canvasBEl]) {
        c.width = Math.round(screen.width * density)
        c.height = Math.round(screen.height * density)
      }
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
      // L'opacité est portée par le GROUPE, pas par le plan : à la dernière
      // image le vectoriel cède la place à un bitmap, et le 32 % doit survivre
      // à l'échange sans que personne n'ait à le réécrire.
      labWrap.current?.setAttribute('opacity', labOpacity(T).toFixed(4))
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

    // Le tourbillon vit dans le monde B, donc sur son propre canvas : celui du
    // monde A part avec l'espace à 10,4 s, deux secondes avant que la première
    // particule ne reparte vers le nom. Il couvre l'ÉCRAN et non le cadre —
    // les particules démarrent jusqu'à 1 220 px de leur cible, très au-delà du
    // cadre, et un canvas qui s'arrêterait à son bord les ferait surgir d'un
    // rectangle.
    let swirlPainted = false
    const drawSwirl = (T: number) => {
      const pts = targets.current
      const on = swirlActive(T) && pts.length > 0
      // Hors de sa fenêtre, le canvas n'est ni effacé ni peint : le tourbillon
      // ne dure que trois secondes sur vingt.
      if (!on && !swirlPainted) return
      ctxB.setTransform(1, 0, 0, 1, 0, 0)
      ctxB.clearRect(0, 0, canvasBEl.width, canvasBEl.height)
      swirlPainted = on
      if (!on) return
      const wb = worldB(T)
      const s = density * wb.scale
      ctxB.setTransform(
        s,
        0,
        0,
        s,
        density * (ox + CX - CX * wb.scale),
        density * (oy + CY - CY * wb.scale),
      )
      paintSwirl(ctxB, parts, pts, T, accent)
      ctxB.globalAlpha = 1
    }

    // L'identité — le nom et le titre — est du HTML posé sur le cadre, à
    // l'échelle du monde B. `letterInk` retient ce qui a été écrit dans chaque
    // lettre : quinze spans réécrits soixante fois par seconde pendant vingt
    // secondes pour une valeur qui ne bouge que sur une demi-seconde.
    const letterInk = new Float64Array(nameChars.length).fill(NaN)
    let etched = NaN
    const applyIdentity = (T: number) => {
      const layer = identity.current
      if (!layer) return
      const wb = worldB(T)
      layer.style.transform = `translate(${(CX - CX * wb.scale).toFixed(2)}px, ${(
        CY -
        CY * wb.scale
      ).toFixed(2)}px) scale(${wb.scale.toFixed(5)})`
      for (let i = 0; i < nameChars.length; i++) {
        const el = nameLetters.current[i]
        const { opacity, shift } = nameLetter(i, T)
        if (!el || opacity === letterInk[i]) continue
        letterInk[i] = opacity
        el.style.opacity = opacity.toFixed(4)
        el.style.transform = `translateY(${shift.toFixed(2)}px)`
      }
      const e = etchTitle(T)
      if (titleText.current && e.progress !== etched) {
        etched = e.progress
        titleText.current.style.clipPath = `inset(-10px ${((1 - e.progress) * 100).toFixed(3)}% -10px 0)`
      }
      if (spark.current) {
        spark.current.style.display = e.sparkVisible ? '' : 'none'
        if (e.sparkVisible) {
          spark.current.style.left = `${(e.progress * INTRO_TITLE_WIDTH - 3).toFixed(2)}px`
          spark.current.style.opacity = e.sparkOpacity.toFixed(3)
        }
      }
      // La classe pose une boucle CSS : elle survit à l'arrêt de l'horloge,
      // et c'est tout l'intérêt — le néon continue de mal fonctionner pendant
      // que le visiteur parcourt la pièce.
      creative.current?.classList.toggle('intro-flicker', flickerOn(T))
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
      drawLab(T)
      if (tri3.current) applyTriangle(tri3.current, triangle3(T))
      drawSwirl(T)
      applyIdentity(T)
      applyWord(genesis.current, T, PHASE_WORDS.genesis)
      applyWord(incubation.current, T, PHASE_WORDS.incubation)
      applyWord(emergence.current, T, PHASE_WORDS.emergence)
    }

    // La sonde de fluidité (#147). Elle garde les instants des images de la
    // DERNIÈRE SECONDE, et rien de plus : une moyenne depuis le départ noierait
    // exactement ce qu'on cherche — la seconde où ça décroche, au tracé du plan
    // ou au tourbillon. Le compte est celui de CETTE boucle, qui est la boucle
    // de l'intro ; la scène 3D a la sienne, et `__rigDebug` la raconte.
    //
    // Elle n'existe que sous `?debug`, et pas sous `import.meta.env.DEV` comme
    // `__rigDebug` : une mesure de fluidité sur un serveur de dev ne dit rien
    // du site servi, et c'est justement `pnpm preview` qu'on veut sonder.
    const stamps: number[] = []
    const probe = (T: number, now: number) => {
      stamps.push(now)
      while (stamps.length > 0 && now - stamps[0] > 1000) stamps.shift()
      const span = stamps.length > 1 ? stamps[stamps.length - 1] - stamps[0] : 0
      ;(window as unknown as Record<string, unknown>).__introDebug = {
        T: +T.toFixed(3),
        phase: introPhase(T),
        fps: stamps.length,
        frameMs: span > 0 ? +(span / (stamps.length - 1)).toFixed(2) : null,
      }
    }

    let frame = 0
    const render = () => {
      const state = useInteraction.getState()
      const now = performance.now()
      const T = introTime(state, now)
      draw(T)
      if (viewMode === 'tour') probe(T, now)
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
  }, [accent, screen, ox, oy, nameChars])

  // Les encres de l'intro, pour ce que le CSS peint tout seul — le cœur
  // blanc-cyan sert au canvas ET à l'étincelle du laser, le doré aux mots de
  // phase et à leurs tirets.
  const vars = {
    '--intro-accent': accent,
    '--intro-core': INTRO_CORE,
    '--intro-gold': INTRO_GOLD,
  } as CSSProperties

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
                échanger sur un `introDone` ferait clignoter le plan. Le groupe
                qui les enveloppe porte l'opacité du plan (100 % pendant qu'il
                s'écrit, 32 % dès que le nom prend la vedette) : c'est le seul
                élément qui traverse l'échange. */}
            <g ref={labWrap}>
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
            {/* Le troisième triangle : devant le plan, derrière le nom. */}
            <NeonTriangle ref={tri3} accent={accent} core={INTRO_CORE} />
          </g>
        </svg>

        {/* Le tourbillon, au-dessus du plan et sous les lettres qu'il compose. */}
        <canvas ref={canvasB} className="intro-canvas intro-canvas--loose" style={cover} />

        {/* L'IDENTITÉ — en HTML, pour la netteté du texte et son ombre portée.
            Elle partage le repère du cadre et la ligne NAME_Y avec le canvas :
            c'est ce qui fait que le tourbillon converge SUR les lettres. */}
        <div ref={identity} className="intro-identity">
          <div
            className="intro-name"
            style={{
              top: NAME_Y - 58,
              fontFamily: `${INTRO_NAME_FONT.family}, sans-serif`,
              fontSize: INTRO_NAME_FONT.size,
              letterSpacing: INTRO_NAME_FONT.letterSpacing,
            }}
          >
            {nameChars.map((ch, i) => (
              <span
                key={i}
                ref={(el) => {
                  nameLetters.current[i] = el
                }}
              >
                {ch}
              </span>
            ))}
          </div>
          <div
            className="intro-title"
            style={{ left: CX - INTRO_TITLE_WIDTH / 2, top: NAME_Y + 72, width: INTRO_TITLE_WIDTH }}
          >
            {/* Le `clip-path` de départ découvre RIEN : sans lui le titre
                serait déjà écrit avant que le laser ne le grave. */}
            <div
              ref={titleText}
              className="intro-title__text"
              style={{ clipPath: 'inset(-10px 100% -10px 0)' }}
            >
              <span ref={creative}>{INTRO_TITLE.flicker}</span>
              {INTRO_TITLE.rest}
            </div>
            <div ref={spark} className="intro-spark" style={{ display: 'none' }} />
          </div>
        </div>
      </div>

      {/* FX écran : le flash du big-bang, sur tout l'écran. Pas de vignette :
          elle assombrissait vers les bords du CADRE, et dessinait un rectangle
          dans le moniteur. */}
      <div ref={flash} className="intro-flash" style={{ ...cover, display: 'none' }} />

      <PhaseWord word="GENESIS" style={WORD_STYLE.genesis} refs={genesis.current} />
      <PhaseWord word="INCUBATION" style={WORD_STYLE.incubation} refs={incubation.current} />
      <PhaseWord word="EMERGENCE" style={WORD_STYLE.emergence} refs={emergence.current} />
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

/**
 * Le tourbillon : les mêmes 900 particules que la nova, chacune ramenée sur un
 * pixel du nom. Les cibles sont réparties par le RANG de la particule, pas au
 * hasard : deux particules voisines dans la liste visent deux pixels voisins,
 * et c'est ce qui fait que le nom se remplit en plaques plutôt qu'en grésil.
 */
const SWIRL_RADIUS = [1.5, 2.2, 3.2] as const
const SWIRL_ALPHA = [1, 0.9, 0.95] as const

function paintSwirl(
  ctx: CanvasRenderingContext2D,
  parts: Particle[],
  targets: NameTarget[],
  T: number,
  accent: string,
) {
  const alpha = swirlOpacity(T)
  const point = { x: 0, y: 0 }
  for (let cls = 0; cls < 3; cls++) {
    ctx.fillStyle = cls === 2 ? INTRO_CORE : accent
    ctx.globalAlpha = alpha * SWIRL_ALPHA[cls]
    ctx.beginPath()
    const r = SWIRL_RADIUS[cls]
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i]
      if (p.cls !== cls) continue
      const target = targets[Math.floor((i * targets.length) / parts.length)]
      swirlPoint(p, target[0], target[1], T, point)
      ctx.moveTo(point.x + r, point.y)
      ctx.arc(point.x, point.y, r, 0, Math.PI * 2)
    }
    ctx.fill()
  }
}

function applyWord(refs: WordRefs, T: number, spec: PhaseWordSpec) {
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
  // Le tiret de gauche arrive avec la première lettre, celui de droite avec la
  // dernière : le mot se pose ENTRE eux au lieu d'apparaître dans un cadre déjà
  // dressé. Portés par l'opacité du bloc, les deux seraient à plein pendant
  // toute l'écriture — 0,63 s de deux traits encadrant du vide.
  const first = refs.rules[0]
  const last = refs.rules[1]
  if (first) first.style.opacity = String(a.letters[0])
  if (last) last.style.opacity = String(a.letters[a.letters.length - 1])
}
