import { INTRO_NAME_FONT } from '@/config/intro'
import { CX, NAME_Y } from '@/lib/introScene'

/**
 * Les cibles du tourbillon (#146) : les pixels du nom, relevés une fois dans
 * un canvas hors écran.
 *
 * Les particules sont dessinées dans un canvas et les lettres écrites dans le
 * DOM ; ce qui les fait coïncider est que l'échantillonnage rend ses points
 * **dans le repère du cadre**, autour de (CX, NAME_Y), et non dans celui du
 * canvas de mesure. Une cible laissée en coordonnées de canvas ferait
 * converger tout le tourbillon en haut à gauche, à côté des lettres.
 *
 * **Il faut que Michroma soit chargée avant de mesurer.** Sans elle le canvas
 * dessine la police de repli, dont les glyphes n'ont ni la même largeur ni le
 * même dessin : le tourbillon composerait un autre nom que celui affiché, ce
 * qui ne lève aucune erreur et ne se voit qu'à l'œil. On échantillonne donc
 * une seule fois, à T = 0, après avoir attendu la fonte — et si elle
 * n'arrive pas, on rend une liste VIDE plutôt qu'un faux nom : le tourbillon
 * n'a pas lieu, les vraies lettres s'écrivent quand même.
 */

/** Le pas de la grille d'échantillonnage, en px. */
export const NAME_SAMPLE_STEP = 6
/** Le seuil d'opacité au-delà duquel un pixel est de l'encre, pas du crénage. */
export const NAME_SAMPLE_ALPHA = 120
/** La boîte de mesure, en px. Élargie si le nom déborde. */
const SAMPLE_BOX = { width: 1700, height: 220 }

export type NameTarget = [number, number]

/**
 * Les pixels encrés d'un buffer RGBA, exprimés dans le repère du cadre.
 * `origin` est le point du buffer qui correspond à (CX, NAME_Y) — le centre du
 * nom sur sa ligne.
 */
export function sampleGlyphs(
  data: Uint8ClampedArray,
  size: { width: number; height: number },
  origin: { x: number; y: number },
): NameTarget[] {
  const out: NameTarget[] = []
  for (let y = 2; y < size.height; y += NAME_SAMPLE_STEP)
    for (let x = 2; x < size.width; x += NAME_SAMPLE_STEP)
      if (data[(y * size.width + x) * 4 + 3] > NAME_SAMPLE_ALPHA)
        out.push([x - origin.x + CX, y - origin.y + NAME_Y])
  return out
}

/**
 * Le nom échantillonné, prêt à servir de cible. Rend une liste vide — jamais
 * une erreur — quand la fonte ou le canvas manquent : c'est une animation, pas
 * une donnée, et rien de visible ne doit dépendre de sa présence.
 */
export async function nameTargets(text: string): Promise<NameTarget[]> {
  const fonts = document.fonts
  if (fonts?.load) {
    const faces = await fonts.load(INTRO_NAME_FONT.css, text)
    if (faces.length === 0) {
      console.warn(
        `[intro] ${INTRO_NAME_FONT.family} ne se charge pas : pas de tourbillon, le nom s'écrira seul`,
      )
      return []
    }
  }
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return []

  // On mesure avant de dimensionner : un nom plus long que la boîte serait
  // rogné, et le tourbillon viserait un nom amputé.
  ctx.font = INTRO_NAME_FONT.css
  setLetterSpacing(ctx, INTRO_NAME_FONT.letterSpacing)
  const width = Math.max(SAMPLE_BOX.width, Math.ceil(ctx.measureText(text).width) + 40)
  canvas.width = width
  canvas.height = SAMPLE_BOX.height
  const origin = { x: width / 2, y: SAMPLE_BOX.height / 2 }

  // Le contexte est remis à zéro par le redimensionnement : tout se réécrit.
  ctx.font = INTRO_NAME_FONT.css
  setLetterSpacing(ctx, INTRO_NAME_FONT.letterSpacing)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#fff'
  ctx.fillText(text, origin.x, origin.y)

  const image = ctx.getImageData(0, 0, canvas.width, canvas.height)
  return sampleGlyphs(image.data, { width: canvas.width, height: canvas.height }, origin)
}

/**
 * `letterSpacing` est récent sur un contexte 2D et absent des anciens moteurs.
 * Sans lui les cibles sont un peu plus serrées que les lettres affichées ; le
 * tourbillon reste sur le nom, ce qui vaut mieux qu'une exception.
 */
function setLetterSpacing(ctx: CanvasRenderingContext2D, px: number): void {
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${px}px`
}
