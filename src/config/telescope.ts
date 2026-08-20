/**
 * Le télescope (issues #106 et § 2.1 de la spec d'interactions).
 *
 * Un seul nom, mais il vaut mieux ici qu'en dur dans deux composants : le cerne
 * de survol et l'entrée en phase TELESCOPE doivent viser exactement le même
 * objet, sinon on cerne ce qui n'est pas cliquable.
 */
export const TELESCOPE_OBJECT = 'Telescope_Merged'

/**
 * Le nœud touché est-il le télescope ?
 *
 * **Le suffixe est le piège.** `Telescope_Merged` est un maillage à TROIS
 * primitives, et le chargeur glTF en fait un groupe dont les enfants
 * s'appellent `Telescope_Merged_1`, `_2`, `_3`. Un raycast ne rend jamais le
 * groupe, toujours l'enfant : une égalité stricte sur le nom ne reconnaît donc
 * jamais rien — mesuré, elle a cassé d'un coup le clic ET le survol.
 *
 * Le préfixe est vérifié avec son `_`, pas seul : sans lui, un futur
 * `Telescope_MergedShadow` passerait pour le télescope.
 */
export function isTelescope(name: string): boolean {
  return name === TELESCOPE_OBJECT || name.startsWith(`${TELESCOPE_OBJECT}_`)
}

/**
 * L'excursion se fait en DEUX TEMPS (issue #106, deuxième passe).
 *
 * En un seul vol, on passait de la fenêtre à un gros plan de lune à ~270 mm
 * sans que rien ne dise qu'un télescope se trouvait entre les deux : la caméra
 * traversait l'instrument. La chorégraphie demandée est
 * « fenêtre → objectif → dans l'objectif → lune », donc il faut un arrêt.
 *
 * Le premier temps amène derrière l'OCULAIRE, l'instrument plein cadre. C'est
 * là que la visée s'ouvre — on vient d'y coller l'œil. Le second temps se fait
 * DANS la visée, et ne change plus que le champ : c'est le grossissement, pas
 * un déplacement.
 */
export const TELESCOPE_APPROACH_S = 0.95
export const TELESCOPE_ZOOM_S = 1.25

/**
 * Recul derrière l'oculaire, en mètres, le long de l'axe de visée.
 *
 * La pose de l'oculaire n'est pas dans le `.glb` : elle se déduit de la caméra
 * `CameraStop_TelescopeMoon`, que Blender a déjà posée à 58 cm du télescope,
 * en reculant le long de son axe. Rien à re-exporter.
 */
export const TELESCOPE_EYEPIECE_BACK = 0.5

/** Champ horizontal, en degrés, du temps d'approche : l'instrument entier. */
export const TELESCOPE_APPROACH_HFOV = 52

/**
 * Élargissement du champ final, en facteur.
 *
 * L'arrêt `Moon` du tour cadre la lune plein écran — c'est la décision de
 * Blender et elle ne bouge pas. Mais dans une VISÉE, une lune qui touche les
 * bords ne laisse pas voir qu'on regarde à travers quelque chose : il faut du
 * ciel autour d'elle et de la place pour le cache. L'excursion élargit donc son
 * champ, et elle seule — le tour continue de rendre le cadrage authored.
 */
export const TELESCOPE_FOV_PAD = 1.5
