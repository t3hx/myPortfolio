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
   * L'écran est DÉCOUVERT : le préchargeur a fini de s'effacer et le visiteur
   * voit la pièce.
   *
   * Distinct de `ready`, qui dit seulement que la scène est prête — entre les
   * deux, il s'écoule le fondu du préchargeur, et pendant ce temps React rend
   * déjà les bulles sans que personne ne les voie. Une frappe démarrée là
   * s'écrit derrière l'écran de chargement : à l'arrivée par lien profond, la
   * phrase était déjà à moitié faite quand elle devenait visible (mesuré : 42
   * caractères sur 69 pour l'accueil), et sur une machine rapide elle serait
   * entièrement passée.
   */
  revealed: boolean
  /**
   * L'excursion du télescope est ARRIVÉE — la caméra est derrière l'oculaire.
   *
   * Distinct de `phase === 'telescope'`, qui est vrai dès le clic : la visée
   * ne doit s'ouvrir qu'une fois le vol terminé, sinon on voit le cache
   * circulaire se poser sur une pièce qui défile encore, et on regarde dans un
   * télescope avant d'y être arrivé.
   */
  /**
   * LE DIALOGUE (#122). Un seul arrêt parle à la fois, donc un seul état
   * suffit — il est remis à zéro à chaque arrivée, ce qui fait qu'une bulle
   * revisitée reparle depuis le début.
   */
  dialoguePage: number
  /** Combien de temps a l'arrêt courant. Publié par `Experience`. */
  dialoguePages: number
  /** La page courante est encore en train de s'écrire. Publié par `Bubble`. */
  dialogueTyping: boolean
  /**
   * Jeton d'achèvement de la frappe. Il s'incrémente quand un geste tombe
   * PENDANT la frappe : la bulle le lit et affiche sa phrase d'un coup.
   *
   * Un compteur et non un booléen, parce que ce qu'on transmet est un
   * ÉVÉNEMENT (« achève »), pas un état. Avec un booléen il faudrait le
   * rabaisser après coup, et deux gestes rapprochés sur la même page ne se
   * distingueraient pas.
   */
  dialogueSkip: number
  telescopeSettled: boolean
  /**
   * La lune est arrivée : le second temps de l'excursion (le grossissement)
   * est terminé et elle remplit la visée.
   *
   * Distinct de `telescopeSettled`, qui dit seulement qu'on est derrière
   * l'oculaire — à cet instant, la visée s'ouvre sur un ciel encore lointain.
   * L'encadré de la lune attend CE signal-ci : il parle d'un sujet qu'il faut
   * d'abord voir.
   */
  moonRevealed: boolean
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
  /**
   * La lune détaillée est-elle affichée ?
   *
   * **Séparée de la phase, et pour la même raison des deux côtés : un échange
   * de texture ne doit se produire que là où personne ne peut le voir.**
   * Elle s'allume à `settleTelescope`, quand l'écran est noir parce qu'on
   * regarde l'intérieur du tube ; elle s'éteint à la FIN du retour, quand la
   * lune est redevenue un petit disque dans la fenêtre. Piloté par la phase,
   * l'échange se voyait aux deux bouts — en pleine fenêtre au clic, et en plein
   * cadre à la sortie.
   */
  moonDetailed: boolean
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
  /** Appelé par le préchargeur au moment où il se démonte. */
  setRevealed: () => void
  setCabinet: (state: CabinetState) => void
  selectProject: (slug: string | null) => void
  requestStop: (index: number) => void
  consumeStopRequest: () => number | null
  openPanel: () => void
  closePanel: () => void
  enterTelescope: () => void
  /** Appelé par `CameraRig` à la fin de l'excursion, jamais au clic. */
  settleTelescope: () => void
  revealMoon: () => void
  hoverTelescope: (hovered: boolean) => void
  /**
   * Un objet interactif est sous le curseur — le télescope, ou un dossier de
   * la commode. C'est ce qui donne au clic sa règle : **la scène d'abord, le
   * dialogue sinon**.
   */
  folderHovered: boolean
  hoverFolder: (hovered: boolean) => void
  /** Remet le dialogue au premier temps. Appelé à l'arrivée sur un arrêt. */
  startDialogue: (pages: number) => void
  setDialogueTyping: (typing: boolean) => void
  /**
   * Un geste sur le dialogue. Rend ce qu'il en a fait :
   *
   *   `typed`     — la frappe était en cours, ce geste l'achève et rien d'autre
   *   `paged`     — page suivante
   *   `exhausted` — c'était la dernière page : l'appelant enchaîne sur l'arrêt
   *                 suivant, et c'est ce qui fait N phrases = N gestes
   */
  advanceDialogue: () => 'typed' | 'paged' | 'exhausted'
  /** Appelé par `CameraRig` à la fin du retour, jamais à la touche `Échap`. */
  showDetailedMoon: (shown: boolean) => void
  exitTelescope: () => void
}

