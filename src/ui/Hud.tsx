import { CAMERA_STOPS } from '@/config/cameraStops'
import { useInteraction } from '@/state/interaction'

/**
 * Diagnostic overlay for the spike. Root is pointer-events:none; only the
 * interactive islands (rail, buttons, panel) re-enable pointer events, so
 * wheel everywhere else falls through to the hidden ScrollControls scroller.
 */
export function Hud() {
  const phase = useInteraction((s) => s.phase)
  const stopIndex = useInteraction((s) => s.stopIndex)
  const ready = useInteraction((s) => s.ready)
  const requestStop = useInteraction((s) => s.requestStop)
  const openPanel = useInteraction((s) => s.openPanel)
  const closePanel = useInteraction((s) => s.closePanel)
  const enterTelescope = useInteraction((s) => s.enterTelescope)
  const exitTelescope = useInteraction((s) => s.exitTelescope)

  const stop = CAMERA_STOPS[stopIndex]

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

          <nav className="rail" aria-label="Camera stops">
            {CAMERA_STOPS.map((s, i) => (
              <button
                key={s.camera}
                type="button"
                className={i === stopIndex ? 'active' : ''}
                title={s.label}
                onClick={() => requestStop(i)}
              >
                <span className="dot" />
                <span className="rail-label">{s.label}</span>
              </button>
            ))}
          </nav>

          <div className="actions">
            {(phase === 'touring' || phase === 'parked') && (
              <>
                <button type="button" onClick={openPanel}>
                  Open panel
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

          {phase === 'panel' && (
            <aside className="panel" role="dialog" aria-label="Demo project panel">
              <header>
                <h2>Demo project panel</h2>
                <button type="button" onClick={closePanel}>
                  Close (Esc)
                </button>
              </header>
              <div className="panel-body">
                <p>
                  This panel exists to validate risk point #2: while it is open, the wheel belongs
                  to THIS scroll area — the camera must not move.
                </p>
                {Array.from({ length: 24 }, (_, i) => (
                  <p key={i}>
                    Scrollable filler block {i + 1}. Keep wheeling: if the room behind you starts
                    touring, the input routing is broken and the spike fails.
                  </p>
                ))}
                <p className="panel-end">— end of panel content —</p>
              </div>
            </aside>
          )}
        </>
      )}
    </div>
  )
}
