import { glyphMark, type CvGlyph } from '@/content/cv'
import type { Locale } from '@/lib/locale'
import { Mark } from '@/ui/Mark'

/**
 * La marque d'une vignette de CV : le fichier quand il existe, l'initiale
 * sinon (#169).
 *
 * Partagé par les deux réglettes — l'écran vertical de la scène et les tuiles
 * du site classique — parce que la règle est une et la même. Les deux avaient
 * déjà la même ternaire recopiée, et c'est le genre de duplication qui finit
 * par diverger sur un détail que personne ne regarde deux fois.
 *
 * Ce composant ne sait que résoudre le REPLI d'un glyphe de CV ; le masque,
 * lui, vit dans `Mark`, qui sert aussi les liens sociaux de la barre (#170).
 */
export function CvMark({ glyph, locale }: { glyph: CvGlyph; locale: Locale }) {
  return <Mark icon={glyph.icon} fallback={glyphMark(glyph, locale)} slab={glyph.slab} />
}
