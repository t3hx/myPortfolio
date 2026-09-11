import { readFileSync, readdirSync } from 'node:fs'
import { BoxGeometry, Mesh, Object3D, PerspectiveCamera, Quaternion, Vector3 } from 'three'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CAMERA_STOPS } from '@/config/cameraStops'
import { UI } from '@/content/ui'
import { plainText } from '@/lib/richText'
import { BUBBLES, bubbleKicker } from '@/content/bubbles'
import {
  DESIGN_ASPECT,
  FALLBACK_DEPTH,
  SAFE_MARGIN,
  anchorDepth,
  clampToSafeArea,
  designAnchor,
} from '@/lib/bubbleAnchors'
import { verticalFov, type StopTransform } from '@/lib/stops'

/**
 * Les bulles sont la seule chose de l'app dont la justesse ne se lit NI dans
 * le code NI dans la console : une ancre fausse de 15 % du cadre donne une
 * bulle parfaitement rendue, au mauvais endroit. Les trois pièges couverts
 * ici, tous silencieux :
 *
 *   1. la dé-projection (fraction du cadre → point monde) inversée en y, ou
 *      calculée avec le champ VERTICAL alors que `hfov` est horizontal ;
 *   2. la table de placement recopiée à côté de la maquette — le texte livré
 *      diverge de la copy validée sans que rien n'échoue ;
 *   3. la numérotation des kickers, qui suit l'ordre du tour (décision du
 *      2026-08-18) : réordonner CAMERA_STOPS doit renuméroter, pas décaler.
 */

const RAD = Math.PI / 180

/** Un arrêt fabriqué : caméra en `position`, tournée de `yawDeg` autour de Y. */
function stopAt(position: Vector3, yawDeg: number, hfov: number): StopTransform {
  return {
    position,
    quaternion: new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), yawDeg * RAD),
    hfov,
    // La dé-projection d'une ancre ne lit que la position, l'orientation et le
    // champ horizontal : la politique de cadrage (#135) ne l'atteint pas.
    yfov: 30,
    contain: 0,
    column: 0,
  }
}

/** La caméra de rendu telle que `applyProgress` la règle pour cet arrêt. */
function renderCamera(stop: StopTransform, aspect = DESIGN_ASPECT): PerspectiveCamera {
  const cam = new PerspectiveCamera(verticalFov(stop.hfov, aspect), aspect)
  cam.position.copy(stop.position)
  cam.quaternion.copy(stop.quaternion)
  cam.updateMatrixWorld(true)
  cam.updateProjectionMatrix()
  return cam
}

