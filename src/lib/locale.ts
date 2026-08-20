/**
 * La langue de l'interface (issue #33).
 *
 * `resolveLocale` est **pur** — préférences du navigateur et valeur mémorisée
 * injectées — exactement comme `resolveExperience` : c'est lui que
 * `tests/locale.test.ts` verrouille, en environnement Node, sans DOM.
 *
 * L'ordre de décision est celui de la moindre surprise :
 *
 *   1. un choix mémorisé gagne toujours — c'est une décision de l'utilisateur,
 *      elle ne se re-devine pas à chaque visite ;
 *   2. sinon, la première langue des préférences du navigateur qu'on sait
 *      parler. On lit la LISTE, pas seulement `navigator.language` : un
 *      visiteur réglé en `de-DE, fr-FR, en` parle français, et lui servir de
 *      l'anglais serait un choix par défaut déguisé en détection ;
 *   3. sinon l'anglais, qui touche plus de monde que le français.
 *
 * `?lang=` n'existe volontairement PAS. Les paramètres d'URL de ce projet sont
 * de l'outillage de développement (voir `viewMode.ts`) ; la langue est un choix
 * de visiteur, elle a sa bascule dans la barre et sa mémoire.
 */

export type Locale = 'fr' | 'en'

export const LOCALES: readonly Locale[] = ['fr', 'en']

export const LOCALE_STORAGE_KEY = 'portfolio.locale'

/**
 * Une valeur qui existe dans les deux langues.
 *
 * **Le type est opt-in, champ par champ, et c'est délibéré.** Une chaîne
 * simple à côté d'un `Localized` ne signale pas un oubli : elle signale que la
 * valeur est neutre par décision — un nom de technologie (`PostgreSQL`), une
 * période (`2023 — 2026`), un niveau de langue (`C1`), une classe de permis
 * française (`B`, qui n'a pas d'équivalent anglais). Tout envelopper aurait
 * produit `{ fr: 'C1', en: 'C1' }` quarante fois, ce qui se lit comme une
 * étourderie et invite à « corriger » ce qui est juste.
 */
export interface Localized<T = string> {
  fr: T
  en: T
}

/**
 * Une valeur qui est parfois traduite, parfois neutre — dans le MÊME champ.
 *
 * Le cas existe pour de bon : « Français / natif » se traduit, « Anglais / C1 »
 * garde son niveau CECRL, et « Permis / B » est une classe française qui n'a
 * pas d'équivalent anglais. Écrire `{ fr: 'C1', en: 'C1' }` mentirait sur
 * l'intention ; une chaîne simple dit « neutre, et c'est une décision ».
 */
export type MaybeLocalized = string | Localized

/** Lit une valeur bilingue. Le nom est court parce qu'il est partout. */
export function t<T>(value: Localized<T>, locale: Locale): T {
  return value[locale]
}

/** Lit une valeur qui peut être neutre. */
export function tm(value: MaybeLocalized, locale: Locale): string {
  return typeof value === 'string' ? value : value[locale]
}

function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value)
}

export function resolveLocale(opts: {
  /** Ce que `localStorage` a rendu, ou `null`. */
  stored: string | null
  /** `navigator.languages` — la liste, pas seulement la première. */
  preferred: readonly string[]
}): { locale: Locale; reason: 'stored' | 'detected' | 'fallback' } {
  const { stored, preferred } = opts

  if (stored && isLocale(stored)) return { locale: stored, reason: 'stored' }

  for (const tag of preferred) {
    // `fr`, `fr-FR`, `fr-CA` : c'est la sous-étiquette de langue qui compte,
    // jamais la région. Comparaison en minuscules — les étiquettes BCP 47 sont
    // insensibles à la casse et certains navigateurs rendent `FR-fr`.
    const base = tag.toLowerCase().split('-')[0]
    if (isLocale(base)) return { locale: base, reason: 'detected' }
  }

  return { locale: 'en', reason: 'fallback' }
}

/* `localStorage` peut lever (navigation privée, quotas) : dans ce cas la langue
   ne se mémorise pas, et c'est tout — on ne casse pas la visite pour ça. Même
   traitement que le choix 3D/classique. */
export function readStoredLocale(): string | null {
  try {
    return window.localStorage.getItem(LOCALE_STORAGE_KEY)
  } catch {
    return null
  }
}

export function storeLocale(locale: Locale): void {
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale)
  } catch {
    /* tant pis */
  }
}
