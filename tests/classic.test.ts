import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  CUBE_SPEED_FAR,
  CUBE_SPEED_IDLE,
  CUBE_REST_DEG,
  CUBE_SPEED_NEAR,
  HALO_SHEET_VH,
  NAME_DECRYPT_MS,
  REVEAL_ROOT_MARGIN,
} from '@/config/classic'
import { CV, glyphMark } from '@/content/cv'
import { UI } from '@/content/ui'
import { approach, cubeSpeed, haloOffset, scrollProgress, spinStep } from '@/lib/classic'
import { LOCALES, t } from '@/lib/locale'
import { DECRYPT_CHARSET_CODE } from '@/ui/Scrambled'

/**
 * Le site classique (#29) — ce qui ne se voit pas à l'écran.
 *
 * Une page une-page est facile à regarder et difficile à vérifier : tout ce
 * qu'elle fait est visible, sauf quand ça ne l'est pas. Ce fichier verrouille
 * exactement ces cas-là — le déverrouillage du défilement, sans lequel la page
 * a l'air tronquée ; la marge de rattrapage de l'observateur, sans laquelle une
 * section dépassée reste invisible pour toujours ; et les deux boucles
 * d'animation, qu'aucune capture ne peut juger.
 */

const css = readFileSync('src/styles/classic.css', 'utf8')
const tokens = readFileSync('src/styles/tokens.css', 'utf8')
const app = readFileSync('src/App.tsx', 'utf8')
const page = readFileSync('src/ui/ClassicApp.tsx', 'utf8')

describe('le déverrouillage du défilement', () => {
  /**
   * **La panne la plus silencieuse de cette page.** `styles.css` fige
   * `html, body, #root` en `height: 100%; overflow: hidden` — ce qu'il faut à
   * une scène 3D plein cadre. Sous cette règle, une page une-page ne défile pas
   * du tout : l'observateur de révélation ne se déclenche jamais, le halo ne
   * dérive pas, le mini-nom n'apparaît pas. Rien ne lève d'erreur, rien ne
   * s'affiche en rouge — la page a simplement l'air d'être coupée après
   * l'accueil, ce qui est aussi ce à quoi ressemble une page inachevée.
   *
   * Les deux moitiés sont vérifiées ensemble parce que chacune est inerte sans
   * l'autre : l'attribut sans la règle, la règle sans l'attribut.
   */
  it('est écrit par App.tsx et lu par classic.css', () => {
    expect(app).toContain("document.documentElement.dataset.experience = 'classic'")
    expect(css).toContain(":root[data-experience='classic']")
    expect(css).toMatch(/:root\[data-experience='classic'\][\s\S]{0,200}overflow: visible/)
  })

  it('est posé AVANT la première peinture', () => {
    // Mesuré image par image : avec un `useEffect`, qui s'exécute après la
    // peinture, la page classique était peinte au moins une trame entière dans
    // un document encore bloqué — `overflow: hidden`, `scrollHeight: 900`.
    // Une image ne se voit pas ; mais tout ce qui MESURE la page au montage la
    // lit dans cet état, et un observateur qui se trompe une fois ne se
    // reprend pas : il a déjà cessé de regarder.
    //
    // `lang`, juste à côté, reste un `useEffect` : une langue fausse pendant
    // une image ne coûte rien, un document bloqué coûte une mise en page.
    // On regarde quel crochet OUVRE le bloc qui écrit l'attribut : le dernier
    // `useEffect(` ou `useLayoutEffect(` avant l'écriture. Un test qui se
    // contenterait de chercher `useLayoutEffect` dans le fichier passerait le
    // jour où il servirait à autre chose.
    const write = app.indexOf("dataset.experience = 'classic'")
    expect(write, "l'écriture de data-experience est introuvable").toBeGreaterThan(0)
    const before = app.slice(0, write)
    expect(before.lastIndexOf('useLayoutEffect(')).toBeGreaterThan(before.lastIndexOf('useEffect('))
  })

  it("est retiré quand on quitte l'expérience classique", () => {
    // Rouvrir la pré-sélection puis choisir la 3D laisserait sinon une page qui
    // défile sous un canvas fixe — la molette commanderait le tour ET le
    // document, ce que personne ne peut diagnostiquer à l'œil.
    expect(app).toContain('delete document.documentElement.dataset.experience')
  })
})