export const useInteraction = create<InteractionState>((set, get) => ({
  phase: 'touring',
  stopIndex: 0,
  ready: false,
  revealed: false,
  dialoguePage: 0,
  dialoguePages: 1,
  dialogueTyping: false,
  dialogueSkip: 0,
  folderHovered: false,
  telescopeSettled: false,
  moonRevealed: false,
  telescopeHovered: false,
  moonDetailed: false,
  pendingStopRequest: null,
  cabinet: 'closed',
  selectedProject: null,

  setPhase: (phase) => set({ phase }),
  setStopIndex: (stopIndex) => {
    if (get().stopIndex !== stopIndex) set({ stopIndex })
  },
  setReady: () => set({ ready: true }),
  setRevealed: () => set({ revealed: true }),
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
      // `telescopeHovered` est éteint ICI et pas au prochain mouvement de
      // souris : après le clic, la souris ne bouge plus, et le cerne restait
      // allumé pendant toute l'excursion — visible en plein cadre sur le tube.
      set({
        phase: 'telescope',
        telescopeSettled: false,
        moonRevealed: false,
        telescopeHovered: false,
      })
    }
  },
  settleTelescope: () => {
    // L'écran est noir ici : c'est le seul instant de la séquence où l'échange
    // de lune est invisible par construction.
    if (get().phase === 'telescope') set({ telescopeSettled: true, moonDetailed: true })
  },
  revealMoon: () => {
    if (get().phase === 'telescope') set({ moonRevealed: true })
  },
  showDetailedMoon: (moonDetailed) => {
    if (get().moonDetailed !== moonDetailed) set({ moonDetailed })
  },
  hoverFolder: (folderHovered) => {
    if (get().folderHovered !== folderHovered) set({ folderHovered })
  },
  startDialogue: (dialoguePages) => set({ dialoguePages, dialoguePage: 0, dialogueTyping: false }),
  setDialogueTyping: (dialogueTyping) => {
    if (get().dialogueTyping !== dialogueTyping) set({ dialogueTyping })
  },
  advanceDialogue: () => {
    const { dialogueTyping, dialoguePage, dialoguePages, dialogueSkip } = get()
    // A (arbitrage du 2026-08-24) : un geste reçu pendant la frappe l'achève,
    // et ne fait QUE ça. L'autre option — avancer quand même — garantissait un
    // geste par phrase, mais laissait un lecteur pressé traverser tout le texte
    // sans jamais en lire une ligne.
    if (dialogueTyping) {
      set({ dialogueSkip: dialogueSkip + 1 })
      return 'typed'
    }
    if (dialoguePage + 1 < dialoguePages) {
      set({ dialoguePage: dialoguePage + 1 })
      return 'paged'
    }
    return 'exhausted'
  },
  hoverTelescope: (telescopeHovered) => {
    if (get().telescopeHovered !== telescopeHovered) set({ telescopeHovered })
  },
  exitTelescope: () => {
    if (get().phase === 'telescope')
      set({ phase: 'parked', telescopeSettled: false, moonRevealed: false })
  },
}))
