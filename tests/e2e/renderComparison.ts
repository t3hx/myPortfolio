import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import pixelmatch from 'pixelmatch'
import { PNG } from 'pngjs'
import type { Page } from '@playwright/test'

/**
 * L'outillage de la boucle de comparaison de renders (#45 et #46).
 *
 * Deux gestes, et un seul point délicat dans chacun : **d'où vient l'image**,
 * et **à partir de quel écart on parle de dérive**.
 */

export const REFS_DIR = 'docs/renders/refs'
/** Ignoré par git — les captures sont jetables (voir `.gitignore`). */
export const ACTUAL_DIR = 'docs/renders/actual'

/**
 * Les arrêts dont le fichier de référence ne porte PAS leur `label`.
 *
 * La règle par défaut reste « la référence s'appelle comme l'arrêt », et elle
 * couvre huit arrêts sur onze. Les trois autres ont été exportés depuis Blender
 * sous le nom de leur nœud caméra (`CameraStop_MonitorVertical` →
 * `vertical_monitor`) ou dans une autre langue (`guitare`, `poster`).
 *
 * Cette table existe parce que les deux noms n'ont pas le même propriétaire :
 * le `label` est la clé de `?stop=`, donc des liens profonds et de la
 * documentation — le renommer casse des URL ; le nom de fichier, lui, suit
 * l'export Blender. Déclarer la correspondance coûte une ligne et laisse
 * chacun libre chez soi. La renommer d'un côté ou de l'autre pour « simplifier »
 * casserait forcément quelque chose de l'autre.
 *
 * `overview.png` n'est PAS un arrêt et n'a rien à faire ici — c'est un rendu de
 * la pièce entière, que la boucle ignore (voir `docs/renders/README.md`).
 */
export const REF_FILE: Record<string, string> = {
  CV: 'vertical_monitor',
  Guitar: 'guitare',
  Posters: 'poster',
}

/** Le fichier de référence d'un arrêt, d'après son `label`. */
export function refName(label: string): string {
  return REF_FILE[label] ?? label.toLowerCase()
}

/**
 * Seuil par canal de `pixelmatch`, en distance perceptuelle YIQ. 0,1 est sa
 * valeur par défaut : elle absorbe le bruit d'anticrénelage sans absorber un
 * changement de couleur. C'est le compagnon de `MAX_DIFF_RATIO`, pas un
 * doublon — celui-ci décide si UN pixel diffère, celui-là combien peuvent.
 */
export const PIXEL_THRESHOLD = 0.1

/**
 * Part maximale de pixels différents avant qu'on parle de dérive.
 *
 * **Mesurée, pas devinée** (re-mesurée le 2026-08-20 sur les références
 * 1920 × 1080 — le tableau complet est dans `docs/renders/README.md`). Le pire
 * arrêt conforme est la guitare à 1,939 %, suivie du bureau à 1,503 % ; 2,5 %
 * laisse la marge d'une machine dont le rasteriseur crénelle un cheveu
 * autrement. Un seuil choisi a priori rend la CI rouge dès le premier jour, et
 * une CI rouge dès le premier jour se débranche.
 *
 * Passer de 1280 × 720 à 1920 × 1080 a RAPPROCHÉ les mesures (bureau 1,808 →
 * 1,503 %, posters 0,218 → 0,155 %) : l'écart vit sur les silhouettes, dont le
 * poids relatif baisse quand la définition monte. Le plafond garde donc plus de
 * marge qu'avant, et pourrait être resserré le jour où on le voudra.
 *
 * Ce qui explique l'écart résiduel — et qui ne disparaîtra jamais : EEVEE et
 * WebGL ne crénellent pas pareil. Tout le budget part dans les silhouettes et
 * les géométries fines (cordes, frettes, feuilles) ; sur les aplats les deux
 * moteurs sont identiques au bit près, ce que l'arrêt Accueil démontre à
 * 0,000 %.
 */
export const MAX_DIFF_RATIO = 0.025

