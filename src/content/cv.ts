/**
 * Le CV (issue #93) — la page qu'un recruteur vient chercher.
 *
 * Module TypeScript statique embarqué, même discipline que `projects.ts` :
 * **aucun appel réseau en v1** (décision de revue technique reprise de #31).
 * Le déploiement est le bouton « enregistrer ».
 *
 * ⚠️ **Les textes ci-dessous sont les placeholders de la maquette**
 * (`design/screens/02-cv.html`, session design 2026-08-10) : Studio Nova,
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
   * **Traduisible, et c'est nécessaire** (#173) : les six qualités donnent
   * S, A, O, P, C, E en français, toutes distinctes, mais « Efficiency-driven »
   * et « Empathetic » partagent leur E en anglais. Une marque non traduisible
   * aurait forcé à choisir entre une collision dans une langue et une initiale
   * fausse dans l'autre.
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
  /** Le titre de la carte de savoir-être. */
  traitsTitle: Localized
  /**
   * Six vignettes, et six exactement : la carte les range en 3 × 2 pour tenir
   * à la hauteur de la photo, dans la rangée du haut. Cinq laissent un trou,
   * sept débordent sur une troisième rangée et repoussent tout le CV vers le
   * bas de l'écran.
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
  traitsTitle: { fr: 'Savoir-être', en: 'Soft skills' },
  traits: [
    { name: { fr: 'Stratège', en: 'Strategist' } },
    { name: { fr: 'Agile', en: 'Agile' } },
    // Deux marques traduites, parce que « Efficiency-driven » et
    // « Empathetic » partagent leur E : sans ça, deux vignettes anglaises
    // identiques côte à côte.
    { name: { fr: 'Optimiseur', en: 'Efficiency-driven' }, initial: { fr: 'O', en: 'Ef' } },
    { name: { fr: 'Persévérant', en: 'Persistent' } },
    { name: { fr: 'Communiquant', en: 'Communicative' } },
    { name: { fr: 'Empathique', en: 'Empathetic' } },
  ],
  factsTitle: { fr: 'Langues & permis', en: 'Languages & licence' },
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
   * Le paragraphe « projet » du CV papier, mot pour mot. Le texte qui vivait
   * ici avant était une invention de #93 : il disait une intention plausible
   * que personne n'avait écrite.
   */
  outlook: {
    fr:
      'Explorateur du code issu du monde du digital analytics, je me reconvertis ' +
      'en développeur web avec une passion sincère pour le JavaScript, côté front ' +
      "comme côté back. Polyvalent, j'associe ma rigueur d'analyste à ma " +
      'créativité afin de construire des applications qui répondent précisément ' +
      'aux besoins métier ou utilisateur.',
    en:
      'A code explorer from the digital analytics world, I am moving into web ' +
      'development with a genuine passion for JavaScript, front end and back end ' +
      "alike. Versatile, I pair an analyst's rigour with creativity to build " +
      'applications that answer business and user needs precisely.',
  },
  jobsTitle: { fr: 'Expériences', en: 'Experience' },
  clientsLabel: { fr: 'Clients', en: 'Clients' },
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
      title: {
        fr: 'Consultant technique senior, digital analytics',
        en: 'Senior technical consultant, digital analytics',
      },
      company: 'Optimal Ways',
      period: '2020 — 2024',
      clients: {
        fr:
          'Midas, Cyrillus, Armand Thiery, Brady Seton, Mobalpa, Brico-Dépôt, ' +
          'Decathlon France/Suisse/Singapour/PRO',
        en:
          'Midas, Cyrillus, Armand Thiery, Brady Seton, Mobalpa, Brico-Dépôt, ' +
          'Decathlon France/Switzerland/Singapore/PRO',
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
      period: '2024',
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
