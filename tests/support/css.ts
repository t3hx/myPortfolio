/**
 * Petits outils de lecture de `tokens.css` pour les tests.
 *
 * Ils existent pour une raison précise : plusieurs contrôles lisaient
 * « tout ce qui suit le premier `@media (prefers-reduced-motion)` », c'est-à-dire
 * la fin du fichier. Ça tenait tant que ces blocs étaient les derniers de la
 * feuille — ajouter une règle de mouvement réduit plus haut a suffi à leur faire
 * lire des sélecteurs qu'ils n'avaient jamais eu l'intention de voir (#122).
 * **Un test qui dépend de l'ORDRE des règles finit par accuser la mauvaise.**
 */

/** Le contenu de tous les blocs `@media (prefers-reduced-motion)`, et rien d'autre. */
export function reducedMotionBlocks(css: string): string {
  const out: string[] = []
  let from = 0
  for (;;) {
    const at = css.indexOf('@media (prefers-reduced-motion', from)
    if (at === -1) break
    const open = css.indexOf('{', at)
    let depth = 0
    let i = open
    for (; i < css.length; i++) {
      if (css[i] === '{') depth++
      else if (css[i] === '}' && --depth === 0) break
    }
    out.push(css.slice(open + 1, i))
    from = i
  }
  return out.join('\n')
}
