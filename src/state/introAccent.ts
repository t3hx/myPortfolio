import { create } from 'zustand'
import { INTRO_ACCENT } from '@/config/intro'
import { introAccentFromUrl } from '@/lib/viewMode'

/**
 * L'accent de l'intro, et rien d'autre (#147).
 *
 * Il vit dans un store à lui, à l'écart de `interaction.ts`, parce qu'il ne
 * décrit pas un état de la visite : c'est un OUTIL D'ARBITRAGE. La couleur du
 * handoff (`#00C0E8`) est provisoire et se tranche en la voyant projetée sur
 * l'écran, dans la scène — donc en la changeant sans recharger, ce qu'un
 * `import` d'une constante ne permet pas.
 *
 * Il est semé par `?accent=` au chargement, et les boutons du HUD l'écrivent.
 * Une fois la couleur retenue, elle devient un token de `tokens.css` et la
 * valeur par défaut de `INTRO_ACCENT` ; le paramètre reste, comme `?lw=`.
 */
interface IntroAccentState {
  accent: string
  setAccent: (accent: string) => void
}

export const useIntroAccent = create<IntroAccentState>((set) => ({
  accent: introAccentFromUrl() ?? INTRO_ACCENT,
  setAccent: (accent) => set({ accent }),
}))
