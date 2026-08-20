import { create } from 'zustand'
import { type Locale, readStoredLocale, resolveLocale, storeLocale } from '@/lib/locale'

/**
 * La langue courante (issue #33).
 *
 * Un store à part de `interaction.ts`, et pas une phase de plus : la langue ne
 * change aucun routage d'entrée, elle ne fait que changer des textes. La règle
 * qui tient `interaction.ts` debout est « chaque phase possède UN routage
 * d'entrée » ; y ajouter la langue reviendrait à faire répondre `CameraRig` à
 * quelque chose qui ne lui demande rien.
 *
 * L'état initial est résolu **au chargement du module**, donc avant le premier
 * rendu : un basculement visible du français vers l'anglais à la première image
 * serait pire que pas de détection du tout.
 */
const initial = resolveLocale({
  stored: typeof window === 'undefined' ? null : readStoredLocale(),
  preferred: typeof navigator === 'undefined' ? [] : navigator.languages,
})

interface LocaleState {
  locale: Locale
  /** Comment la langue initiale a été décidée — utile en débogage. */
  reason: 'stored' | 'detected' | 'fallback'
  setLocale: (locale: Locale) => void
}

export const useLocale = create<LocaleState>((set, get) => ({
  locale: initial.locale,
  reason: initial.reason,
  setLocale: (locale) => {
    if (get().locale === locale) return
    // Mémorisé ici, mais l'attribut `lang` du document est posé AILLEURS (un
    // effet dans `App.tsx`) : deux écritures du même attribut finiraient par
    // diverger, et c'est celle du premier rendu qui manquerait.
    storeLocale(locale)
    set({ locale, reason: 'stored' })
  },
}))
