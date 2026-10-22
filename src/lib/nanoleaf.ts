/**
 * Les maths du dégradé NanoLeaf (issue #36), **pures** : ni three.js ni DOM.
 * `tests/nanoleaf.test.ts` les verrouille.
 */

/**
 * Le rang de chaque tuile le long du panneau, normalisé entre 0 et 1.
 *
 * Les 14 tuiles sont des TRIANGLES, et chacune a ses propres sommets — 42 pour
 * 42 indices, rien n'est partagé. On peut donc calculer un centroïde par tuile
 * et lui donner sa propre valeur, ce qui rend le dégradé réellement « de tuile
 * en tuile » et non un simple dégradé continu qui les traverse.
 *
 * C'est le RANG qui est retourné, pas la position : les tuiles d'un panneau
 * NanoLeaf ne sont pas régulièrement espacées, et une vague indexée sur la
 * position accélérerait et ralentirait selon les trous. Sur le rang, elle
 * avance d'une tuile à l'autre au même pas.
 */
export function tileRanks(positions: ArrayLike<number>): Float32Array {
  const triangles = Math.floor(positions.length / 9)
  const keys: { index: number; along: number }[] = []

  for (let t = 0; t < triangles; t++) {
    let cx = 0
    let cy = 0
    for (let v = 0; v < 3; v++) {
      cx += positions[t * 9 + v * 3]
      cy += positions[t * 9 + v * 3 + 1]
    }
    // La diagonale du panneau plutôt qu'un seul axe : les tuiles montent en
    // zigzag, et sur X seul deux voisines verticales seraient confondues.
    keys.push({ index: t, along: cx / 3 + cy / 3 })
  }

  keys.sort((a, b) => a.along - b.along)

  // Une valeur par SOMMET, mais constante sur les trois d'une tuile : c'est ce
  // qui donne un aplat par tuile au lieu d'un dégradé qui la traverse.
  const out = new Float32Array(triangles * 3)
  keys.forEach((tile, rank) => {
    const value = triangles > 1 ? rank / (triangles - 1) : 0
    for (let v = 0; v < 3; v++) out[tile.index * 3 + v] = value
  })
  return out
}
