/**
 * Le CV (issue #93) — la page qu'un recruteur vient chercher.
 *
 * Module TypeScript statique embarqué, même discipline que `projects.ts` :
 * **aucun appel réseau en v1** (décision de revue technique reprise de #31).
 * Le déploiement est le bouton « enregistrer ».
 *
 * **Les textes sont le vrai parcours depuis #173** (les placeholders de la
 * maquette — Studio Nova, Atelier K, Freelance — sont partis avec), aligné sur
 * le CV papier le 2026-10-21 : la reconversion ouvre les expériences, Optimal
 * Ways court jusqu'à 2025, « Le cap » dit l'IA. Ce qui est vérifié par
 * `tests/cv.test.ts`, c'est la forme, jamais la prose — à une exception près :
 * la liste des entreprises y est verrouillée par son contenu.
 */

/**
 * Une vignette de réglette : une marque, un nom dessous. Sert deux fois — le
 * savoir-être et le savoir-faire ont exactement la même anatomie, et en faire
 * deux composants aurait produit deux fois la même chose à maintenir.
 *
 * **L'absence d'`icon` est le repli, jamais une erreur de chargement.** Sans
 * fichier, la vignette affiche l'INITIALE du nom en crème monochrome : c'est le
 * glyphe neutre quand aucune marque n'existe. Il n'y a délibérément pas de
 * `onError` — une icône cassée est pire qu'un vide assumé, et c'est la donnée
 * qui décide, pas le réseau. Même règle que la couverture d'une fiche projet.
 */
import { MARKS } from '@/config/icons'
import { tm, type Locale, type Localized, type MaybeLocalized } from '@/lib/locale'

export interface CvGlyph {
  /** Ce qui s'écrit sous la vignette, et dont l'initiale sert de repli.
   *  Traduit pour un savoir-être, neutre pour un nom de technologie. */
  name: MaybeLocalized
  /**
   * Ce qui s'écrit DANS la vignette quand il n'y a pas d'icône.
   *
   * **Traduisible** (#173) : la raison historique était les traits — dont les
   * initiales anglaises entraient en collision — et les traits sont des
   * étiquettes texte depuis #194. Le type reste `MaybeLocalized` : il ne coûte
   * rien et la prochaine donnée traduite n'aura pas à le redemander.
   *
   * Sans lui, c'est la première lettre du nom — ce qui suffit tant que les
   * noms se distinguent par elle. Les tuiles du site classique (#29) ne
   * peuvent pas s'en contenter : `TypeScript` et `Tailwind CSS` commencent
   * tous deux par un T, `PostgreSQL` par le P de rien d'autre mais se lit
   * `Pg` partout ailleurs. Deux caractères lèvent l'ambiguïté sans devenir un
   * mot ; au-delà, la vignette n'est plus un glyphe mais une étiquette, et il
   * y en a déjà une dessous.
   */
  initial?: MaybeLocalized
  /**
   * Une marque de `MARKS` (`src/config/icons.ts`). Absente = l'initiale.
   *
   * **Rendue par un masque CSS, en monochrome** — décision de l'auteur du
   * 2026-09-11, qui RENVERSE celle inscrite ici auparavant. Cette ligne disait
   * « rendu en `<img>`, pas en `mask-image` : les vraies marques sont en
   * couleur et doivent le rester », et la couleur est écartée pour deux raisons
   * mesurées. À 16 px sur du verre fumé elle est du bruit, et c'est l'étiquette
   * sous la vignette qui porte l'identification. Surtout, les fichiers livrés
   * portent `fill="currentColor"` : dans une balise `<img>` il n'a aucun
   * contexte dont hériter et vaut noir, donc invisible. La décision précédente
   * est datée, pas effacée — elle explique pourquoi le repli est monochrome et
   * plus pourquoi il serait le seul à l'être.
   */
  icon?: string
  /**
   * La marque est un PAVÉ : un glyphe détouré dans un carré plein, qui peint
   * la moitié ou plus de sa boîte.
   *
   * **L'encre DÉPISTE, l'œil décide, et c'est la leçon de la planche** (#169).
   * L'encre — la part du carré réellement peinte, mesurée entre 14,9 % et
   * 86,4 % dans `src/config/icons.ts` — signale les candidats : au-delà de
   * 50 %, une marque risque de lire comme un bloc clair plutôt que comme un
   * pictogramme. Mais elle ne distingue pas un GLYPHE DÉTOURÉ DANS UN CARRÉ
   * PLEIN d'un DESSIN DENSE. Postgres est à 52,9 % parce que son éléphant est
   * finement tracé : réduit, il devient une tache, et on perd de la lisibilité
   * sans corriger de poids. TypeScript à 85,9 % et Node.js à 65,1 % sont de
   * vrais blocs, eux, et un cran plus petit les remet dans la famille des
   * silhouettes.
   *
   * L'encre ne se normalise pas dans les deux sens — une silhouette ne peut
   * pas en gagner sans qu'on redessine la marque — donc c'est un plafond, pas
   * une cible, et il se pose marque par marque, sur capture.
   */
  slab?: true
}

