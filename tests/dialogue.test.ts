import { beforeEach, describe, expect, it } from 'vitest'
import { useInteraction } from '@/state/interaction'

/**
 * L'arbitrage du dialogue (#122). Il vit dans le store parce que deux entrées
 * le consultent — la molette et le clic — et qu'aucune des deux ne doit avoir
 * sa propre idée de la règle.
 *
 * **Il prend l'heure en paramètre**, et c'est ce qui le rend vérifiable ici :
 * la question « est-ce que ça écrit encore » se répond par une soustraction sur
 * l'horloge du geste, pas par un état qu'un composant aurait publié. La
 * première version passait par un effet React — donc avec une image de retard —
 * et un clic tombé dans cette fenêtre tournait la page d'une phrase encore en
 * train de s'écrire. Ce test est là pour que ce retard ne puisse pas revenir.
 */
const store = () => useInteraction.getState()

/** Trois pages d'une seconde chacune, démarrées à t = 1000. */
const troisPages = () => store().startDialogue([1000, 1000, 1000], 1000)

describe('advanceDialogue', () => {
  beforeEach(() => troisPages())

  it('achève la frappe en cours, et ne fait que ça', () => {
    expect(store().advanceDialogue(1500)).toBe('typed')
    expect(store().dialoguePage, 'la page ne doit pas avoir tourné').toBe(0)
    expect(store().dialogueDone).toBe(true)
  })

  it('tourne la page une fois la frappe achevée', () => {
    store().advanceDialogue(1500) // achève
    expect(store().advanceDialogue(1600)).toBe('paged')
    expect(store().dialoguePage).toBe(1)
  })

  it('tourne la page si la frappe s’est terminée toute seule', () => {
    // Personne n'a rien publié : la durée est écoulée, donc la frappe est finie.
    expect(store().advanceDialogue(2200)).toBe('paged')
    expect(store().dialoguePage).toBe(1)
  })

  it('repart le chronomètre à chaque page', () => {
    store().advanceDialogue(2200) // page 1, démarrée à 2200
    // 500 ms plus tard, la page 1 s'écrit encore : ce geste l'achève.
    expect(store().advanceDialogue(2700)).toBe('typed')
    expect(store().dialoguePage).toBe(1)
  })

  it('se déclare épuisé sur la dernière page', () => {
    store().advanceDialogue(2200) // → page 1
    store().advanceDialogue(3300) // → page 2
    expect(store().dialoguePage).toBe(2)
    expect(store().advanceDialogue(4400)).toBe('exhausted')
  })

  it('un arrêt d’une seule phrase est épuisé dès qu’elle est écrite', () => {
    // L'accueil. C'est ce « exhausted » qui fait N phrases = N gestes : le
    // même geste ferme la phrase et quitte l'arrêt, sinon la première
    // impression du site coûterait deux défilements.
    store().startDialogue([1000], 0)
    expect(store().advanceDialogue(500), 'pendant la frappe').toBe('typed')
    expect(store().advanceDialogue(600), 'une fois achevée').toBe('exhausted')
  })

  it('n’écrit pas du tout quand la frappe ne dure pas', () => {
    // Sous « mouvement réduit », les durées valent zéro : aucun geste ne peut
    // être consommé par une frappe qui n'existe pas.
    store().startDialogue([0, 0], 0)
    expect(store().advanceDialogue(0)).toBe('paged')
    expect(store().advanceDialogue(0)).toBe('exhausted')
  })

  it('repart au premier temps à chaque arrivée', () => {
    // Les dix bulles restent montées ensemble, pour que leur fondu de sortie
    // survive : rien ne remet leur pagination à zéro tout seul, et une bulle
    // revisitée rouvrirait sur sa dernière page.
    store().advanceDialogue(2200)
    expect(store().dialoguePage).toBe(1)
    troisPages()
    expect(store().dialoguePage).toBe(0)
    expect(store().dialogueDone).toBe(false)
  })

  it('n’a rien à dire quand il n’y a pas de dialogue', () => {
    store().startDialogue([], 0)
    expect(store().advanceDialogue(0)).toBe('exhausted')
  })
})
