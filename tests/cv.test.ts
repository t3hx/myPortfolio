import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { CAMERA_STOPS } from '@/config/cameraStops'
import { CV, CV_JOBS_EMPTY, type CvGlyph } from '@/content/cv'
import { CASCADE_MS, CASCADE_STEP_MS, CV_OUT_MS, CV_STOP_LABEL, DECRYPT_MS } from '@/ui/CvScreen'

/**
 * Le CV (#93). Quatre choses qu'aucune relecture ne rattraperait :
 *
 *   1. l'arrêt qui l'affiche est désigné par un `label` — le renommer dans
 *      `CAMERA_STOPS` laisserait un composant qui ne s'affiche plus jamais,
 *      sans la moindre erreur (même piège que les sections de la barre) ;
 *   2. la durée de sortie vit DEUX FOIS — en CSS (`--t-cv-out`) et en JS
 *      (`CV_OUT_MS`, qui décide du démontage) ;
 *   3. l'anatomie doit rester dans `tokens.css` : dès qu'elle repart dans un
 *      CSS local, l'app et la maquette peuvent diverger en silence ;
 *   4. l'accordéon ne doit plus porter de plafond en dur — une `max-height`
 *      devinée fait disparaître la mission de trop sans rien dire.
 *
 * La forme, jamais la prose : les textes de `CV` sont les placeholders de la
 * maquette et attendent la plume de leur auteur.
 */

const tokens = readFileSync('docs/design/tokens.css', 'utf8')
const mockup = readFileSync('docs/design/screens/02-cv.html', 'utf8')
const component = readFileSync('src/ui/CvScreen.tsx', 'utf8')

describe("l'arrêt du CV", () => {
  it('existe encore dans le tour', () => {
    const stop = CAMERA_STOPS.find((s) => s.label === CV_STOP_LABEL)
    expect(stop, `aucun arrêt nommé « ${CV_STOP_LABEL} »`).toBeDefined()
  })
})

describe('le nom déchiffré', () => {
  it('dure exactement ce que le CSS annonce', () => {
    const declared = tokens.match(/--t-decrypt:\s*(\d+)ms/)
    expect(declared, 'jeton --t-decrypt introuvable dans tokens.css').not.toBeNull()
    expect(Number(declared![1])).toBe(DECRYPT_MS)
  })

  it('a un nom à déchiffrer et le garde lisible pour une synthèse vocale', () => {
    // Le texte brouillé est `aria-hidden` ; le vrai nom vit dans `aria-label`,
    // sans quoi une synthèse lirait une ligne de bruit tirée au sort.
    expect(CV.identity.name.trim()).not.toBe('')
    expect(component).toContain('aria-label={text}')
    expect(component).toContain('aria-hidden="true"')
  })

  it("s'affiche en chasse fixe", () => {
    // Les glyphes tirés au sort changent de largeur en chasse
    // proportionnelle : le nom gigoterait pendant toute l'animation.
    const rule = tokens.slice(tokens.indexOf('.cv__name {'), tokens.indexOf('.cv__row {'))
    expect(rule).toContain('ui-monospace')
  })

  it('est neutralisé par `prefers-reduced-motion`', () => {
    // Le critère du design system est l'autonomie : cette animation part toute
    // seule, elle doit donc être coupée — pas seulement raccourcie.
    expect(component).toContain("matchMedia('(prefers-reduced-motion: reduce)')")
  })

  it('ne tire jamais un espace au sort', () => {
    // Ce sont les espaces qui gardent la silhouette du nom pendant le
    // brouillage ; un espace dans le jeu de glyphes ouvrirait des trous.
    const charset = component.match(/DECRYPT_CHARSET = '([^']+)'/)
    expect(charset, 'DECRYPT_CHARSET introuvable').not.toBeNull()
    expect(charset![1]).not.toContain(' ')
    expect(charset![1].length).toBeGreaterThan(10)
  })
})