/**
 * Les arrêts dont la référence ne décrit PLUS ce que l'app montre.
 *
 * Deux natures, et la distinction est tout l'intérêt du tableau :
 *
 *  - `tracked` — l'écart est identifié, borné, et le plafond reste assez serré
 *    pour qu'une dérive AU-DELÀ échoue encore. Le test tourne et conclut.
 *  - `unverified` — la référence et l'app ne montrent pas la même chose du
 *    tout. Comparer n'a plus de sens : un plafond assez haut pour absorber
 *    l'écart n'attraperait plus rien, et le test rendrait un VERT sur un arrêt
 *    que personne ne vérifie. L'image est quand même capturée et publiée, mais
 *    l'arrêt est déclaré non vérifié — la CI affiche « skipped » avec sa
 *    raison, et le rapport ne ment pas.
 *
 * C'est la faute que ce dépôt collectionne : l'arrêt qui parkait au bon endroit
 * avec un cadrage que personne n'avait autorisé, l'image qui partait avec une
 * 3D vide sans que rien n'échoue pour le dire. Un plafond complaisant déguisé
 * en succès est pire qu'un trou visible.
 *
 * Les deux entrées ci-dessous se suppriment ENSEMBLE quand #97 ferme : les deux
 * références y sont re-rendues depuis Blender. Une entrée ne se prolonge jamais
 * « parce que ça a encore bougé ».
 */
export interface KnownDeviation {
  kind: 'tracked' | 'unverified'
  /** Plafond propre à cet arrêt, au-dessus de l'écart mesuré. `tracked` seul. */
  maxRatio?: number
  /** Pourquoi l'image diffère. Cette phrase part dans le rapport. */
  reason: string
}

export const KNOWN_DEVIATIONS: Record<string, KnownDeviation> = {
  // Mesuré à 5,417 % sur la référence 1920 × 1080 du 2026-08-20. Le diff dessine littéralement le tiroir
  // sorti et les dossiers étiquetés : la référence a été rendue avant que
  // l'arrivée à cet arrêt ne l'ouvre (#76) et n'y clone un dossier par projet
  // (#79). Le reste de l'image est comparé normalement, et 7 % laisse peu de
  // place à autre chose que le tiroir : l'arrêt continue de se surveiller.
  cabinet: {
    kind: 'tracked',
    maxRatio: 0.07,
    reason:
      "la référence est antérieure au tiroir qui s'ouvre à l'arrivée (#76) et " +
      'aux dossiers étiquetés (#79) — à re-rendre depuis Blender, voir #97',
  },
  // Mesuré à 39,467 % sur la référence 1920 × 1080 : elle montre
  // `Outside_Moon_Detailed` (la lune photographique), l'app montre
  // `Outside_Moon` (la lune stylisée). L'échange de visibilité n'a lieu qu'en
  // phase TELESCOPE, alors que l'arrêt se visite aussi à la molette, à 270 mm.
  // Décision produit du 2026-08-20 : c'est la RÉFÉRENCE qui a tort — elle a été
  // rendue avec le mauvais objet visible (#97). Ce ne sont pas deux rendus du
  // même objet : il n'y a rien à comparer avant qu'elle soit re-rendue, et un
  // plafond assez haut pour absorber 40 % n'attraperait plus rien.
  moon: {
    kind: 'unverified',
    reason:
      'la référence a été rendue avec la lune détaillée visible, que seule la ' +
      "phase TELESCOPE affiche — l'arrêt montre bien la lune stylisée. " +
      'Référence à re-rendre, voir #97',
  },
}

/** Le plafond applicable à un arrêt, et l'écart connu qui le justifie. */
export function ceilingFor(label: string): {
  maxRatio: number
  deviation: KnownDeviation | null
} {
  const deviation = KNOWN_DEVIATIONS[label] ?? null
  return { maxRatio: deviation?.maxRatio ?? MAX_DIFF_RATIO, deviation }
}

