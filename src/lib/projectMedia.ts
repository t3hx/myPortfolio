import type { Project } from '@/content/projects'
import type { Localized } from '@/lib/locale'

/**
 * Ce qu'une fiche projet a à MONTRER, mis à plat (issue #126).
 *
 * La fiche lit une vidéo et présente plusieurs captures ; ces deux champs
 * vivent séparément dans `Project`, parce qu'ils ne se ressemblent pas — l'un
 * se lit, les autres se regardent. Mais la scène de la fiche, elle, n'en montre
 * qu'un à la fois et la pellicule les indexe tous : à cet endroit-là, c'est UNE
 * liste ordonnée.
 *
 * Cette fonction est le seul endroit qui dit cet ordre — la vidéo d'abord, les
 * captures ensuite. Le composant ne le redécide pas, et un test peut le
 * vérifier sans DOM.
 *
 * **Une liste vide est un état normal, jamais une panne** — même règle que les
 * icônes du CV : aucun `onError` n'est câblé nulle part, c'est la donnée qui
 * décide. Sans média déclaré, la scène retombe sur `cover`, puis sur le
 * placeholder hachuré.
 */

export interface MediaItem {
  kind: 'video' | 'shot'
  src: string
  /** L'affiche d'une vidéo. Une capture n'en a pas : elle EST sa propre image. */
  poster?: string
  /** Ce que le média montre — légende sous la scène ET nom accessible. */
  alt: Localized
}

/** La vidéo en tête, les captures dans leur ordre de déclaration. */
export function projectMedia(project: Project): MediaItem[] {
  const items: MediaItem[] = []
  if (project.video) items.push({ kind: 'video', ...project.video })
  for (const shot of project.shots ?? []) items.push({ kind: 'shot', ...shot })
  return items
}

/**
 * L'image d'une vignette, ou `undefined` s'il n'y en a pas.
 *
 * Une vidéo sans affiche n'a littéralement aucune image à montrer avant d'être
 * chargée — et elle ne se charge qu'au geste (`preload="none"`). La vignette
 * affiche alors son rang, plutôt qu'un carré noir qui ressemble à un échec.
 */
export function thumbSrc(item: MediaItem): string | undefined {
  return item.kind === 'video' ? item.poster : item.src
}

/**
 * La pellicule ne paraît qu'à partir de DEUX médias.
 *
 * Une pellicule d'une seule vignette n'indexe rien : elle répète la scène juste
 * en dessous d'elle, en plus petit, et donne à cliquer sur ce qu'on regarde
 * déjà.
 */
export function showsStrip(media: MediaItem[]): boolean {
  return media.length > 1
}