describe('la cascade de déchiffrement', () => {
  it('dure exactement ce que le CSS annonce', () => {
    const declared = tokens.match(/--t-cascade:\s*(\d+)ms/)
    expect(declared, 'jeton --t-cascade introuvable').not.toBeNull()
    expect(Number(declared![1])).toBe(CASCADE_MS)
    expect(CASCADE_STEP_MS).toBeLessThan(CASCADE_MS)
  })

  it("n'a qu'une horloge pour tout l'écran", () => {
    // Une quinzaine de titres s'animent ensemble. Une boucle `rAF` et un état
    // par titre, c'est quinze rendus React par image à côté d'une scène 3D.
    // `Scrambled` doit donc rester PUR : il dérive son texte du temps qu'on
    // lui passe, il ne le mesure pas.
    const body = component.slice(
      component.indexOf('function Scrambled'),
      component.indexOf('function CvName'),
    )
    expect(body).not.toContain('useState')
    expect(body).not.toContain('useEffect')
    expect(body).not.toContain('requestAnimationFrame')
  })

  it('tire ses glyphes de façon déterministe', () => {
    // `Scrambled` est rendu pendant la phase de rendu de React : un tirage non
    // pur y donnerait un texte différent à chaque re-rendu déclenché par autre
    // chose que l'horloge. On regarde le CORPS de la fonction, pas le fichier :
    // son commentaire, lui, a le droit de nommer ce qu'on évite.
    const body = component.slice(
      component.indexOf('function Scrambled'),
      component.indexOf('function CvName'),
    )
    expect(body).not.toContain('Math.random')
  })

  it('affiche un caret pendant le déchiffrement du nom, et lui seul', () => {
    expect(tokens).toContain('.cv__caret')
    expect(component).toContain('cv__caret')
    expect(component).toContain('typing &&')
  })
})

