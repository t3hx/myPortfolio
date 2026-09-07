import type { LabPlan } from '@/content/labPlan'
import { INTRO_FRAME } from '@/config/intro'

/**
 * Le plan du lab, aplati en image une fois qu'il ne se dessine plus (#145).
 *
 * **Pourquoi.** Pendant la révélation, l'écran principal recule : mesuré, le
 * cadre passe de 1727 px à 479 px de large en 1,66 s. Un `<Html transform>`
 * de drei est du DOM sous une `matrix3d` réécrite à chaque image, donc le
 * navigateur re-rastérise son contenu à une échelle nouvelle 230 fois de
 * suite — et ce contenu, depuis la phase 2, est un dessin au trait de 2 346
 * tracés. **Sous Gecko, cela coûte le tiers des images du recul** : 238 images
 * sans le plan, 172 avec, le 95e centile du temps par image passant de 7,4 à
 * 14,0 ms. Sous Chromium (Skia) le même recul ne perd rien, ce qui est
 * exactement pourquoi la mesure a été refaite sur le moteur du visiteur.
 *
 * Une image, elle, se compose : mesuré, l'aplatissement rend les 238 images du
 * témoin, au centime près.
 *
 * **Deux fausses pistes, écartées par la mesure.** `will-change: transform` ne
 * change rien (Gecko re-rastérise quand même). Fusionner les 2 346 tracés en
 * six chemins — un par épaisseur — est PIRE (133 images) : un chemin unique
 * couvrant tout le cadre se rastérise d'un bloc, sans découpage. Le coût n'est
 * donc pas le nombre d'éléments mais la surface vectorielle à repeindre.
 *
 * **Quand.** À la dernière image de l'intro, et pas avant : tant que le plan
 * s'écrit, il doit rester vectoriel. C'est sans risque, car la caméra ne peut
 * pas quitter Home plus tôt — pendant l'intro, la molette est le geste de saut
 * et n'atteint jamais le tour.
 */

/**
 * Le plan en un document SVG autonome, prêt à être rastérisé. Pur, pour être
 * vérifiable hors navigateur : c'est la seule moitié du travail qui puisse se
 * tromper en silence.
 *
 * Il redit en attributs ce que `.intro-lab` déclare en CSS — un document
 * chargé dans une `Image` est isolé, aucune feuille de style de la page ne
 * l'atteint. Le pointillé, lui, n'est pas repris : le dessin est fini.
 */
export function labPlanSvg(plan: LabPlan, accent: string): string {
  let paths = ''
  for (const batch of plan.order)
    for (const [d, width] of plan.batches[batch])
      paths += `<path d="${d}" stroke-width="${width}"/>`
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${INTRO_FRAME.width}" height="${INTRO_FRAME.height}" ` +
    `viewBox="0 0 ${INTRO_FRAME.width} ${INTRO_FRAME.height}">` +
    // Le même décalage que le composant : le plan est cadré 1920 × 1050 et
    // l'intro en 1920 × 1080.
    `<g transform="translate(0 15)" fill="none" stroke="${accent}" stroke-linecap="round">${paths}</g>` +
    `</svg>`
  )
}

/**
 * La densité à laquelle rastériser. Le plan est vu au plus grand à Home, où il
 * remplit presque la fenêtre : en dessous de la densité de l'écran, le trait
 * serait plus mou qu'aujourd'hui. Plafonnée à 2, comme le canvas du monde A —
 * au-delà, la mémoire monte plus vite que la netteté.
 */
export function rasterDensity(devicePixelRatio: number): number {
  return Math.min(2, Math.max(1, devicePixelRatio || 1))
}

/**
 * Rend le document en une image, et renvoie une URL d'objet à donner à un
 * `<image>`. Un `blob:` plutôt qu'un `data:` : la donnée reste hors du DOM,
 * là où un PNG de 3840 × 2160 en base64 serait plusieurs mégaoctets d'attribut.
 * L'appelant révoque l'URL quand il la remplace ou disparaît.
 */
export async function rasterizeLabPlan(svg: string, density: number): Promise<string> {
  const image = new Image()
  await new Promise<void>((resolve, reject) => {
    image.onload = () => {
      resolve()
    }
    image.onerror = () => {
      reject(new Error('le plan du lab ne se rastérise pas'))
    }
    image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
  })

  const canvas = document.createElement('canvas')
  canvas.width = Math.round(INTRO_FRAME.width * density)
  canvas.height = Math.round(INTRO_FRAME.height * density)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('pas de contexte 2D pour rastériser le plan')
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height)

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('le plan du lab ne se convertit pas en image')
  return URL.createObjectURL(blob)
}
