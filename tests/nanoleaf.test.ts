import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { LED_PERIOD, LED_RAMP, LED_SPREAD, LED_TILES_MATERIAL, LED_TINT } from '@/config/nanoleaf'
import { tileRanks } from '@/lib/nanoleaf'

/**
 * Le dégradé des tuiles NanoLeaf (#36) — la première animation du lot qui
 * touche un matériau CUIT. Ce que ces tests protègent n'est donc pas seulement
 * un effet : c'est le droit de continuer à dire que le rendu vient de Blender.
 */

const component = readFileSync('src/scene/NanoLeaf.tsx', 'utf8')

describe('le rang des tuiles', () => {
  // Trois triangles alignés, donnés dans le désordre : chacun ses 3 sommets,
  // rien de partagé — c'est exactement la géométrie du panneau.
  const positions = [
    2,
    2,
    0,
    2.1,
    2,
    0,
    2,
    2.1,
    0, // le plus loin
    0,
    0,
    0,
    0.1,
    0,
    0,
    0,
    0.1,
    0, // le plus proche
    1,
    1,
    0,
    1.1,
    1,
    0,
    1,
    1.1,
    0, // au milieu
  ]

  it('donne un APLAT par tuile, pas un dégradé qui la traverse', () => {
    // C'est ce qui distingue un panneau NanoLeaf d'un simple dégradé : les
    // trois sommets d'une tuile doivent porter la même valeur.
    const r = tileRanks(positions)
    expect(r[0]).toBe(r[1])
    expect(r[1]).toBe(r[2])
    expect(r[3]).toBe(r[5])
    expect(r[6]).toBe(r[8])
  })

  it('classe par position, pas par ordre de déclaration', () => {
    // Les tuiles arrivent dans l'ordre du maillage, qui ne suit pas le panneau.
    const r = tileRanks(positions)
    expect(r[3]).toBe(0) // la plus proche de l'origine ouvre la vague
    expect(r[0]).toBe(1) // la plus lointaine la ferme
    expect(r[6]).toBeGreaterThan(0)
    expect(r[6]).toBeLessThan(1)
  })

  it('utilise le RANG et non la distance', () => {
    // Les tuiles d'un panneau ne sont pas régulièrement espacées : indexée sur
    // la position, la vague accélérerait et ralentirait selon les trous.
    const espacees = [
      0, 0, 0, 0.1, 0, 0, 0, 0.1, 0, 0.2, 0.2, 0, 0.3, 0.2, 0, 0.2, 0.3, 0, 9, 9, 0, 9.1, 9, 0, 9,
      9.1, 0,
    ]
    const r = tileRanks(espacees)
    expect(r[3]).toBeCloseTo(0.5, 6) // au milieu par le rang, pas par la distance
  })
})

describe('la palette', () => {
  it('forme une vraie triade, pas deux voisins et un tiers', () => {
    // Le premier jeu mêlait deux bleus — cyan et bleu électrique — et un rose :
    // deux voisins sur la roue chromatique ne font pas une triade, et le
    // panneau lisait « bleu qui varie ». Vert, violet et magenta sont répartis
    // autour de la roue, et c'est ce qui donne l'accord.
    expect(LED_RAMP).toEqual(['#36ff51', '#7c46d6', '#e24bc0'])
    expect(LED_RAMP.length).toBe(3)
  })

  it('boucle sans couture NI frontière', () => {
    // La version par segments choisissait deux arrêts avec un floor() : deux
    // frontières nettes traversaient le cycle, et une tuile qui les
    // franchissait changeait de régime d'un coup. Chaque arrêt porte
    // maintenant un lobe en cosinus centré sur lui — il n'y a plus de
    // frontière du tout.
    expect(component).toContain('cos(6.2831853')
    expect(component).not.toContain('floor(s)')
  })

  it('reste une lumière d’ambiance, pas un gyrophare', () => {
    expect(LED_PERIOD).toBeGreaterThanOrEqual(10)
    // Moins d'un cycle sur le panneau : deux tuiles voisines se ressemblent,
    // ce qui donne un dégradé doux plutôt qu'un arc-en-ciel.
    expect(LED_SPREAD).toBeLessThan(1)
  })
})

describe('le respect du bake', () => {
  it('ne change QUE la teinte, jamais la luminosité', () => {
    // La première version multipliait le bake par la teinte puis rehaussait :
    // les canaux débordaient, le panneau devenait plus lumineux que ce que
    // Blender avait cuit, et les couleurs viraient au criard. La teinte est
    // ramenée à la luminance du bake avant d'être mélangée.
    expect(component).toContain('lumBake')
    expect(component).toContain('lumTint')
    // La force est mesurée. La triade vert / violet / magenta est plus saturée
    // que le bleu cuit, donc le panneau finit forcément au-dessus de la
    // saturation du bake — c'est le prix de l'accord demandé. Ce qui reste
    // borné, c'est la LUMINOSITÉ : plus la teinte monte, plus les canaux
    // saturés écrêtent et plus le panneau s'assombrit. Mesuré à l'arrêt
    // Bureau : bake 208 ; teinte 0,35 → 194 ; 0,42 → 190 ; 0,5 → 185. Au-delà,
    // le panneau perd sa place dans l'image.
    expect(LED_TINT).toBeLessThanOrEqual(0.45)
  })

  it("ne touche qu'un seul matériau, nommé", () => {
    // Le pipeline non éclairé n'est pas modifié : on injecte dans le fragment
    // shader d'un `MeshBasicMaterial` précis, et rien d'autre.
    expect(LED_TILES_MATERIAL).toBe('Mat_LEDEmissive')
    expect(component).toContain('onBeforeCompile')
    expect(component).not.toContain('new ShaderMaterial')
  })

  it('se démonte sans laisser de trace', () => {
    // Sans quoi un rechargement à chaud empilerait les injections, et le
    // matériau ne reviendrait jamais à son état cuit.
    expect(component).toContain('deleteAttribute')
    expect(component).toContain('material.onBeforeCompile = () => {}')
  })

  it('laisse le matériau INTACT sous mouvement réduit', () => {
    // Pas figé sur une teinte : intact. C'est ce qui garantit que la boucle de
    // comparaison, qui capture en mouvement réduit, voit exactement le bake —
    // donc que la règle WYSIWYG reste vérifiable malgré une animation
    // permanente.
    const effect = component.slice(component.indexOf('useEffect(() => {'))
    expect(
      effect
        .slice(effect.indexOf('{') + 1)
        .trimStart()
        .startsWith('if (reduced) return'),
    ).toBe(true)
  })
})
