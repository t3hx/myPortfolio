import { useEffect, useState } from 'react'
import { PROJECTS } from '@/content/projects'
import { UI } from '@/content/ui'
import { t } from '@/lib/locale'
import { useLocale } from '@/state/locale'
import { useInteraction } from '@/state/interaction'

/**
 * La fiche projet plein écran (issue #83) — le deuxième clic, enfin fermé.
 *
 * Elle recrée `docs/design/screens/03b-project.html`, dont l'anatomie vit dans
 * `docs/design/tokens.css` avec celle de la bulle et de la barre : l'app et la
 * maquette partagent une seule définition, et rien ne peut diverger en silence.
 *
 * **La classe `panel` est load-bearing.** `CameraRig` ignore toute molette dont
 * la cible est dans `.panel` — sans elle, le tour continuerait de tourner sous
 * la fiche. Le nom compte, ce n'est pas de la décoration.
 *
 * La fiche couvre la barre de menu : l'empilement `panneaux 300 > barre 200`
 * fait d'elle un modal par construction, d'où deux sorties toujours offertes,
 * `Échap` (câblé dans `CameraRig`) et le bouton de fermeture.
 */

/** Doit égaler `--t-sheet-out` de tokens.css — `tests/projectSheet.test.ts`
 *  est la seule chose qui relie les deux. */
export const SHEET_OUT_MS = 200

export function ProjectSheet() {
  const phase = useInteraction((s) => s.phase)
  const selected = useInteraction((s) => s.selectedProject)
  const closePanel = useInteraction((s) => s.closePanel)
  const locale = useLocale((s) => s.locale)

  const visible = phase === 'panel' && selected !== null

  // Démontage différé, comme la bulle : `visible` à false lance le fondu
  // (.sheet--out), le démontage suit une fois le fondu fini. Démonter tout de
  // suite emporterait la sortie avec le composant.
  const [mounted, setMounted] = useState(visible)
  useEffect(() => {
    if (visible) {
      setMounted(true)
      return
    }
    const timer = window.setTimeout(() => setMounted(false), SHEET_OUT_MS)
    return () => window.clearTimeout(timer)
  }, [visible])

  // La fiche reste lisible pendant tout son fondu de sortie sans qu'on ait à la
  // mettre en cache : `Échap` rend la phase à PARKED tout de suite, alors que
  // `selectedProject` n'est vidé qu'à l'atterrissage du dossier, 850 ms plus
  // tard. Si cet ordre changeait un jour, la fiche disparaîtrait d'un coup au
  // lieu de planter.
  const project = PROJECTS.find((p) => p.slug === selected) ?? null

  if (!mounted || !project) return null

  return (
    <section
      className={visible ? 'sheet panel' : 'sheet panel sheet--out'}
      role="dialog"
      aria-modal="true"
      aria-labelledby="sheet-title"
    >
      <div className="sheet__close">
        <span className="sheet__key">{t(UI.sheet.escape, locale)}</span>
        <button
          className="sheet__close-btn"
          type="button"
          aria-label={t(UI.sheet.close, locale)}
          onClick={closePanel}
        >
          ×
        </button>
      </div>

      <div className="sheet__inner">
        {/* Sans couverture dessinée, le placeholder hachuré EST l'illustration
            générique — même facture que la photo du CV. Une image pointée sur un
            fichier absent afficherait une icône cassée, ce qui est pire qu'un
            vide assumé. */}
        {project.cover ? (
          <img className="sheet__cover" src={project.cover} alt="" />
        ) : (
          <div className="sheet__cover">{t(UI.sheet.cover, locale)}</div>
        )}

        <div>
          <header className="sheet__kicker">
            <span className="sheet__dot" />
            <span className="sheet__label">{t(UI.sheet.kicker, locale)}</span>
          </header>

          <h1 className="sheet__title" id="sheet-title">
            {project.name}
          </h1>
          <p className="sheet__tagline">{t(project.tagline, locale)}</p>

          <div className="sheet__meta">
            <div className="sheet__meta-item">
              <span className="sheet__meta-key">{t(UI.sheet.year, locale)}</span>
              <span className="sheet__meta-value sheet__meta-value--mono">{project.year}</span>
            </div>
            <div className="sheet__meta-item">
              <span className="sheet__meta-key">{t(UI.sheet.role, locale)}</span>
              <span className="sheet__meta-value">{t(project.role, locale)}</span>
            </div>
          </div>

          <ul className="sheet__stack">
            {project.stack.map((tech) => (
              <li className="sheet__chip" key={tech}>
                {tech}
              </li>
            ))}
          </ul>

          <ul className="sheet__points">
            {t(project.highlights, locale).map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>

          {/* Une fiche sans lien n'affiche RIEN : trois des cinq dépôts sont
              privés, et un portfolio n'a pas le droit de proposer une porte
              fermée à clé — même discipline que MENU_SOCIALS. */}
          {project.links && project.links.length > 0 && (
            <div className="sheet__links">
              {project.links.map((link) => (
                <a
                  className="sheet__link"
                  key={link.href}
                  href={link.href}
                  target="_blank"
                  rel="noreferrer"
                >
                  {t(link.label, locale)}
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