/**
 * Ce qui s'écrit dans une vignette sans icône.
 *
 * La règle vit ici, pas dans les composants : l'écran vertical de la scène et
 * les tuiles du site classique affichent la MÊME donnée, et deux replis
 * différents feraient dire deux choses à un seul contenu — `Pg` d'un côté,
 * `P` de l'autre, sans que rien ne le signale.
 */
export function glyphMark(glyph: CvGlyph, locale: Locale): string {
  return glyph.initial === undefined
    ? tm(glyph.name, locale).slice(0, 1)
    : tm(glyph.initial, locale)
}

/** Une ligne de la carte « Langues & permis » : un intitulé, une valeur. */
export interface CvFact {
  /** « Français », « Anglais », « Permis »… */
  label: Localized
  /** Ce qui s'aligne à droite : « natif » se traduit, « C1 » et « B » non. */
  value: MaybeLocalized
}

export interface CvJob {
  /** L'intitulé du poste. */
  title: Localized
  /** Nom propre : jamais traduit. */
  company: string
  /** « 2023 — 2026 ». Du texte : ce n'est pas une date qu'on trie. */
  period: string
  /**
   * Les missions révélées par l'accordéon au survol. **Absentes = cartouche
   * statique**, qui ne réagit pas au survol et ne promet donc rien : c'est le
   * cas d'un poste dont le CV ne détaille aucune mission, et c'est le même
   * traitement qu'une formation (`.job--static`).
   *
   * **La règle « quatre au minimum » a été retirée** (#173). Elle datait du
   * 2026-08-20, quand cette donnée était inventée et pouvait se rembourrer
   * jusqu'à quatre. Le vrai parcours en porte sept, cinq, trois et zéro, et
   * inventer une quatrième puce pour satisfaire une règle de forme serait
   * exactement ce que cette issue est venue corriger.
   *
   * **La liste porte TOUT ce que le CV dit ; c'est le rendu qui coupe.** Le
   * site classique les affiche toutes, l'écran vertical s'arrête à
   * `MISSIONS_ON_SCREEN` — chaque puce y coûte ~21 px de hauteur ouverte, et
   * la hauteur est la ressource rare de cet écran. Couper dans la DONNÉE
   * aurait privé les deux surfaces, dont celle qui a la place.
   */
  missions?: Localized<string[]>
  /**
   * Les clients servis pendant ce poste, en une ligne.
   *
   * Un champ à part et non une puce : ce n'est pas une mission, c'est le
   * contexte du poste — et le CV papier le compose ainsi, sur sa propre ligne
   * sous l'intitulé. `MaybeLocalized` parce que la plupart sont des noms
   * propres et ne se traduisent pas, mais « France/Suisse/Singapour » si.
   */
  clients?: MaybeLocalized
}

/**
 * Une cartouche de formation. Même anatomie qu'un poste, MOINS l'accordéon :
 * un diplôme n'a pas de missions à dérouler, et lui donner un survol qui
 * n'ouvre rien serait une promesse non tenue.
 */
