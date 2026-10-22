import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/**
 * La feuille du design system, vérifiée sur ce qu'aucun outil du projet ne
 * regarde : sa STRUCTURE.
 *
 * Prettier la formate, ESLint ne la lit pas, et le navigateur ne se plaint
 * jamais — CSS n'a pas d'erreur fatale, il ignore ce qu'il ne comprend pas.
 * Une accolade en trop suffit donc à faire disparaître **tout ce qui suit**
 * dans le fichier, en silence.
 *
 * C'est arrivé le 2026-08-24 : une accolade surnuméraire laissée par une
 * réécriture de bloc a fait tomber la règle `.scope`, 270 lignes plus bas. La
 * visée du télescope a cessé d'exister — la lune s'affichait plein cadre, sans
 * cache — et rien n'a échoué : ni le lint, ni Prettier, ni les 288 tests, ni la
 * boucle de comparaison, qui ne lit que le tampon WebGL.
 */
const tokens = readFileSync('src/styles/tokens.css', 'utf8')

/** Le fichier sans ses commentaires, mais avec ses sauts de ligne. */
function sansCommentaires(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, (bloc) => bloc.replace(/[^\n]/g, ' '))
}

describe('tokens.css', () => {
  it('a ses accolades équilibrées', () => {
    const net = sansCommentaires(tokens)
    const ouvrantes = (net.match(/\{/g) ?? []).length
    const fermantes = (net.match(/\}/g) ?? []).length
    expect(ouvrantes, `${ouvrantes} ouvrantes pour ${fermantes} fermantes`).toBe(fermantes)
  })

  it('ne referme jamais un bloc qui n’est pas ouvert', () => {
    // Le compte global peut être juste alors qu'une fermeture prématurée a déjà
    // fait dériver le reste — deux erreurs qui se compensent. On suit donc la
    // profondeur ligne à ligne, et on nomme la ligne fautive.
    const lignes = sansCommentaires(tokens).split('\n')
    let profondeur = 0
    let faute: number | null = null
    lignes.forEach((ligne, i) => {
      profondeur += (ligne.match(/\{/g) ?? []).length - (ligne.match(/\}/g) ?? []).length
      if (profondeur < 0 && faute === null) faute = i + 1
    })
    expect(faute, faute === null ? '' : `accolade en trop ligne ${faute}`).toBeNull()
  })

  it('n’imbrique jamais une règle @ dans une autre règle', () => {
    // LE contrôle qui manquait. Le compte d'accolades peut être JUSTE et la
    // feuille cassée : c'est exactement ce qui est arrivé en corrigeant le
    // défaut précédent — en retirant une accolade de trop, j'ai retiré celle
    // qui fermait `.ping__tap`, si bien que `@keyframes ping-wave` s'est
    // retrouvé imbriqué DANS la règle. Le fichier est resté équilibré, les
    // trois tests d'accolades sont restés verts, et l'onde a cessé d'exister.
    //
    // `@keyframes`, `@media` et `@property` n'ont rien à faire ailleurs qu'à
    // la racine : les y trouver signale un bloc qu'on a oublié de fermer.
    const lignes = sansCommentaires(tokens).split('\n')
    let profondeur = 0
    const imbriquées: string[] = []
    lignes.forEach((ligne, i) => {
      const at = ligne.match(/@(keyframes|media|property)\b/)
      if (at && profondeur > 0) imbriquées.push(`ligne ${i + 1} : @${at[1]}`)
      profondeur += (ligne.match(/\{/g) ?? []).length - (ligne.match(/\}/g) ?? []).length
    })
    expect(imbriquées, imbriquées.join(', ')).toEqual([])
  })

  it('ferme tout ce qu’elle a ouvert', () => {
    const lignes = sansCommentaires(tokens).split('\n')
    const profondeur = lignes.reduce(
      (d, l) => d + (l.match(/\{/g) ?? []).length - (l.match(/\}/g) ?? []).length,
      0,
    )
    expect(profondeur, 'un bloc reste ouvert en fin de fichier').toBe(0)
  })
})
