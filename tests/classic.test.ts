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

describe('le balayage de consigne', () => {
  /** Le MOUVEMENT n'est pas recopié — `cue-laser` vit dans `tokens.css` et les
   *  deux pages l'utilisent. C'est lui qui a été mesuré et arbitré (#131). */
  it('réutilise les keyframes de la bulle pour sa boucle', () => {
    expect(tokens).toContain('@keyframes cue-laser')
    expect(css).toMatch(/\.classic-cue--loop[\s\S]{0,120}animation: cue-laser/)
  })

  it('ne traverse qu’une fois sur l’accroche, et sur toute la durée', () => {
    // Les keyframes de la bulle traversent en 22 % puis attendent : cette
    // attente n'a de sens qu'en boucle. Un seul passage doit occuper sa durée.
    expect(css).toMatch(/\.classic-cue--pass[\s\S]{0,140}animation: classic-cue-pass/)
    expect(css).toMatch(/@keyframes classic-cue-pass[\s\S]{0,160}from[\s\S]{0,60}130%/)
    expect(css).toMatch(/\.classic-cue--pass[\s\S]{0,140}1 both/)
  })

  it('peint le même dégradé que la bulle', () => {
    // La recette est recopiée (six lignes) ; ce test est ce qui l'empêche de
    // diverger le jour où l'une des deux est retouchée.
    const stops = (block: string) =>
      block
        .match(/linear-gradient\(([\s\S]*?)\);/)![1]
        .replace(/\s+/g, ' ')
        .trim()
    const bubble = tokens.slice(tokens.indexOf('.bubble__cue {'))
    const classic = css.slice(css.indexOf('.classic-cue {'))
    expect(stops(classic)).toBe(stops(bubble))
  })

  it('perd son balayage sous mouvement réduit, jamais sa couleur', () => {
    // L'accent porte une information — ceci vous demande quelque chose — qu'on
    // ne peut pas retirer sans appauvrir la phrase. Même arbitrage que la bulle.
    const reduced = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'))
    expect(reduced).toMatch(/\.classic-cue \{[\s\S]{0,160}animation: none/)
    expect(reduced).toMatch(/\.classic-cue \{[\s\S]{0,160}text-fill-color: var\(--glow\)/)
  })
})

describe('la bascule de langue', () => {
  it('montre les deux langues, pas seulement l’autre', () => {
    // Un bouton isolé marqué « EN » se lit aussi bien « vous êtes en anglais »
    // que « passer en anglais » — deux lectures exactement contraires — et il
    // ne dit pas quelles langues existent. La paire EST la liste.
    const toggle = page.slice(
      page.indexOf('function LangToggle'),
      page.indexOf('export function ClassicApp'),
    )
    expect(toggle).toContain('LOCALES.map')
    expect(toggle).toContain("aria-current={code === locale ? 'true' : undefined}")
  })

  it('garde le côté actif cliquable', () => {
    // Le désactiver ferait disparaître l'indicateur, or c'est lui qui répond à
    // « dans quelle langue suis-je ». Même arbitrage que la barre de la scène.
    const toggle = page.slice(
      page.indexOf('function LangToggle'),
      page.indexOf('export function ClassicApp'),
    )
    expect(toggle).not.toContain('disabled')
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
    const cvScreen = readFileSync('src/ui/CvScreen.tsx', 'utf8')
    expect(cvScreen).toContain('glyphMark(item, locale)')
    expect(page).toContain('glyphMark(skill, locale)')
  })
})