/**
 * Capture une image de la scène 3D SEULE, à un arrêt donné.
 *
 * On lit le tampon de dessin de WebGL (`toDataURL`), on ne photographie pas la
 * page. Deux raisons, et la seconde est la vraie :
 *
 *  1. les références sont des rendus Blender NUS — une capture de page y
 *     ajouterait la bulle, la barre de menu et le CV, et l'écart mesuré serait
 *     dominé par du DOM qu'on n'a jamais voulu comparer ;
 *  2. l'attente de stabilité de Playwright n'a jamais lieu. La boucle `rAF` de
 *     R3F ne s'arrête pas, ce qui avait fait expirer `browser_take_screenshot`
 *     à deux reprises le 2026-08-09 (note d'#45). Ici il n'y a pas de capture
 *     de page à stabiliser : on lit un tampon.
 *
 * `?capture` allume `preserveDrawingBuffer` — sans lui, l'image est noire.
 */
export async function captureStop(page: Page, label: string): Promise<Buffer> {
  await page.goto(`/?stop=${encodeURIComponent(label)}&capture`)

  // Le préchargeur se DÉMONTE quand la scène est prête (#25) : sa disparition
  // est donc le signal de fin de chargement, pas une approximation.
  await page.waitForSelector('.preload', { state: 'detached', timeout: 60_000 })

  // `?stop=` place la caméra d'un coup, sans tween (CameraRig) : une image
  // dessinée après ce point est déjà la bonne. Les deux `rAF` garantissent
  // qu'il y en a eu une depuis, et le petit délai couvre la reconstruction des
  // 146 matériaux, muette de bout en bout.
  await page.waitForTimeout(400)
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      }),
  )

  const dataUrl = await page.evaluate(() => {
    const canvas = document.querySelector('canvas')
    if (!canvas) throw new Error('aucun <canvas> dans la page')
    return canvas.toDataURL('image/png')
  })
  return Buffer.from(dataUrl.split(',')[1], 'base64')
}

export interface DiffResult {
  /** Part de pixels différents, entre 0 et 1. */
  ratio: number
  differing: number
  total: number
  /** Où la capture a été écrite. */
  actualPath: string
  /** Où l'image de différence a été écrite, s'il y en avait une à écrire. */
  diffPath: string | null
}

function write(path: string, data: Buffer): void {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, data)
}

/**
 * Compare une capture à sa référence Blender et écrit les deux sorties dans
 * `docs/renders/actual/` : la capture, et l'image de différence quand il y a
 * quelque chose à montrer.
 *
 * Un écart de dimensions n'est pas une dérive de rendu, c'est une erreur de
 * protocole (mauvais `viewport`, `deviceScaleFactor` oublié) : on le dit avec
 * ses chiffres au lieu de rendre un taux de 100 % qu'on lirait comme un bug de
 * la scène.
 */
export function diffAgainstReference(actual: Buffer, label: string): DiffResult {
  const actualPath = join(ACTUAL_DIR, `${label}.png`)
  write(actualPath, actual)

  const ref = PNG.sync.read(readFileSync(join(REFS_DIR, `${label}.png`)))
  const shot = PNG.sync.read(actual)

  if (ref.width !== shot.width || ref.height !== shot.height) {
    throw new Error(
      `${label} : capture ${shot.width}×${shot.height} contre référence ` +
        `${ref.width}×${ref.height} — le cadre a changé, pas le rendu.`,
    )
  }

  const diff = new PNG({ width: ref.width, height: ref.height })
  const differing = pixelmatch(ref.data, shot.data, diff.data, ref.width, ref.height, {
    threshold: PIXEL_THRESHOLD,
  })

  const total = ref.width * ref.height
  let diffPath: string | null = null
  if (differing > 0) {
    diffPath = join(ACTUAL_DIR, `${label}.diff.png`)
    write(diffPath, PNG.sync.write(diff))
  }

  return { ratio: differing / total, differing, total, actualPath, diffPath }
}
