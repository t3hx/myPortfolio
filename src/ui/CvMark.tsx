import { glyphMark, type CvGlyph } from '@/content/cv'
import type { Locale } from '@/lib/locale'

/**
 * Ce qui se peint DANS une vignette : la marque quand elle existe, l'initiale
 * sinon (#169).
 *
 * Partagé par les deux réglettes — l'écran vertical de la scène et les tuiles
 * du site classique — parce que la règle est une et la même. Les deux avaient
 * déjà la même ternaire recopiée, et c'est le genre de duplication qui finit
 * par diverger sur un détail que personne ne regarde deux fois.
 *
 * **Un MASQUE, pas une image** (#167). Les fichiers portent `fill="currentColor"`,
 * et `currentColor` dans une balise `<img>` n'a aucun contexte dont hériter :
 * il vaut noir, donc invisible sur du verre fumé. Le masque, lui, ne lit que la
 * transparence du fichier et prend sa couleur du contexte — si bien qu'une
 * seule marque sert la vignette crème du CV et la barre de menu à 40 %
 * d'opacité, sans un fichier par teinte.
 *
 * La taille, elle, appartient à la surface : la recette vit dans `tokens.css`,
 * chaque réglette donne ses pixels.
 */
export function CvMark({ glyph, locale }: { glyph: CvGlyph; locale: Locale }) {
  // L'initiale est du TEXTE : elle se lit, se sélectionne et s'énonce. Une
  // marque est décorative — l'étiquette sous la vignette dit déjà son nom.
  if (glyph.icon === undefined) return <>{glyphMark(glyph, locale)}</>
  return (
    <span
      className={glyph.slab ? 'glyph-mark glyph-mark--slab' : 'glyph-mark'}
      style={{ '--mark': `url(${glyph.icon})` } as React.CSSProperties}
      aria-hidden="true"
    />
  )
}