/** Où le point tombe dans le cadre, en fraction (0,0 = coin haut-gauche). */
function projectToFrame(cam: PerspectiveCamera, point: Vector3): { x: number; y: number } {
  const ndc = point.clone().project(cam)
  return { x: (ndc.x + 1) / 2, y: (1 - ndc.y) / 2 }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('designAnchor', () => {
  it('replace chaque bulle du design à sa fraction de cadre, au pixel près', () => {
    const stop = stopAt(new Vector3(2, 1.4, -3), 37, 54.43)
    const cam = renderCamera(stop)

    for (const bubble of BUBBLES) {
      const frame = projectToFrame(cam, designAnchor(stop, 4.2, bubble.center))
      // 1e-4 de cadre = 0,13 px de large sur 1280 : la boucle ferme.
      expect(frame.x).toBeCloseTo(bubble.center.x, 4)
      expect(frame.y).toBeCloseTo(bubble.center.y, 4)
    }
  })

  it("ne place pas la bulle au centre quand le design l'envoie dans un coin", () => {
    // Garde-fou contre un « ça marche » où tout retomberait au milieu du cadre :
    // le coin haut-droit du télescope doit vraiment être en haut à droite.
    const stop = stopAt(new Vector3(0, 0, 0), 0, 54.43)
    const anchor = designAnchor(stop, 5, { x: 0.7708, y: 0.1352 })
    expect(anchor.x).toBeGreaterThan(0.5) // à droite de l'axe
    expect(anchor.y).toBeGreaterThan(0.5) // au-dessus
    expect(anchor.z).toBeCloseTo(-5, 6) // 5 m devant, caméra regardant −Z
  })

  it('projette au même endroit à toutes les profondeurs (la profondeur ne fait que la parallaxe)', () => {
    const stop = stopAt(new Vector3(-1, 2, 0.5), -120, 48)
    const cam = renderCamera(stop)
    const center = { x: 0.1355, y: 0.2801 }

    const near = projectToFrame(cam, designAnchor(stop, 0.8, center))
    const far = projectToFrame(cam, designAnchor(stop, 40, center))

    expect(near.x).toBeCloseTo(far.x, 6)
    expect(near.y).toBeCloseTo(far.y, 6)
  })

  it('garde la position horizontale quand le cadre est rogné par un écran plus haut', () => {
    // Politique « ajustement horizontal » de verticalFov : un viewport 4:3
    // rogne en haut et en bas. La bulle doit garder sa colonne et suivre le
    // rognage, pas déraper latéralement.
    const stop = stopAt(new Vector3(0, 1, 0), 15, 54.43)
    const center = { x: 0.1908, y: 0.1702 }
    const anchor = designAnchor(stop, 3, center)

    const wide = projectToFrame(renderCamera(stop, DESIGN_ASPECT), anchor)
    const tall = projectToFrame(renderCamera(stop, 4 / 3), anchor)

    expect(tall.x).toBeCloseTo(wide.x, 6)
    expect(tall.y).not.toBeCloseTo(wide.y, 3)
  })
})

describe('anchorDepth', () => {
  function sceneWithBox(name: string, at: Vector3): Object3D {
    const scene = new Object3D()
    const mesh = new Mesh(new BoxGeometry(1, 1, 1))
    mesh.name = name
    mesh.position.copy(at)
    scene.add(mesh)
    scene.updateMatrixWorld(true)
    return scene
  }

  it("mesure la distance le long de l'axe de visée, pas la distance brute", () => {
    const scene = sceneWithBox('Cat_Merged', new Vector3(3, 0, -4))
    // Caméra à l'origine regardant −Z : l'objet est à 5 m à vol d'oiseau,
    // mais à 4 m DEVANT — c'est cette dernière qui décide de la parallaxe.
    const stop = stopAt(new Vector3(0, 0, 0), 0, 54.43)
    expect(anchorDepth(scene, ['Cat_Merged'], stop)).toBeCloseTo(4, 6)
  })

  it('unit les boîtes de plusieurs nœuds', () => {
    const scene = sceneWithBox('Cabinet_Top', new Vector3(0, 0, -2))
    const other = new Mesh(new BoxGeometry(1, 1, 1))
    other.name = 'Cabinet_Bottom'
    other.position.set(0, 0, -6)
    scene.add(other)
    scene.updateMatrixWorld(true)

    const stop = stopAt(new Vector3(0, 0, 0), 0, 54.43)
    expect(anchorDepth(scene, ['Cabinet_Top', 'Cabinet_Bottom'], stop)).toBeCloseTo(4, 6)
  })

  it('crie et retombe sur la profondeur de repli quand le nœud manque', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const scene = sceneWithBox('Cat_Merged', new Vector3(0, 0, -4))
    const stop = stopAt(new Vector3(0, 0, 0), 0, 54.43)

    expect(anchorDepth(scene, ['Absent_Merged'], stop)).toBe(FALLBACK_DEPTH)
    expect(warn).toHaveBeenCalled()
  })

  it("retombe sur le repli quand l'objet est derrière la caméra", () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const scene = sceneWithBox('Cat_Merged', new Vector3(0, 0, 4))
    const stop = stopAt(new Vector3(0, 0, 0), 0, 54.43)

    expect(anchorDepth(scene, ['Cat_Merged'], stop)).toBe(FALLBACK_DEPTH)
    expect(warn).toHaveBeenCalled()
  })
})

