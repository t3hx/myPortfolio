import { Fragment, useEffect, useRef } from 'react'
import {
  CUBE_PARALLAX_X,
  CUBE_PARALLAX_Y,
  CUBE_REST_DEG,
  CUBE_SPEED_IDLE,
  NAME_DECRYPT_DELAY_MS,
  NAME_DECRYPT_FRAME_MS,
  NAME_DECRYPT_MS,
} from '@/config/classic'
import { CV } from '@/content/cv'
import { UI } from '@/content/ui'
import { cubeSpeed, cubeSpeedStep, spinStep } from '@/lib/classic'
import { reducedMotion } from '@/lib/clock'
import { t, tm, type Locale } from '@/lib/locale'
import { useDecryptClock } from '@/lib/decrypt'
import { DECRYPT_CHARSET_CODE, Scrambled } from '@/ui/Scrambled'
import { WireCube } from '@/ui/classic/WireCube'
import { ignite } from '@/ui/classic/useReveal'

/**
 * L'accueil : le nom qui se déchiffre, le cube qui tourne, la pièce qui
 * s'allume (spec §1 à §4).
 *
 * C'est le seul écran de la page qui s'anime tout seul, et il le fait UNE
 * fois. Tout le reste attend un geste — un défilement, un survol.
 */

/**
 * La rotation du cube, pilotée par la distance du curseur.
 *
 * **Le cube ralentit quand on l'approche**, et c'est le sens qui compte : on
 * regarde ce qui se calme quand on s'en approche, on chasse ce qui s'emballe.
 *
 * Deux choses passent par le DOM sans repasser par React — l'angle et la
 * parallaxe. Ce sont des transformations par image ; les publier en état ferait
 * re-rendre l'accueil soixante fois par seconde, et le nom se re-déchiffrerait
 * dans la foulée puisqu'il dérive du même rendu.
 */
function useSpinningCube() {
  const shape = useRef<HTMLDivElement>(null)
  const spin = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const el = spin.current
    if (!el) return
    if (reducedMotion()) return

    let mouse: { x: number; y: number } | null = null
    const onMove = (e: MouseEvent) => {
      mouse = { x: e.clientX, y: e.clientY }
      const group = shape.current
      if (!group) return
      // La parallaxe s'écarte du curseur (les deux facteurs sont négatifs) :
      // c'est le décalage CONTRAIRE qui crée la profondeur. Un cube qui suivrait
      // la souris se collerait à la vitre.
      const dx = e.clientX / window.innerWidth - 0.5
      const dy = e.clientY / window.innerHeight - 0.5
      group.style.transform = `translate(${dx * CUBE_PARALLAX_X}px, ${dy * CUBE_PARALLAX_Y}px)`
    }
    window.addEventListener('mousemove', onMove, { passive: true })

    let frame = 0
    let angle = CUBE_REST_DEG
    let speed = CUBE_SPEED_IDLE
    let last = performance.now()
    const tick = (now: number) => {
      const dt = (now - last) / 1000
      last = now
      // Sans souris — un tactile, un clavier, une page qu'on vient d'ouvrir —
      // le cube tourne à sa vitesse de repos plutôt que de s'arrêter : il n'a
      // personne à qui répondre, il n'a pas pour autant à faire le mort.
      let target = CUBE_SPEED_IDLE
      if (mouse) {
        const r = el.getBoundingClientRect()
        const d = Math.hypot(mouse.x - (r.left + r.width / 2), mouse.y - (r.top + r.height / 2))
        target = cubeSpeed(d, window.innerWidth, window.innerHeight)
      }
      speed = cubeSpeedStep(speed, target)
      angle = spinStep(angle, speed, dt)
      el.style.transform = `rotateX(-18deg) rotateY(${angle}deg)`
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)

    return () => {
      window.removeEventListener('mousemove', onMove)
      cancelAnimationFrame(frame)
    }
  }, [])

  return { shape, spin }
}

