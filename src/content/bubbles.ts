/**
 * Le contenu narratif du tour : une bulle par arrêt (issue #48).
 *
 * Source unique des textes — le composant `<Bubble>` n'en contient aucun, et
 * `CameraStop` n'a plus de `caption`. Chaque entrée porte trois choses :
 *
 *  1. **la phrase et son sujet**, repris mot pour mot des maquettes validées
 *     (`docs/design/screens/*.html`, session design 2026-08-10) ;
 *  2. **l'ancre monde**, décrite par les nœuds du `.glb` qui justifient la
 *     bulle : leur boîte englobante donne la PROFONDEUR de l'ancre, donc la
 *     parallaxe de la bulle quand la caméra quitte l'arrêt (voir
 *     `src/lib/bubbleAnchors.ts`) ;
 *  3. **le placement du design**, en fraction du cadre 1280×720 de la table
 *     « Placement par arrêt » de DESIGN.md. Les centres ci-dessous ont été
 *     MESURÉS sur les maquettes elles-mêmes (boîte réellement rendue à
 *     1280×720), pas recopiés depuis les `left`/`top` : la table pose le coin
 *     haut-gauche, alors que `<Html center>` centre la bulle sur le point
 *     projeté. Mêmes police, mêmes largeurs, même texte ⇒ même boîte.
 *
 * L'ordre du tableau EST l'ordre du tour (il suit `CAMERA_STOPS`), et le
 * numéro du kicker s'en déduit — décision produit du 2026-08-18, déférée par
 * la review de #47 : les maquettes numérotent dans leur ordre de capture
 * (01 bureau, 02 CV…), le tour dans le sien. Réordonner `CAMERA_STOPS`
 * renumérote les bulles tout seul ; les numéros des maquettes sont donc
 * périmés par construction, pas leur texte.
 *
 * Textes en français : c'est la langue des maquettes et de l'écran de
 * pré-sélection déjà livré. Le bilingue FR/EN est l'issue #33 — cette table
 * est la seule à modifier le jour où elle arrive.
 */
export interface BubbleContent {
  /** Le `label` de `CAMERA_STOPS` — aussi la clé de `?stop=`. */
  stop: string
  /**
   * Nœuds du `.glb` dont l'union des boîtes donne le point ancré. Seule leur
   * profondeur vue de la caméra de l'arrêt est utilisée : la direction, elle,
   * vient de `center`. Un nom absent est signalé et l'arrêt retombe sur une
   * profondeur par défaut (voir `bubbleAnchors.ts`).
   */
  objects: string[]
  /** Centre de la bulle dans le cadre du design, en fraction de 1280×720. */
  center: { x: number; y: number }
  /** `max-width` du design, en px content-box. `null` = libre (home, nowrap). */
  maxWidth: number | null
  /** Objet nommé dans le kicker. Absent = variante inline sans titre (home). */
  subject?: string
  /** La phrase — une seule, voix Newsreader italique. */
  text: string
  /** Ligne de rappel de 44 px vers l'objet, du côté indiqué. */
  tick?: 'left' | 'right'
  /** Variante `--tilted` : rotation en degrés, mesurée sur la maquette. */
  tilt?: number
}

