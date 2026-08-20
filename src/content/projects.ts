/**
 * Les fiches projets (issue #31).
 *
 * Module TypeScript statique embarqué : **aucun appel réseau en v1** (décision
 * de revue technique). Un portfolio dont les projets dépendraient d'une API
 * aurait un état de chargement, un état d'erreur et un écran vide à dessiner —
 * pour cinq fiches qui changent trois fois par an.
 *
 * **L'ordre du tableau EST l'ordre des dossiers dans le tiroir**, du fond vers
 * l'avant — même convention que `CAMERA_STOPS`, dont l'ordre est celui du tour.
 * Réordonner ici réordonne la commode, et rien d'autre à faire.
 *
 * ⚠️ **Les textes sont des placeholders**, comme ceux des bulles : les faits
 * (nom, année, stack, liens) sont exacts, les phrases attendent la plume de
 * leur auteur. Ce qui est vérifié par les tests, c'est la FORME — pas la prose.
 */

import type { Localized } from '@/lib/locale'

export interface ProjectLink {
  /** Ce qui s'affiche : « Code », « Voir le site »… */
  label: Localized
  href: string
}

export interface Project {
  /** Clé stable et unique. Destinée à devenir la clé d'un lien profond. */
  slug: string
  /** Le titre de la fiche. */
  name: string
  /** Ce qui tient sur l'étiquette du dossier — voir `TAB_LABEL_MAX_CHARS`.
   *  Souvent plus court que `name` : « Celestial Walker » ne rentre pas. */
  tabLabel: string
  /** Une phrase, celle qu'on lit avant tout le reste. */
  tagline: Localized
  /** « 2026 » ou « 2025 — 2026 ». Du texte : ce n'est pas une date qu'on trie. */
  year: string
  role: Localized
  /** Jamais traduit : un nom de technologie n'a pas de version française. */
  stack: string[]
  /** Deux ou trois faits saillants. Ni un journal de bord, ni un CV. */
  highlights: Localized<string[]>
  /**
   * Absent = aucun lien affiché, et c'est délibéré pour les dépôts privés.
   *
   * Même discipline que `MENU_SOCIALS`, dont une entrée sans `href` n'est pas
   * rendue : un portfolio n'a pas le droit de proposer une porte fermée à clé.
   */
  links?: ProjectLink[]
  /** Chemin d'illustration. Absent = `GENERIC_COVER_SRC`. */
  cover?: string
}

