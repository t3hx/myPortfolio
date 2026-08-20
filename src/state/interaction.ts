import { create } from 'zustand'

/**
 * The interaction state machine locked in the design doc (eng-review issue 10):
 *
 *             scroll                    click interactive object / HUD
 *   TOURING ◄────────► PARKED ────────────────┬──────────────┐
 *   (scroll = tour)    (at a stop, raycast    ▼              ▼
 *                      active)            PANEL_OPEN     TELESCOPE
 *                                         (wheel owned   (ocular zoom,
 *                                         by the panel,  scroll ignored,
 *                                         Esc closes)    Esc exits)
 *
 * The rule that matters: each phase owns ONE input routing. CameraRig reads
 * `phase` every frame and freezes the tour outside TOURING/PARKED.
 */
export type Phase = 'touring' | 'parked' | 'panel' | 'telescope'

/**
 * L'état du tiroir de la commode (#76) — délibérément SÉPARÉ de `Phase`.
 *
 * La règle qui tient ce fichier debout est « chaque phase possède UN routage
 * d'entrée », et le tiroir n'a pas de routage à lui : il ne capture ni la
 * molette ni le clavier, il coulisse pendant que le tour garde la main. En
 * faire une phase reviendrait à devoir répondre, dans CameraRig, à une phase
 * qui ne demande rien.
 *
 * `folder` est la case du lot suivant (#82) : le dossier a quitté le tiroir et
 * vole vers la caméra. C'est LUI qui passera `Phase` en `'panel'`.
 */
export type CabinetState = 'closed' | 'open' | 'folder'

interface InteractionState {
  phase: Phase
  /** Nearest stop index (updates continuously while touring). */
  stopIndex: number
  /** True once the .glb is loaded and stop transforms are extracted. */
  ready: boolean
  /**
   * L'excursion du télescope est ARRIVÉE — la caméra est derrière l'oculaire.
   *
   * Distinct de `phase === 'telescope'`, qui est vrai dès le clic : la visée
   * ne doit s'ouvrir qu'une fois le vol terminé, sinon on voit le cache
   * circulaire se poser sur une pièce qui défile encore, et on regarde dans un
   * télescope avant d'y être arrivé.
   */
  telescopeSettled: boolean
  /**
   * Le télescope est survolé — la seule chose que `RoomModel` sait, et la seule
   * dont le cerne a besoin.
   *
   * Il passe par l'état plutôt que par un second `<primitive>` sur le même
   * objet : le télescope appartient au graphe que `RoomModel` monte, et le
   * rendre une deuxième fois le DÉPARENTERAIT de la scène. Un seul propriétaire
   * du graphe, un drapeau pour le reste.
   */
  telescopeHovered: boolean
  /** HUD → CameraRig bridge: request a snap to this stop index. */
  pendingStopRequest: number | null
  /** Le tiroir de la commode — voir `CabinetState`. */
  cabinet: CabinetState
  /** Le `slug` du projet dont le dossier a quitté le tiroir, s'il y en a un.
   *  C'est ce que le panneau (#83) lira pour savoir quelle fiche afficher. */
  selectedProject: string | null

  setPhase: (phase: Phase) => void
  setStopIndex: (index: number) => void
  setReady: () => void
  setCabinet: (state: CabinetState) => void
  selectProject: (slug: string | null) => void
  requestStop: (index: number) => void
  consumeStopRequest: () => number | null
  openPanel: () => void
  closePanel: () => void
  enterTelescope: () => void
  /** Appelé par `CameraRig` à la fin de l'excursion, jamais au clic. */
  settleTelescope: () => void
  hoverTelescope: (hovered: boolean) => void
  exitTelescope: () => void
}

export const useInteraction = create<InteractionState>((set, get) => ({
  phase: 'touring',
  stopIndex: 0,
  ready: false,
  telescopeSettled: false,
  telescopeHovered: false,
  pendingStopRequest: null,
  cabinet: 'closed',
  selectedProject: null,

  setPhase: (phase) => set({ phase }),
  setStopIndex: (stopIndex) => {
    if (get().stopIndex !== stopIndex) set({ stopIndex })
  },
  setReady: () => set({ ready: true }),
  setCabinet: (cabinet) => {
    if (get().cabinet !== cabinet) set({ cabinet })
  },
  selectProject: (selectedProject) => {
    if (get().selectedProject !== selectedProject) set({ selectedProject })
  },

  requestStop: (index) => set({ pendingStopRequest: index }),
  consumeStopRequest: () => {
    const req = get().pendingStopRequest
    if (req !== null) set({ pendingStopRequest: null })
    return req
  },

  // Panels can only open from a settled state; closing returns to PARKED
  // (the camera never moved while the panel was open).
  openPanel: () => {
    const { phase } = get()
    if (phase === 'touring' || phase === 'parked') set({ phase: 'panel' })
  },
  closePanel: () => {
    if (get().phase === 'panel') set({ phase: 'parked' })
  },

  enterTelescope: () => {
    const { phase } = get()
    if (phase === 'touring' || phase === 'parked') {
      set({ phase: 'telescope', telescopeSettled: false })
    }
  },
  settleTelescope: () => {
    if (get().phase === 'telescope') set({ telescopeSettled: true })
  },
  hoverTelescope: (telescopeHovered) => {
    if (get().telescopeHovered !== telescopeHovered) set({ telescopeHovered })
  },
  exitTelescope: () => {
    if (get().phase === 'telescope') set({ phase: 'parked', telescopeSettled: false })
  },
}))
