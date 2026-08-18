import { CanvasTexture, SRGBColorSpace, type Texture } from 'three'
import {
  LABEL_FONT_FAMILY,
  LABEL_FONT_PX,
  LABEL_FONT_WEIGHT,
  LABEL_INK,
  LABEL_SAFE_RATIO,
  LABEL_TEXTURE_H,
  LABEL_TEXTURE_W,
} from '@/config/cabinet'

/**
 * Le nom du projet, peint dans une texture pour l'étiquette du dossier (#80).
 *
 * **C'est la seule exception du projet à « jamais de texte en texture »**
 * (décision utilisateur, 2026-08-18). L'étiquette est une _affordance_, comme
 * l'icône d'un bouton : elle ne porte qu'un nom, et ce nom existe aussi dans la
 * fiche DOM, qui reste la version accessible et indexable. L'exception s'arrête
 * là — rien d'autre ne va sur une texture.
 */

/** La police du texte, telle que `canvas` l'attend. */
function fontAt(px: number): string {
  return `${LABEL_FONT_WEIGHT} ${px}px ${LABEL_FONT_FAMILY}`
}

/**
 * Le corps qui fait entrer `text` dans la largeur utile.
 *
 * `TAB_LABEL_MAX_CHARS` empêche les libellés manifestement trop longs
 * d'arriver jusqu'ici, mais un compte de signes reste un proxy : onze « M »
 * sont plus larges que onze « i ». On mesure donc pour de bon, et on réduit
 * tant que ça dépasse — un nom qui déborde de son carton se verrait, alors
 * qu'un nom légèrement plus petit ne se remarque pas.
 */
export function fittingFontPx(ctx: CanvasRenderingContext2D, text: string): number {
  const usable = LABEL_TEXTURE_W * LABEL_SAFE_RATIO
  let px = LABEL_FONT_PX
  // 24 px : en dessous, le nom serait illisible à l'écran et mieux vaut le
  // laisser dépasser visiblement que prétendre l'avoir fait tenir.
  while (px > 24) {
    ctx.font = fontAt(px)
    if (ctx.measureText(text).width <= usable) break
    px -= 2
  }
  return px
}

/**
 * Attend que Space Grotesk soit réellement disponible.
 *
 * `canvas` ne connaît pas `font-display: swap` : si la webfont n'est pas encore
 * chargée au moment du `fillText`, il peint dans la police de secours **sans
 * rien signaler**, et l'étiquette part en production dans la mauvaise fonte.
 * Rien, ensuite, ne le rattrape : une texture est peinte une fois.
 */
export async function labelFontReady(): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return
  try {
    await document.fonts.load(fontAt(LABEL_FONT_PX), 'Portfolio')
    await document.fonts.ready
  } catch {
    // Une fonte indisponible dégrade l'étiquette, elle n'annule pas le dossier.
  }
}

/** La texture d'une étiquette : le nom du projet, centré, sur fond transparent
 *  — le carton de `Folder_Tab` reste visible dessous, avec son bake. */
export function labelTexture(text: string): Texture {
  const canvas = document.createElement('canvas')
  canvas.width = LABEL_TEXTURE_W
  canvas.height = LABEL_TEXTURE_H
  const ctx = canvas.getContext('2d')!

  ctx.clearRect(0, 0, LABEL_TEXTURE_W, LABEL_TEXTURE_H)
  ctx.font = fontAt(fittingFontPx(ctx, text))
  ctx.fillStyle = LABEL_INK
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, LABEL_TEXTURE_W / 2, LABEL_TEXTURE_H / 2)

  const texture = new CanvasTexture(canvas)
  // Le reste du pipeline est en sRGB : une texture d'encre déclarée linéaire
  // ressortirait délavée.
  texture.colorSpace = SRGBColorSpace
  return texture
}
