import { useEffect, useRef, useState } from 'react'
import { CAMERA_STOPS } from '@/config/cameraStops'
import { CV, CV_JOBS_EMPTY, type CvGlyph } from '@/content/cv'
import { UI } from '@/content/ui'
import { type Locale, t, tm } from '@/lib/locale'
import { useLocale } from '@/state/locale'
import { useInteraction } from '@/state/interaction'

/**
 * Le CV « affiché par l'écran vertical » (issue #93).
 *
 * Il recrée `docs/design/screens/02-cv.html`, dont l'anatomie vit désormais
 * dans `docs/design/tokens.css` avec celle de la bulle, de la barre et de la
 * fiche : l'app et la maquette partagent une seule définition, et rien ne peut
 * diverger en silence.
 *
 * **Ce n'est pas une phase.** `interaction.ts` pose la règle — chaque phase
 * possède UN routage d'entrée — et le CV n'en a aucun : il ne capture ni la
 * molette ni le clavier, il s'affiche pendant que le tour garde la main. Il se
 * déduit donc de l'état existant, exactement comme `Experience` déduit la
 * bulle visible : `parked` + l'arrêt `CV`. Corollaire assumé : **pas de classe
 * `panel`**, la molette continue de commander le tour au-dessus du CV.
 *
 * Il n'est pas modal non plus. À `--z-bubble` (100) il passe SOUS la barre de
 * menu (200) : « Résumé » est la porte par laquelle on arrive ici, elle doit
 * rester la porte de sortie.
 */

/** `label` de l'arrêt qui affiche le CV — clé de `CAMERA_STOPS` et de `?stop=`.
 *  `tests/cv.test.ts` vérifie qu'il existe encore, comme `menu.test.ts` le fait
 *  pour les sections de la barre. */
export const CV_STOP_LABEL = 'CV'

/** Doit égaler `--t-cv-out` de tokens.css — `tests/cv.test.ts` est la seule
 *  chose qui relie les deux. */
export const CV_OUT_MS = 200

/** Doit égaler `--t-decrypt` de tokens.css — `tests/cv.test.ts` relie les deux. */
export const DECRYPT_MS = 1600

/** Durée d'un titre déchiffré, et décalage d'un cran à l'autre de la cascade. */
export const CASCADE_MS = 420
export const CASCADE_STEP_MS = 60

/** Les glyphes tirés au sort. Majuscules, chiffres et symboles : de quoi lire
 *  « du code », sans caractère assez large pour déformer une chasse fixe. */
const DECRYPT_CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#@%&$*/<>'

/**
 * L'horloge de la cascade — **une seule pour tout le CV**.
 *
 * Une quinzaine de titres se déchiffrent en même temps. Leur donner chacun sa
 * boucle `requestAnimationFrame` et son état, c'est quinze rendus React par
 * image, à côté d'une scène 3D qui a déjà besoin des seize millisecondes. Ici
 * un seul `rAF` publie le temps écoulé et tout le monde en dérive son texte :
 * un rendu par image, quel que soit le nombre de titres.
 *
 * Retourne `null` quand il n'y a rien à animer — fin de la cascade, ou
 * `prefers-reduced-motion`. Les composants lisent ce `null` comme « affiche le
 * texte final », ce qui neutralise l'animation au lieu de la raccourcir : le
 * critère du design system est l'autonomie, et celle-ci part toute seule.
 */