describe('le CV ne bouge pas quand un accordéon s’ouvre', () => {
  it('est ancré sous une entretoise INCOMPRESSIBLE', () => {
    // Le CV n'est pas centré : centré, tout ce qui le fait grandir le fait
    // remonter — la moitié de ce qu'un accordéon ajoute est reprise en haut.
    // C'est de l'arithmétique, aucune réserve ne le corrige exactement puisque
    // les quatre accordéons n'ont pas la même hauteur.
    //
    // `flex: 0 0 auto` est le mot load-bearing : une entretoise compressible
    // (`0 1 auto`) tient tant que rien ne déborde, puis cède — mesuré 9 px à
    // 1512 × 945, où le CV déborde déjà au repos. Incompressible, le haut est
    // figé à toute hauteur : 0 px sur les huit cartouches, aux trois tailles.
    const before = tokens.slice(
      tokens.indexOf('.cv::before {'),
      tokens.indexOf('}', tokens.indexOf('.cv::before {')),
    )
    expect(before).toContain('flex: 0 0 auto')
    expect(before).toMatch(/height: min\(\d+vh/)
  })

  it('ne centre plus, et ne réagit plus au survol par la mise en page', () => {
    // `:has(.job:hover)` réglait la réserve précédente et se déclenchait AUSSI
    // sur les formations, qui n'ouvrent rien : survoler un diplôme déplaçait
    // tout le CV. Rien ne doit plus faire dépendre la mise en page d'un survol.
    const rule = tokens.slice(tokens.indexOf('.cv {'), tokens.indexOf('.cv::before'))
    expect(rule).toContain('justify-content: flex-start')
    expect(tokens).not.toContain('.cv:has(')
    expect(tokens).not.toContain('--cv-reserve')
  })
})

describe('le balayage au survol', () => {
  it('traverse la cartouche une fois, sans rien promettre', () => {
    // Il est posé sur `.job`, donc les formations l'ont aussi : il n'annonce
    // pas une ouverture, il accuse réception du pointeur.
    expect(tokens).toContain('@keyframes job-sweep')
    expect(tokens).toContain('.job:hover::before')
    expect(tokens).toMatch(/--t-sweep:\s*\d+ms/)
    // `overflow: hidden` est ce qui coupe le liseré aux bords arrondis.
    const rule = tokens.slice(
      tokens.indexOf('.job { position: relative'),
      tokens.indexOf('.job::before'),
    )
    expect(rule).toContain('overflow: hidden')
  })
})

describe('le CV défile', () => {
  it('est ancré, prend la molette, et ne porte pas `panel`', () => {
    // Sept blocs font ~910 px : ça tient sur un écran plein, pas dans un cadre
    // de 720. Trois choses qu'un refactor casserait sans bruit —
    //   1. `flex-start`, jamais `center`. Centré, le bloc remonte à chaque
    //      ouverture d'accordéon ; et un `center` seul déborde des DEUX côtés
    //      quand ça ne rentre pas, or un conteneur ne défile jamais vers le
    //      négatif — la moitié haute deviendrait inatteignable ;
    //   2. `pointer-events: auto`, sinon la molette ne l'atteint jamais et va
    //      au canevas ;
    //   3. surtout PAS `panel` : cette classe ferait ignorer au tour toute
    //      molette passant ici, et on ne pourrait plus quitter l'arrêt en
    //      défilant. C'est `CvScreen` qui arbitre, cran par cran.
    const rule = tokens.slice(tokens.indexOf('.cv {'), tokens.indexOf('.cv--out'))
    expect(rule).toContain('justify-content: flex-start')
    expect(rule).toContain('overflow-y: auto')
    expect(rule).toContain('pointer-events: auto')
    expect(component).not.toContain('cv panel')
  })

  it('arbitre la molette avec un écouteur natif, pas un `onWheel` React', () => {
    // `CameraRig` écoute en natif sur `.stage`. React 19 délègue ses `onWheel`
    // à la racine de l'arbre, qui est un ANCÊTRE de `.stage` : un
    // `stopPropagation` synthétique arriverait après coup, le tour ayant déjà
    // avancé. Mesuré — c'est exactement ce qui s'est passé au premier essai.
    expect(component).toContain("addEventListener('wheel'")
    expect(component).not.toContain('onWheel=')
  })
})

describe('la sortie du CV', () => {
  it('dure exactement ce que le CSS annonce', () => {
    const declared = tokens.match(/--t-cv-out:\s*(\d+)ms/)
    expect(declared, 'jeton --t-cv-out introuvable dans tokens.css').not.toBeNull()
    expect(Number(declared![1])).toBe(CV_OUT_MS)
  })

  it("est déclarée après l'entrée, sinon elle ne gagne pas", () => {
    // Même spécificité : c'est l'ordre dans le fichier qui tranche. Remonter
    // `.cv--out` au-dessus de `.cv` laisserait le fondu de sortie sans effet.
    expect(tokens.indexOf('.cv--out')).toBeGreaterThan(tokens.indexOf('.cv {'))
  })
})

describe('le contenu du CV', () => {
  it('sait afficher chaque poste sans trou', () => {
    // Le composant lit ces champs sans garde : un poste incomplet laisserait un
    // blanc dans la composition plutôt qu'une erreur.
    for (const job of CV.jobs) {
      expect(job.title, job.company).toBeTruthy()
      expect(job.company, job.title).toBeTruthy()
      expect(job.period, job.company).toBeTruthy()
      // Quatre au minimum (décision de l'auteur, 2026-08-20) : une cartouche
      // qui n'en montre que deux ne récompense pas le survol qui l'a ouverte.
      expect(job.missions.length, job.company).toBeGreaterThanOrEqual(4)
      for (const mission of job.missions) expect(mission, job.company).toBeTruthy()
    }
  })

  it('identifie chaque poste de façon unique', () => {
    // `entreprise-période` sert de clé React : deux postes identiques feraient
    // disparaître une cartouche silencieusement.
    const keys = CV.jobs.map((j) => `${j.company}-${j.period}`)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('a des faits complets et une phrase de repli', () => {
    expect(CV.factsTitle).toBeTruthy()
    expect(CV.facts.length).toBeGreaterThan(0)
    for (const fact of CV.facts) {
      expect(fact.label).toBeTruthy()
      expect(fact.value).toBeTruthy()
    }
    expect(CV_JOBS_EMPTY.trim().length).toBeGreaterThan(0)
  })
})

describe('les formations', () => {
  it('affichent chaque cartouche sans trou', () => {
    expect(CV.formationsTitle.trim()).not.toBe('')
    expect(CV.formations.length).toBeGreaterThan(0)
    for (const f of CV.formations) {
      expect(f.title, f.school).toBeTruthy()
      expect(f.school, f.title).toBeTruthy()
      expect(f.period, f.school).toBeTruthy()
    }
  })

  it('identifie chaque cartouche de façon unique', () => {
    // `école-période` sert de clé React, comme `entreprise-période` pour un poste.
    const keys = CV.formations.map((f) => `${f.school}-${f.period}`)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('ne portent aucune mission à dérouler', () => {
    // `.job--static` retire le survol ET le `tabIndex` : un diplôme n'ouvre
    // rien, il ne doit donc rien promettre.
    expect(component).toContain('job job--static')
  })
})

describe('les réglettes de vignettes', () => {
  const strips: [string, CvGlyph[]][] = [
    ['savoir-être', CV.traits],
    ['savoir-faire', CV.skills],
  ]

  it('a toujours de quoi fabriquer une initiale', () => {
    // Sans SVG, la vignette affiche `name.slice(0, 1)`. Un nom vide y produit
    // une pastille muette — pas une erreur, juste un carré vide que personne
    // ne relierait à sa cause.
    for (const [strip, items] of strips) {
      expect(items.length, strip).toBeGreaterThan(0)
      for (const item of items) expect(item.name.trim(), strip).not.toBe('')
    }
  })

  it('identifie chaque vignette de façon unique', () => {
    // `name` sert de clé React : un doublon ferait disparaître une vignette.
    for (const [strip, items] of strips) {
      const names = items.map((i) => i.name)
      expect(new Set(names).size, strip).toBe(names.length)
    }
  })

  it('garde le savoir-être à six, ni plus ni moins', () => {
    // La carte les range en 3 × 2 pour tenir à la hauteur de la photo. Cinq
    // laissent un trou ; sept ouvrent une troisième rangée, qui rallonge toute
    // la rangée du haut et pousse le CV hors de l'écran quand un accordéon
    // s'ouvre (mesuré à 1000 × 720).
    expect(CV.traits.length).toBe(6)
  })
})

describe('« Le cap »', () => {
  it('porte un titre de SECTION, pas un titre de carte', () => {
    // Décision de l'auteur (2026-08-20) : c'est une section au même rang
    // qu'Expériences et Formations, et c'est la marge du titre de section qui
    // la détache du savoir-faire au-dessus.
    const at = component.indexOf('CV.outlookTitle')
    expect(at, 'CV.outlookTitle absent du composant').toBeGreaterThan(-1)
    expect(component.slice(component.lastIndexOf('<h2', at), at)).toContain('cv__section-title')
  })

  it("porte l'accent froid, contrairement aux titres de carte", () => {
    // La couleur porte la hiérarchie : trois sections en accent, les cartes
    // qu'elles contiennent en crème sourd. Ni corps ni graisse en plus.
    const rule = tokens.slice(
      tokens.indexOf('.cv__section-title {'),
      tokens.indexOf('}', tokens.indexOf('.cv__section-title {')),
    )
    expect(rule).toContain('rgba(var(--glow-rgb)')
  })

  it('vient avant les cartouches', () => {
    // L'intention se lit d'abord, le parcours la justifie ensuite.
    expect(component.indexOf('CV.outlookTitle')).toBeLessThan(component.indexOf('CV.jobsTitle'))
    expect(component.indexOf('CV.jobsTitle')).toBeLessThan(component.indexOf('CV.formationsTitle'))
  })

  it('tient en quatre lignes', () => {
    // Le budget est vertical, pas éditorial : à 13 px dans une carte de ~545 px,
    // une ligne porte ~95 signes. Au-delà de quatre, le CV déborde de l'écran
    // dès qu'un accordéon s'ouvre — mesuré, la marge n'est que de 33 px.
    expect(CV.outlookTitle.trim()).not.toBe('')
    expect(CV.outlook.trim()).not.toBe('')
    expect(CV.outlook.length).toBeLessThanOrEqual(400)
  })
})

describe("l'anatomie du CV", () => {
  it('vit dans le design system, pas dans le composant', () => {
    for (const cls of [
      '.cv {',
      '.cv__card',
      '.cv__card--traits',
      '.cv__fact',
      '.cv__empty',
      '.cv__tiles',
      '.cv__tile-mark',
      '.cv__outlook-text',
      '.cv__section-title',
      '.job {',
      '.job--static',
      '.job__missions',
    ]) {
      expect(tokens, `${cls} absent de tokens.css`).toContain(cls)
    }
  })

  it("n'est plus redéfinie par la maquette", () => {
    // La maquette ne garde qu'un commentaire dans son `<style>` ; y remettre
    // une règle rouvrirait la porte à deux définitions divergentes.
    const local = mockup.slice(mockup.indexOf('<style>'), mockup.indexOf('</style>'))
    expect(local).not.toMatch(/^\s*\.(cv|job)[^*]*\{/m)
  })

  it("déroule l'accordéon sans plafond en dur", () => {
    // `grid-template-rows: 0fr → 1fr` prend la hauteur du contenu. Une
    // `max-height` en pixels rognerait la mission de trop en silence.
    expect(tokens).toMatch(/\.job__missions\s*\{[^}]*grid-template-rows:\s*0fr/)
    expect(tokens).not.toMatch(/\.job__missions[^}]*max-height:\s*\d/)
  })
})
