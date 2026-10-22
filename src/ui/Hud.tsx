import { CAMERA_STOPS } from '@/config/cameraStops'
import { PROJECTS } from '@/content/projects'
import { useInteraction } from '@/state/interaction'

/** Le projet que le raccourci de mise en page ouvre. */
const DEBUG_PROJECT = 'owlog'

/**
 * L'outillage de diagnostic, derrière `?debug` (`viewMode === 'tour'`).
 *
 * La racine ne prend AUCUN événement ; seules les îles interactives les
 * rallument, pour que la molette passe partout ailleurs jusqu'au tour. Un
 * bouton posé hors d'une île ne serait pas cliquable.
 *
 * Il est en anglais, seul écran du site à l'être : c'est de l'outillage, jamais
 * servi à un visiteur, et le passer par le système de traduction ferait
 * traduire des mots qui ne s'adressent à personne.
 *
 * **Tout y vit dans le coin bas-gauche, en une colonne.** Le rail d'arrêts était
 * une colonne de pastilles collée au bord droit, à `z-index: 200` — celui de la
 * barre de menu, qu'il recouvrait pixel pour pixel. Deux navigations au même
 * endroit, dont une seule est le produit. Les arrêts sont maintenant une liste
 * déroulante rangée avec les autres boutons.
 */
export function Hud() {
  const phase = useInteraction((s) => s.phase)
  const stopIndex = useInteraction((s) => s.stopIndex)
  const ready = useInteraction((s) => s.ready)
  const requestStop = useInteraction((s) => s.requestStop)
  const openPanel = useInteraction((s) => s.openPanel)
  const selectProject = useInteraction((s) => s.selectProject)
  const enterTelescope = useInteraction((s) => s.enterTelescope)
  const exitTelescope = useInteraction((s) => s.exitTelescope)
  const replayIntro = useInteraction((s) => s.replayIntro)

  const stop = CAMERA_STOPS[stopIndex]
  const touring = phase === 'touring' || phase === 'parked'

  /**
   * Le raccourci de mise en page : la fiche projet, dépliée, sans le vol du
   * dossier. Elle s'ouvre normalement au bout d'un vol de 850 ms depuis le
   * tiroir de la commode, ce qui oblige à traverser le tour et à viser un
   * dossier pour relire une ligne de la fiche. Ici on écrit directement les
   * deux états dont elle dépend — le projet choisi et la phase PANEL — sans
   * toucher au tiroir, qui n'a jamais possédé de routage d'entrée.
   *
   * `Échap` la ferme comme d'habitude (câblé dans `CameraRig`) : le vol de
   * retour n'a rien à annuler puisqu'il n'y en a pas eu.
   */
  const openProjectSheet = () => {
    selectProject(DEBUG_PROJECT)
    openPanel()
  }

  return (
    <div className="hud">
      {ready && (
        <>
          <div className="status">
            <span className={`phase phase-${phase}`}>{phase.toUpperCase()}</span>
            <span className="stop-label">
              {stopIndex + 1}/{CAMERA_STOPS.length} — {stop?.label}
            </span>
          </div>

          <div className="actions actions--intro">
            <button type="button" onClick={replayIntro}>
              Replay intro
            </button>

            {/* La liste déroulante des arrêts. `value` suit l'arrêt courant :
                un saut demandé ailleurs — la barre de menu, une flèche — doit
                s'y lire, sinon elle raconte le dernier saut qu'elle a émis. */}
            <label className="picker">
              Stop
              <select value={stopIndex} onChange={(e) => requestStop(Number(e.target.value))}>
                {CAMERA_STOPS.map((s, i) => (
                  <option key={s.camera} value={i}>
                    {i + 1}. {s.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="actions">
            {touring && (
              <>
                <button type="button" onClick={openProjectSheet}>
                  Project sheet ({PROJECTS.find((p) => p.slug === DEBUG_PROJECT)?.slug})
                </button>
                <button type="button" onClick={enterTelescope}>
                  Telescope view
                </button>
              </>
            )}
            {phase === 'telescope' && (
              <button type="button" onClick={exitTelescope}>
                Leave telescope (Esc)
              </button>
            )}
          </div>

          <p className="hint">
            Scroll to tour · ↑↓/PageUp-Dn stop by stop · click the telescope · Esc closes
          </p>
        </>
      )}
    </div>
  )
}
