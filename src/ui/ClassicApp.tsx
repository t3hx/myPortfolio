import { useEffect, useRef, useState } from 'react'
import {
  REVEAL_BODY_MS,
  REVEAL_CHIP_BASE_MS,
  REVEAL_PROJECT_BASE_MS,
  REVEAL_STEP_CARD_MS,
  REVEAL_STEP_PROJECT_MS,
  REVEAL_STEP_TILE_MS,
  REVEAL_TILE_BASE_MS,
} from '@/config/classic'
import { CV, glyphMark } from '@/content/cv'
import { MENU_SOCIALS } from '@/content/menu'
import { PROJECTS } from '@/content/projects'
import { UI } from '@/content/ui'
import { t, tm, type Locale } from '@/lib/locale'
import { useLocale } from '@/state/locale'
import { LangToggle } from '@/ui/LangToggle'
import { EmberHalo } from '@/ui/classic/EmberHalo'
import { Hero } from '@/ui/classic/Hero'
import { SectionHead } from '@/ui/classic/SectionHead'
import { revealDelay, useReveal } from '@/ui/classic/useReveal'

/**
 * Le site classique (issue #29) — la branche non-3D de l'écran de
 * pré-sélection, et la page servie à qui n'a pas de WebGL.
 *
 * Elle recrée `design/classic/portfolio-2d.dc.html` ; la spécification qui fait
 * foi est `docs/PORTFOLIO_2D.md`, jusqu'aux timings.
 *
 * **Pur DOM, aucun import de scène, aucun contexte WebGL, jamais.** C'est la
 * propriété centrale de ce fichier et la raison d'être de l'import dynamique
 * d'`App3D` dans `App.tsx` : le visiteur qui arrive ici l'a soit demandé, soit
 * n'avait pas le choix. Le cube filaire de l'accueil est donc en CSS 3D et non
 * en react-three-fiber, malgré la préférence notée dans la spec — voir
 * `WireCube.tsx`, où la dérogation est argumentée.
 *
 * **Le contenu vient de `cv.ts` et `projects.ts`**, que la scène 3D lit aussi
 * (arbitrage du 2026-08-24). Rien de ce que cette page affiche n'est écrit
 * ici : un second parcours, recopié, aurait divergé du premier à la première
 * correction de date, sans que rien ne le dise. Ce qui est propre à la page —
 * accroche, intitulés, pied de page — vit dans `UI.classic`.
 */

/**
 * Les liens sociaux, dans l'ordre de CETTE page.
 *
 * `MENU_SOCIALS` est rangé pour la barre verticale de la scène, qui se lit de
 * haut en bas ; la spec de la page classique demande `gh · in`, de gauche à
 * droite. Ce ne sont pas deux avis sur le même ordre, ce sont deux mises en
 * page — et c'est bien la même source, simplement lue dans l'autre sens.
 *
 * Le filtre sur `href` reprend la règle de la barre : une entrée sans adresse
 * n'est pas rendue du tout. Un portfolio n'a pas le droit de montrer une porte
 * fermée à clé.
 */
const SOCIALS = [...MENU_SOCIALS].reverse().filter((social) => social.href)

/** Ce que le tour appelle « Le cap » ouvre la page en 01 : c'est la seule
 *  section dont le titre vient du contenu partagé et non de `UI.classic`. */
function Cap({ locale }: { locale: Locale }) {
  const [ref, revealed] = useReveal<HTMLElement>()
  return (
    <section className="classic-section classic-section--cap" ref={ref} data-revealed={revealed}>
      <SectionHead kicker={t(UI.classic.capKicker, locale)} title={t(CV.outlookTitle, locale)}>
        <div
          className="classic-glass classic-cap classic-reveal"
          style={revealDelay(REVEAL_BODY_MS)}
        >
          <p>{t(CV.outlook, locale)}</p>
        </div>
      </SectionHead>
    </section>
  )
}

