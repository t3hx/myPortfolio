import type { CSSProperties } from 'react'

/**
 * Une marque monochrome, peinte par un MASQUE (#167, #169, #170).
 *
 * C'est la seule implémentation du procédé dans le projet, et elle sert trois
 * réglettes : les vignettes du CV de la scène, les tuiles du site classique et
 * les liens sociaux de la barre de menu.
 *
 * **Un masque, jamais une image.** Les fichiers de `public/icons/` portent
 * `fill="currentColor"`, et `currentColor` dans une balise `img` n'a aucun
 * contexte dont hériter : il vaut noir, donc invisible sur du verre fumé. Le
 * masque ne lit que la transparence du fichier et prend sa couleur d'ici — si
 * bien qu'une seule marque sert une vignette crème et une barre à 72 %
 * d'opacité, sans un fichier par teinte.
 *
 * **Le repli est du TEXTE, et c'est voulu** : il se lit, se sélectionne et
 * s'énonce. Une marque, elle, est décorative — quelque chose d'autre dit son
 * nom, l'étiquette sous la vignette ou le nom accessible du lien.
 *
 * La taille appartient à l'appelant : la recette vit dans `tokens.css`, chaque
 * réglette pose son `--mark-size` (et son `--mark-slab` pour un pavé).
 */
export function Mark({
  icon,
  fallback,
  slab,
}: {
  /** Chemin de `MARKS`. Absent = le repli s'affiche. */
  icon?: string
  /** Ce qui s'affiche sans marque : une initiale, deux lettres. */
  fallback: string
  /** La marque est un pavé et se peint un cran plus petit — voir `CvGlyph.slab`. */
  slab?: true
}) {
  if (icon === undefined) return <>{fallback}</>
  return (
    <span
      className={slab ? 'glyph-mark glyph-mark--slab' : 'glyph-mark'}
      // `--mark` est posé en ligne : c'est la seule chose qui change d'une
      // marque à l'autre, et une classe par technologie aurait mis dix-neuf
      // règles dans la feuille pour une seule différence.
      style={{ '--mark': `url(${icon})` } as CSSProperties}
      aria-hidden="true"
    />
  )
}
