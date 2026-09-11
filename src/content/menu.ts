/**
 * Le contenu de la barre de menu (issue #26).
 *
 * Les trois sections pointent chacune sur un arrêt de `CAMERA_STOPS`, par
 * `label` — la même clé que celle des bulles et de `?stop=`. Rien n'est
 * dupliqué : le menu ne connaît pas de pose, il demande un arrêt et c'est
 * CameraRig qui vole jusque-là.
 */
import { MARKS } from '@/config/icons'
import type { Localized } from '@/lib/locale'

export interface MenuSection {
  /** Texte vertical affiché dans la barre. */
  label: Localized
  /** `label` de l'arrêt visé dans CAMERA_STOPS. */
  stop: string
}

export const MENU_SECTIONS: MenuSection[] = [
  { label: { fr: 'Accueil', en: 'Home' }, stop: 'Home' },
  { label: { fr: 'Résumé', en: 'Résumé' }, stop: 'CV' },
  // Les projets sont dans la commode, pas sur le bureau (décision produit,
  // 2026-08-18). Le second clic — ouvrir une fiche projet une fois sur place —
  // reste à construire.
  { label: { fr: 'Projets', en: 'Projects' }, stop: 'Cabinet' },
]

/** Liens externes du bas de barre. Une entrée sans `href` n'est pas rendue :
 *  un menu dont la promesse est « le contact en deux clics » n'a pas le droit
 *  d'afficher un lien mort. */
export interface MenuSocial {
  /** Les deux lettres de la maquette. **Repli, pas doublon** : c'est ce qui
   *  s'affiche si la marque vient à manquer, et un masque absent n'affiche
   *  rien du tout sans émettre la moindre erreur. */
  label: string
  title: string
  href: string
  /** Chemin de `MARKS` (#170). Absent = les deux lettres. */
  icon?: string
}

export const MENU_SOCIALS: MenuSocial[] = [
  {
    label: 'in',
    title: 'LinkedIn',
    href: 'https://www.linkedin.com/in/tdbs',
    icon: MARKS.linkedin,
  },
  { label: 'gh', title: 'GitHub', href: 'https://github.com/t3hx', icon: MARKS.github },
]
