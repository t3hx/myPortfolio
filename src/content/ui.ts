import type { Localized } from '@/lib/locale'

/**
 * Les textes de l'interface qui n'appartiennent à aucun contenu (issue #33) —
 * préchargeur, écran de pré-sélection, fiche projet, version classique, et les
 * étiquettes d'accessibilité qui vont avec.
 *
 * Ils vivent ici et pas dans leur composant pour la raison qui a fait ouvrir
 * #33 : « aucun texte codé en dur hors du système de traduction ». Une chaîne
 * laissée dans un JSX ne se voit pas manquer — elle reste simplement en
 * français quand tout le reste bascule.
 *
 * **Le HUD (`src/ui/Hud.tsx`) est exclu, et c'est une décision.** C'est de
 * l'outillage derrière `?debug`, au même titre que `?outline` ou `?debug-fly` :
 * il n'est jamais servi à un visiteur, et le traduire reviendrait à entretenir
 * la moitié d'un dictionnaire pour un bandeau de diagnostic. Ses libellés sont
 * d'ailleurs déjà en anglais.
 */
export const UI = {
  preloader: {
    /** `aria-label` de la zone de chargement. */
    region: { fr: 'Chargement', en: 'Loading' } as Localized,
    copy: { fr: 'On allume les lampes…', en: 'Turning the lamps on…' } as Localized,
  },
  preselection: {
    eyebrow: {
      fr: "Portfolio — la visite d'une pièce",
      en: 'Portfolio — a tour of one room',
    } as Localized,
    title: {
      fr: 'Comment souhaitez-vous visiter ?',
      en: 'How would you like to visit?',
    } as Localized,
    three: { fr: 'Expérience 3D', en: '3D experience' } as Localized,
    threeMeta: {
      fr: 'WebGL · ~3 Mo · souris, tactile ou clavier',
      en: 'WebGL · ~3 MB · mouse, touch or keyboard',
    } as Localized,
    classic: { fr: 'Expérience classique', en: 'Classic experience' } as Localized,
    classicMeta: {
      fr: 'HTML · instantané · accessible',
      en: 'HTML · instant · accessible',
    } as Localized,
  },
  classic: {
    eyebrow: {
      fr: 'Portfolio — expérience classique',
      en: 'Portfolio — classic experience',
    } as Localized,
    title: { fr: 'La version légère arrive.', en: 'The light version is coming.' } as Localized,
    body: {
      fr: 'Cette page racontera la même histoire que la pièce en 3D — projets, CV, contact — en HTML léger et accessible. Elle est en construction.',
      en: 'This page will tell the same story as the 3D room — projects, résumé, contact — in light, accessible HTML. It is under construction.',
    } as Localized,
    noWebgl: {
      fr: "WebGL n'est pas disponible sur cet appareil — vous avez été orienté ici automatiquement.",
      en: 'WebGL is unavailable on this device — you were routed here automatically.',
    } as Localized,
    switch: { fr: "changer d'expérience", en: 'change experience' } as Localized,
  },
  sheet: {
    kicker: { fr: 'Projet', en: 'Project' } as Localized,
    year: { fr: 'Année', en: 'Year' } as Localized,
    role: { fr: 'Rôle', en: 'Role' } as Localized,
    close: { fr: 'Fermer la fiche', en: 'Close the sheet' } as Localized,
    escape: { fr: 'Échap', en: 'Esc' } as Localized,
    cover: { fr: 'illustration', en: 'illustration' } as Localized,
  },
  cv: {
    /** `aria-label` de la section. */
    region: { fr: 'Curriculum vitae', en: 'Résumé' } as Localized,
    photo: { fr: 'photo', en: 'photo' } as Localized,
  },
  menu: {
    region: { fr: 'Menu', en: 'Menu' } as Localized,
    /** `title` de la bascule de langue, dans la langue vers laquelle elle mène. */
    switchTo: { fr: 'Passer en français', en: 'Switch to English' } as Localized,
  },
}
