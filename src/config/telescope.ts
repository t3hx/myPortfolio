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
