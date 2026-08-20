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
 * Bilingue depuis #33. Seuls le SUJET et la PHRASE le sont : l'ancrage, le
 * centre et la largeur restent partagés, parce qu'ils décrivent une géométrie
 * mesurée sur la scène et sur les maquettes, pas du texte. Les dupliquer par
 * langue créerait deux sources de vérité pour une seule chose.
 */
import { DRAWER_STOP_LABEL } from '@/config/cabinet'
import type { Locale, Localized } from '@/lib/locale'
import { t } from '@/lib/locale'
import { PROJECTS_EMPTY } from '@/content/projects'

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
  subject?: Localized
  /**
   * La phrase — une seule, voix Newsreader italique.
   *
   * **Le français fait foi et lui seul** : c'est la langue des maquettes, et
   * `tests/bubbleAnchors.test.ts` le vérifie mot pour mot contre elles.
   * L'anglais n'a PAS de maquette et n'est donc pas verrouillé — c'est
   * délibéré, pas un oubli. En revanche il partage le `center` et le
   * `maxWidth` du français : la géométrie a été mesurée sur les boîtes rendues
   * en français, donc une traduction plus longue doit être vérifiée à l'œil,
   * et c'est le `maxWidth` qu'on corrige alors, jamais le `center`.
   */
  text: Localized
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
    text: {
      fr: 'Bienvenue — faites défiler pour commencer la visite, chaque objet ici a une histoire.',
      en: 'Welcome — scroll to begin the tour; every object in here has a story.',
    },
  },
  {
    stop: 'CV',
    objects: ['Monitors_Screens'],
    center: { x: 0.1355, y: 0.2801 },
    maxWidth: 260,
    subject: { fr: 'Le CV', en: 'The résumé' },
    text: {
      fr: 'Le CV, en pied et à jour — la version papier dort dans la commode.',
      en: 'The résumé, full-length and current — the paper copy sleeps in the cabinet.',
    },
    tick: 'right',
  },
  {
    stop: 'Desk',
    objects: ['Desk_Merged'],
    center: { x: 0.5, y: 0.8304 },
    maxWidth: 460,
    subject: { fr: 'Le bureau', en: 'The desk' },
    text: {
      fr: 'Deux écrans, un clavier bruyant, du café tiède : le poste de pilotage de tous mes projets.',
      en: 'Two screens, a loud keyboard, lukewarm coffee: the cockpit of every project.',
    },
  },
  {
    stop: 'Scoreboard',
    objects: ['Map_Sheet'],
    center: { x: 0.1628, y: 0.9004 },
    maxWidth: 340,
    subject: { fr: 'La mappemonde', en: 'The world map' },
    text: {
      fr: 'Punaises et fils rouges : chaque voyage part de la maison.',
      en: 'Pins and red thread: every journey starts from home.',
    },
  },
  {
    stop: 'Bookshelf',
    objects: ['Bookshelf_Merged'],
    center: { x: 0.1317, y: 0.6502 },
    maxWidth: 240,
    subject: { fr: 'L’étagère', en: 'The shelf' },
    text: {
      fr: 'Des classeurs de partitions et de méthodes — toute la théorie que je promets encore de finir un jour.',
      en: 'Binders of sheet music and method books — all the theory I still promise to finish.',
    },
  },
  {
    stop: 'Cabinet',
    // La commode est modélisée en pièces détachées : la coque suffit à situer
    // sa profondeur, les tiroirs et poignées ne la déplaceraient pas.
    objects: ['Cabinet_Back', 'Cabinet_Top', 'Cabinet_Bottom', 'Cabinet_LSide', 'Cabinet_RSide'],
    center: { x: 0.1602, y: 0.8404 },
    maxWidth: 300,
    subject: { fr: 'La commode', en: 'The cabinet' },
    text: {
      fr: 'Les archives : diplômes, contrats, et quelques idées classées trop tôt.',
      en: 'The archive: diplomas, contracts, and a few ideas filed away too early.',
    },
  },
  {
    stop: 'Cat',
    objects: ['Cat_Merged'],
    center: { x: 0.1908, y: 0.1504 },
    maxWidth: 340,
    subject: { fr: 'Le chat', en: 'The cat' },
    text: {
      fr: 'Pixel, contrôle qualité. Rien ne sort d’ici sans son regard vert.',
      en: 'Pixel, quality control. Nothing leaves this room without his green stare.',
    },
  },
  {
    stop: 'Guitar',
    objects: ['Guitar_Merged'],
    center: { x: 0.6918, y: 0.3953 },
    maxWidth: 380,
    subject: { fr: 'La guitare', en: 'The guitar' },
    text: {
      fr: 'Le soir, c’est elle qui parle — une Les Paul branchée sur un vieux Sharmall.',
      en: 'At night she does the talking — a Les Paul through an old Sharmall.',
    },
    // Parallèle au bord de l'ampli, mesuré au pixel pendant la session design.
    tilt: -11.15,
  },
  {
    stop: 'Posters',
    objects: ['Poster_Expanse_Merged'],
    center: { x: 0.1719, y: 0.4607 },
    maxWidth: 330,
    subject: { fr: 'Les posters', en: 'The posters' },
    text: {
      fr: 'The Expanse au mur — le rappel quotidien de viser un peu plus loin.',
      en: 'The Expanse on the wall — a daily reminder to aim a little further.',
    },
    tick: 'right',
  },
  {
    stop: 'Telescope',
    objects: ['Telescope_Merged'],
    center: { x: 0.7708, y: 0.1154 },
    maxWidth: 340,
    subject: { fr: 'Le télescope', en: 'The telescope' },
    text: {
      fr: 'Le télescope pointe la fenêtre — la suite au prochain arrêt.',
      en: 'The telescope is aimed at the window — the rest at the next stop.',
    },
  },
  {
    stop: 'Moon',
    objects: ['Outside_Moon'],
    center: { x: 0.1589, y: 0.9004 },
    maxWidth: 330,
    subject: { fr: 'La lune', en: 'The moon' },
    text: {
      fr: 'À 384 000 km, le seul sujet qui accepte de poser par nuit claire.',
      en: 'At 384,000 km, the only subject that will pose on a clear night.',
    },
  },
]