export function Hero({ locale }: { locale: Locale }) {
  const { shape, spin } = useSpinningCube()

  // Le nom est mis en capitales ICI, pas en CSS. `text-transform` ne change que
  // le rendu : le déchiffrage travaillerait sur les minuscules d'origine et
  // mélangerait des glyphes hauts à des lettres basses, ce qui se voit à cette
  // taille. Découpé sur l'espace plutôt qu'à un index écrit en dur, pour que le
  // jour où le nom change la ligne ne se coupe pas au milieu d'un mot.
  const full = CV.identity.name.toUpperCase()
  const space = full.indexOf(' ')
  const firstName = space === -1 ? full : full.slice(0, space)
  const lastName = space === -1 ? '' : full.slice(space + 1)

  // Le retard fait partie de la durée totale : l'horloge doit couvrir le
  // silence initial ET le déchiffrage, sinon elle s'arrête pendant que le nom
  // est encore brouillé.
  const total = NAME_DECRYPT_DELAY_MS + NAME_DECRYPT_MS
  const elapsed = useDecryptClock(true, total)
  const typing = elapsed !== null && elapsed < total

  const scramble = (text: string, delay: number) => (
    <Scrambled
      text={text}
      elapsed={elapsed}
      delay={NAME_DECRYPT_DELAY_MS + delay}
      duration={NAME_DECRYPT_MS}
      charset={DECRYPT_CHARSET_CODE}
      frameMs={NAME_DECRYPT_FRAME_MS}
    />
  )

  return (
    <section className="classic-hero">
      <div
        className="classic-hero__glow classic-ignite"
        style={ignite(2600, 1500)}
        aria-hidden="true"
      />

      <div
        className="classic-hero__cube classic-ignite"
        style={ignite(2200, 1000)}
        ref={shape}
        aria-hidden="true"
      >
        <div className="classic-hero__cube-inner">
          <WireCube ref={spin} />
        </div>
      </div>

      <div className="classic-hero__body">
        <div className="classic-kicker classic-ignite" style={ignite(1000, 400)}>
          <span className="classic-dot" aria-hidden="true" />
          <span>{t(UI.classic.kicker, locale)}</span>
        </div>

        {/* Le nom brouillé est `aria-hidden` et le vrai nom vit dans
            `aria-label` : une synthèse vocale lirait sinon une ligne de bruit.
            Même traitement que `CvName`. */}
        <h1 className="classic-hero__name" aria-label={full}>
          <span className="classic-slide-l" aria-hidden="true">
            {scramble(firstName, 0)}
          </span>
          <span className="classic-slide-r" aria-hidden="true">
            {scramble(lastName, 0)}
            {typing && <i className="classic-caret" />}
          </span>
        </h1>

        <p className="classic-hero__tagline classic-ignite" style={ignite(1400, 2000)}>
          {t(UI.classic.tagline, locale)}
        </p>

        {/* La ligne de méta est DÉRIVÉE de `CV.facts` — la même source que le CV
            de la scène. La recopier ici aurait produit un second état civil, qui
            se serait mis à mentir au premier changement. L'âge, lui, n'est
            affiché que par cette page : il vit dans `CV.identity`. */}
        <div className="classic-hero__meta classic-ignite" style={ignite(1400, 2500)}>
          <span>{t(CV.identity.age, locale)}</span>
          {CV.facts.map((fact) => (
            <Fragment key={t(fact.label, locale)}>
              {/* Le point cyan est un SÉPARATEUR : il précède chaque fait, donc
                  il n'ouvre jamais la ligne — c'est l'âge qui l'ouvre. */}
              <i aria-hidden="true" />
              <span>
                {t(fact.label, locale)} {tm(fact.value, locale)}
              </span>
            </Fragment>
          ))}
        </div>
      </div>

      <div
        className="classic-hero__scroll classic-ignite"
        style={ignite(1600, 3000)}
        aria-hidden="true"
      >
        <span>{t(UI.classic.scroll, locale)}</span>
        <i />
      </div>
    </section>
  )
}