export const BUBBLES: BubbleContent[] = [
  {
    stop: 'Home',
    // Aucun objet ne « justifie » l'accueil — mais le cadrage Home est un très
    // gros plan de l'écran (0,55 m), c'est la surface qui remplit l'image et
    // donc la bonne profondeur. Le sol, lui, est DERRIÈRE cette caméra.
    objects: ['Monitors_Screens'],
    center: { x: 0.5, y: 0.896 },
    maxWidth: null,
    text: 'Bienvenue — faites défiler pour commencer la visite, chaque objet ici a une histoire.',
  },
  {
    stop: 'CV',
    objects: ['Monitors_Screens'],
    center: { x: 0.1355, y: 0.2801 },
    maxWidth: 260,
    subject: 'Le CV',
    text: 'Le CV, en pied et à jour — la version papier dort dans la commode.',
    tick: 'right',
  },
  {
    stop: 'Desk',
    objects: ['Desk_Merged'],
    center: { x: 0.5, y: 0.8304 },
    maxWidth: 460,
    subject: 'Le bureau',
    text: 'Deux écrans, un clavier bruyant, du café tiède : le poste de pilotage de tous mes projets.',
  },
  {
    stop: 'Scoreboard',
    objects: ['Map_Sheet'],
    center: { x: 0.1628, y: 0.9004 },
    maxWidth: 340,
    subject: 'La mappemonde',
    text: 'Punaises et fils rouges : chaque voyage part de la maison.',
  },
  {
    stop: 'Bookshelf',
    objects: ['Bookshelf_Merged'],
    center: { x: 0.1317, y: 0.6502 },
    maxWidth: 240,
    subject: 'L’étagère',
    text: 'Des classeurs de partitions et de méthodes — toute la théorie que je promets encore de finir un jour.',
  },
  {
    stop: 'Cabinet',
    // La commode est modélisée en pièces détachées : la coque suffit à situer
    // sa profondeur, les tiroirs et poignées ne la déplaceraient pas.
    objects: ['Cabinet_Back', 'Cabinet_Top', 'Cabinet_Bottom', 'Cabinet_LSide', 'Cabinet_RSide'],
    center: { x: 0.1602, y: 0.8404 },
    maxWidth: 300,
    subject: 'La commode',
    text: 'Les archives : diplômes, contrats, et quelques idées classées trop tôt.',
  },
  {
    stop: 'Cat',
    objects: ['Cat_Merged'],
    center: { x: 0.1908, y: 0.1504 },
    maxWidth: 340,
    subject: 'Le chat',
    text: 'Pixel, contrôle qualité. Rien ne sort d’ici sans son regard vert.',
  },
  {
    stop: 'Guitar',
    objects: ['Guitar_Merged'],
    center: { x: 0.6918, y: 0.3953 },
    maxWidth: 380,
    subject: 'La guitare',
    text: 'Le soir, c’est elle qui parle — une Les Paul branchée sur un vieux Sharmall.',
    // Parallèle au bord de l'ampli, mesuré au pixel pendant la session design.
    tilt: -11.15,
  },
  {
    stop: 'Posters',
    objects: ['Poster_Expanse_Merged'],
    center: { x: 0.1719, y: 0.4607 },
    maxWidth: 330,
    subject: 'Les posters',
    text: 'The Expanse au mur — le rappel quotidien de viser un peu plus loin.',
    tick: 'right',
  },
  {
    stop: 'Telescope',
    objects: ['Telescope_Merged'],
    center: { x: 0.7708, y: 0.1154 },
    maxWidth: 340,
    subject: 'Le télescope',
    text: 'Le télescope pointe la fenêtre — la suite au prochain arrêt.',
  },
  {
    stop: 'Moon',
    objects: ['Outside_Moon'],
    center: { x: 0.1589, y: 0.9004 },
    maxWidth: 330,
    subject: 'La lune',
    text: 'À 384 000 km, le seul sujet qui accepte de poser par nuit claire.',
  },
]

/**
 * Le kicker « NN — Objet » de la bulle `index`, ou `undefined` pour une bulle
 * sans titre (home). Le numéro est le RANG parmi les bulles titrées, pas
 * l'index dans le tour : home ne consomme pas de numéro, et une bulle sans
 * titre ajoutée plus tard n'en consommerait pas non plus.
 */
export function bubbleKicker(bubbles: BubbleContent[], index: number): string | undefined {
  const bubble = bubbles[index]
  if (!bubble?.subject) return undefined
  const rank = bubbles.slice(0, index + 1).filter((b) => b.subject).length
  return `${String(rank).padStart(2, '0')} — ${bubble.subject}`
}

/**
 * La bulle `index` telle qu'elle est ANNONCÉE à l'arrivée à l'arrêt (issue #49)
 * — ce que lit `<StopAnnouncer>`, pas ce qui est peint.
 *
 * Volontairement PAS le kicker : « 01 — Le bureau » se prononce « zéro un tiret
 * cadratin le bureau », un numéro de repère visuel qui n'aide pas à l'oreille.
 * L'annonce garde le sujet (il situe l'objet cadré, que l'utilisateur ne voit
 * pas) puis la phrase. Sans sujet (home), la phrase suffit.
 *
 * Index hors table = chaîne vide : l'annonceur ne rend alors aucun texte, et
 * une région live vide n'annonce rien.
 */
export function bubbleAnnouncement(bubbles: BubbleContent[], index: number): string {
  const bubble = bubbles[index]
  if (!bubble) return ''
  return bubble.subject ? `${bubble.subject}. ${bubble.text}` : bubble.text
}