export interface CvFormation {
  title: Localized
  /** Nom propre : jamais traduit. */
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
    /**
     * L'âge, tel qu'il s'écrit — lu par la ligne de méta de l'accueil
     * classique (#29), que l'écran vertical de la scène n'affiche pas.
     *
     * **Du texte, et il se périme.** Une date de naissance calculée serait
     * juste toute seule, mais elle ferait entrer une horloge dans un module
     * de contenu statique, pour une valeur qui change une fois par an et que
     * l'auteur relit de toute façon en même temps que ses dates de poste.
     *
     * **`null` dans une langue veut dire « rien à dire », et l'anglais est
     * dans ce cas** (décision de l'auteur, 2026-09-11) : un CV anglophone ne
     * porte pas l'âge, et le PDF anglais l'a retiré aussi. `null` plutôt
     * qu'une chaîne vide, parce qu'une chaîne vide se lit comme un oubli — et
     * parce que la ligne de méta doit alors sauter la mention ET son
     * séparateur, ce qu'un blanc ne lui dirait pas.
     */
    age: Localized<string | null>
    /** Le texte alternatif de la photo, quand il y en a une. */
    alt: Localized
  }
  /**
   * Où le poste s'exerce (#194) : « Lille, France », un nom propre, neutre
   * entre les langues. La carte « L'essentiel » le compose comme un fait —
   * `locationLabel` en libellé, ce champ en valeur. Il ne vit pas dans
   * `CV.facts` pour la raison de l'âge : la ligne de méta de l'accueil
   * classique rend TOUS les faits, et la localisation y apparaîtrait sans que
   * personne l'ait composée là.
   */
  location: string
  /** Le libellé de la ligne de localisation — « Basé à » (décision
   *  utilisateur, 2026-10-21 : le lieu ne joue pas le libellé, et
   *  « Localisation » était trop long pour la carte). */
  locationLabel: Localized
  /** Le libellé de la ligne d'âge — qui ne s'affiche qu'en français, puisque
   *  `identity.age` est `null` en anglais et que la ligne saute avec. */
  ageLabel: Localized
  /** Le titre de la carte de savoir-être. */
  traitsTitle: Localized
  /**
   * Six étiquettes texte, et six exactement (#194) : la carte tient à la
   * hauteur de la photo, dans la rangée du haut, et une septième ouvre une
   * rangée de plus qui repousse tout le CV vers le bas de l'écran. Plus de
   * vignettes à initiales — une initiale de qualité humaine n'identifie rien,
   * et le site classique range déjà les mêmes mots en puces.
   */
  traits: CvGlyph[]
  /** Le titre de la carte de faits — « Langues & permis ». */
  factsTitle: Localized
  facts: CvFact[]
  /** Le titre de la réglette de savoir-faire. */
  skillsTitle: Localized
  /**
   * La réglette se répartit toute seule (`auto-fit`) et passe à la ligne quand
   * il le faut : le nombre n'est pas contraint, mais chaque ligne coûte ~44 px
   * de hauteur, et c'est la hauteur qui est comptée sur cet écran.
   */
  skills: CvGlyph[]
  /** Le titre de la section de vision — « Le cap » (décision du 2026-08-20). */
  outlookTitle: Localized
  /** Quatre lignes au maximum : au-delà, le CV ne tient plus dans l'écran. */
  outlook: Localized
  /** Le titre de la pile d'expériences — « Expériences ». */
  jobsTitle: Localized
  /** Du plus récent au plus ancien : l'ordre du tableau EST l'ordre affiché. */
  jobs: CvJob[]
  /** Le libellé qui introduit les clients d'un poste — « Clients ». */
  clientsLabel: Localized
  /** Le libellé du lien qui rapporte le PDF (#161, #162). Le chemin du
   *  document, lui, vit dans `src/config/resume.ts` : c'est une adresse
   *  servie, pas du contenu rédigé. */
  downloadLabel: Localized
  /** Le titre de la pile de formations — « Formations ». */
  formationsTitle: Localized
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
export const CV_JOBS_EMPTY: Localized = {
  fr: 'Le parcours arrive. En attendant, la version papier dort dans la commode.',
  en: 'The track record is on its way. Until then, the paper copy sleeps in the cabinet.',
}