/**
 * Une cartouche d'expérience, avec son accordéon de missions.
 *
 * **L'ouverture se fait au survol, une seule à la fois, et la dernière survolée
 * RESTE ouverte** (spec §9). C'est ce dernier point qui fait la différence :
 * refermer au départ du curseur oblige à garder la souris immobile pour lire,
 * ce qui transforme la lecture en exercice d'adresse. Ici on survole, on
 * s'éloigne, on lit.
 *
 * Le survol n'ouvre rien sur une formation, et c'est pourquoi ce composant ne
 * sert qu'aux expériences : un diplôme n'a pas de missions à dérouler, et lui
 * donner une réaction serait une promesse non tenue.
 *
 * **La cartouche n'est PAS focalisable.** Un `tabIndex` dessus aurait mis
 * quatre arrêts dans l'ordre de tabulation qui n'annoncent rien et n'ouvrent
 * rien sous Entrée — un faux bouton coûte plus cher qu'une absence de bouton.
 * Les missions sont dans le DOM quoi qu'il arrive : on les atteint en lisant,
 * pas en ouvrant. Le vrai composant à divulgation est une décision
 * d'accessibilité à part entière (#49), pas un effet de bord de cette page.
 */
function ExperienceCards({ locale }: { locale: Locale }) {
  const [ref, revealed] = useReveal<HTMLDivElement>()
  const [open, setOpen] = useState(0)

  return (
    <div className="classic-cards classic-cards--exp" ref={ref} data-revealed={revealed}>
      {CV.jobs.map((job, i) => (
        <article
          key={`${job.company}-${job.period}`}
          className={`classic-glass classic-card classic-card--exp classic-reveal${
            open === i ? ' classic-card--open' : ''
          }`}
          style={revealDelay(i * REVEAL_STEP_CARD_MS)}
          // Un poste sans mission n'ouvre rien : le survol ne doit donc pas le
          // désigner comme la cartouche ouverte, sinon il referme la
          // précédente pour n'afficher que du vide.
          onMouseEnter={() => job.missions && setOpen(i)}
        >
          <div className="classic-card__head">
            <div>
              <div className="classic-card__title">{t(job.title, locale)}</div>
              <div className="classic-card__org">{job.company}</div>
            </div>
            <div className="classic-card__period">{job.period}</div>
          </div>
          {job.clients && (
            <p className="classic-card__clients">
              <span>{t(CV.clientsLabel, locale)}</span> {tm(job.clients, locale)}
            </p>
          )}
          {/* TOUTES les missions, contrairement à l'écran vertical de la scène
              qui s'arrête à quatre (#173) : cette page a la hauteur pour
              elles, et la donnée les porte déjà. */}
          {job.missions && (
            <div className="classic-card__missions">
              <div>
                <ul className="classic-card__list">
                  {t(job.missions, locale).map((mission) => (
                    <li key={mission}>
                      <i aria-hidden="true" />
                      <span>{mission}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </article>
      ))}
    </div>
  )
}

function Skills({ locale }: { locale: Locale }) {
  const [ref, revealed] = useReveal<HTMLDivElement>()
  return (
    <div ref={ref} data-revealed={revealed}>
      <div className="classic-sub classic-reveal">{t(CV.skillsTitle, locale)}</div>
      <div className="classic-tiles">
        {CV.skills.map((skill, i) => {
          const name = tm(skill.name, locale)
          return (
            <div
              className="classic-tile classic-reveal"
              key={name}
              style={revealDelay(REVEAL_TILE_BASE_MS + i * REVEAL_STEP_TILE_MS)}
            >
              <span className="classic-tile__mark" aria-hidden="true">
                {skill.icon ? <img src={skill.icon} alt="" /> : glyphMark(skill, locale)}
              </span>
              <span className="classic-tile__label">{name}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Traits({ locale }: { locale: Locale }) {
  const [ref, revealed] = useReveal<HTMLDivElement>()
  return (
    <div ref={ref} data-revealed={revealed}>
      <div className="classic-sub classic-reveal">{t(CV.traitsTitle, locale)}</div>
      <div className="classic-chips">
        {CV.traits.map((trait, i) => {
          const name = tm(trait.name, locale)
          return (
            <span
              className="classic-chip classic-reveal"
              key={name}
              style={revealDelay(REVEAL_CHIP_BASE_MS + i * REVEAL_STEP_TILE_MS)}
            >
              {name}
            </span>
          )
        })}
      </div>
    </div>
  )
}

/**
 * Le CV, et le seul écran de la page qui compte QUATRE groupes de révélation.
 *
 * **La `<section>` n'en est pas un, et c'est la correction du 2026-08-24.**
 * Elle l'a été, et le résultat était qu'on ne voyait plus aucune cascade : le
 * CSS révèle par `[data-revealed='true'] .classic-reveal`, un sélecteur de
 * DESCENDANCE, qui traverse donc les groupes imbriqués. Les cartouches, les
 * vignettes et les puces s'allumaient toutes avec l'en-tête, mille cinq cents
 * pixels avant qu'on les atteigne — mesuré : au moment où on y arrivait, tout
 * était joué depuis longtemps.
 *
 * **Un groupe de révélation ne doit jamais en contenir un autre.**
 * `useReveal` le signale en développement plutôt que de laisser le défaut
 * réapparaître en silence : il ne se voit pas dans le DOM, il ne se voit qu'en
 * défilant, et une cascade qu'on rate se lit comme une absence d'animation, pas
 * comme un bug.
 */
function CvSection({ locale }: { locale: Locale }) {
  const [ref, revealed] = useReveal<HTMLDivElement>()
  return (
    <section className="classic-section">
      <div ref={ref} data-revealed={revealed}>
        <SectionHead
          kicker={t(UI.classic.cvKicker, locale)}
          title={t(UI.classic.cvTitle, locale)}
        />
        <div className="classic-sub classic-reveal" style={revealDelay(REVEAL_BODY_MS)}>
          {t(CV.jobsTitle, locale)}
        </div>
      </div>
      {/* Trois groupes frères, et frères par nécessité : ils occupent trois
          hauteurs d'écran et chacun doit s'allumer quand on l'atteint. */}
      <ExperienceCards locale={locale} />
      <Skills locale={locale} />
      <Traits locale={locale} />
    </section>
  )
}

/**
 * Les projets. Ils viennent de `projects.ts` — les mêmes que les dossiers de la
 * commode, avec les mêmes phrases.
 *
 * La couverture manquante affiche le cadre hachuré et son étiquette, jamais une
 * `<img>` pointée sur un fichier absent : une icône cassée est pire qu'un vide
 * assumé, et c'est la donnée qui décide. Même discipline que la fiche projet de
 * la scène et que la photo du CV.
 */
function Projects({ locale }: { locale: Locale }) {
  const [ref, revealed] = useReveal<HTMLElement>()
  return (
    <section className="classic-section" ref={ref} data-revealed={revealed}>
      <SectionHead
        kicker={t(UI.classic.projKicker, locale)}
        title={t(UI.classic.projTitle, locale)}
      >
        <div className="classic-projects">
          {PROJECTS.map((project, i) => (
            <article
              key={project.slug}
              className="classic-glass classic-project classic-reveal"
              style={revealDelay(REVEAL_PROJECT_BASE_MS + i * REVEAL_STEP_PROJECT_MS)}
            >
              <div className="classic-project__cover">
                {project.cover ? (
                  <img src={project.cover} alt="" />
                ) : (
                  t(UI.classic.coverLabel, locale)
                )}
              </div>
              <div className="classic-project__body">
                <div className="classic-project__year">{project.year}</div>
                <h3 className="classic-project__title">{project.name}</h3>
                <p className="classic-project__phrase">{t(project.tagline, locale)}</p>
                <div className="classic-project__stack">{project.stack.join(' · ')}</div>
                {project.links && (
                  <div className="classic-project__links">
                    {project.links.map((link) => (
                      <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer">
                        {t(link.label, locale)} ↗
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      </SectionHead>
    </section>
  )
}

function Formations({ locale }: { locale: Locale }) {
  const [ref, revealed] = useReveal<HTMLElement>()
  return (
    <section className="classic-section classic-section--form" ref={ref} data-revealed={revealed}>
      <SectionHead kicker={t(UI.classic.formKicker, locale)} title={t(CV.formationsTitle, locale)}>
        <div className="classic-cards">
          {CV.formations.map((formation, i) => (
            <article
              key={`${formation.school}-${formation.period}`}
              className="classic-glass classic-card classic-reveal"
              style={revealDelay(REVEAL_PROJECT_BASE_MS + i * REVEAL_STEP_CARD_MS)}
            >
              <div className="classic-card__head">
                <div>
                  <div className="classic-card__title">{t(formation.title, locale)}</div>
                  <div className="classic-card__org">{formation.school}</div>
                </div>
                <div className="classic-card__period">{formation.period}</div>
              </div>
            </article>
          ))}
        </div>
      </SectionHead>
    </section>
  )
}

/**
 * Le mini-nom collant (spec §8).
 *
 * **L'observateur porte sur le `h1`, jamais sur la section.** L'accueil fait
 * 100vh : sa section sort de l'écran bien après son titre, et le relais
 * arriverait deux écrans trop tard — juste avant « Le cap », c'est-à-dire au
 * moment où plus personne ne cherche le nom.
 */
function MiniName({ locale }: { locale: Locale }) {
  const [on, setOn] = useState(false)

  useEffect(() => {
    const name = document.querySelector('.classic-hero__name')
    if (!name) return
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) setOn(!entry.isIntersecting)
    })
    io.observe(name)
    return () => io.disconnect()
  }, [])

  return (
    <div className="classic-mini" data-on={on} aria-label={t(UI.classic.region, locale)}>
      <span className="classic-dot" style={{ width: 6, height: 6 }} aria-hidden="true" />
      <span>{CV.identity.name.toUpperCase()}</span>
    </div>
  )
}

export function ClassicApp({
  autoFallback,
  onReopen,
}: {
  /** Vrai quand on a été routé ici faute de WebGL — pas par choix. */
  autoFallback: boolean
  /** Rouvre l'écran de pré-sélection (efface le choix mémorisé). */
  onReopen: () => void
}) {
  const locale = useLocale((s) => s.locale)
  const page = useRef<HTMLDivElement>(null)

  return (
    <div className="classic-page" ref={page}>
      <EmberHalo />

      <header className="classic-top">
        {SOCIALS.map((social) => (
          <a
            key={social.label}
            className="classic-top__link"
            href={social.href}
            title={social.title}
            target="_blank"
            rel="noopener noreferrer"
          >
            {social.label}
          </a>
        ))}
        <LangToggle />
      </header>

      <MiniName locale={locale} />

      {/* Non collante, par décision de la session design : elle défile avec la
          page. Une photo qui suit le regard sur toute la hauteur d'un CV se
          transforme en surveillance ; ici elle salue, puis laisse la place. */}
      <div className="classic-photo">
        {CV.identity.photo ? (
          <img src={CV.identity.photo} alt={t(CV.identity.alt, locale)} />
        ) : (
          t(UI.cv.photo, locale)
        )}
      </div>

      <main>
        <Hero locale={locale} />
        <Cap locale={locale} />
        <CvSection locale={locale} />
        <Projects locale={locale} />
        <Formations locale={locale} />
      </main>

      <footer className="classic-foot">
        <div className="classic-foot__rule" />
        <div className="classic-foot__row">
          <span className="classic-foot__note">{t(UI.classic.footNote, locale)}</span>
          <div className="classic-foot__links">
            {SOCIALS.map((social) => (
              <a key={social.href} href={social.href} target="_blank" rel="noopener noreferrer">
                {/* L'adresse nue, comme dans la maquette : `www.` est du
                    protocole, pas du nom — et il déséquilibre la paire. */}
                {social.href.replace(/^https?:\/\/(www\.)?/, '')}
              </a>
            ))}
          </div>
        </div>
        {/* La sortie vers la 3D est en PIED de page, pas en tête : le visiteur a
            déjà choisi, et une page qui passe son temps à proposer autre chose
            n'assume pas ce qu'elle montre. Quand WebGL manque, il n'y a rien à
            proposer — seulement à expliquer pourquoi on est ici. */}
        <p className="classic-foot__note" style={{ marginTop: 18 }}>
          {autoFallback ? (
            t(UI.classic.noWebgl, locale)
          ) : (
            <button type="button" className="classic-foot__switch" onClick={onReopen}>
              {t(UI.classic.switch, locale)}
            </button>
          )}
        </p>
      </footer>
    </div>
  )
}
