import { create } from 'zustand'

/**
 * La progression du chargement, en OCTETS (issue #25).
 *
 * Pourquoi pas `useProgress` de drei : il est alimenté par
 * `DefaultLoadingManager.onProgress`, qui compte des ITEMS. Mesuré sur le v13 :
 * le manager voit 18 items — le `.glb`, les deux fichiers draco, et 14 `blob:`
 * (les textures webp embarquées, que GLTFLoader repasse par ImageLoader). Le
 * `.glb` de 3 Mo, seule chose qui prenne du temps sur un vrai réseau, ne pèse
 * donc que 1/18 de la barre ; et son `total` grandit en cours de route
 * (1 → 4 → 18), ce qui fait RECULER la progression (1/4 = 25 % à t+33 ms, puis
 * 2/18 = 11 % à t+41 ms). La DoD demande une progression réelle : ce sont les
 * octets du seul fichier téléchargé.
 */
interface LoadingState {
  /** Octets reçus pour le `.glb`. */
  loaded: number
  /** Octets annoncés par `Content-Length` — 0 si le serveur ne le donne pas. */
  total: number
  /** `loaded / total`, borné à [0,1] et MONOTONE : une barre ne recule pas. */
  fraction: number
  report: (loaded: number, total: number) => void
}

export const useLoading = create<LoadingState>((set, get) => ({
  loaded: 0,
  total: 0,
  fraction: 0,
  report: (loaded, total) =>
    set({
      loaded,
      total,
      fraction: total > 0 ? Math.max(get().fraction, Math.min(1, loaded / total)) : get().fraction,
    }),
}))
