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
  it('ne contient que des couleurs déjà présentes dans la pièce', () => {
    // C'est ce qui fait que l'animation a l'air native plutôt que collée
    // dessus : le rose-violet des pales du PC, le cyan des LED, le bleu du
    // clavier. Aucune n'est inventée.
    expect(LED_RAMP).toEqual(['#ed9ef5', '#4dd9ff', '#4da6ff'])
  })

  it('boucle sans couture', () => {
    // Le dernier arrêt revient au premier : sans ce retour, la vague ferait un
    // saut de couleur à chaque tour.
    expect(component).toContain('uRamp[0]')
    expect(LED_RAMP.length).toBe(3)
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
    // 0,5 est mesuré : au-delà, la saturation du panneau dépasse celle du bake.
    expect(LED_TINT).toBeLessThanOrEqual(0.5)
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
