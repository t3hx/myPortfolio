import type { Localized } from '@/lib/locale'

/**
 * Les textes de l'interface qui n'appartiennent à aucun contenu (issue #33) —
 * préchargeur, écran de pré-sélection, fiche projet, version classique, et les
 * étiquettes d'accessibilité qui vont avec.
 *
 * Ils vivent ici et pas dans leur composant pour la raison qui a fait ouvrir
 * #33 : « aucun texte codé en dur hors du système de traduction ». Une chaîne
 * laissée dans un JSX ne se voit pas manquer — elle reste simplement en
 * français quand tout le reste bascule.
 *
 * **Le HUD (`src/ui/Hud.tsx`) est exclu, et c'est une décision.** C'est de
 * l'outillage derrière `?debug`, au même titre que `?outline` ou `?debug-fly` :
 * il n'est jamais servi à un visiteur, et le traduire reviendrait à entretenir
 * la moitié d'un dictionnaire pour un bandeau de diagnostic. Ses libellés sont
 * d'ailleurs déjà en anglais.
 */
export const UI = {
  preloader: {
    /** `aria-label` de la zone de chargement. */
    region: { fr: 'Chargement', en: 'Loading' } as Localized,
    copy: { fr: 'On allume les lampes…', en: 'Turning the lamps on…' } as Localized,
  },
  preselection: {
    /**
     * L'accroche. Elle nommait « la visite d'une pièce » — ce qui n'a jamais
     * décrit que la BRANCHE 3D, et le devenait faux à mesure que la version
     * classique cessait d'être un échafaudage (#29). Elle décrit maintenant
     * l'écran : deux portes, un seul contenu derrière. Sa promesse compte
     * autant que sa justesse — c'est elle qui autorise à prendre la version
     * légère sans craindre de rater quelque chose.
     */
    eyebrow: {
      fr: 'Portfolio — deux entrées, une même histoire',
      en: 'Portfolio — two ways in, one story',
    } as Localized,
    title: {
      fr: 'Comment souhaitez-vous visiter ?',
      en: 'How would you like to visit?',
    } as Localized,
    three: { fr: 'Expérience 3D', en: '3D experience' } as Localized,
    /**
     * Ce que promet chaque carte. **Ces deux phrases vivaient en dur dans le
     * JSX** — elles n'ont jamais basculé en anglais depuis #33, et rien ne
     * pouvait le signaler : une chaîne oubliée dans un composant ne se voit pas
     * manquer, elle reste simplement en français quand tout le reste change.
     */
    threeBody: {
      fr: "Entrez dans la pièce — la caméra vous guide d'objet en objet, au fil de la molette.",
      en: 'Step into the room — the camera walks you from object to object, one scroll at a time.',
    } as Localized,
    threeMeta: {
      fr: 'WebGL · ~3 Mo · souris, tactile ou clavier',
      en: 'WebGL · ~3 MB · mouse, touch or keyboard',
    } as Localized,
    classic: { fr: 'Expérience classique', en: 'Classic experience' } as Localized,
    classicBody: {
      fr: "La même histoire, en une page légère — idéale en déplacement ou au lecteur d'écran.",
      en: 'The same story, in one light page — at its best on the move or in a screen reader.',
    } as Localized,
    classicMeta: {
      fr: 'HTML · instantané · accessible',
      en: 'HTML · instant · accessible',
    } as Localized,
    /** Le rappel du bas. Il désamorce la seule crainte que cet écran puisse
     *  produire : celle de s'engager. */
    note: {
      fr: 'votre choix est mémorisé — modifiable à tout moment depuis le menu',
      en: 'your choice is remembered — changeable at any time from the menu',
    } as Localized,
  },
  /**
   * Le site classique (#29) — la page une-page servie à qui choisit « sans
   * 3D », et à qui n'a pas de WebGL.
   *
   * **Ce qui est ici est ce que la scène n'a pas** : une accroche, une ligne
   * de méta, des intitulés de section, un pied de page. Tout le reste — le
   * parcours, les projets, les savoir-faire — vient de `cv.ts` et
   * `projects.ts`, que les deux expériences partagent (arbitrage du
   * 2026-08-24). C'est la raison pour laquelle il n'y a ici aucun poste,
   * aucune école et aucun projet : les recopier aurait créé un second
   * parcours, qui se serait mis à mentir au premier changement de date.
   *
   * Les numéros des sections (`01 —`, `02 —`…) sont ÉCRITS, contrairement à
   * ceux des bulles du tour, que `bubbleKicker()` calcule. Le tour se
   * réordonne — c'est même une gestuelle que `cameraStops.ts` invite — alors
   * qu'une page une-page a l'ordre de son défilement, et rien d'autre ne peut
   * le changer qu'une réécriture de cette page.
   */
  classic: {
    kicker: {
      fr: 'Portfolio — Développeur front créatif',
      en: 'Portfolio — Creative front-end developer',
    } as Localized,
    /** La voix, en Newsreader italique : la seule phrase que la page « dit ». */
    tagline: {
      fr: '« Donner de la vie aux interfaces : le mouvement, la matière, l’interaction. »',
      en: '“Bringing interfaces to life: motion, texture, interaction.”',
    } as Localized,
    scroll: { fr: 'défiler', en: 'scroll' } as Localized,
    capKicker: { fr: '01 — Projet professionnel', en: '01 — Professional goal' } as Localized,
    cvKicker: { fr: '02 — CV', en: '02 — Resume' } as Localized,
    cvTitle: { fr: 'Parcours', en: 'Background' } as Localized,
    projKicker: { fr: '03 — Projets persos', en: '03 — Side projects' } as Localized,
    projTitle: { fr: 'Projets persos', en: 'Side projects' } as Localized,
    formKicker: { fr: '04 — Formations', en: '04 — Education' } as Localized,
    /** L'étiquette du cadre hachuré, tant qu'une fiche n'a pas de couverture. */
    coverLabel: {
      fr: 'visuel projet — à fournir',
      en: 'project visual — to be provided',
    } as Localized,
    footNote: {
      fr: '© 2026 Thibault Dubois — conçu et développé à la main',
      en: '© 2026 Thibault Dubois — designed & built by hand',
    } as Localized,
    /**
     * `aria-label` du lien vers l'accueil de la page. Le mini-nom collant est
     * décoratif à l'œil mais reste le seul repère de position en haut d'écran.
     */
    region: { fr: 'Portfolio', en: 'Portfolio' } as Localized,
    noWebgl: {
      fr: "WebGL n'est pas disponible sur cet appareil — vous avez été orienté ici automatiquement.",
      en: 'WebGL is unavailable on this device — you were routed here automatically.',
    } as Localized,
    switch: { fr: "changer d'expérience", en: 'change experience' } as Localized,
  },
  sheet: {
    kicker: { fr: 'Projet', en: 'Project' } as Localized,
    year: { fr: 'Année', en: 'Year' } as Localized,
    role: { fr: 'Rôle', en: 'Role' } as Localized,
    close: { fr: 'Fermer la fiche', en: 'Close the sheet' } as Localized,
    escape: { fr: 'Échap', en: 'Esc' } as Localized,
    /**
     * Ce que la touche fait — affiché partout où la touche l'est (#136).
     *
     * Elle vivait dans `UI.telescope`, parce que la visée était le seul écran à
     * la dire. La fiche projet, elle, montrait la touche SANS la phrase : deux
     * surfaces qui se ferment de la même façon et ne le disent pas pareil. Elle
     * a donc déménagé ici, à côté de `escape`, puisque c'est déjà là que vit la
     * touche et que `.sheet__key` est déjà partagée par les deux.
     */
    exit: { fr: 'pour revenir', en: 'to go back' } as Localized,
    cover: { fr: 'illustration', en: 'illustration' } as Localized,
    /** `aria-label` de la pellicule. Elle n'a pas de titre visible : les
     *  vignettes se voient, et un intertitre au-dessus d'elles serait du
     *  bruit pour tout le monde sauf pour un lecteur d'écran. */
    media: { fr: 'Médias du projet', en: 'Project media' } as Localized,
    /** Ce que la vignette de la vidéo annonce. Le glyphe ▶ est décoratif, donc
     *  masqué aux lecteurs d'écran : sans ce mot, rien ne distinguerait la
     *  vidéo des captures dans la liste des vignettes. */
    video: { fr: 'Vidéo', en: 'Video' } as Localized,
  },
  cv: {
    /** `aria-label` de la section. */
    region: { fr: 'Curriculum vitae', en: 'Résumé' } as Localized,
    photo: { fr: 'photo', en: 'photo' } as Localized,
  },
  telescope: {
    /**
     * La phrase de la lune. Elle était la bulle du 11ᵉ arrêt du tour ; la lune
     * n'étant plus une étape (#113), elle se dit là où on regarde la lune —
     * dans l'instrument. Texte repris mot pour mot de `BUBBLES`, les deux
     * langues comprises : le sujet n'a pas changé, seulement l'endroit.
     */
    /**
     * Le titre de l'encadré. C'était le `subject` de la bulle du tour ; il la
     * suit dans la visée. Sans numéro : la numérotation suit le RANG dans le
     * tour, et la lune n'y est plus.
     */
    subject: { fr: 'La lune', en: 'The moon' } as Localized,
    /**
     * **Hors dialogue, et c'est une décision** (#120). La visée n'est pas un
     * arrêt : elle ne reçoit ni molette ni clic — `Échap` en est la seule
     * issue — donc rien n'y ferait défiler des pages. Une phrase, affichée à
     * l'arrivée de la lune, qui reste tant qu'on regarde.
     */
    moon: {
      fr: 'À 384 000 km. La seule cliente qui ne demande jamais de modifications.',
      en: '384,000 km away. The only client who never asks for changes.',
    } as Localized,
  },
  menu: {
    region: { fr: 'Menu', en: 'Menu' } as Localized,
    /** `title` de la bascule de langue, dans la langue vers laquelle elle mène. */
    switchTo: { fr: 'Passer en français', en: 'Switch to English' } as Localized,
  },
}
