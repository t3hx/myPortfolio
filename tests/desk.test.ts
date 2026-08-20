import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  FAN_BLADE_MATERIAL,
  FAN_RPS_MAX,
  FAN_RPS_MIN,
  FAN_SPIN,
  PC_FANS,
  SMOKE_LIFE,
  SMOKE_OPACITY,
  SMOKE_PUFFS,
  SMOKE_RISE,
} from '@/config/desk'
import { fanAxis, fanSpeed, puff } from '@/lib/desk'

/**
 * Le bureau qui respire (#35). Ce que l'œil ne rattrape pas : un ventilateur
 * qui tourne autour du mauvais axe (il vacille au lieu de tourner), dix
 * ventilateurs synchronisés (ça se lit comme une seule pièce), et une fumée
 * qui clignote à chaque recyclage de bouffée.
 */

describe("l'axe d'un ventilateur", () => {
  it('est sa dimension la plus fine, quelle que soit son orientation', () => {
    // Les trois orientations mesurées sur l'export du 2026-08-20. Les déduire
    // vaut pour les dix d'un coup et survit à un ré-export qui réoriente le
    // boîtier — la spec, elle, les listait à la main.
    expect(fanAxis([0.0951, 0.0149, 0.0951])).toBe(1) // Top / Bottom → Y
    expect(fanAxis([0.14, 0.14, 0.0125])).toBe(2) // Rear → Z
    expect(fanAxis([0.0149, 0.0951, 0.0951])).toBe(0) // Right → X
  })

  it('couvre les dix ventilateurs du boîtier', () => {
    expect(PC_FANS.length).toBe(10)
    expect(new Set(PC_FANS).size).toBe(10)
  })
})

describe('les vitesses', () => {
  const speeds = PC_FANS.map((_, i) => fanSpeed(i))

  it('restent dans la plage où la rotation se voit encore', () => {
    // Au-delà, le disque devient un flou uniforme et on ne voit plus qu'il
    // tourne — l'animation coûte alors sans rien montrer.
    for (const s of speeds) {
      expect(s).toBeGreaterThanOrEqual(FAN_RPS_MIN)
      expect(s).toBeLessThanOrEqual(FAN_RPS_MAX)
    }
  })

  it('sont désynchronisées', () => {
    // Dix disques identiques à la même vitesse se lisent comme une seule pièce
    // mécanique, ce qu'un boîtier de PC n'est pas.
    expect(new Set(speeds.map((s) => s.toFixed(3))).size).toBeGreaterThan(7)
  })

  it('tournent TOUTES dans le même sens', () => {
    // Le sens était alterné, pour « casser l'impression de bloc » — une idée
    // de designer appliquée à de la mécanique. Dans un vrai boîtier, tous les
    // ventilateurs sont montés dans le même sens ; ce qui varie, c'est la
    // vitesse. `FAN_SPIN` est une constante, pas une fonction du rang.
    expect(typeof FAN_SPIN).toBe('number')
    expect(Math.abs(FAN_SPIN)).toBe(1)
  })

  it('sont reproductibles', () => {
    // Déterministe : sinon la scène ne rend pas deux fois la même image, et la
    // boucle de comparaison n'a plus de sens.
    expect(fanSpeed(3)).toBe(fanSpeed(3))
  })
})

describe('la fumée', () => {
  it("s'éteint aux deux bouts de la vie d'une bouffée", () => {
    // Une bouffée qui naît ou meurt à pleine opacité clignote à chaque cycle,
    // et le filet se met à battre.
    for (const i of [0, 7, 21]) {
      expect(puff(i, SMOKE_PUFFS, 0).opacity).toBeGreaterThanOrEqual(0)
    }
    let maxAtBirth = 0
    for (let i = 0; i < SMOKE_PUFFS; i++) {
      const p = puff(i, SMOKE_PUFFS, 0)
      if (p.age < 0.02 || p.age > 0.98) maxAtBirth = Math.max(maxAtBirth, p.opacity)
    }
    expect(maxAtBirth).toBeLessThan(SMOKE_OPACITY * 0.1)
  })

  it('reste de la vapeur, pas un nuage', () => {
    let max = 0
    for (let t = 0; t < SMOKE_LIFE; t += 0.05) {
      for (let i = 0; i < SMOKE_PUFFS; i++) max = Math.max(max, puff(i, SMOKE_PUFFS, t).opacity)
    }
    expect(max).toBeLessThanOrEqual(SMOKE_OPACITY + 1e-9)
  })

  it('monte sans jamais dépasser sa hauteur de vie', () => {
    for (let t = 0; t < SMOKE_LIFE * 2; t += 0.07) {
      for (let i = 0; i < SMOKE_PUFFS; i++) {
        const p = puff(i, SMOKE_PUFFS, t)
        expect(p.rise).toBeGreaterThanOrEqual(0)
        expect(p.rise).toBeLessThanOrEqual(SMOKE_RISE + 1e-9)
      }
    }
  })

  it('étale les bouffées sur toute la durée de vie', () => {
    // Réparties par leur rang : c'est ce qui donne un filet continu sans avoir
    // à gérer une file d'émission.
    const ages = Array.from({ length: SMOKE_PUFFS }, (_, i) => puff(i, SMOKE_PUFFS, 0).age)
    expect(Math.min(...ages)).toBeLessThan(0.05)
    expect(Math.max(...ages)).toBeGreaterThan(0.9)
  })
})

describe('le mouvement réduit', () => {
  const component = readFileSync('src/scene/DeskAlive.tsx', 'utf8')

  it('coupe la boucle ET démonte la fumée', () => {
    // Couper la boucle ne suffit pas : figées, les bouffées resteraient
    // VISIBLES, alors que les rendus de référence n'en contiennent aucune —
    // et la boucle de comparaison capture justement en mouvement réduit.
    const frame = component.slice(component.indexOf('useFrame(('))
    expect(
      frame
        .slice(frame.indexOf('{') + 1)
        .trimStart()
        .startsWith('if (reduced) return'),
    ).toBe(true)
    expect(component).toContain('if (reduced || !rig.origin) return null')
  })

  it('est demandé AVANT la navigation dans la boucle de comparaison', () => {
    // Posé après le `goto`, le premier rendu se ferait en mouvement normal et
    // les ventilateurs auraient déjà pris de l'avance au moment de la capture.
    const capture = readFileSync('tests/e2e/renderComparison.ts', 'utf8')
    expect(capture.indexOf('emulateMedia')).toBeLessThan(capture.indexOf('page.goto'))
  })
})

describe('le support rond', () => {
  it('ne tourne pas avec les pales', () => {
    // Chaque ventilateur est un maillage à DEUX primitives — `Mat_FanFrame`
    // (le support) et `Mat_FanBlade` (les pales) — que le chargeur glTF monte
    // en deux `Mesh` frères. Faire tourner le parent emportait le support,
    // alors qu'il est vissé au boîtier.
    const component = readFileSync('src/scene/DeskAlive.tsx', 'utf8')
    expect(component).toContain('FAN_BLADE_MATERIAL')
    expect(FAN_BLADE_MATERIAL).toBe('Mat_FanBlade')
  })
})