/**
 * Le kicker « NN — Objet » de la bulle `index`, ou `undefined` pour une bulle
 * sans titre (home). Le numéro est le RANG parmi les bulles titrées, pas
 * l'index dans le tour : home ne consomme pas de numéro, et une bulle sans
 * titre ajoutée plus tard n'en consommerait pas non plus.
 */
export function bubbleKicker(
  bubbles: BubbleContent[],
  index: number,
  locale: Locale,
): string | undefined {
  const bubble = bubbles[index]
  if (!bubble?.subject) return undefined
  const rank = bubbles.slice(0, index + 1).filter((b) => b.subject).length
  return `${String(rank).padStart(2, '0')} — ${t(bubble.subject, locale)}`
}

/**
 * La phrase d'une bulle, avec le repli du tiroir vide (#78, #83).
 *
 * À zéro projet il n'y a **aucun dossier à cliquer**, donc aucune fiche ne
 * s'ouvre jamais : un écran vide plein cadre serait une porte qui ne s'ouvre
 * pas. Le repli prend donc la place de la bulle de la commode — même
 * emplacement, même anatomie, autre phrase — parce que le système n'admet
 * qu'un seul bloc de texte visible à la fois.
 *
 * Le compte de projets est passé en paramètre plutôt qu'importé : ce module est
 * la source des TEXTES, il n'a pas à savoir d'où vient la liste.
 */
export function bubbleText(bubble: BubbleContent, projectCount: number, locale: Locale): string {
  if (bubble.stop === DRAWER_STOP_LABEL && projectCount === 0) {
    return t(PROJECTS_EMPTY, locale)
  }
  return t(bubble.text, locale)
}