describe("l'observateur de révélation", () => {
  /**
   * La marge haute ne règle pas le déclenchement, elle règle le RATTRAPAGE.
   * Sans elle, une section dépassée d'un coup — défilement rapide, touche Fin,
   * un lien d'ancre — n'entre jamais dans le champ de l'observateur et reste à
   * `opacity: 0`. Définitivement, et sans rien signaler.
   */
  it('rattrape les sections dépassées', () => {
    const top = Number(REVEAL_ROOT_MARGIN.split(' ')[0].replace('px', ''))
    expect(top).toBeGreaterThan(5000)
  })

  it('ne révèle rien avant que la section soit vraiment entrée', () => {
    // La marge BASSE est négative : un groupe compte comme vu quand il a
    // franchi le dernier dixième de l'écran, pas quand son premier pixel
    // affleure. Sinon la cascade se joue hors du regard.
    const bottom = REVEAL_ROOT_MARGIN.split(' ')[2]
    expect(bottom.startsWith('-')).toBe(true)
  })
})

describe('le déchiffrage du nom', () => {
  it('dure exactement ce que le CSS annonce', () => {
    const declared = css.match(/--t-classic-decrypt:\s*(\d+)ms/)
    expect(declared, 'jeton --t-classic-decrypt introuvable').not.toBeNull()
    expect(Number(declared![1])).toBe(NAME_DECRYPT_MS)
  })

  it('ne tire ni espace ni lettre', () => {
    // Pas d'espace : ce sont eux qui gardent la silhouette du nom pendant le
    // brouillage. Pas de lettre : le jeu du CV brouille des intitulés, celui-ci
    // brouille un NOM PROPRE en très grand — avec des lettres, on lit des
    // quasi-noms pendant 1,7 s au lieu de voir un nom se résoudre.
    expect(DECRYPT_CHARSET_CODE).not.toContain(' ')
    expect(DECRYPT_CHARSET_CODE).not.toMatch(/[a-zA-Z]/)
    expect(DECRYPT_CHARSET_CODE.length).toBeGreaterThan(10)
  })
})

describe('le cube de l’accueil', () => {
  it('ralentit quand le curseur s’en approche', () => {
    // Le sens compte et il est contre-intuitif à écrire : on regarde ce qui se
    // calme quand on s'en approche, on chasse ce qui s'emballe. Inversé, le
    // code compile et le cube fuit le curseur.
    expect(cubeSpeed(0, 1920, 1080)).toBeCloseTo(CUBE_SPEED_NEAR)
    expect(cubeSpeed(9999, 1920, 1080)).toBeCloseTo(CUBE_SPEED_FAR)
    expect(cubeSpeed(200, 1920, 1080)).toBeLessThan(cubeSpeed(600, 1920, 1080))
  })

  it('a une vitesse de repos entre les deux bornes', () => {
    // Sans souris — un tactile, un clavier — le cube tourne quand même : il n'a
    // personne à qui répondre, il n'a pas pour autant à faire le mort.
    expect(CUBE_SPEED_IDLE).toBeGreaterThan(CUBE_SPEED_NEAR)
    expect(CUBE_SPEED_IDLE).toBeLessThan(CUBE_SPEED_FAR)
  })

  it('se repose sur l’assiette que le CSS déclare', () => {
    // Sous mouvement réduit la boucle est coupée et le cube reste sur cette
    // pose définitivement ; à 0° il se lit comme un tronc de pyramide. C'est
    // aussi l'angle de départ de la boucle, faute de quoi le cube sauterait à
    // la première image.
    expect(css).toMatch(new RegExp(`rotateX\\(-18deg\\) rotateY\\(${CUBE_REST_DEG}deg\\)`))
    const hero = readFileSync('src/ui/classic/Hero.tsx', 'utf8')
    expect(hero).toContain('let angle = CUBE_REST_DEG')
  })

  it('ne saute pas au retour d’un onglet en arrière-plan', () => {
    // Un onglet caché ne reçoit plus d'images ; au retour, `dt` vaut plusieurs
    // secondes. Sans plafond le cube ne rattrape pas, il saute.
    const long = spinStep(0, 60, 12)
    const capped = spinStep(0, 60, 0.05)
    expect(long).toBeCloseTo(capped)
  })

  it('reste dans un tour complet', () => {
    expect(spinStep(359, 60, 0.05)).toBeLessThan(360)
  })
})

