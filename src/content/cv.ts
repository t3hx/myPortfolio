/**
 * Le CV (issue #93) — la page qu'un recruteur vient chercher.
 *
 * Module TypeScript statique embarqué, même discipline que `projects.ts` :
 * **aucun appel réseau en v1** (décision de revue technique reprise de #31).
 * Le déploiement est le bouton « enregistrer ».
 *
 * ⚠️ **Les textes ci-dessous sont les placeholders de la maquette**
 * (`docs/design/screens/02-cv.html`, session design 2026-08-10) : Studio Nova,
 * Atelier K, Freelance. Ils tiennent la FORME, pas les faits. Un parcours
 * professionnel inventé sur le portfolio d'une personne réelle serait pire
 * qu'un écran vide — c'est à l'auteur de les remplacer, comme pour `PROJECTS`.
 * Ce qui est vérifié par `tests/cv.test.ts`, c'est la forme, jamais la prose.
 */

/**
 * Une vignette de réglette : une marque, un nom dessous. Sert deux fois — le
 * savoir-être et le savoir-faire ont exactement la même anatomie, et en faire
 * deux composants aurait produit deux fois la même chose à maintenir.
 *
 * **L'absence d'`icon` est le repli, jamais une erreur de chargement.** Sans
 * fichier, la vignette affiche l'INITIALE du nom en crème monochrome : c'est le
 * glyphe neutre en attendant les vrais SVG. Il n'y a délibérément pas de
 * `onError` — une icône cassée est pire qu'un vide assumé, et c'est la donnée
 * qui décide, pas le réseau. Même règle que la couverture d'une fiche projet.
 */
export interface CvGlyph {
  /** Ce qui s'écrit sous la vignette, et dont l'initiale sert de repli. */
  name: string
  /**
   * Chemin d'un SVG servi depuis `public/` (ex. `/icons/react.svg`). Absent =
   * l'initiale. Rendu en `<img>`, pas en `mask-image` : les vraies marques sont
   * en couleur et doivent le rester. Seul le repli est monochrome, et cette
   * asymétrie est voulue.
   */
  icon?: string
}

/** Une ligne de la carte « Langues & permis » : un intitulé, une valeur. */
export interface CvFact {
  /** « Français », « Anglais », « Permis »… */
  label: string
  /** Ce qui s'aligne à droite, en chasse fixe : « natif », « C1 », « B ». */
  value: string
}

export interface CvJob {
  /** L'intitulé du poste. */
  title: string
  company: string
  /** « 2023 — 2026 ». Du texte : ce n'est pas une date qu'on trie. */
  period: string
  /**
   * Les missions révélées par l'accordéon au survol.
   *
   * **Quatre au minimum** (décision de l'auteur, 2026-08-20) : une cartouche
   * qui n'en montre que deux ne récompense pas le survol qui l'a ouverte.
   * `tests/cv.test.ts` le vérifie. Le maximum, lui, n'est pas technique —
   * l'accordéon s'adapte à son contenu (`.job__missions` interpole
   * `grid-template-rows` au lieu d'une `max-height` devinée) — mais chaque
   * puce coûte ~21 px de hauteur ouverte, et la hauteur est la ressource rare
   * de cet écran.
   */
  missions: string[]
}

/**
 * Une cartouche de formation. Même anatomie qu'un poste, MOINS l'accordéon :
 * un diplôme n'a pas de missions à dérouler, et lui donner un survol qui
 * n'ouvre rien serait une promesse non tenue.
 */
export interface CvFormation {
  title: string
  school: string
  /** « 2016 — 2018 ». Du texte, comme la période d'un poste. */
  period: string
}

export interface Cv {
  /** L'identité. `photo` absente = le cadre hachuré de la maquette, assumé. */
  identity: {
    /**
     * Prénom et nom, en haut de tout. Affiché en chasse FIXE et déchiffré
     * caractère par caractère à l'arrivée (voir `Decrypt` dans `CvScreen`) :
     * en chasse proportionnelle, les glyphes tirés au sort changeraient de
     * largeur à chaque image et le nom gigoterait.
     */
    name: string
    photo?: string
    /** Le texte alternatif de la photo, quand il y en a une. */
    alt: string
  }
  /** Le titre de la carte de savoir-être. */
  traitsTitle: string
  /**
   * Six vignettes, et six exactement : la carte les range en 3 × 2 pour tenir
   * à la hauteur de la photo, dans la rangée du haut. Cinq laissent un trou,
   * sept débordent sur une troisième rangée et repoussent tout le CV vers le
   * bas de l'écran.
   */
  traits: CvGlyph[]
  /** Le titre de la carte de faits — « Langues & permis ». */
  factsTitle: string
  facts: CvFact[]
  /** Le titre de la réglette de savoir-faire. */
  skillsTitle: string
  /**
   * La réglette se répartit toute seule (`auto-fit`) et passe à la ligne quand
   * il le faut : le nombre n'est pas contraint, mais chaque ligne coûte ~44 px
   * de hauteur, et c'est la hauteur qui est comptée sur cet écran.
   */
  skills: CvGlyph[]
  /** Le titre de la section de vision — « Le cap » (décision du 2026-08-20). */
  outlookTitle: string
  /** Quatre lignes au maximum : au-delà, le CV ne tient plus dans l'écran. */
  outlook: string
  /** Le titre de la pile d'expériences — « Expériences ». */
  jobsTitle: string
  /** Du plus récent au plus ancien : l'ordre du tableau EST l'ordre affiché. */
  jobs: CvJob[]
  /** Le titre de la pile de formations — « Formations ». */
  formationsTitle: string
  /** Quatre cartouches, du plus récent au plus ancien. */
  formations: CvFormation[]
}

