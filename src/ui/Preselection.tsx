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
 * La vedette par défaut est la carte que l'écran RECOMMANDE, et le survol la
 * lui prend : la carte quittée s'éteint, celle qu'on désigne s'allume. Quitter
 * les deux rend la vedette à la recommandation plutôt que d'éteindre tout —
 * cet écran recommande, il ne se contente pas de proposer. La 3D est la
 * recommandation… sauf sur un appareil à pointeur coarse (#186), où elle est
 * désactivée : recommander une carte qu'on ne peut pas choisir serait pire
 * que deux halos.
 */
export function Preselection({
  onChoose,
  threeDisabled = false,
}: {
  onChoose: (choice: ExperienceChoice) => void
  /** Pointeur coarse (#186) : la 3D se montre mais ne se choisit pas. */
  threeDisabled?: boolean
}) {
  const locale = useLocale((s) => s.locale)
  const recommended: ExperienceChoice = threeDisabled ? 'classic' : '3d'
  const [featured, setFeatured] = useState<ExperienceChoice>(recommended)

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
        {/* Sortir des DEUX cartes rend la vedette à la recommandation. Le
            rendre au niveau du groupe et non de chaque carte évite le
            clignotement en passant de l'une à l'autre : le curseur ne quitte
            jamais le groupe. */}
        <div className="presel__cards" onPointerLeave={() => setFeatured(recommended)}>
          <Card
            choice="3d"
            featured={featured === '3d'}
            disabled={threeDisabled}
            onFeature={setFeatured}
            onChoose={onChoose}
            locale={locale}
            label={UI.preselection.three}
            body={UI.preselection.threeBody}
            /* Désactivée, la ligne technique cède sa place à l'explication :
               « souris, tactile ou clavier » serait exactement la promesse que
               la carte vient de refuser. */
            meta={threeDisabled ? UI.preselection.threeOff : UI.preselection.threeMeta}
            /* autoFocus : Entrée = la carte vedette. */
            autoFocus={!threeDisabled}
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
            autoFocus={threeDisabled}
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
  disabled = false,
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
  disabled?: boolean
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
      className={
        disabled
          ? 'presel-card presel-card--off'
          : featured
            ? 'presel-card presel-card--lit'
            : 'presel-card'
      }
      /* `aria-disabled`, jamais `disabled` : un bouton `disabled` sort de
         l'ordre de tabulation et un lecteur d'écran n'atteint plus son
         explication — or l'explication EST le contenu utile de cette carte. */
      aria-disabled={disabled || undefined}
      autoFocus={autoFocus}
      onPointerEnter={disabled ? undefined : () => onFeature(choice)}
      // Le focus met en avant comme le survol : au clavier, la carte qu'on
      // atteint par Tab doit s'allumer, sinon on tabule à l'aveugle — le halo
      // est le seul indicateur, `:focus-visible` posant `outline: none`.
      onFocus={disabled ? undefined : () => onFeature(choice)}
      onClick={disabled ? undefined : () => onChoose(choice)}
    >
      <span className="bubble__kicker">
        <span
          className={featured && !disabled ? 'bubble__dot' : 'bubble__dot presel-card__dot--muted'}
        />
        <span
          className={
            featured && !disabled ? 'bubble__label presel-card__label--lit' : 'bubble__label'
          }
        >
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
        key={featured && !disabled ? 'lit' : 'dim'}
        className={featured && !disabled ? 'presel-card__meta beam' : 'presel-card__meta'}
      >
        {t(meta, locale)}
      </span>
    </button>
  )
}