function useCascadeClock(active: boolean, total: number): number | null {
  const [elapsed, setElapsed] = useState<number | null>(null)

  useEffect(() => {
    if (!active) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let frame = 0
    const started = performance.now()
    const tick = (now: number) => {
      const dt = now - started
      if (dt >= total) {
        setElapsed(null)
        return
      }
      setElapsed(dt)
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [active, total])

  return elapsed
}

/**
 * Un texte déchiffré : les caractères se figent de gauche à droite, ceux qui
 * restent tirent un glyphe au sort.
 *
 * **Les espaces ne sont jamais brouillés** : ce sont eux qui gardent la
 * silhouette du mot pendant toute l'animation, sans quoi on ne lit qu'un bloc
 * de bruit.
 *
 * Le tirage est **déterministe**, dérivé de l'image et de la position, et non
 * de `Math.random()` : ce composant est rendu pendant la phase de rendu de
 * React, où un appel non pur donnerait un résultat différent à chaque re-rendu
 * déclenché par autre chose que l'horloge.
 */
function Scrambled({
  text,
  elapsed,
  delay = 0,
  duration = CASCADE_MS,
}: {
  text: string
  elapsed: number | null
  delay?: number
  duration?: number
}) {
  if (elapsed === null || elapsed >= delay + duration) return <>{text}</>

  const progress = Math.max((elapsed - delay) / duration, 0)
  const settled = Math.floor(progress * text.length)
  const frame = Math.floor(elapsed / 40)

  return (
    <>
      {text
        .split('')
        .map((char, i) => {
          if (i < settled || char === ' ') return char
          const n = (i * 2654435761 + frame * 40503) >>> 0
          return DECRYPT_CHARSET[n % DECRYPT_CHARSET.length]
        })
        .join('')}
    </>
  )
}

/**
 * Le nom, en haut de tout, avec son caret de bloc.
 *
 * Le caret ne vit que pendant le déchiffrement : c'est lui qui fait lire
 * « console » plutôt que « titre animé », et le laisser après coup en ferait
 * une décoration clignotante permanente.
 *
 * Le texte brouillé est `aria-hidden` et le vrai nom vit dans `aria-label` :
 * une synthèse vocale lirait sinon une ligne de bruit.
 */
function CvName({ text, elapsed }: { text: string; elapsed: number | null }) {
  const typing = elapsed !== null && elapsed < DECRYPT_MS
  return (
    <h1 className="cv__name" aria-label={text}>
      <span aria-hidden="true">
        <Scrambled text={text} elapsed={elapsed} duration={DECRYPT_MS} />
        {typing && <i className="cv__caret" />}
      </span>
    </h1>
  )
}

/**
 * Une réglette de vignettes — le savoir-être et le savoir-faire partagent la
 * même, elles ne diffèrent que par la répartition des colonnes.
 *
 * Sans `icon`, la vignette affiche l'INITIALE du nom : c'est le glyphe neutre
 * en attendant les vrais SVG, pas un état d'erreur. Aucun `onError` n'est câblé
 * — une icône cassée est pire qu'un vide assumé, et c'est la donnée qui décide,
 * jamais le réseau. Même discipline que la couverture d'une fiche projet.
 */
function CvTiles({
  items,
  variant,
  locale,
}: {
  items: CvGlyph[]
  variant: string
  locale: Locale
}) {
  return (
    <div className={`cv__tiles cv__tiles--${variant}`}>
      {items.map((item) => {
        // `tm` et pas `t` : un savoir-être se traduit, un nom de technologie
        // non — et c'est le même champ. Voir `MaybeLocalized`.
        const name = tm(item.name, locale)
        return (
          <div className="cv__tile" key={name}>
            <span className="cv__tile-mark" aria-hidden="true">
              {item.icon ? <img src={item.icon} alt="" /> : name.slice(0, 1)}
            </span>
            <span className="cv__tile-label">{name}</span>
          </div>
        )
      })}
    </div>
  )
}

export function CvScreen() {
  const phase = useInteraction((s) => s.phase)
  const stopIndex = useInteraction((s) => s.stopIndex)
  const root = useRef<HTMLElement>(null)
  const locale = useLocale((s) => s.locale)

  const visible = phase === 'parked' && CAMERA_STOPS[stopIndex]?.label === CV_STOP_LABEL

  // Un rang par titre, dans l'ordre où on les lit : la cascade descend l'écran.
  // `cue(n)` donne le retard du n-ième, et la dernière cartouche ferme la
  // marche — d'où le total, qui arrête l'horloge.
  const cue = (rank: number) => rank * CASCADE_STEP_MS
  const lastRank = 7 + CV.jobs.length + CV.formations.length
  const elapsed = useCascadeClock(visible, Math.max(DECRYPT_MS, cue(lastRank) + CASCADE_MS))

  // Démontage différé, comme la bulle et la fiche : `visible` à false lance le
  // fondu (.cv--out), le démontage suit une fois le fondu fini. Démonter tout
  // de suite emporterait la sortie avec le composant.
  const [mounted, setMounted] = useState(visible)
  useEffect(() => {
    if (visible) {
      setMounted(true)
      return
    }
    const timer = window.setTimeout(() => setMounted(false), CV_OUT_MS)
    return () => window.clearTimeout(timer)
  }, [visible])

  // --- Le passe-plat de la molette ------------------------------------------
  //
  // Le CV défile parce qu'il ne tient plus dans l'écran. Il ne prend donc la
  // molette que s'il lui reste de la course DANS CE SENS-LÀ ; arrivé en butée,
  // il laisse passer et le tour reprend la main au cran suivant. Sans cette
  // nuance, on entrerait dans le CV sans pouvoir en ressortir en défilant.
  //
  // Écouteur NATIF, et c'est load-bearing : `CameraRig` écoute lui aussi en
  // natif, sur `.stage`. React 19 délègue ses `onWheel` à la racine de l'arbre,
  // qui est un ANCÊTRE de `.stage` — un `stopPropagation` synthétique
  // arriverait donc après coup, le rig ayant déjà fait avancer le tour.
  //
  // Quand le contenu tient (grand écran), rien ne défile, rien n'est arrêté :
  // le tour se comporte exactement comme avant.
  useEffect(() => {
    const el = root.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      const atTop = el.scrollTop <= 0
      const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1
      const goingDown = e.deltaY > 0
      if ((goingDown && !atBottom) || (!goingDown && !atTop)) e.stopPropagation()
    }
    el.addEventListener('wheel', onWheel)
    return () => el.removeEventListener('wheel', onWheel)
  }, [mounted])

  if (!mounted) return null

  return (
    <section
      ref={root}
      className={visible ? 'cv' : 'cv cv--out'}
      aria-label={t(UI.cv.region, locale)}
    >
      <CvName text={CV.identity.name} elapsed={elapsed} />

      <div className="cv__row">
        {/* Sans photo, le cadre hachuré EST l'illustration — même parti que la
            couverture générique d'une fiche projet. Une <img> pointée sur un
            fichier absent afficherait une icône cassée, ce qui est pire qu'un
            vide assumé. */}
        <div className="cv__photo">
          {CV.identity.photo ? (
            <img src={CV.identity.photo} alt={t(CV.identity.alt, locale)} />
          ) : (
            t(UI.cv.photo, locale)
          )}
        </div>

        {/* Le savoir-être s'intercale entre la photo et les faits (2026-08-20) :
            trois cartes de largeur égale, la photo donnant la hauteur. */}
        <div className="cv__card cv__card--traits">
          <h2 className="cv__card-title">
            <Scrambled text={t(CV.traitsTitle, locale)} elapsed={elapsed} delay={cue(1)} />
          </h2>
          <CvTiles items={CV.traits} variant="traits" locale={locale} />
        </div>

        <div className="cv__card">
          <h2 className="cv__card-title">
            <Scrambled text={t(CV.factsTitle, locale)} elapsed={elapsed} delay={cue(2)} />
          </h2>
          {CV.facts.map((fact) => (
            <div className="cv__fact" key={fact.label.fr}>
              <b>{t(fact.label, locale)}</b>
              <span>{tm(fact.value, locale)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="cv__card">
        <h2 className="cv__card-title">
          <Scrambled text={t(CV.skillsTitle, locale)} elapsed={elapsed} delay={cue(3)} />
        </h2>
        <CvTiles items={CV.skills} variant="skills" locale={locale} />
      </div>

      {/* « Le cap » : la seule ligne du CV qui parle à la première personne,
          d'où la police de la voix — celle des bulles du tour. Elle est placée
          AVANT les cartouches (décision de l'auteur, 2026-08-20) : l'intention
          se lit d'abord, le parcours la justifie ensuite.

          Son titre est un titre de SECTION, pas un titre de carte : c'est une
          section à part entière, au même rang qu'Expériences et Formations, et
          la marge du titre est ce qui la détache du savoir-faire au-dessus. */}
      <h2 className="cv__section-title">
        <Scrambled text={t(CV.outlookTitle, locale)} elapsed={elapsed} delay={cue(4)} />
      </h2>
      <div className="cv__card">
        <p className="cv__outlook-text">{t(CV.outlook, locale)}</p>
      </div>

      <h2 className="cv__section-title">
        <Scrambled text={t(CV.jobsTitle, locale)} elapsed={elapsed} delay={cue(5)} />
      </h2>

      {/* Aucun poste : une phrase, jamais un écran vide. L'identité et les
          langues restent là — seul le parcours manque, et il le dit. */}
      {CV.jobs.length === 0 ? (
        <p className="cv__empty">{t(CV_JOBS_EMPTY, locale)}</p>
      ) : (
        CV.jobs.map((job, i) => (
          <div className="job" key={`${job.company}-${job.period}`} tabIndex={0}>
            <div className="job__head">
              <span className="job__title">
                <Scrambled text={t(job.title, locale)} elapsed={elapsed} delay={cue(6 + i)} />
              </span>
              <span className="job__company">{job.company}</span>
              <span className="job__period">{job.period}</span>
            </div>
            {/* L'accordéon est pur CSS (survol / focus-within, --t-accordion) :
                un état React ici n'ajouterait qu'un rendu par mouvement de
                souris pour reproduire ce que le sélecteur fait seul. */}
            <div className="job__missions">
              <ul>
                {t(job.missions, locale).map((mission) => (
                  <li key={mission}>{mission}</li>
                ))}
              </ul>
            </div>
          </div>
        ))
      )}

      <h2 className="cv__section-title">
        <Scrambled
          text={t(CV.formationsTitle, locale)}
          elapsed={elapsed}
          delay={cue(6 + CV.jobs.length)}
        />
      </h2>
      {/* Mêmes cartouches, MOINS l'accordéon : un diplôme n'a pas de missions à
          dérouler. `--static` retire aussi la réaction au survol — un fond qui
          s'éclaircit sur quelque chose qui n'ouvre rien est une promesse non
          tenue, et il n'y a pas de `tabIndex` pour la même raison. */}
      {CV.formations.map((formation, i) => (
        <div className="job job--static" key={`${formation.school}-${formation.period}`}>
          <div className="job__head">
            <span className="job__title">
              <Scrambled
                text={t(formation.title, locale)}
                elapsed={elapsed}
                delay={cue(7 + CV.jobs.length + i)}
              />
            </span>
            <span className="job__company">{formation.school}</span>
            <span className="job__period">{formation.period}</span>
          </div>
        </div>
      ))}
    </section>
  )
}