/**
 * Le repli quand `jobs` est vide.
 *
 * Un CV sans parcours n'est pas un écran vide : l'identité et les langues sont
 * toujours là, seule la colonne des postes manque et le dit. Même discipline
 * que `PROJECTS_EMPTY` pour le tiroir vide (#78) — le système ne montre jamais
 * un trou sans phrase.
 */
export const CV_JOBS_EMPTY =
  'Le parcours arrive. En attendant, la version papier dort dans la commode.'

export const CV: Cv = {
  identity: { name: 'Thibault Vasseur', alt: 'Photo de Thibault' },
  traitsTitle: 'Savoir-être',
  traits: [
    { name: 'Curiosité' },
    { name: 'Rigueur' },
    { name: 'Autonomie' },
    { name: 'Écoute' },
    { name: 'Pédagogie' },
    { name: 'Ténacité' },
  ],
  factsTitle: 'Langues & permis',
  facts: [
    { label: 'Français', value: 'natif' },
    { label: 'Anglais', value: 'C1' },
    { label: 'Permis', value: 'B' },
  ],
  skillsTitle: 'Savoir-faire',
  skills: [
    { name: 'TypeScript' },
    { name: 'React' },
    { name: 'Node' },
    { name: 'PostgreSQL' },
    { name: 'Three.js' },
    { name: 'Docker' },
    { name: 'Blender' },
    { name: 'Git' },
  ],
  outlookTitle: 'Le cap',
  outlook:
    "Continuer à faire des interfaces qu'on a envie de toucher, là où le détail " +
    'compte autant que la structure. Je cherche une équipe qui construit sur ' +
    'plusieurs années plutôt que sur plusieurs sprints, et qui laisse le temps ' +
    'de bien poser les fondations.',
  jobsTitle: 'Expériences',
  jobs: [
    {
      title: 'Développeur front-end senior',
      company: 'Studio Nova',
      period: '2023 — 2026',
      missions: [
        'Refonte WebGL du site vitrine (three.js, 60 fps)',
        'Design system interne — tokens, composants, docs',
        'Mentorat de deux développeurs juniors',
        'Budget de performance tenu sur trois refontes de suite',
      ],
    },
    {
      title: 'Développeur full-stack',
      company: 'Atelier K',
      period: '2020 — 2023',
      missions: [
        'Plateforme e-commerce (Node, PostgreSQL)',
        'Intégration paiement et facturation',
        'Mise en place CI/CD et revues de code',
        'Migration du catalogue vers un schéma versionné',
      ],
    },
    {
      title: 'Intégrateur web',
      company: 'Freelance',
      period: '2018 — 2020',
      missions: [
        'Sites vitrines pour artisans et studios',
        'Audits performance et accessibilité',
        'Reprise de trois sites laissés sans mainteneur',
        'Formation des clients à la mise à jour de leur contenu',
      ],
    },
    {
      title: 'Alternance développement web',
      company: 'Coopérative Lumen',
      period: '2016 — 2018',
      missions: [
        'Outil interne de suivi des adhérents',
        'Reprise du parc de sites sous un socle commun',
        'Automatisation des exports comptables mensuels',
        'Documentation du socle pour les alternants suivants',
      ],
    },
  ],
  formationsTitle: 'Formations',
  formations: [
    {
      title: 'Master développement web',
      school: 'École Ardent',
      period: '2016 — 2018',
    },
    {
      title: 'Licence informatique',
      school: 'Université de Verlaine',
      period: '2013 — 2016',
    },
    {
      title: 'DUT informatique',
      school: 'IUT de Vallonne',
      period: '2011 — 2013',
    },
    {
      title: 'Baccalauréat scientifique',
      school: 'Lycée Saint-Aubert',
      period: '2011',
    },
  ],
}