describe('le halo de braise', () => {
  it('ne part jamais vers le bas', () => {
    // La nappe monte quand on descend. Un décalage positif la ferait sortir par
    // le bas et laisserait le haut de l'écran nu.
    expect(haloOffset(0, 2000, 900)).toBeLessThanOrEqual(0)
    expect(haloOffset(1, 2000, 900)).toBeLessThan(0)
  })

  it('reste visible du haut au bas de la page', () => {
    // La course est la hauteur de la nappe moins celle du viewport : c'est
    // exactement ce qu'il faut pour que son bas affleure l'écran au départ et
    // son haut à l'arrivée. Une nappe plus courte que deux viewports n'a plus
    // de quoi traverser la page.
    expect(HALO_SHEET_VH).toBeGreaterThan(2)
    const vh = 900
    expect(haloOffset(1, HALO_SHEET_VH * vh, vh)).toBeCloseTo(-(HALO_SHEET_VH - 1) * vh)
  })

  it('ne descend pas sous une nappe plus courte que l’écran', () => {
    // `toBeCloseTo` et non `toBe` : le produit vaut `-0`, que `Object.is`
    // distingue de `0` alors que le CSS ne les distingue pas — `-0.0px` est un
    // décalage nul parfaitement valide. Ce qui compte est l'absence de course.
    expect(haloOffset(1, 500, 900)).toBeCloseTo(0)
  })

  it('ne devient jamais NaN sur une page qui ne défile pas', () => {
    // `scrollHeight === vh` donnerait `0/0`. Le halo partirait à `NaN` px —
    // donc nulle part, sur une page dont le seul tort est d'être courte. Un
    // `NaN` en CSS ne lève rien : la déclaration est simplement ignorée.
    const p = scrollProgress(0, 900, 900)
    expect(Number.isNaN(p)).toBe(false)
    expect(p).toBe(0)
  })

  it('reste borné entre 0 et 1 malgré le rebond élastique', () => {
    // Un `scrollY` négatif (rebond en haut de page sur macOS) ou supérieur au
    // maximum (rebond en bas) sortirait la nappe de sa course.
    expect(scrollProgress(-200, 4000, 900)).toBe(0)
    expect(scrollProgress(99999, 4000, 900)).toBe(1)
  })

  it('converge au lieu de diverger', () => {
    // Un lissage écrit à l'envers — `cur + (cur - cible) * k` — compile, tourne,
    // et s'envole. Rien ne le dit avant que le halo ait quitté l'écran.
    let cur = 0
    for (let i = 0; i < 400; i++) cur = approach(cur, 1, 0.02)
    expect(cur).toBeGreaterThan(0.99)
    expect(cur).toBeLessThanOrEqual(1)
  })
})

