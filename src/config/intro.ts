/**
 * L'intro « Triangle » (issue #127) : ce qui la pose sur l'écran principal.
 *
 * Le vocabulaire est fixé dans CONTEXT.md — écran principal, dernière image,
 * geste de saut. Ici ne vivent que les nombres et les noms que le code lit.
 */

/**
 * Le matériau de la surface d'écran, dans le `.glb`. Un seul matériau sur une
 * seule primitive de huit sommets, qui couvre les DEUX moniteurs — l'horizontal
 * et le vertical. C'est `findScreenPlane` qui sépare les deux, en choisissant
 * la face que la caméra Home regarde.
 */
export const SCREEN_MATERIAL = 'Mat_MonitorScreen'

/** L'arrêt dont la caméra désigne l'écran principal, par son `label`. */
export const INTRO_HOME_STOP = 'Home'

/**
 * Le cadre de la composition, en pixels du design : l'animation a été
 * chorégraphiée dans un 1920 × 1080, et toutes ses positions y sont écrites.
 * Ce cadre est posé ENTIER sur l'écran — contenu et centré, jamais rogné ni
 * étiré (décision du 2026-09-05).
 */
export const INTRO_FRAME = { width: 1920, height: 1080 } as const

/**
 * Le cadre est contenu dans CE QUE LE VISITEUR VOIT À HOME, pas dans l'écran.
 *
 * Les deux ne coïncident qu'en 16:9. Le cadrage Home est un `fit: contain`
 * (#135) : sur une fenêtre plus haute (16:10, un MacBook) il rogne les côtés
 * de l'écran, sur une plus large (21:9) le haut et le bas. Mesuré à 1440×900,
 * un cadre dimensionné sur l'écran débordait de la fenêtre de 2,5 % de chaque
 * côté — l'animation aurait perdu ses bords sans que rien ne le dise.
 *
 * La marge est donc une fraction de la HAUTEUR de la fenêtre à Home, laissée
 * libre des quatre côtés du cadre. Un seul réglage, à ajuster à l'écran.
 */
export const INTRO_SCREEN_MARGIN = 0.03

/**
 * Ce que la barre de menu réserve sur le bord DROIT de la fenêtre, en px :
 * sa largeur plus son retrait du bord (`.menu` dans tokens.css — 52 + 12).
 * La barre ne doit gêner en rien la lecture de l'animation (décision du
 * 2026-09-05) : le cadre s'arrête avant elle, et comme il reste centré sur
 * l'écran, la même réserve vaut à gauche. `tests/introScreen.test.ts` échoue
 * si les tokens et ce nombre divergent.
 */
export const INTRO_SAFE_INSET_PX = 64

/**
 * La latence entre la découverte (le préchargeur est parti) et le départ de
 * l'intro, en ms. Jamais sur la même image : le visiteur voit d'abord l'écran,
 * puis l'écran s'allume. Sous une seconde (décision du 2026-09-05).
 * Doit suivre `--t-intro-delay` (tokens.css) — verrouillé par tests/intro.test.ts.
 */
export const INTRO_DELAY_MS = 800

/**
 * Ce que la bulle Home attend après la dernière image avant de parler, en ms.
 * Que l'intro finisse par le temps ou par un geste de saut, la bulle suit une
 * seconde plus tard (décision du 2026-09-05).
 * Doit suivre `--t-intro-bubble` (tokens.css) — verrouillé par tests/intro.test.ts.
 */
export const INTRO_BUBBLE_DELAY_MS = 1000

/**
 * L'accent de l'intro. **Arbitré le 2026-09-07** (#147), en le voyant projeté
 * sur l'écran dans la scène, contre `#8FDBE4` — le `--glow` du design system —
 * et `#BFF7FF`. Il reste distinct du `--glow`, et c'est voulu : l'intro est ce
 * que l'écran affiche, pas ce que la pièce éclaire.
 *
 * Il double `--intro-accent` de `tokens.css` : le CSS peint le texte et les
 * tirets, le canvas peint les particules et les ondes en JavaScript, et aucun
 * des deux ne peut lire la déclaration de l'autre. `tests/intro.test.ts` échoue
 * si les deux divergent. `?accent=` reste, comme `?lw=`, pour en comparer une
 * autre sans toucher au code.
 */
export const INTRO_ACCENT = '#00C0E8'
/** Le crème du texte, celui du design system. */
export const INTRO_CREAM = '#EFE5D3'

/**
 * Le doré des mots de phase et de leurs tirets (#147).
 *
 * **Il est DÉRIVÉ du crème, pas choisi à côté.** La palette du site n'a qu'une
 * seule couleur qui ne soit pas un cyan — `--cream`, `hsl(39, 47%, 88%)` — et
 * les mots de phase doivent se démarquer de l'accent quel qu'il soit : les
 * trois candidates sont à 186, 190 et 188 degrés de teinte. Ce doré garde la
 * teinte du crème (39 → 41°), monte sa saturation (47 → 68 %) et baisse sa
 * clarté (88 → 75 %). Il reste donc la même famille — la seule chaude de la
 * palette — à 149 degrés de teinte de l'accent, et il se lit doré plutôt que
 * blanc cassé.
 *
 * Il porte le texte ET les tirets : deux couleurs pour un même mot en feraient
 * deux éléments, alors que les tirets sont sa ponctuation.
 *
 * Il double `--intro-gold` de `tokens.css`, pour la raison qui vaut pour
 * l'accent — et `tests/intro.test.ts` verrouille les deux ensemble.
 */
export const INTRO_GOLD = '#EBCF94'
/** Le cœur blanc-cyan des néons et des grosses particules. */
export const INTRO_CORE = '#EAFBFF'
/** Le nombre de particules de la nova et du tourbillon (réglage final du handoff). */
export const INTRO_PARTICLES = 900

/**
 * La police du nom, la seule chose que le tourbillon vise (#146).
 *
 * Elle est déclarée ICI parce qu'elle est écrite deux fois : par le CSS, qui
 * pose les vraies lettres, et par le canvas hors écran, qui les échantillonne
 * pour donner une cible à chaque particule. Deux tailles divergentes feraient
 * converger le tourbillon sur un nom que personne n'affiche — sans erreur, et
 * sans que rien ne le dise. `tests/intro.test.ts` verrouille le CSS dessus.
 *
 * `css` est la forme abrégée que `document.fonts.load()` et `ctx.font`
 * attendent, et elle doit rester cohérente avec les deux nombres.
 */
export const INTRO_NAME_FONT = {
  family: 'Michroma',
  size: 96,
  letterSpacing: 6,
  css: '96px Michroma',
} as const

/**
 * Le titre gravé au laser, en deux morceaux : celui qui clignote ensuite pour
 * toujours, et le reste. **En anglais dans les deux langues** (décision
 * produit, comme les mots de phase) : c'est un titre de métier, et sa largeur
 * calibre la gravure.
 */
export const INTRO_TITLE = { flicker: 'CREATIVE', rest: ' DEVELOPER' } as const

/**
 * La largeur du bloc du titre, en px du cadre. Ce n'est pas une mise en page :
 * c'est la course du faisceau. L'étincelle suit `progression × cette largeur`,
 * et le `clip-path` découvre exactement ce bloc — changer l'un sans l'autre
 * laisse l'étincelle à côté du bord qu'elle est censée graver.
 */
export const INTRO_TITLE_WIDTH = 580
