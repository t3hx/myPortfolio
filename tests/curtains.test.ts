import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  CURTAIN_BOTTOM,
  CURTAIN_DRIFT,
  CURTAIN_MATERIAL,
  CURTAIN_OBJECTS,
  CURTAIN_PERIOD,
  CURTAIN_PERIOD_2,
  CURTAIN_SWAY,
  CURTAIN_TOP,
} from '@/config/curtains'

/**
 * Les rideaux dans la brise (#38). Ce qu'un refactor casserait sans bruit : le
 * point d'accroche, la désynchronisation des deux panneaux, et surtout la
 * composante latérale — celle sans laquelle le mouvement existe mais ne se voit
 * pas.
 */

const component = readFileSync('src/scene/Curtains.tsx', 'utf8')

describe('le tissu', () => {
  it('est accroché en haut et libre en bas', () => {
    // La même amplitude partout ferait glisser toute la chute latéralement,
    // comme un panneau rigide qui pivote.
    expect(CURTAIN_TOP).toBeGreaterThan(CURTAIN_BOTTOM)
    // Le shader est écrit dans un gabarit : le fichier contient l'EXPRESSION,
    // pas sa valeur. C'est l'ordre des deux bornes qui est vérifié ici — haut
    // d'abord, bas ensuite — car l'inverser rendrait l'ourlet fixe et la
    // tringle mobile, ce qui ne saute pas aux yeux dans une capture.
    const call = component.slice(component.indexOf('smoothstep('))
    expect(call.indexOf('CURTAIN_TOP')).toBeLessThan(call.indexOf('CURTAIN_BOTTOM'))
    expect(call).toContain('position.y')
  })

  it('balance latéralement, et pas seulement perpendiculairement', () => {
    // LE PIÈGE, et il a fallu le mesurer pour le voir. À l'arrêt Télescope la
    // caméra regarde vers la fenêtre, donc presque DANS L'AXE du souffle : à
    // 9 cm de débattement perpendiculaire, la silhouette du rideau ne bougeait
    // pas d'un pixel, seul son ombrage changeait. C'est le balancement le long
    // de la tringle qui se lit de face.
    expect(CURTAIN_DRIFT).toBeGreaterThan(0)
    expect(component).toContain('transformed.z +=')
    // Plus petit que le gonflement : un tissu suspendu résiste davantage au
    // balancement latéral.
    expect(CURTAIN_DRIFT).toBeLessThan(CURTAIN_SWAY)
  })

  it('reste loin du télescope', () => {
    // La boîte du rideau droit chevauche déjà celle de l'instrument de 7,8 cm
    // en Z et partage sa plage en X. Vérifié en capture à l'arrêt Télescope,
    // où les deux se côtoient : à ces amplitudes le tissu ne l'atteint pas.
    expect(CURTAIN_SWAY).toBeLessThanOrEqual(0.1)
    expect(CURTAIN_DRIFT).toBeLessThanOrEqual(0.05)
  })
})

describe('la brise', () => {
  it("n'est pas un mécanisme", () => {
    // Deux ondes commensurables se rejoindraient périodiquement et le
    // mouvement se mettrait à battre la mesure.
    const ratio = CURTAIN_PERIOD / CURTAIN_PERIOD_2
    expect(Number.isInteger(ratio)).toBe(false)
    expect(Number.isInteger(1 / ratio)).toBe(false)
  })

  it('reste douce et régulière', () => {
    // Une brise, pas une rafale.
    expect(CURTAIN_PERIOD).toBeGreaterThan(5)
    expect(CURTAIN_PERIOD_2).toBeGreaterThan(3)
  })

  it('désynchronise les deux panneaux par leur position monde', () => {
    // Ils partagent géométrie locale ET matériau : sans ce décalage ils
    // ondulaient exactement ensemble, ce qui se lit comme un mécanisme.
    expect(CURTAIN_OBJECTS.length).toBe(2)
    expect(component).toContain('modelMatrix[3].z')
  })
})

describe('le respect du bake', () => {
  it('ne déplace que des sommets, sans toucher à ce qui est affiché', () => {
    // La texture cuite est intacte : on ne change pas la couleur du tissu,
    // seulement l'endroit où il se trouve.
    expect(CURTAIN_MATERIAL).toBe('Mat_Curtain')
    expect(component).toContain('onBeforeCompile')
    expect(component).toContain('begin_vertex')
    expect(component).not.toContain('gl_FragColor')
  })

  it('laisse le matériau INTACT sous mouvement réduit', () => {
    // Pas figé sur une position : intact. C'est ce qui garde la boucle de
    // comparaison, qui capture en mouvement réduit, devant le bake exact.
    const effect = component.slice(component.indexOf('useEffect(() => {'))
    expect(
      effect
        .slice(effect.indexOf('{') + 1)
        .trimStart()
        .startsWith('if (reduced) return'),
    ).toBe(true)
  })

  it('se démonte sans laisser de trace', () => {
    expect(component).toContain('target.onBeforeCompile = () => {}')
  })
})