export const CV: Cv = {
  identity: {
    name: 'Thibault Dubois',
    age: { fr: '36 ans', en: null },
    alt: { fr: 'Photo de Thibault', en: 'Photograph of Thibault' },
  },
  location: 'Lille, France',
  locationLabel: { fr: 'Basé à', en: 'Based in' },
  ageLabel: { fr: 'Âge', en: 'Age' },
  traitsTitle: { fr: 'Savoir-être', en: 'Soft skills' },
  // Des étiquettes texte sur les deux surfaces depuis #194 — plus aucune
  // marque : l'`initial` traduit que portait « Optimiseur » (O/Ef, pour la
  // collision anglaise des E) est parti avec les vignettes, et l'ordre est
  // celui du CV papier (réaligné le 2026-10-21 : le papier ouvre sur
  // Empathique, et cette liste le lisait à l'envers).
  traits: [
    { name: { fr: 'Empathique', en: 'Empathetic' } },
    { name: { fr: 'Communiquant', en: 'Communicative' } },
    { name: { fr: 'Persévérant', en: 'Persistent' } },
    { name: { fr: 'Optimiseur', en: 'Efficiency-driven' } },
    { name: { fr: 'Agile', en: 'Agile' } },
    { name: { fr: 'Stratège', en: 'Strategist' } },
  ],
  // « L'essentiel » depuis #194 : la carte dit aussi l'âge et la localisation,
  // « Langues & permis » ne couvrait plus son contenu. La maquette
  // `design/screens/02-cv.html` garde l'ancien titre — dérive assumée, comme
  // les initiales des vignettes (voir CLAUDE.md).
  factsTitle: { fr: "L'essentiel", en: 'The essentials' },
  facts: [
    { label: { fr: 'Français', en: 'French' }, value: { fr: 'natif', en: 'native' } },
    { label: { fr: 'Anglais', en: 'English' }, value: 'C2' },
    { label: { fr: 'Permis', en: 'Driving licence' }, value: 'B' },
  ],
  skillsTitle: { fr: 'Savoir-faire', en: 'Technical skills' },
  /**
   * Sept vignettes, choisies par l'auteur (2026-09-11) : ce qui vaut une place
   * dédiée dans l'interface, pas l'inventaire du CV. JavaScript et Git en sont
   * absents exprès — le premier découle de TypeScript, le second va de soi. Le
   * reste du CV (MongoDB, Firebase, GCP, Cloudflare, Linux, MacOS, Asana,
   * Jira) est vrai et reste dans le PDF, qui n'a pas la même économie de place.
   */
  skills: [
    // `initial` reste, et ce n'est pas redondant : c'est le repli si un jour
    // une marque manque, et c'est ce que le test d'unicité vérifie.
    // `slab` est mesuré, pas choisi — voir l'encre dans `src/config/icons.ts`.
    { name: 'TypeScript', initial: 'Ts', icon: MARKS.typescript, slab: true },
    { name: 'React.js', initial: 'R', icon: MARKS.react },
    { name: 'Vue.js', initial: 'V', icon: MARKS.vuejs },
    { name: 'Three.js', initial: 'Th', icon: MARKS.threejs },
    { name: 'Node.js', initial: 'N', icon: MARKS.nodejs, slab: true },
    { name: 'Postgres', initial: 'Pg', icon: MARKS.postgresql },
    { name: 'Docker', initial: 'Dk', icon: MARKS.docker },
  ],
  outlookTitle: { fr: 'Le cap', en: 'The heading' },
  /**
   * Le paragraphe « projet » du CV papier — CONDENSÉ, plus mot pour mot
   * (validation utilisateur, 2026-10-21). Le papier ajoute la mention de l'IA
   * et atteint 431 caractères, or le plafond de cet écran est 400 — quatre
   * lignes, au-delà le CV déborde dès qu'un accordéon s'ouvre (voir le test).
   * « à chaque étape de la création d'applications web » est la proposition
   * sacrifiée : « du prototype à la mise en production » dit la même étendue.
   */
  outlook: {
    fr:
      'Explorateur du code issu du monde du digital analytics, je me reconvertis ' +
      'en développeur web avec une passion sincère pour le JavaScript, côté front ' +
      "comme côté back. Polyvalent, j'associe ma rigueur d'analyste à ma " +
      "créativité et je m'appuie sur l'IA du prototype à la mise en production, " +
      'afin de construire des produits qui répondent précisément aux besoins ' +
      'métier ou utilisateur.',
    en:
      'A code explorer from the digital analytics world, I am moving into web ' +
      'development with a genuine passion for JavaScript, front end and back end ' +
      "alike. Versatile, I pair an analyst's rigour with creativity and lean on " +
      'AI from prototype to production, to build products that answer business ' +
      'and user needs precisely.',
  },
  jobsTitle: { fr: 'Expériences', en: 'Experience' },
  clientsLabel: { fr: 'Clients', en: 'Clients' },
  downloadLabel: { fr: 'Télécharger le CV', en: 'Download the résumé' },
  /**
   * Le parcours réel, du plus récent au plus ancien (#173).
   *
   * **Les périodes sont en ANNÉES et non en mois**, alors que le PDF donne le
   * mois : la cartouche est étroite, et `period` n'est pas traduisible — « Août
   * 2020 » y serait du français servi à un lecteur anglais. Le PDF reste la
   * version exhaustive, ici c'est un repère.
   */
  jobs: [
    {
      // La reconversion ouvre le parcours (CV papier, validé 2026-10-21).
      // `company` porte le cadre que le papier écrit sous l'intitulé — ce
      // n'est pas un nom propre, mais c'est la ligne que les deux surfaces
      // composent à cette place. La période reste « 2026 » seul : le papier
      // écrit « 2026 — aujourd'hui », et « aujourd'hui » ne se traduit pas —
      // même raison que les mois, absents des autres cartouches.
      title: {
        fr: 'Reconversion développeur web',
        en: 'Retraining as a web developer',
      },
      company: 'Formation autodidacte & projets perso',
      period: '2026',
      missions: {
        fr: [
          'Formation Vue.js (Composition API, Pinia, Nuxt) — certifications vueschool.io',
          'Formation React (hooks, state management, écosystème)',
          "IA appliquée au développement : Claude Code, Codex, agents et intégration d'API",
          "Harness engineering : outillage et environnements d'évaluation pour agents IA",
          'Projets web construits : Portfolio, Solarsys, Owlog',
        ],
        en: [
          'Vue.js training (Composition API, Pinia, Nuxt) — vueschool.io certifications',
          'React training (hooks, state management, ecosystem)',
          'AI applied to development: Claude Code, Codex, agents and API integration',
          'Harness engineering: tooling and evaluation environments for AI agents',
          'Web projects built: Portfolio, Solarsys, Owlog',
        ],
      },
    },
    {
      title: {
        fr: 'Consultant technique senior, digital analytics',
        en: 'Senior technical consultant, digital analytics',
      },
      company: 'Optimal Ways',
      // 2025, pas 2024 : le CV papier court d'août 2020 à décembre 2025
      // (corrigé le 2026-10-21 — l'année de fin était périmée ici).
      period: '2020 — 2025',
      // L'ordre des clients est celui du CV papier : Decathlon d'abord.
      clients: {
        fr:
          'Decathlon France/Suisse/Singapour/PRO, Brico-Dépôt, Midas, ' +
          'Cyrillus, Armand Thiery, Brady Seton, Mobalpa',
        en:
          'Decathlon France/Switzerland/Singapore/PRO, Brico-Dépôt, Midas, ' +
          'Cyrillus, Armand Thiery, Brady Seton, Mobalpa',
      },
      missions: {
        fr: [
          'Gestion de projets de A à Z, autonomie sur le renouvellement des contrats',
          'Analyse des données, assurance qualité, conseil en stratégie analytics et en UX',
          "Développement d'outils pour l'intégration et le traitement des données (JS, Node.js)",
          'Traitement des données collectées dans BigQuery (GCP) et Azure Cloud',
          "Intégration et migration d'outils analytics : GA, Piano, Adobe",
          "Création du système d'information interne à l'agence",
          "Management d'équipe : planification, formation interne et externe, intégration",
        ],
        en: [
          'End-to-end project ownership, autonomy on contract renewals',
          'Data analysis, quality assurance, analytics strategy and UX consulting',
          'Tooling for data integration and processing (JS, Node.js)',
          'Processing of collected data in BigQuery (GCP) and Azure Cloud',
          'Analytics tool integration and migration: GA, Piano, Adobe',
          "Built the agency's internal information system",
          'Team management: planning, internal and external training, onboarding',
        ],
      },
    },
    {
      title: {
        fr: "Responsable d'application (MCO)",
        en: 'Application manager (run & maintenance)',
      },
      company: 'IDKIDS Group',
      period: '2019 — 2020',
      missions: {
        fr: [
          'Collecte des besoins des équipes métier e-commerce et rédaction des cas d’usage',
          'Organisation des sprints et priorisation des tâches avec les équipes de développement',
          'Extractions de base de données pour le contrôle de gestion',
          'Adressage des problématiques prioritaires du service client (run, support N2)',
          'Astreinte technique et assurance qualité lors des mises en production',
        ],
        en: [
          'Requirements gathering with the e-commerce business teams, use-case writing',
          'Sprint planning and task prioritisation with the development teams',
          'Database extractions for the management control team',
          'Handling of priority customer-service issues (run, L2 support)',
          'On-call duty and quality assurance during production releases',
        ],
      },
    },
    {
      // Le CV ne détaille aucune mission pour ce poste : la cartouche est donc
      // statique, et elle ne promet rien au survol.
      title: { fr: 'Consultant data', en: 'Data consultant' },
      company: 'Web Transition',
      period: '2018 — 2019',
      clients: 'KingFisher, IDKIDS Group',
    },
    {
      title: {
        fr: 'Technicien support N2, serveurs BareMetal et Cloud',
        en: 'Support technician L2, BareMetal and Cloud servers',
      },
      company: 'OVHcloud',
      period: '2015 — 2018',
      missions: {
        fr: [
          'Traitement et priorisation des incidents critiques avec les équipes DevOps et SysAdmin',
          'Intervention à distance sur les serveurs (Proxmox, VMware, SSH)',
          'Dépannage téléphonique des clients non hébergés',
        ],
        en: [
          'Triage and prioritisation of critical incidents with DevOps and SysAdmin teams',
          'Remote work on servers (Proxmox, VMware, SSH)',
          'Phone troubleshooting for non-hosted customers',
        ],
      },
    },
  ],
  formationsTitle: { fr: 'Formations', en: 'Education' },
  formations: [
    {
      title: {
        fr: 'Certification Vue.js (beginner + masterclass)',
        en: 'Vue.js certification (beginner + masterclass)',
      },
      school: 'vueschool.io',
      // 2026, comme le CV papier (corrigé le 2026-10-21 — il disait 2024 ici).
      period: '2026',
    },
    {
      title: {
        fr: 'Certification JavaScript (beginner + advanced)',
        en: 'JavaScript certification (beginner + advanced)',
      },
      // Le CV papier écrit « Openclassroom » ; la plateforme s'appelle
      // OpenClassrooms. Corrigé ici, à corriger là-bas.
      school: 'OpenClassrooms',
      period: '2022',
    },
    {
      title: {
        fr: 'BTS négociation et relation client',
        en: 'BTS sales & customer relations (two-year degree)',
      },
      school: 'ISEG',
      period: '2010 — 2012',
    },
  ],
}
