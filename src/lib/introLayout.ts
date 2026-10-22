/**
 * La pose du cadre de l'intro sur l'écran (issue #142) : contenu, centré, avec
 * une marge. Jamais rogné, jamais étiré.
 *
 * **Contenu dans ce que le visiteur voit à Home, pas dans l'écran.** Les deux
 * ne coïncident qu'en 16:9 : le cadrage Home rogne les côtés de l'écran sur
 * une fenêtre plus haute et le haut et le bas sur une plus large (#135). Le
 * calcul part donc de la fenêtre — sa taille en px, ce qu'elle montre de
 * l'écran en mètres — retire la réserve de la barre de menu et la marge, y
 * contient le cadre, puis exprime le tout dans le repère de l'écran, où le
 * DOM est posé.
 *
 * Le cadre garde toujours ses pixels de design (1920 × 1080) : c'est la boîte
 * de l'écran qui est dimensionnée autour de lui, et `distanceFactor` qui dit
 * à drei combien vaut un pixel en mètres.
 */
export interface Size {
  width: number
  height: number
}

export interface LayoutInput {
  /** Le rectangle de l'écran, en mètres. */
  screen: Size
  /** Le cadre de la composition, en px de design. */
  frame: Size
  /** La fenêtre du navigateur, en px CSS. */
  viewport: Size
  /** Ce que la caméra Home montre à la profondeur de l'écran, en mètres. */
  visible: Size
  /** Ce qu'un bord vertical de la fenêtre réserve (la barre), en px CSS. */
  insetPx: number
  /** Fraction de la HAUTEUR de la fenêtre laissée libre de chaque côté. */
  margin: number
}

export interface ScreenLayout {
  /** La boîte qui couvre tout l'écran, en px de design — l'encre autour. */
  screen: Size
  /** Le cadre, en px de design : toujours `frame`, jamais redimensionné. */
  frame: Size
  /** La taille du cadre en mètres, sur l'écran. */
  frameMeters: Size
  /**
   * Le facteur drei (mode `transform`) : un élément de P px mesure
   * P × distanceFactor / 400 unités monde.
   */
  distanceFactor: number
}

const DREI_PX_PER_UNIT = 400

export function screenLayout(input: LayoutInput): ScreenLayout {
  const { screen, frame, viewport, visible, insetPx, margin } = input
  if (!(margin >= 0 && margin < 0.5)) {
    throw new RangeError(`intro margin must be in [0, 0.5), got ${margin}`)
  }
  // La zone sûre, en px de fenêtre : la barre à droite, et autant à gauche
  // pour que le cadre reste centré ; la marge des quatre côtés.
  const marginPx = viewport.height * margin
  const safe = {
    width: viewport.width - 2 * (insetPx + marginPx),
    height: viewport.height - 2 * marginPx,
  }
  if (safe.width <= 0 || safe.height <= 0) {
    throw new RangeError('intro safe area is empty: viewport too small for the inset and margin')
  }
  // Contenu : la dimension la plus contraignante décide de l'échelle.
  const scale = Math.min(safe.width / frame.width, safe.height / frame.height)
  const framePx = { width: frame.width * scale, height: frame.height * scale }

  // De la fenêtre à l'écran : un px de fenêtre vaut `visible / viewport`
  // mètres à la profondeur de l'écran.
  const metersPerViewportPx = visible.width / viewport.width
  const frameMeters = {
    width: framePx.width * metersPerViewportPx,
    height: framePx.height * metersPerViewportPx,
  }

  // Du monde aux px de design : le cadre fait exactement ses 1920 × 1080.
  const metersPerDesignPx = frameMeters.width / frame.width
  return {
    screen: {
      width: screen.width / metersPerDesignPx,
      height: screen.height / metersPerDesignPx,
    },
    frame: { width: frame.width, height: frame.height },
    frameMeters,
    distanceFactor: metersPerDesignPx * DREI_PX_PER_UNIT,
  }
}