describe('clampToSafeArea', () => {
  const design = { width: 1280, height: 720 }

  /**
   * La boîte RENDUE de chaque bulle, en px, à 1280×720 — mesurée sur les
   * maquettes à jour avec la copy de #32, sous Firefox et sous Chromium (les
   * deux moteurs s'accordent à 1 px près ; c'est la valeur haute qui est
   * retenue). La guitare est son propre cas : elle est inclinée, et c'est sa
   * boîte englobante — celle que `getBoundingClientRect` rend à l'app — qui
   * mesure 439×190 là où sa boîte de mise en page fait 426×164.
   *
   * **Une hauteur mesurée et non calculée, et c'est le point.** Ce contrôle
   * portait sur une hauteur unique de 111 px pour les dix bulles : toutes
   * tenaient donc dans la marge quoi qu'on écrive. La copy de #32 fait passer
   * quatre bulles à trois lignes (138 px), et la mappemonde — que le design
   * avait posée bord à bord avec la marge du bas — sortait alors de 29 px du
   * cadre, sans que rien ne le dise. Re-mesurer est la seule façon de faire
   * échouer ce test le jour où une page de trop repousse une bulle dehors.
   */
  const RENDERED_BOX: Record<string, { width: number; height: number }> = {
    Home: { width: 645, height: 62 },
    Desk: { width: 506, height: 110 },
    CV: { width: 306, height: 139 },
    Cabinet: { width: 346, height: 139 },
    Bookshelf: { width: 286, height: 167 },
    Cat: { width: 386, height: 139 },
    Guitar: { width: 439, height: 190 },
    Posters: { width: 376, height: 139 },
    Telescope: { width: 386, height: 139 },
    Scoreboard: { width: 386, height: 139 },
  }

  it('ne touche à rien dans le cadre du design', () => {
    // Le placement validé tient déjà dans la marge à 1280×720 : le jour où le
    // clamp bougerait une bulle ici, c'est la table qui aurait dérivé.
    for (const bubble of BUBBLES) {
      const box = RENDERED_BOX[bubble.stop]
      expect(box, `boîte non mesurée pour ${bubble.stop}`).toBeDefined()
      const centre = { x: bubble.center.x * 1280, y: bubble.center.y * 720 }
      expect(clampToSafeArea(centre, box, design), bubble.stop).toEqual(centre)
    }
  })

  it('repousse une bulle qui déborderait du bord', () => {
    // Le cas mesuré : le chat à 19 % d'un cadre de 1000 px sort de 2,2 px.
    const centre = { x: 0.1908 * 1000, y: 300 }
    const safe = clampToSafeArea(centre, { width: 386, height: 111 }, { width: 1000, height: 1000 })
    expect(safe.x).toBeCloseTo(SAFE_MARGIN + 193, 6)
    expect(safe.y).toBe(300)
  })

  it('centre une bulle plus large que le cadre au lieu de la coincer', () => {
    const safe = clampToSafeArea(
      { x: 40, y: 40 },
      { width: 800, height: 111 },
      { width: 600, height: 400 },
    )
    expect(safe.x).toBe(300)
  })
})

const MOCKUP_DIR = 'design/screens'

/**
 * Les phrases de bulle écrites dans un HTML de maquette, telles que le
 * visiteur les lit — donc avec ses sauts de ligne, et sans son balisage.
 *
 * **Un `<br>` de maquette vaut un `\n` de copy** (#32) : la rédaction coupe ses
 * lignes avec `\n`, une maquette avec un `<br>`, et sans cette équivalence
 * couper une phrase ferait échouer un contrôle qui ne parle que de ce qui est
 * écrit. Les retours à la ligne du BALISAGE, eux, sont réduits : une maquette a
 * le droit d'indenter son HTML sans que ça devienne de la copy.
 *
 * L'espace INSÉCABLE (U+00A0) est épargnée par cette réduction, et c'est le
 * point délicat : c'est un blanc pour `\s`, mais c'est de la COPY — la
 * typographie française la met devant « : » et c'est elle qui empêche le
 * deux-points de tomber seul en début de ligne.
 */