describe('les groupes de révélation ne s’imbriquent pas', () => {
  /**
   * **Le défaut qui se lit comme une absence d'animation.** Le CSS révèle par
   * `[data-revealed='true'] .classic-reveal`, un sélecteur de DESCENDANCE : un
   * groupe placé à l'intérieur d'un autre s'allume avec lui, quel que soit son
   * propre observateur. Le CV l'a vécu — ses trois blocs partaient mille cinq
   * cents pixels trop tôt, et le symptôme n'était pas « ça s'allume trop tôt »
   * mais « il n'y a aucune animation », parce qu'on arrivait après.
   */
  it("la section du CV n'est pas elle-même un groupe", () => {
    const section = page.slice(
      page.indexOf('function CvSection'),
      page.indexOf('function Projects'),
    )
    expect(section).toContain('<section className="classic-section">')
    expect(section).not.toMatch(/<section[^>]*data-revealed/)
  })

  it('le défaut est signalé en développement, pas seulement commenté', () => {
    // Il ne se voit pas dans le DOM : il ne se voit qu'en défilant, au moment
    // où il est trop tard pour le remarquer.
    const hook = readFileSync('src/ui/classic/useReveal.ts', 'utf8')
    expect(hook).toContain("querySelector('[data-revealed]')")
    expect(hook).toContain('import.meta.env.DEV')
  })
})

