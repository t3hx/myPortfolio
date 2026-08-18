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

export interface ProjectLink {
  /** Ce qui s'affiche : « Code », « Voir le site »… */
  label: string
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
  tagline: string
  /** « 2026 » ou « 2025 — 2026 ». Du texte : ce n'est pas une date qu'on trie. */
  year: string
  role: string
  stack: string[]
  /** Deux ou trois faits saillants. Ni un journal de bord, ni un CV. */
  highlights: string[]
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
    tagline: "Le visionnage est l'unité d'enregistrement, pas le film.",
    year: '2026',
    role: 'Conception et développement',
    stack: ['TypeScript', 'PWA', 'Nuxt'],
    highlights: [
      'Un même film revu trois fois compte trois entrées, pas une ligne modifiée.',
      'Fonctionne hors ligne : le suivi se fait souvent loin du réseau.',
    ],
  },
  {
    slug: 'odysong',
    name: 'Odysong',
    tabLabel: 'Odysong',
    tagline: 'Un voyage en 3D fabriqué à partir de vos goûts musicaux Spotify.',
    year: '2026',
    role: 'Conception et développement',
    stack: ['TypeScript', 'WebGL', 'API Spotify'],
    highlights: ["Le paysage traversé est dérivé de l'écoute réelle, pas d'un décor générique."],
  },
  {
    slug: 'celestial-walker',
    name: 'Celestial Walker',
    tabLabel: 'Celestial',
    tagline: "Une visite du système solaire, à l'échelle, dans le navigateur.",
    year: '2026',
    role: 'Développement',
    stack: ['Nuxt', 'TypeScript', 'Three.js'],
    highlights: ['Architecture documentée en composables, factories et stores.'],
    links: [{ label: 'Code', href: 'https://github.com/t3hx/celestial-walker-nuxt' }],
  },
  {
    slug: 'txpf',
    name: 'TXPF',
    tabLabel: 'TXPF',
    tagline: 'Le portfolio précédent : une vitrine Vue adossée à une API Nest.',
    year: '2025 — 2026',
    role: 'Conception et développement',
    stack: ['Vue 3', 'TailwindCSS', 'NestJS'],
    highlights: ['Démos de projets protégées derrière le back-office.'],
    links: [
      { label: 'Front', href: 'https://github.com/t3hx/txpf-frontend-vue' },
      { label: 'API', href: 'https://github.com/t3hx/txpf-backend-nest' },
    ],
  },
  {
    slug: 'portfolio',
    name: 'Ce portfolio',
    tabLabel: 'Portfolio',
    tagline: 'Une pièce modélisée sous Blender, parcourue au défilement.',
    year: '2026',
    role: 'Conception, modélisation et développement',
    stack: ['React', 'react-three-fiber', 'Blender', 'GSAP'],
    highlights: [
      'Rendu entièrement pré-cuit : aucune lumière au runtime, tout est dans les textures.',
      'La caméra suit onze cadrages composés dans Blender, jamais réécrits en code.',
    ],
    links: [{ label: 'Code', href: 'https://github.com/t3hx/myPortfolio' }],
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
 * Un tiroir vide est un état possible — pas une panne — et il ne doit jamais
 * se traduire par un écran blanc. Le texte vit ici, avec le reste du contenu ;
 * sa mise en scène appartient au panneau (#83).
 */
export const PROJECTS_EMPTY = {
  title: 'Le tiroir est vide',
  text: "Rien de classé ici pour l'instant. Les projets arrivent — en attendant, le reste de la pièce se visite.",
}
