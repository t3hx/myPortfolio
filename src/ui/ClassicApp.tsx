import { Logo } from '@/ui/Logo'

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
  return (
    <main className="stage">
      <div className="presel classic">
        <header className="presel__head">
          <Logo />
          <p className="presel__eyebrow">Portfolio — expérience classique</p>
          <h1 className="presel__title">La version légère arrive.</h1>
        </header>
        <p className="classic__body">
          Cette page racontera la même histoire que la pièce en 3D — projets, CV, contact — en HTML
          léger et accessible. Elle est en construction.
        </p>
        {autoFallback ? (
          <p className="presel__note">
            WebGL n'est pas disponible sur cet appareil — vous avez été orienté ici automatiquement.
          </p>
        ) : (
          <button type="button" className="classic__switch" onClick={onReopen}>
            changer d'expérience
          </button>
        )}
      </div>
    </main>
  )
}
