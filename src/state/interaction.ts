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
   * LE DIALOGUE (#122). Un seul arrêt parle à la fois, donc un seul état.
   *
   * **Tout se déduit du TEMPS, et d'une seule origine.** La première version
   * demandait à la bulle de publier « je suis en train d'écrire » ; ça passait
   * par un effet React, donc avec une image de retard, et un clic tombé dans
   * cette fenêtre était arbitré sur un état périmé — il tournait la page d'une
   * phrase encore en cours d'écriture. Un retard qu'on réduit reste un retard :
   * ici il n'y en a plus, parce qu'il n'y a plus de message à faire circuler.
   */
  dialoguePage: number
  /** La durée de frappe de chaque page, en ms. Vide = pas de dialogue. */
  dialogueDurations: number[]
  /** Quand la page courante a commencé à s'écrire (`performance.now()`). */
  dialogueStartedAt: number
  /** La frappe de la page courante a été achevée d'un geste. */
  dialogueDone: boolean
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
  /**
   * L'INTRO (#143) — voir CONTEXT.md pour les mots.
   *
   * `introStartedAt` est l'origine du temps T (`performance.now()` du T = 0),
   * `null` tant qu'elle n'a pas démarré. `introDone` : la dernière image est
   * atteinte — par le temps, par un geste de saut, ou d'emblée (mouvement
   * réduit, lien direct ailleurs qu'à Home). `introReleased` : la bulle peut
   * parler, une seconde après la dernière image. Trois drapeaux et pas une
   * phase : l'intro ne possède aucun routage d'entrée à elle — le geste de
   * saut est pris avant le rig, et le tour garde la main partout ailleurs.
   */
  introStartedAt: number | null
  introDone: boolean
  introReleased: boolean
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
  /** T = 0, à cette heure. */
  startIntro: (now: number) => void
  /** La dernière image, par le temps ou par un geste. Idempotent. */
  finishIntro: () => void
  /** La bulle peut parler. Sans effet avant la dernière image. */
  releaseIntro: () => void
  /** Tout à zéro : l'outil d'arbitrage (#147) rejoue depuis le début. */
  replayIntro: () => void
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
  /**
   * Remet le dialogue au premier temps. Appelé à l'arrivée sur un arrêt, et
   * seulement une fois l'écran découvert — une frappe lancée derrière le
   * préchargeur s'écrit sans spectateur.
   *
   * Les durées viennent de l'appelant : sous `prefers-reduced-motion` elles
   * valent zéro, ce qui dit exactement ce qu'on veut dire — la frappe ne dure
   * pas — et évite au store d'avoir son propre avis sur le mouvement réduit.
   */
  startDialogue: (durations: number[], now?: number) => void
  /**
   * Un geste sur le dialogue. Rend ce qu'il en a fait :
   *
   *   `typed`     — la frappe était en cours, ce geste l'achève et rien d'autre
   *   `paged`     — page suivante
   *   `exhausted` — c'était la dernière page : l'appelant enchaîne sur l'arrêt
   *                 suivant, et c'est ce qui fait N phrases = N gestes
   */
  advanceDialogue: (now?: number) => 'typed' | 'paged' | 'exhausted'
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
  dialogueDurations: [],
  dialogueStartedAt: 0,
  dialogueDone: true,
  folderHovered: false,
  telescopeSettled: false,
  moonRevealed: false,
  telescopeHovered: false,
  moonDetailed: false,
  introStartedAt: null,
  introDone: false,
  introReleased: false,
  pendingStopRequest: null,
  cabinet: 'closed',
  selectedProject: null,

  setPhase: (phase) => set({ phase }),
  setStopIndex: (stopIndex) => {
    if (get().stopIndex !== stopIndex) set({ stopIndex })
  },
  setReady: () => set({ ready: true }),
  setRevealed: () => set({ revealed: true }),
  startIntro: (now) => {
    if (get().introStartedAt === null && !get().introDone) set({ introStartedAt: now })
  },
  finishIntro: () => {
    if (!get().introDone) set({ introDone: true })
  },
  releaseIntro: () => {
    if (get().introDone && !get().introReleased) set({ introReleased: true })
  },
  replayIntro: () => set({ introStartedAt: null, introDone: false, introReleased: false }),
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
  startDialogue: (dialogueDurations, now = performance.now()) =>
    set({
      dialogueDurations,
      dialoguePage: 0,
      dialogueStartedAt: now,
      dialogueDone: dialogueDurations.length === 0,
    }),

  advanceDialogue: (now = performance.now()) => {
    const { dialoguePage, dialogueDurations, dialogueStartedAt, dialogueDone } = get()
    const durée = dialogueDurations[dialoguePage] ?? 0

    // A (arbitrage du 2026-08-24) : un geste reçu pendant la frappe l'achève,
    // et ne fait QUE ça. La question se répond par une soustraction, sur
    // l'horloge du geste lui-même — il n'y a rien à publier, donc rien qui
    // puisse être en retard.
    if (!dialogueDone && now - dialogueStartedAt < durée) {
      set({ dialogueDone: true })
      return 'typed'
    }
    if (dialoguePage + 1 < dialogueDurations.length) {
      set({ dialoguePage: dialoguePage + 1, dialogueStartedAt: now, dialogueDone: false })
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