export const PROJECTS: Project[] = [
  {
    slug: 'owlog',
    name: 'Owlog',
    tabLabel: 'Owlog',
    tagline: {
      fr: "Le visionnage est l'unité d'enregistrement, pas le film.",
      en: 'A viewing is the unit of record, not the film.',
    },
    year: '2026',
    role: { fr: 'Conception et développement', en: 'Design and development' },
    stack: ['TypeScript', 'PWA', 'Nuxt'],
    highlights: {
      fr: [
        'Un même film revu trois fois compte trois entrées, pas une ligne modifiée.',
        'Fonctionne hors ligne : le suivi se fait souvent loin du réseau.',
      ],
      en: [
        'The same film watched three times is three entries, not one edited row.',
        'Works offline: logging often happens far from a network.',
      ],
    },
  },
  {
    slug: 'odysong',
    name: 'Odysong',
    tabLabel: 'Odysong',
    tagline: {
      fr: 'Un voyage en 3D fabriqué à partir de vos goûts musicaux Spotify.',
      en: 'A 3D journey built from your Spotify listening.',
    },
    year: '2026',
    role: { fr: 'Conception et développement', en: 'Design and development' },
    stack: ['TypeScript', 'WebGL', 'API Spotify'],
    highlights: {
      fr: ["Le paysage traversé est dérivé de l'écoute réelle, pas d'un décor générique."],
      en: ['The landscape is derived from real listening, not from a generic backdrop.'],
    },
  },
  {
    slug: 'celestial-walker',
    name: 'Celestial Walker',
    tabLabel: 'Celestial',
    tagline: {
      fr: "Une visite du système solaire, à l'échelle, dans le navigateur.",
      en: 'A tour of the solar system, to scale, in the browser.',
    },
    year: '2026',
    role: { fr: 'Développement', en: 'Development' },
    stack: ['Nuxt', 'TypeScript', 'Three.js'],
    highlights: {
      fr: ['Architecture documentée en composables, factories et stores.'],
      en: ['Architecture documented as composables, factories and stores.'],
    },
    links: [
      { label: { fr: 'Code', en: 'Code' }, href: 'https://github.com/t3hx/celestial-walker-nuxt' },
    ],
  },
  {
    slug: 'txpf',
    name: 'TXPF',
    tabLabel: 'TXPF',
    tagline: {
      fr: 'Le portfolio précédent : une vitrine Vue adossée à une API Nest.',
      en: 'The previous portfolio: a Vue showcase backed by a Nest API.',
    },
    year: '2025 — 2026',
    role: { fr: 'Conception et développement', en: 'Design and development' },
    stack: ['Vue 3', 'TailwindCSS', 'NestJS'],
    highlights: {
      fr: ['Démos de projets protégées derrière le back-office.'],
      en: ['Project demos gated behind the back-office.'],
    },
    links: [
      { label: { fr: 'Front', en: 'Front' }, href: 'https://github.com/t3hx/txpf-frontend-vue' },
      { label: { fr: 'API', en: 'API' }, href: 'https://github.com/t3hx/txpf-backend-nest' },
    ],
  },
  {
    slug: 'portfolio',
    name: 'Ce portfolio',
    tabLabel: 'Portfolio',
    tagline: {
      fr: 'Une pièce modélisée sous Blender, parcourue au défilement.',
      en: 'A room modelled in Blender, explored by scrolling.',
    },
    year: '2026',
    role: {
      fr: 'Conception, modélisation et développement',
      en: 'Design, modelling and development',
    },
    stack: ['React', 'react-three-fiber', 'Blender', 'GSAP'],
    highlights: {
      fr: [
        'Rendu entièrement pré-cuit : aucune lumière au runtime, tout est dans les textures.',
        'La caméra suit onze cadrages composés dans Blender, jamais réécrits en code.',
      ],
      en: [
        'Fully pre-baked render: no runtime lights, everything lives in the textures.',
        'The camera follows eleven framings composed in Blender, never rewritten in code.',
      ],
    },
    links: [{ label: { fr: 'Code', en: 'Code' }, href: 'https://github.com/t3hx/myPortfolio' }],
  },
]

/**
 * L'illustration servie quand une fiche n'a pas de couverture.
 *
 * Le fichier n'existe pas encore : c'est un livrable de la session design
 * (#78), et le composant qui l'affichera est #83. La constante existe dès
 * maintenant pour que les deux lots visent le même chemin.
 */
export const GENERIC_COVER_SRC = '/images/projects/cover-generique.svg'

/**
 * Ce qu'on dit quand il n'y a aucun projet à montrer.
 *
 * **Une phrase, pas un écran.** À zéro projet il n'y a aucun dossier à cliquer,
 * donc aucune fiche ne s'ouvre jamais : un panneau plein cadre serait une porte
 * qui ne s'ouvre pas. Le repli prend la place de la bulle de la commode — même
 * emplacement, même anatomie, autre phrase — parce que le système n'admet
 * qu'un seul bloc de texte visible à la fois.
 *
 * Tranché en session design (#78) ; la maquette
 * `docs/design/screens/03c-project-empty.html` fait foi pour la copy.
 */
export const PROJECTS_EMPTY: Localized = {
  fr: "Le tiroir est vide pour l'instant. Les projets arrivent — le reste de la pièce se visite déjà.",
  en: 'The drawer is empty for now. Projects are coming — the rest of the room is already open.',
}
