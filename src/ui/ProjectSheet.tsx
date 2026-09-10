import { type CSSProperties, useEffect, useState } from 'react'
import { PROJECTS } from '@/content/projects'
import { UI } from '@/content/ui'
import { t } from '@/lib/locale'
import { projectMedia, showsStrip, thumbSrc } from '@/lib/projectMedia'
import { useLocale } from '@/state/locale'
import { useInteraction } from '@/state/interaction'

/**
 * La fiche projet plein écran (issue #83, réagencée par #126).
 *
 * Elle recrée `design/screens/03b-project.html`, dont l'anatomie vit dans
 * `src/styles/tokens.css` avec celle de la bulle et de la barre : l'app et la
 * maquette partagent une seule définition, et rien ne peut diverger en silence.
 *
 * **Elle montre d'abord CE QUE LE PROJET FAIT** — une vidéo qu'on lit, des
 * captures qu'on regarde — et dit ensuite ce qu'il est. La composition de la
 * session design du 2026-08-10 donnait la colonne fluide au texte et 300 px à
 * une illustration ; elle avait été dessinée avant qu'on sache ce qu'un projet
 * aurait vraiment à montrer. Rien de ce qu'elle disait n'a disparu.
 *
 * **La classe `panel` est load-bearing.** `CameraRig` ignore toute molette dont
 * la cible est dans `.panel` — sans elle, le tour continuerait de tourner sous
 * la fiche. Le nom compte, ce n'est pas de la décoration ; c'est aussi ce qui
 * fait défiler la colonne de texte sans une ligne de câblage.
 *
 * La fiche couvre la barre de menu : l'empilement `panneaux 300 > barre 200`
 * fait d'elle un modal par construction, d'où deux sorties toujours offertes,
 * `Échap` (câblé dans `CameraRig`, sur `window`) et le bouton de fermeture.
 * Aucun gestionnaire de clavier ici : ce serait le seul moyen d'avaler la
 * touche, et la visionneuse n'a pas le droit de fermer la seule issue.
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

  // Le média regardé. Il repart à zéro quand la fiche change de projet : la
  // troisième capture d'Owlog n'a rien à voir avec la troisième de Solarsys, et
  // rouvrir une fiche sur la vue qu'on regardait dans une AUTRE serait un état
  // que personne n'a demandé.
  const [active, setActive] = useState(0)
  useEffect(() => setActive(0), [selected])

  // La fiche reste lisible pendant tout son fondu de sortie sans qu'on ait à la
  // mettre en cache : `Échap` rend la phase à PARKED tout de suite, alors que
  // `selectedProject` n'est vidé qu'à l'atterrissage du dossier, 850 ms plus
  // tard. Si cet ordre changeait un jour, la fiche disparaîtrait d'un coup au
  // lieu de planter.
  const project = PROJECTS.find((p) => p.slug === selected) ?? null

  if (!mounted || !project) return null

  const media = projectMedia(project)
  // Borné EN PLUS de la remise à zéro : un effet ne s'exécute qu'après le
  // rendu, donc `active` survit une image au changement de projet. Sans cette
  // borne, une fiche ouverte sur sa quatrième capture en montrerait une vide
  // le temps d'une image en passant à un projet qui n'en a que deux.
  const shown = media[Math.min(active, media.length - 1)]

  return (
    <section
      className={visible ? 'sheet panel' : 'sheet panel sheet--out'}
      role="dialog"
      aria-modal="true"
      aria-labelledby="sheet-title"
    >
      <div className="sheet__close">
        {/* La touche montrait ce qu'il fallait presser sans dire ce que ça
            faisait, là où la visée du télescope, elle, le disait (#136). Deux
            écrans qui se ferment pareil doivent le dire pareil. */}
        <span className="sheet__key sheet__key--cue">
          <span className="cue" style={{ '--cue-delay': 'var(--t-sheet-in)' } as CSSProperties}>
            {t(UI.sheet.escape, locale)}
          </span>
        </span>
        {/* Une CONSIGNE, au sens de #129 : elle demande un geste, donc elle
            porte l'accent et le balayage repasse — le traitement de « défiler »
            sur le site classique, pas celui d'une phrase qui raconte. */}
        <span
          className="sheet__exit cue"
          style={{ '--cue-delay': 'var(--t-sheet-in)' } as CSSProperties}
        >
          {t(UI.sheet.exit, locale)}
        </span>
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
        <div className="sheet__media">
          {/* La scène ne montre QU'UN média à la fois, et son repli descend
              trois marches : le média choisi, sinon l'illustration fixe de la
              fiche, sinon le placeholder hachuré. Aucune n'est un état
              d'erreur — même règle que les icônes du CV, aucun `onError` n'est
              câblé, c'est la donnée qui décide. */}
          <div className="sheet__stage">
            {shown?.kind === 'video' ? (
              // `preload="none"` : aucun octet ne part avant le clic. C'est ce
              // qui rend la vidéo gratuite pour qui ne la regarde pas — sur
              // cinq fiches, la simple ouverture du tiroir coûterait sinon
              // plusieurs mégaoctets que personne n'a demandés.
              //
              // Les contrôles sont ceux du navigateur, et c'est délibéré : ils
              // affichent déjà un grand bouton de lecture sur l'affiche, ils
              // savent le plein écran, la barre de progression et le son. Un
              // lecteur maison redessinerait tout ça moins bien.
              //
              // La clé force le remontage au changement de média : passer à une
              // capture arrête la lecture, plutôt que de laisser un son
              // continuer derrière une image fixe.
              <video
                key={shown.src}
                className="sheet__player"
                src={shown.src}
                poster={shown.poster}
                preload="none"
                controls
                playsInline
                aria-label={t(shown.alt, locale)}
              />
            ) : shown ? (
              <img className="sheet__shot" src={shown.src} alt={t(shown.alt, locale)} />
            ) : project.cover ? (
              <img className="sheet__shot" src={project.cover} alt="" />
            ) : (
              <div className="sheet__cover">{t(UI.sheet.cover, locale)}</div>
            )}
          </div>

          {/* La légende porte le texte de l'`alt` : une seule phrase, écrite une
              seule fois, lue par l'œil comme par le lecteur d'écran. */}
          {shown && <p className="sheet__caption">{t(shown.alt, locale)}</p>}

          {showsStrip(media) && (
            <ul className="sheet__strip" aria-label={t(UI.sheet.media, locale)}>
              {media.map((item, i) => {
                const thumb = thumbSrc(item)
                return (
                  <li key={item.src}>
                    <button
                      className="sheet__thumb"
                      type="button"
                      aria-current={i === Math.min(active, media.length - 1)}
                      aria-label={
                        item.kind === 'video'
                          ? `${t(UI.sheet.video, locale)} — ${t(item.alt, locale)}`
                          : t(item.alt, locale)
                      }
                      onClick={() => setActive(i)}
                    >
                      {thumb ? (
                        <img src={thumb} alt="" />
                      ) : (
                        <span className="sheet__thumb-index">{i + 1}</span>
                      )}
                      {item.kind === 'video' && (
                        <span className="sheet__thumb-play" aria-hidden="true">
                          ▶
                        </span>
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="sheet__body">
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