export function bubbleTextsIn(html: string): string[] {
  const BREAK = '\u0000'
  return (
    [...html.matchAll(/<article[^>]*class="[^"]*\bbubble\b[^"]*"[\s\S]*?<\/article>/g)]
      // Une bulle marquée `data-variant` documente un REPLI — le tiroir vide
      // (#78) réutilise la bulle de la commode avec une autre phrase. Elle
      // n'appartient à aucun arrêt, donc sa copy ne vit pas dans BUBBLES ; sans
      // ce filtre elle passerait pour une douzième bulle.
      .filter((article) => !/^<article[^>]*\bdata-variant=/.test(article[0]))
      .flatMap((article) => [
        ...article[0].matchAll(/<p class="bubble__text"[^>]*>([\s\S]*?)<\/p>/g),
      ])
      .map((m) =>
        m[1]
          .replace(/<br\s*\/?>/g, BREAK)
          .replace(/[\n\r\t]+/g, ' ')
          .replace(/ {2,}/g, ' ')
          .split(BREAK)
          .map((line) => line.trim())
          .join('\n'),
      )
  )
}

/** Les phrases de bulle d'une maquette, lue sur le disque. */
function mockupTexts(file: string): string[] {
  return bubbleTextsIn(readFileSync(`${MOCKUP_DIR}/${file}`, 'utf8'))
}

describe('lecture des maquettes', () => {
  it('lit un saut de maquette comme un saut de copy, et l’indentation comme rien', () => {
    // Auto-contrôle de l'oracle : c'est cette équivalence qui autorise la
    // rédaction à couper une ligne (#32), et elle ne se voit ni dans le HTML ni
    // dans la chaîne livrée.
    const html = `<article class="bubble">
      <p class="bubble__text">Approchez l’œil,<br />
      la Lune pose ce soir.</p>
    </article>`
    expect(bubbleTextsIn(html)).toEqual(['Approchez l’œil,\nla Lune pose ce soir.'])
  })

  it('garde l’espace insécable, qui est de la copy et non un blanc', () => {
    const html =
      '<article class="bubble"><p class="bubble__text">Les archives\u00a0: deux.</p></article>'
    expect(bubbleTextsIn(html)).toEqual(['Les archives\u00a0: deux.'])
  })

  it('ignore le repli du tiroir vide, qui n’appartient à aucun arrêt', () => {
    expect(mockupTexts('03c-project-empty.html')).toEqual([])
  })
})

