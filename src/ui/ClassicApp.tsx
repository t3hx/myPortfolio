import { Logo } from '@/ui/Logo'
import { UI } from '@/content/ui'
import { t } from '@/lib/locale'
import { useLocale } from '@/state/locale'

/**
 * Version classique — pour l'instant un échafaudage honnête : la vraie page 2D
 * est une issue à part (voir #24, « la version 2D elle-même est une autre
 * issue : ici, seul l'aiguillage »). Ce composant matérialise la route : pur
 * DOM, aucun import de scène, aucun contexte WebGL, jamais.
 */
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

  return (
    <main className="stage">
      <div className="presel classic">
        <header className="presel__head">
          <Logo />
          <p className="presel__eyebrow">{t(UI.classic.eyebrow, locale)}</p>
          <h1 className="presel__title">{t(UI.classic.title, locale)}</h1>
        </header>
        <p className="classic__body">{t(UI.classic.body, locale)}</p>
        {autoFallback ? (
          <p className="presel__note">{t(UI.classic.noWebgl, locale)}</p>
        ) : (
          <button type="button" className="classic__switch" onClick={onReopen}>
            {t(UI.classic.switch, locale)}
          </button>
        )}
      </div>
    </main>
  )
}
