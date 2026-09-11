/**
 * Le contenu narratif du tour : une bulle par arrêt (issue #48).
 *
 * Source unique des textes — le composant `<Bubble>` n'en contient aucun, et
 * `CameraStop` n'a plus de `caption`. Chaque entrée porte trois choses :
 *
 *  1. **la phrase et son sujet**, repris mot pour mot des maquettes validées
 *     (`design/screens/*.html`, session design 2026-08-10) ;
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
   * Ce que l'arrêt dit — **une suite de pages**, voix Newsreader italique.
   *
   * Une page est un TEMPS du dialogue, pas une longueur : c'est l'unité que le
   * visiteur fait défiler d'un clic ou d'un geste (#119). Le type interdit la
   * suite vide, parce qu'un arrêt muet passerait tous les tests sans que rien
   * ne le dise — et qu'une bulle sans texte, à l'écran, ressemble à un défaut
   * de chargement plutôt qu'à une décision.
   *
   * **`**ainsi**` marque une consigne** (#129) : ces mots portent l'accent et
   * un balayage les parcourt. Le marquage vise des MOTS, pas la phrase — une
   * consigne vit presque toujours au milieu d'un texte qui, lui, raconte. Ce
   * n'est pas du Markdown : rien d'autre n'est interprété. Le texte livré garde
   * ses marqueurs, et le contrôle verbatim des maquettes compare le texte NU.
   *
   * **Un `\n` coupe la ligne** (#32), et c'est un `<br>` que `layout` en fait,
   * jamais un `white-space` de CSS — la variante sans titre de l'accueil pose
   * `nowrap`, qui aurait réduit le saut à une espace sans que rien ne le dise.
   * Le saut coûte un caractère de frappe, puisqu'il s'affiche. Trois façons de
   * couper une phrase, dans l'ordre où il faut les essayer : baisser
   * `maxWidth` (la boîte grandit en HAUTEUR, où elle n'a personne à recouvrir),
   * en faire deux pages si la coupure est un temps de la narration, et le `\n`
   * quand c'est la ligne elle-même qu'on veut casser. Une maquette dit la même
   * chose avec un `<br>`.
   *
   * **L'espace insécable (U+00A0) est de la copy, pas de la mise en forme.** La
   * typographie française la met devant « : ; ! ? », et c'est elle qui empêche
   * le deux-points de tomber seul en début de ligne — mesuré sur l'étagère, à
   * 240 px de large. Elle est invisible dans le source : la chercher se fait à
   * la recherche, pas à l'œil, et la maquette doit porter la MÊME.
   *
   * Les deux langues ont le MÊME nombre de pages, et c'est une contrainte
   * choisie : une page est un temps de la narration, et les temps ne changent
   * pas d'une langue à l'autre. Le français est 15 à 20 % plus long, ce qui se
   * règle sur `maxWidth`, jamais en coupant une phrase en deux d'un côté et
   * pas de l'autre.
   *
   * **Le français fait foi et lui seul** : c'est la langue des maquettes, et
   * `tests/bubbleAnchors.test.ts` le vérifie mot pour mot contre elles.
   * L'anglais n'a PAS de maquette et n'est donc pas verrouillé — c'est
   * délibéré, pas un oubli. En revanche il partage le `center` et le
   * `maxWidth` du français : la géométrie a été mesurée sur les boîtes rendues
   * en français, donc une traduction plus longue doit être vérifiée à l'œil,
   * et c'est le `maxWidth` qu'on corrige alors, jamais le `center`.
   */
  text: readonly [Localized, ...Localized[]]
  /**
   * Ligne de rappel de 44 px vers l'objet, du côté indiqué.
   *
   * **Le côté suit la position de la bulle dans le cadre** : posée à gauche
   * (`center.x < 0,5`), elle tend son rappel vers la droite, et l'inverse.
   * C'est la seule règle — la ligne relie la bulle à ce dont elle parle, donc
   * elle part du côté où se trouve le sujet.
   *
   * Deux arrêts seulement en avaient (le CV et les posters, maquettés ainsi
   * par la session design) ; les autres l'ont reçue le 2026-08-24, par souci de
   * cohérence. **L'accueil n'en a pas, et c'est la seule exception** : sa bulle
   * est la variante sans titre, centrée en bas, et elle ne désigne aucun objet
   * — elle dit « faites défiler ». Un rappel horizontal y pointerait vers rien.
   */
  tick?: 'left' | 'right' | 'top'
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
    text: [
      {
        // `**…**` marque une CONSIGNE : ces mots-là s'écrivent dans l'accent et
        // un balayage les parcourt (#129). Le marquage vise des MOTS et non la
        // phrase — l'accueil et l'invitation à s'installer racontent, seul le
        // « coup de molette » demande quelque chose.
        fr: 'Bonjour ! Installez-vous, la visite commence. Un **coup de molette** et on y va.',
        en: 'Hello! Make yourself comfortable, the tour is starting. **One flick of the scroll wheel** and off we go.',
      },
    ],
  },
  {
    stop: 'Desk',
    objects: ['Desk_Merged'],
    // Descendue de 40 px dans le cadre du design (0,8304 → 0,8860 sur 720)
    // pour dégager le bureau, et son rappel passe au-dessus (2026-08-24).
    center: { x: 0.5, y: 0.886 },
    maxWidth: 460,
    subject: { fr: 'Le bureau', en: 'The desk' },
    text: [
      {
        fr: 'Bienvenue dans mon bureau. Chaque objet a son histoire : un **clic** ou un **scroll** et elle se raconte.',
        en: "Welcome to my office. Every object here has a story: a **click** or a **scroll** and it'll tell it.",
      },
      {
        fr: 'La pièce maîtresse : café fumant, clavier bruyant, deux écrans et un PC bien trop puissant…',
        en: "The centrepiece: steaming coffee, a loud keyboard, two screens and a PC that's way too powerful…",
      },
      {
        fr: 'De quoi analyser des données, coder des outils, et perdre du temps sur Blender. Comme ici.',
        en: 'Perfect for crunching data, building tools, and losing hours in Blender. Case in point.',
      },
    ],
    tick: 'top',
  },
  {
    stop: 'CV',
    objects: ['Monitors_Screens'],
    center: { x: 0.1355, y: 0.2801 },
    maxWidth: 260,
    subject: { fr: 'Le CV', en: 'The résumé' },
    text: [
      {
        // PAS de consigne ici, et c'est une décision : la phrase promettait
        // « un **clic** pour le télécharger » alors qu'il n'existe aucun
        // fichier à télécharger. Le bouton est #159, dont la definition of
        // done repose la consigne le jour où il arrive.
        fr: 'Mon CV, à jour (promis). Le parcours, les langues, et ce que je cherche : tout est à l’écran.',
        en: "My CV, up to date (I promise). The track record, the languages, and what I'm after: it's all on screen.",
      },
    ],
    tick: 'right',
  },
  {
    stop: 'Cabinet',
    // La commode est modélisée en pièces détachées : la coque suffit à situer
    // sa profondeur, les tiroirs et poignées ne la déplaceraient pas.
    objects: ['Cabinet_Back', 'Cabinet_Top', 'Cabinet_Bottom', 'Cabinet_LSide', 'Cabinet_RSide'],
    // Descendue d'une demi-ligne (0,0198 de cadre) : la copy de #32 fait passer
    // cette bulle de deux à trois lignes, et c'est le COIN HAUT-GAUCHE que la
    // table de placement fixe — la boîte grandit donc vers le bas, et son
    // centre avec. Mesuré sur la maquette à jour, à 1280×720.
    center: { x: 0.1602, y: 0.8602 },
    maxWidth: 300,
    subject: { fr: 'La commode', en: 'The cabinet' },
    text: [
      {
        fr: 'La commode des projets persos : **ouvrez un dossier**, chacun est une idée poussée un peu trop loin.',
        en: 'The side-projects dresser: **open a folder**, each one is an idea I took a little too far.',
      },
    ],
    tick: 'right',
  },
  {
    stop: 'Bookshelf',
    objects: ['Bookshelf_Merged'],
    center: { x: 0.1317, y: 0.6502 },
    maxWidth: 240,
    subject: { fr: 'L’étagère', en: 'The shelf' },
    text: [
      {
        fr: 'Orwell, Asimov, Poe, Horowitz : la bibliothèque qui m’a formé l’esprit. Et parfois gâché des nuits !',
        en: "Orwell, Asimov, Poe, Horowitz: the bookshelf that shaped my mind. And ruined a few nights' sleep!.",
      },
    ],
    tick: 'right',
  },
  {
    stop: 'Cat',
    objects: ['Cat_Merged'],
    // Descendue d'une demi-ligne (0,0198 de cadre) : la copy de #32 fait passer
    // cette bulle de deux à trois lignes, et c'est le COIN HAUT-GAUCHE que la
    // table de placement fixe — la boîte grandit donc vers le bas, et son
    // centre avec. Mesuré sur la maquette à jour, à 1280×720.
    center: { x: 0.1908, y: 0.1702 },
    maxWidth: 340,
    subject: { fr: 'Le chat', en: 'The cat' },
    text: [
      {
        fr: 'Pixel, contrôle qualité. Surveillance constante : rien n’est poussé en "prod" sans son approbation.',
        en: 'Pixel, quality control. Constant surveillance: nothing gets pushed to "prod" without his approval.',
      },
      {
        fr: 'Et il ne vous lâchera jamais des yeux. Si si, je vous jure ! **Bougez votre souris**, vous verrez.',
        en: "And he'll never take his eyes off you. No really, I swear! **Move your mouse**, you'll see.",
      },
    ],
    tick: 'right',
  },
  {
    stop: 'Guitar',
    objects: ['Guitar_Merged'],
    center: { x: 0.6918, y: 0.3953 },
    maxWidth: 380,
    subject: { fr: 'La guitare', en: 'The guitar' },
    text: [
      {
        fr: 'Le soir, c’est elle qui parle : une LTD branchée sur un vieux Sharmall. Les voisins adorent…',
        en: 'In the evening, she does the talking: an LTD plugged into an old Sharmall. The neighbours love it…',
      },
    ],
    // Parallèle au bord de l'ampli, mesuré au pixel pendant la session design.
    tilt: -11.15,
    tick: 'left',
  },
  {
    stop: 'Posters',
    objects: ['Poster_Expanse_Merged'],
    // Descendue d'une demi-ligne (0,0198 de cadre) : la copy de #32 fait passer
    // cette bulle de deux à trois lignes, et c'est le COIN HAUT-GAUCHE que la
    // table de placement fixe — la boîte grandit donc vers le bas, et son
    // centre avec. Mesuré sur la maquette à jour, à 1280×720.
    center: { x: 0.1719, y: 0.4805 },
    maxWidth: 330,
    subject: { fr: 'Les posters', en: 'The posters' },
    text: [
      {
        fr: 'The Expanse au mur. Ma série préférée, point. Complexe, réaliste, la physique y est respectée.',
        en: 'The Expanse on the wall. My favourite show, full stop. Complex, realistic, and the physics holds up.',
      },
      {
        fr: 'Si vous ne l’avez pas vue, on peut en discuter. Si vous l’avez vue, on peut en discuter longtemps.',
        en: "Haven't seen it? We can talk about it. Have seen it? We can talk about it for hours.",
      },
    ],
    tick: 'right',
  },
  {
    stop: 'Telescope',
    objects: ['Telescope_Merged'],
    // Descendue d'une demi-ligne (0,0198 de cadre) : la copy de #32 fait passer
    // cette bulle de deux à trois lignes, et c'est le COIN HAUT-GAUCHE que la
    // table de placement fixe — la boîte grandit donc vers le bas, et son
    // centre avec. Mesuré sur la maquette à jour, à 1280×720.
    center: { x: 0.7708, y: 0.1352 },
    maxWidth: 340,
    subject: { fr: 'Le télescope', en: 'The telescope' },
    text: [
      {
        fr: 'Montagnes, nuit claire, silence : mon coin calme. Et un télescope qui ne demande qu’un **clic**.',
        en: 'Mountains, clear night, silence: my quiet spot. And a telescope that only asks for one **click**.',
      },
      {
        fr: 'Approchez l’œil du télescope, la Lune pose ce soir.',
        en: 'Lean in, the Moon is posing tonight.',
      },
    ],
    tick: 'left',
  },
  {
    stop: 'Scoreboard',
    objects: ['Map_Sheet'],
    // Remontée d'une demi-ligne (0,0198 de cadre), à l'inverse des quatre
    // au-dessus : le design avait posé cette bulle BORD À BORD avec la marge de
    // sécurité du bas (bas mesuré à 703 px pour 708). La troisième ligne que
    // demande la copy de #32 la poussait 29 px hors du cadre, où
    // `clampToSafeArea` l'aurait remontée de force — en la décrochant de son
    // ancre. C'est donc son BAS qui est tenu, pas son coin haut-gauche.
    center: { x: 0.1628, y: 0.8806 },
    maxWidth: 340,
    subject: { fr: 'La mappemonde', en: 'The world map' },
    text: [
      {
        fr: 'Chaque fil, une culture découverte, un plat testé, une langue massacrée avec enthousiasme.',
        en: 'Every thread: a culture discovered, a dish tried, a language butchered with enthusiasm.',
      },
    ],
    tick: 'right',
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
export function bubblePages(bubble: BubbleContent, projectCount: number, locale: Locale): string[] {
  // Le tiroir vide (#78) ne raconte pas la même chose que le tiroir plein : il
  // remplace le dialogue entier, et n'a qu'un temps. C'est un REPLI, pas une
  // page de plus — l'ajouter à la suite ferait dire à l'arrêt une phrase sur
  // des projets qui ne sont pas là, puis une autre pour s'en excuser.
  if (bubble.stop === DRAWER_STOP_LABEL && projectCount === 0) {
    return [t(PROJECTS_EMPTY, locale)]
  }
  return bubble.text.map((page) => t(page, locale))
}
