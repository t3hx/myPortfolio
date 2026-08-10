import type { ExperienceChoice } from '@/lib/experienceChoice'
import { Logo } from '@/ui/Logo'

/**
 * Écran 0a — pré-sélection 3D / classique (issue #24). Recréé depuis la
 * maquette de référence `docs/design/screens/0a-preselection.html` ; les
 * styles `.presel*` vivent dans `styles.css`, les tokens et les composants
 * `.bubble__*` viennent de `docs/design/tokens.css`.
 *
 * Pur DOM : aucun import de scène, aucun canvas — cet écran doit peser
 * quelques Ko là où l'expérience 3D en pèse des milliers.
 */
export function Preselection({ onChoose }: { onChoose: (choice: ExperienceChoice) => void }) {
  return (
    <main className="stage">
      <div className="presel">
        <header className="presel__head">
          <Logo />
          <p className="presel__eyebrow">Portfolio — la visite d'une pièce</p>
          <h1 className="presel__title">Comment souhaitez-vous visiter&nbsp;?</h1>
        </header>
        <div className="presel__cards">
          {/* autoFocus : Entrée = 3D (la carte vedette), Tab puis Entrée = classique.
              Le halo n'est plus porté d'office : il s'allume au survol/focus et
              respire (décision du 2026-08-10, remplace le « halo d'office »). */}
          <button
            type="button"
            className="presel-card"
            autoFocus
            onClick={() => onChoose('3d')}
          >
            <span className="bubble__kicker">
              <span className="bubble__dot" />
              <span className="bubble__label presel-card__label--lit">Expérience 3D</span>
            </span>
            <p className="bubble__text">
              Entrez dans la pièce — la caméra vous guide d'objet en objet, au fil de la
              molette.
            </p>
            <span className="presel-card__meta">WebGL · ~3 Mo · souris, tactile ou clavier</span>
          </button>
          <button type="button" className="presel-card" onClick={() => onChoose('classic')}>
            <span className="bubble__kicker">
              <span className="bubble__dot presel-card__dot--muted" />
              <span className="bubble__label">Expérience classique</span>
            </span>
            <p className="bubble__text">
              La même histoire, en une page légère — idéale en déplacement ou au lecteur
              d'écran.
            </p>
            <span className="presel-card__meta">HTML · instantané · accessible</span>
          </button>
        </div>
        <p className="presel__note">votre choix est mémorisé — modifiable à tout moment depuis le menu</p>
      </div>
    </main>
  )
}