describe('les deux marquages de l’accueil', () => {
  /**
   * Ils ne disent PAS la même chose, et c'est tout l'intérêt de les distinguer.
   * Une CONSIGNE porte l'accent : la couleur est de l'information, elle dit
   * « ceci vous demande quelque chose » (#129). Un FAISCEAU ne fait que
   * traverser un texte qui garde sa couleur — il souligne sans requalifier.
   */
  it('viennent tous deux du design system, jamais recopiés ici', () => {
    // La recette de la consigne a vécu recopiée dans `classic.css`, avec un
    // test pour surveiller qu'elle ne dérive pas. Une seule définition rend ce
    // test inutile, ce qui vaut mieux qu'un test qui passe.
    expect(tokens).toContain('.cue {')
    expect(tokens).toContain('.beam {')
    expect(css).not.toContain('.classic-cue')
    expect(css).not.toContain('.classic-sweep')
    expect(css).not.toMatch(/linear-gradient\([\s\S]{0,40}var\(--glow\) 43%/)
  })

  it('marquent l’accroche et « défiler » différemment', () => {
    const hero = readFileSync('src/ui/classic/Hero.tsx', 'utf8')
    // L'accroche raconte : elle est TRAVERSÉE et garde sa couleur.
    const tagline = hero.slice(hero.indexOf('classic-hero__tagline'))
    expect(tagline).toContain('className="beam"')
    // « Défiler » demande : c'est la seule consigne de la page.
    const scroll = hero.slice(hero.indexOf('classic-hero__scroll'))
    expect(scroll).toContain('className="cue"')
  })

  it('donnent à « défiler » son propre tempo, sans changer sa forme', () => {
    // Une consigne seule dans un coin doit rester repérable plus souvent qu'un
    // mot au milieu d'un récit. Seule la DURÉE est surchargée : la forme —
    // traverser vite, attendre longtemps — reste celle du design system.
    const hero = readFileSync('src/ui/classic/Hero.tsx', 'utf8')
    expect(hero).toContain("'--t-cue-laser': 'var(--t-classic-cue-loop)'")
    expect(css).toMatch(/--t-classic-cue-loop:\s*\d+ms/)
  })

  it('traverse l’accroche une seule fois, et sur toute la durée', () => {
    // Les keyframes d'une consigne traversent en 22 % puis attendent : cette
    // attente n'a de sens qu'en boucle. Un faisceau doit occuper sa durée.
    expect(tokens).toMatch(/\.beam \{[\s\S]{0,700}animation:[\s\S]{0,120}beam-pass/)
    expect(tokens).toMatch(/@keyframes beam-pass[\s\S]{0,160}from[\s\S]{0,80}130%/)
    expect(tokens).toMatch(/\.beam \{[\s\S]{0,700}1 both/)
  })

  it('ne peint PAS ce qu’un faisceau traverse dans l’accent', () => {
    const beam = tokens.slice(tokens.indexOf('.beam {'))
    const stops = beam.match(/linear-gradient\(([\s\S]*?)\);/)![1]
    expect(stops).toMatch(/currentColor 0%/)
    expect(stops).toMatch(/var\(--glow-deep\) 50%/)
    // `currentColor` et non une valeur en dur : le faisceau sert des textes de
    // couleurs différentes — la crème pleine de l'accroche, la crème à 50 %
    // d'une méta de pré-sélection — et une couleur écrite les repeindrait.
    expect(stops).not.toMatch(/#[0-9a-f]{6}/i)
  })

  it('éclaire la consigne autant qu’il la traverse', () => {
    // Le dégradé seul ne pouvait pas se démarquer davantage : son point le plus
    // clair est déjà #fff. Ce qui manquait était la LUEUR, et il en faut deux
    // couches — blanche et serrée pour détacher les lettres, cyan et large pour
    // déborder — sans quoi l'effet se voit sur l'encre de l'accueil et se perd
    // sur le verre fumé d'une bulle.
    expect(tokens).toContain('@keyframes cue-bloom')
    const bloom = tokens.slice(tokens.indexOf('@keyframes cue-bloom'))
    expect(bloom).toMatch(/drop-shadow\([^)]*255, 255, 255/)
    expect(bloom).toMatch(/drop-shadow\([^)]*--glow-rgb/)
    // Exactement synchrone avec la traversée : même durée, même retard.
    expect(tokens).toMatch(
      /cue-laser var\(--t-cue-laser\)[\s\S]{0,80}cue-bloom var\(--t-cue-laser\)/,
    )
  })

  it('perdent leur balayage sous mouvement réduit, jamais leur couleur', () => {
    const reduced = tokens.slice(tokens.lastIndexOf('.cue {'))
    expect(reduced.slice(0, 220)).toContain('animation: none')
    // L'accent porte une information — ceci vous demande quelque chose — qu'on
    // ne peut pas retirer sans appauvrir la phrase.
    expect(reduced.slice(0, 220)).toContain('text-fill-color: var(--glow)')
    // La lueur part avec le balayage, sinon le mot reste un néon fixe.
    expect(reduced.slice(0, 220)).toContain('filter: none')
    // Le faisceau, lui, n'a rien à garder : la couleur du texte est déjà la
    // bonne, il n'était que du mouvement.
    const beamReduced = tokens.slice(tokens.lastIndexOf('.beam {'))
    expect(beamReduced.slice(0, 260)).toContain('text-fill-color: inherit')
    expect(beamReduced.slice(0, 260)).toContain('animation: none')
  })
})

describe('la bascule de langue', () => {
  const toggle = readFileSync('src/ui/LangToggle.tsx', 'utf8')
  const presel = readFileSync('src/ui/Preselection.tsx', 'utf8')

  it('montre les deux langues, pas seulement l’autre', () => {
    // Un bouton isolé marqué « EN » se lit aussi bien « vous êtes en anglais »
    // que « passer en anglais » — deux lectures exactement contraires — et il
    // ne dit pas quelles langues existent. La paire EST la liste.
    expect(toggle).toContain('LOCALES.map')
    expect(toggle).toContain("aria-current={code === locale ? 'true' : undefined}")
  })

  it('garde le côté actif cliquable', () => {
    // Le désactiver ferait disparaître l'indicateur, or c'est lui qui répond à
    // « dans quelle langue suis-je ». Même arbitrage que la barre de la scène.
    expect(toggle).not.toContain('disabled')
  })

  /**
   * **Elle existe sur l'écran de CHOIX, et c'est ce qui l'a rendue partagée.**
   * On y arrivait dans la langue devinée par le navigateur, on lisait la
   * question et les deux promesses dans cette langue, et on ne pouvait en
   * changer qu'après s'être engagé dans une expérience.
   */
  it('est sur l’écran de choix comme sur le site classique', () => {
    expect(presel).toContain('<LangToggle className="presel__lang" />')
    expect(page).toContain('<LangToggle />')
    // Un seul composant : deux copies auraient fini par diverger, et c'est le
    // même geste, au même endroit de l'écran.
    expect(presel).toContain("from '@/ui/LangToggle'")
    expect(page).toContain("from '@/ui/LangToggle'")
  })

  it('lègue son choix aux deux portfolios sans rien transporter', () => {
    // `useLocale` est un store global et mémorisé : la décision prise à l'écran
    // de choix vaut ensuite pour la 3D comme pour le 2D, et pour les visites
    // suivantes puisque `resolveLocale` fait passer un choix mémorisé avant
    // toute détection. Aucune prop de langue ne descend, et c'est la propriété
    // à préserver — la première qui apparaîtrait créerait une seconde vérité.
    expect(toggle).toContain('useLocale((s) => s.setLocale)')
    expect(toggle).not.toMatch(/locale\s*:\s*Locale/)
    const store = readFileSync('src/state/locale.ts', 'utf8')
    expect(store).toContain('storeLocale(locale)')
    const lib = readFileSync('src/lib/locale.ts', 'utf8')
    expect(lib).toMatch(/if \(stored && isLocale\(stored\)\) return \{ locale: stored/)
  })

  it('vit dans le design system, pas dans la feuille du site classique', () => {
    // Elle sert la pré-sélection, qui n'appartient pas au site 2D. Même
    // raisonnement que `.beam`.
    expect(tokens).toContain('.lang {')
    expect(css).not.toContain('.classic-lang')
  })
})

describe('la favicon', () => {
  const svg = readFileSync('public/favicon.svg', 'utf8')
  const html = readFileSync('index.html', 'utf8')

  it('est servie aux deux expériences', () => {
    // Un onglet ne sait pas laquelle on visite, et il s'affiche avant la
    // première ligne de JavaScript : le SVG est donc un fichier servi tel quel,
    // déclaré dans le document, jamais monté par React.
    expect(html).toContain('rel="icon"')
    expect(html).toContain('/favicon.svg')
    // `type` explicite : sans lui, certains navigateurs réclament d'abord un
    // `/favicon.ico` inexistant et laissent un 404 dans la console.
    expect(html).toContain('type="image/svg+xml"')
  })

  it("porte le triangle du logo, avec ses coordonnées à l'échelle", () => {
    // `src/ui/Logo.tsx` trace `M2 2.5 H14 L8 13.5 Z` dans une boîte de 16 ;
    // celle-ci en fait 32. C'est la seule copie de la forme dans le produit.
    expect(svg).toContain('M6 7 H26 L16 26 Z')
    expect(svg).toContain('viewBox="0 0 32 32"')
  })

  it('ne contient aucun double tiret dans ses commentaires', () => {
    // **C'est du XML.** Un double tiret y est interdit à l'intérieur d'un
    // commentaire : nommer le jeton d'accent par son écriture CSS a suffi à
    // rendre le fichier illisible, et le navigateur affiche alors une PAGE
    // d'erreur XML dans l'onglet, pas une icône cassée. Personne ne regarde sa
    // propre favicon, donc personne ne l'aurait vu.
    for (const comment of svg.match(/<!--[\s\S]*?-->/g) ?? []) {
      expect(comment.slice(4, -3)).not.toContain('--')
    }
  })
})

describe('le contenu', () => {
  /**
   * **La page ne réécrit aucun contenu, elle le lit** (arbitrage du
   * 2026-08-24). Un second parcours recopié ici aurait divergé du premier à la
   * première correction de date, sans que rien ne le dise — c'est exactement le
   * genre de mensonge qu'un portfolio ne peut pas se permettre.
   */
  it('lit le parcours et les projets partagés', () => {
    expect(page).toContain("from '@/content/cv'")
    expect(page).toContain("from '@/content/projects'")
  })

  it("n'écrit aucun poste ni aucune école dans UI.classic", () => {
    // Le repère est concret : si un nom d'entreprise ou d'école apparaissait
    // dans les libellés de la page, c'est qu'on aurait recommencé à recopier.
    const labels = JSON.stringify(UI.classic)
    for (const job of CV.jobs) expect(labels).not.toContain(job.company)
    for (const formation of CV.formations) expect(labels).not.toContain(formation.school)
  })

  it('existe dans les deux langues, sans trou', () => {
    for (const [key, value] of Object.entries(UI.classic)) {
      for (const locale of LOCALES) {
        expect(t(value, locale), `UI.classic.${key} (${locale})`).toBeTruthy()
      }
    }
  })

  it('numérote ses sections dans l’ordre du défilement', () => {
    // Contrairement aux bulles du tour, que `bubbleKicker()` calcule : le tour
    // se réordonne, une page une-page a l'ordre de son défilement et rien
    // d'autre ne peut le changer qu'une réécriture de la page.
    const order = [
      UI.classic.capKicker,
      UI.classic.cvKicker,
      UI.classic.projKicker,
      UI.classic.formKicker,
    ]
    order.forEach((kicker, i) => {
      for (const locale of LOCALES) {
        expect(t(kicker, locale).startsWith(`0${i + 1} —`)).toBe(true)
      }
    })
  })
})

describe('les vignettes de savoir-faire', () => {
  it('préfèrent leur initiale déclarée au premier caractère du nom', () => {
    // `TypeScript` et `Tailwind CSS` commencent tous deux par un T : sans
    // initiale explicite, deux tuiles voisines affichent le même glyphe.
    expect(glyphMark({ name: 'PostgreSQL', initial: 'Pg' }, 'fr')).toBe('Pg')
    expect(glyphMark({ name: 'PostgreSQL' }, 'fr')).toBe('P')
  })

  it('donnent la même marque aux deux expériences', () => {
    // La règle vit dans `cv.ts` et non dans les composants : deux replis
    // différents feraient dire deux choses à une seule donnée.
    //
    // **Le contrôle a changé de forme avec #169, et il s'est renforcé.** Il
    // vérifiait que les deux composants appelaient `glyphMark` chacun de son
    // côté — ce qui garantissait le même REPLI mais laissait chacun peindre la
    // marque à sa façon, et ils divergeaient déjà : `<img>` en couleur ici,
    // `<img>` en couleur là, pour des fichiers en `currentColor` qui rendaient
    // noir. Les deux rendent maintenant le MÊME composant, qui porte la règle
    // entière — masque, couleur du contexte, repli par initiale.
    const cvScreen = readFileSync('src/ui/CvScreen.tsx', 'utf8')
    expect(cvScreen).toContain('<CvMark glyph={item} locale={locale} />')
    expect(page).toContain('<CvMark glyph={skill} locale={locale} />')
    const mark = readFileSync('src/ui/CvMark.tsx', 'utf8')
    expect(mark).toContain('glyphMark(glyph, locale)')
    // Un masque, jamais une image : `currentColor` dans une `<img>` vaut noir.
    // Les commentaires sont retirés d'abord — celui de ce fichier CITE la
    // balise pour expliquer pourquoi elle est écartée, et un contrôle qui lit
    // la prose finirait par interdire d'expliquer sa propre règle.
    const sansCommentaires = mark.replace(/\/\*[\s\S]*?\*\//g, '')
    expect(sansCommentaires).not.toContain('<img')
    expect(tokens).toMatch(/\.glyph-mark\s*\{[^}]*mask:/)
  })
})
