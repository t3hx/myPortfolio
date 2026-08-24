import { beforeEach, describe, expect, it } from 'vitest'
import { useInteraction } from '@/state/interaction'

/**
 * L'arbitrage du dialogue (#122). Il vit dans le store parce que deux entrées
 * le consultent — la molette et le clic — et qu'aucune des deux ne doit avoir
 * sa propre idée de la règle.
 */
const store = () => useInteraction.getState()

describe('advanceDialogue', () => {
  beforeEach(() => {
    store().startDialogue(3)
    store().setDialogueTyping(false)
  })

  it('tourne les pages, puis se déclare épuisé sur la dernière', () => {
    // C'est ce « exhausted » qui fait N phrases = N gestes : l'appelant
    // enchaîne sur l'arrêt suivant avec le MÊME geste, pas le suivant.
    expect(store().advanceDialogue()).toBe('paged')
    expect(store().dialoguePage).toBe(1)
    expect(store().advanceDialogue()).toBe('paged')
    expect(store().dialoguePage).toBe(2)
    expect(store().advanceDialogue()).toBe('exhausted')
  })

  it('un arrêt d’une seule phrase est épuisé du premier geste', () => {
    // L'accueil. Avec un geste de clôture PUIS un geste de départ, la première
    // impression du site aurait coûté deux scrolls.
    store().startDialogue(1)
    expect(store().advanceDialogue()).toBe('exhausted')
  })

  it('achève la frappe et ne fait que ça (arbitrage A)', () => {
    store().setDialogueTyping(true)
    const avant = store().dialogueSkip
    expect(store().advanceDialogue()).toBe('typed')
    expect(store().dialoguePage, 'la page ne doit pas avoir tourné').toBe(0)
    expect(store().dialogueSkip, 'le jeton d’achèvement avance').toBe(avant + 1)
  })

  it('reste épuisé tant qu’on n’a pas changé d’arrêt', () => {
    store().startDialogue(1)
    expect(store().advanceDialogue()).toBe('exhausted')
    expect(store().advanceDialogue()).toBe('exhausted')
  })

  it('repart au premier temps à chaque arrivée', () => {
    // Les dix bulles restent montées ensemble, pour que leur fondu de sortie
    // survive : rien ne remet leur pagination à zéro tout seul, et une bulle
    // revisitée rouvrirait sur sa dernière page.
    store().advanceDialogue()
    expect(store().dialoguePage).toBe(1)
    store().startDialogue(2)
    expect(store().dialoguePage).toBe(0)
    expect(store().dialogueTyping, 'une frappe pendante ne survit pas au départ').toBe(false)
  })
})