describe('BUBBLES', () => {
  it('couvre chaque arrêt du tour, une fois, dans son ordre', () => {
    expect(BUBBLES.map((b) => b.stop)).toEqual(CAMERA_STOPS.map((s) => s.label))
  })

  it('reprend mot pour mot la copy des maquettes de la session design', () => {
    // `10-moon.html` est mis de côté, pas ignoré. La lune n'est plus un arrêt
    // (#113), donc sa phrase n'est plus dans BUBBLES — mais elle est toujours
    // affichée, dans la visée du télescope, et c'est TOUJOURS la copy de la
    // session design. La retirer du test aurait supprimé le seul garde-fou
    // contre sa dérive ; elle est simplement comparée à son nouveau domicile,
    // plus bas.
    const MOON_MOCKUP = '10-moon.html'
    const files = readdirSync(MOCKUP_DIR).filter((f) => f.endsWith('.html'))
    const mockups = files.filter((f) => f !== MOON_MOCKUP).flatMap(mockupTexts)

    // Comparaison par ensemble : l'ordre du tour est une décision produit et
    // n'a pas à suivre l'ordre de capture des maquettes — le texte, si.
    //
    // **Le FRANÇAIS seulement, et c'est délibéré** (#33). Les maquettes de la
    // session design sont en français : c'est la seule langue dont il existe
    // une référence, donc la seule qui puisse dériver en silence. L'anglais
    // n'a pas de maquette et n'est pas verrouillé ici — l'absence de contrôle
    // est une décision, pas un trou à combler par une maquette inventée.
    // La PREMIÈRE page seulement : c'est elle que la session design a écrite.
    // Les pages suivantes sont de la copy neuve (#32) et n'ont pas de maquette
    // à laquelle se comparer — les garder hors de cette égalité est ce qui
    // permet d'en ajouter sans rendre le test faux.
    // Comparé sur le texte NU : les marqueurs de consigne (`**…**`) sont du
    // balisage, pas de la copy, et les maquettes n'en portent pas. Sans ce
    // dénudage, marquer trois mots ferait échouer un contrôle qui ne parle que
    // de ce que le visiteur lit.
    expect([...BUBBLES.map((b) => plainText(b.text[0].fr))].sort()).toEqual([...mockups].sort())

    // La lune : même exigence, autre domicile. Sa maquette ne contient qu'une
    // bulle, et c'est la phrase que la visée affiche maintenant.
    expect(mockupTexts(MOON_MOCKUP)).toEqual([UI.telescope.moon.fr])

    // Ce que l'anglais doit à ce test : exister et ne pas être vide. Une
    // traduction oubliée laisserait une bulle blanche, que rien ne dirait.
    for (const bubble of BUBBLES) {
      for (const [i, page] of bubble.text.entries()) {
        expect(page.en.trim(), `${bubble.stop} page ${i}`).not.toBe('')
        expect(page.fr.trim(), `${bubble.stop} page ${i}`).not.toBe('')
      }
      if (bubble.subject) expect(bubble.subject.en.trim(), bubble.stop).not.toBe('')
    }
  })

  it('n’a aucun arrêt muet', () => {
    // Le type interdit déjà la suite vide, et c'est lui qui garantit AUSSI que
    // les deux langues ont le même nombre de temps : une page porte son
    // français et son anglais ensemble, donc elles ne peuvent pas diverger.
    // Ce test couvre ce que le type ne voit pas — un tableau construit
    // dynamiquement un jour, ou une page ajoutée sans texte.
    for (const bubble of BUBBLES) {
      expect(bubble.text.length, bubble.stop).toBeGreaterThan(0)
    }
  })

  it('reste dans le cadre : centres en fraction, largeurs du design', () => {
    for (const bubble of BUBBLES) {
      expect(bubble.center.x).toBeGreaterThan(0)
      expect(bubble.center.x).toBeLessThan(1)
      expect(bubble.center.y).toBeGreaterThan(0)
      expect(bubble.center.y).toBeLessThan(1)
      expect(bubble.maxWidth === null || bubble.maxWidth > 0).toBe(true)
    }
  })
})

describe('bubbleKicker', () => {
  it("numérote dans l'ordre du tour, home ne consommant pas de numéro", () => {
    expect(bubbleKicker(BUBBLES, 0, 'fr')).toBeUndefined() // home, variante inline
    expect(bubbleKicker(BUBBLES, 1, 'fr')).toBe('01 — Le bureau')
    expect(bubbleKicker(BUBBLES, 2, 'fr')).toBe('02 — Le CV')
    expect(bubbleKicker(BUBBLES, BUBBLES.length - 1, 'fr')).toBe('09 — La mappemonde')
    // Le numéro ne dépend pas de la langue, seul le sujet est traduit (#33).
    expect(bubbleKicker(BUBBLES, 1, 'en')).toBe('01 — The desk')
  })

  it('renumérote quand le tour est réordonné', () => {
    const swapped = [BUBBLES[0], BUBBLES[2], BUBBLES[1], ...BUBBLES.slice(3)]
    expect(bubbleKicker(swapped, 1, 'fr')).toBe('01 — Le CV')
    expect(bubbleKicker(swapped, 2, 'fr')).toBe('02 — Le bureau')
  })
})
