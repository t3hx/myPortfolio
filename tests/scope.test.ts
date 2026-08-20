import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { SCOPE_OUT_MS } from '@/ui/TelescopeScope'

/**
 * La visée du télescope (#106). Trois choses qu'aucune relecture ne
 * rattraperait, et une décision de composition qu'un refactor défera.
 */

const tokens = readFileSync('docs/design/tokens.css', 'utf8')
const component = readFileSync('src/ui/TelescopeScope.tsx', 'utf8')
const rule = tokens.slice(tokens.indexOf('.scope {'), tokens.indexOf('.scope::before'))

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
  it('garde un cercle sur tout format d’écran', () => {
    // En pourcentage, l'ouverture deviendrait une ellipse hors du carré.
    expect(rule).toContain('min(100vw, 100vh)')
  })

  it('ne barre jamais la face de la lune', () => {
    // À ce grossissement la lune est plus grande que l'ouverture. Un liseré
    // posé au bord de l'ouverture tombait en pleine face : un trait fin en
    // travers d'un astre se lit comme une rayure, pas comme une optique. Tout
    // ce qui décore le bord vit donc AU-DELÀ du rayon, dans la zone assombrie.
    const ring = tokens.slice(tokens.indexOf('.scope::before'), tokens.indexOf('.scope__reticle'))
    for (const m of ring.matchAll(/--scope-r\)\s*\*\s*([\d.]+)/g)) {
      expect(Number(m[1]), 'un décor du bord est retombé dans l’ouverture').toBeGreaterThan(1)
    }
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
