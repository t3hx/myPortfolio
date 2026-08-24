import { useState } from 'react'
import type { ExperienceChoice } from '@/lib/experienceChoice'
import { LangToggle } from '@/ui/LangToggle'
import { Logo } from '@/ui/Logo'
import { UI } from '@/content/ui'
import { t, type Locale } from '@/lib/locale'
import { useLocale } from '@/state/locale'

/**
 * Écran 0a — pré-sélection 3D / classique (issue #24). Recréé depuis la
 * maquette de référence `design/screens/0a-preselection.html` ; les
 * styles `.presel*` vivent dans `styles.css`, les tokens et les composants
 * `.bubble__*` viennent de `src/styles/tokens.css`.
 *
 * Pur DOM : aucun import de scène, aucun canvas — cet écran doit peser
 * quelques Ko là où l'expérience 3D en pèse des milliers.
 *
 * **Une seule carte est mise en avant à la fois, et c'est de l'état, pas du
 * CSS** (2026-08-25). Le halo était porté par `:hover` ET par
 * `:focus-visible` : `autoFocus` posant le focus sur la carte 3D dès le
 * chargement, survoler la seconde en allumait deux — un écran qui pose une
 * question en montrant deux réponses cochées. Deux règles indépendantes ne
 * peuvent pas s'exclure ; une variable, si.
 *
 * La 3D reste la vedette par défaut, et le survol la lui PREND : la carte
 * quittée s'éteint, celle qu'on désigne s'allume. Quitter les deux rend la
 * vedette à la 3D plutôt que d'éteindre tout — cet écran recommande, il ne se
 * contente pas de proposer.
 */
export function Preselection({ onChoose }: { onChoose: (choice: ExperienceChoice) => void }) {
  const locale = useLocale((s) => s.locale)
  const [featured, setFeatured] = useState<ExperienceChoice>('3d')

  return (
    <main className="stage">
      {/* La langue se choisit AVANT l'expérience, et cet écran était le seul à
          ne pas le permettre : on y arrivait dans la langue devinée par le
          navigateur, on lisait la question et les deux promesses dans cette
          langue, et on ne pouvait en changer qu'après s'être engagé. Le choix
          se propage tout seul aux deux portfolios — `useLocale` est un store
          global et mémorisé, personne n'a à le transporter. */}
      <LangToggle className="presel__lang" />
      <div className="presel">
        <header className="presel__head">
          <Logo className="presel__logo" />
          <p className="presel__eyebrow">{t(UI.preselection.eyebrow, locale)}</p>
          <h1 className="presel__title">{t(UI.preselection.title, locale)}</h1>
        </header>
        {/* Sortir des DEUX cartes rend la vedette à la 3D. Le rendre au niveau
            du groupe et non de chaque carte évite le clignotement en passant de
            l'une à l'autre : le curseur ne quitte jamais le groupe. */}
        <div className="presel__cards" onPointerLeave={() => setFeatured('3d')}>
          <Card
            choice="3d"
            featured={featured === '3d'}
            onFeature={setFeatured}
            onChoose={onChoose}
            locale={locale}
            label={UI.preselection.three}
            body={UI.preselection.threeBody}
            meta={UI.preselection.threeMeta}
            /* autoFocus : Entrée = 3D (la carte vedette), Tab puis Entrée = classique. */
            autoFocus
          />
          <Card
            choice="classic"
            featured={featured === 'classic'}
            onFeature={setFeatured}
            onChoose={onChoose}
            locale={locale}
            label={UI.preselection.classic}
            body={UI.preselection.classicBody}
            meta={UI.preselection.classicMeta}
          />
        </div>
        <p className="presel__note">{t(UI.preselection.note, locale)}</p>
      </div>
    </main>
  )
}

function Card({
  choice,
  featured,
  onFeature,
  onChoose,
  locale,
  label,
  body,
  meta,
  autoFocus,
}: {
  choice: ExperienceChoice
  featured: boolean
  onFeature: (choice: ExperienceChoice) => void
  onChoose: (choice: ExperienceChoice) => void
  locale: Locale
  label: { fr: string; en: string }
  body: { fr: string; en: string }
  meta: { fr: string; en: string }
  autoFocus?: boolean
}) {
  return (
    <button
      type="button"
      className={featured ? 'presel-card presel-card--lit' : 'presel-card'}
      autoFocus={autoFocus}
      onPointerEnter={() => onFeature(choice)}
      // Le focus met en avant comme le survol : au clavier, la carte qu'on
      // atteint par Tab doit s'allumer, sinon on tabule à l'aveugle — le halo
      // est le seul indicateur, `:focus-visible` posant `outline: none`.
      onFocus={() => onFeature(choice)}
      onClick={() => onChoose(choice)}
    >
      <span className="bubble__kicker">
        <span className={featured ? 'bubble__dot' : 'bubble__dot presel-card__dot--muted'} />
        <span className={featured ? 'bubble__label presel-card__label--lit' : 'bubble__label'}>
          {t(label, locale)}
        </span>
      </span>
      <p className="bubble__text">{t(body, locale)}</p>
      {/* Le faisceau du design system, sur la ligne technique de la carte mise
          en avant. La classe est POSÉE et RETIRÉE par React : c'est ce qui le
          rejoue à chaque changement de vedette, là où une animation laissée en
          place ne passerait qu'une fois pour toute la visite. La clé force le
          remontage, sans quoi React réutilise le nœud et le navigateur ne voit
          pas de nouvelle animation quand la classe revient dans la même image. */}
      <span
        key={featured ? 'lit' : 'dim'}
        className={featured ? 'presel-card__meta beam' : 'presel-card__meta'}
      >
        {t(meta, locale)}
      </span>
    </button>
  )
}
