import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { isTelescope } from '@/config/telescope'
import { SCOPE_OUT_MS } from '@/ui/TelescopeScope'

/**
 * La visée du télescope (#106). Trois choses qu'aucune relecture ne
 * rattraperait, et une décision de composition qu'un refactor défera.
 */

const tokens = readFileSync('docs/design/tokens.css', 'utf8')
const component = readFileSync('src/ui/TelescopeScope.tsx', 'utf8')
/** Les COMMENTAIRES sont retirés partout dans ce fichier : ils expliquent
 *  justement ce qu'on interdit, et le mot interdit y figure donc forcément. */
const strip = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '')
const code = (ts: string) => ts.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')
const rule = strip(tokens.slice(tokens.indexOf('.scope {'), tokens.indexOf('.scope::before')))

describe('la sortie de la visée', () => {
  it('dure exactement ce que le CSS annonce', () => {
    const declared = tokens.match(/--t-scope-out:\s*(\d+)ms/)
    expect(declared, 'jeton --t-scope-out introuvable').not.toBeNull()
    expect(Number(declared![1])).toBe(SCOPE_OUT_MS)
  })

  it("est déclarée après l'entrée, sinon elle ne gagne pas", () => {
    // Même spécificité : c'est l'ordre dans le fichier qui tranche.
    expect(tokens.indexOf('.scope--out')).toBeGreaterThan(tokens.indexOf('.scope {'))
  })

  it('démonte en différé', () => {
    // La caméra met 1,6 s à revenir de la lune ; démonter le cache à l'instant
    // où la phase change le ferait disparaître d'un coup au milieu du vol.
    expect(component).toContain('SCOPE_OUT_MS')
    expect(component).toContain('setMounted(false)')
  })
})

describe("l'empilement", () => {
  it('laisse la barre de menu au-dessus, donc une sortie', () => {
    // À `--z-panel` le cache couvrirait la barre et `Échap` deviendrait la
    // seule issue. Même arbitrage que le CV : ce qui n'est pas modal ne se
    // comporte pas comme un modal.
    expect(rule).toContain('z-index: var(--z-bubble)')
    expect(rule).not.toContain('--z-panel')
  })

  it("n'intercepte pas le pointeur", () => {
    expect(rule).toContain('pointer-events: none')
  })
})

describe("la composition de l'oculaire", () => {
  it('suit la lune, donc la LARGEUR du cadre', () => {
    // Même raison que pour les bulles : le tour ajuste son champ
    // HORIZONTALEMENT, donc la taille apparente de la lune est proportionnelle
    // à la largeur et à rien d'autre. Sur `min(100vw, 100vh)` la cible suivait
    // la lune près du 16:9 et s'en décrochait ailleurs — mesuré, elle tombait
    // à 0,95 du limbe et coupait la face de l'astre.
    expect(rule).toContain('100vw')
    expect(rule).not.toContain('min(100vw, 100vh)')
  })

  it('borde le limbe de la lune, sans mordre dessus', () => {
    // La cible se lit comme le bord d'une optique à une seule condition : être
    // POSÉE sur le limbe. Plus dedans, un trait fin en travers d'un astre
    // ressemble à une rayure ; plus dehors, il flotte dans le noir sans rien
    // border. Tout ce qui décore le bord se mesure donc en `--scope-moon`.
    const ring = tokens.slice(tokens.indexOf('.scope::before'), tokens.indexOf('.scope__reticle'))
    const factors = [...ring.matchAll(/--scope-moon\)\s*\*\s*([\d.]+)/g)].map((m) => Number(m[1]))
    expect(factors.length, 'la cible ne se mesure plus sur le rayon de la lune').toBeGreaterThan(0)
    for (const f of factors) expect(f).toBeGreaterThanOrEqual(1)
  })

  it('ne met pas de croix au centre', () => {
    // Le centre, c'est la lune, et on ne la barre pas : quatre repères au bord,
    // jamais un réticule en croix.
    expect(component).toContain('scope__tick--n')
    expect(component).toContain('scope__tick--e')
    expect(component).not.toMatch(/crosshair|scope__cross/)
  })
})

describe('le mouvement réduit', () => {
  it("conserve l'ouverture mais lui retire le resserrement", () => {
    // Elle répond à un clic, donc elle est conservée — mais le resserrement du
    // cercle, lui, part tout seul une fois le clic donné, et c'est du mouvement
    // plein cadre.
    const reduced = tokens.slice(tokens.indexOf('@media (prefers-reduced-motion'))
    expect(reduced).toContain('.scope {')
    expect(reduced).not.toMatch(/\.scope\s*\{[^}]*scale/)
  })
})

describe('le nom du télescope', () => {
  it('reconnaît les enfants d’un maillage à plusieurs primitives', () => {
    // LE PIÈGE. `Telescope_Merged` a TROIS primitives, et le chargeur glTF en
    // fait un groupe dont les enfants s'appellent `_1`, `_2`, `_3`. Un raycast
    // ne rend jamais le groupe, toujours l'enfant : une égalité stricte sur le
    // nom ne reconnaît rien — mesuré, elle a cassé d'un coup le clic ET le
    // survol, sans rien afficher dans la console.
    expect(isTelescope('Telescope_Merged')).toBe(true)
    expect(isTelescope('Telescope_Merged_2')).toBe(true)
    // Le `_` du préfixe compte : sans lui, ceci passerait pour le télescope.
    expect(isTelescope('Telescope_MergedShadow')).toBe(false)
    expect(isTelescope('Desk_Merged')).toBe(false)
  })
})

describe("le moment de l'ouverture", () => {
  const rig = readFileSync('src/scene/CameraRig.tsx', 'utf8')

  it("attend l'ARRIVÉE, pas le clic", () => {
    // `phase === 'telescope'` est vrai dès le clic, alors que la caméra met
    // 1,6 s à rejoindre l'oculaire. Ouvrir la visée tout de suite posait le
    // cache circulaire sur une pièce encore en mouvement.
    expect(component).toContain('telescopeSettled')
    expect(code(component)).not.toContain("phase === 'telescope'")
    expect(rig).toContain('settleTelescope()')
    expect(rig.indexOf('onComplete')).toBeLessThan(rig.indexOf('settleTelescope()'))
  })
})
