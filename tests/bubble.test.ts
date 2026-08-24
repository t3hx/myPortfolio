import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { reducedMotionBlocks } from './support/css'
import { BUBBLE_OUT_MS } from '@/scene/Bubble'

/**
 * Le démontage différé de la bulle (Bubble.tsx) et le fondu CSS (.bubble--out,
 * durée --t-bubble-out) sont deux implémentations du même budget motion.
 * Personne ne les relie à l'exécution : si la session design retouche le token
 * sans toucher la constante, la bulle se démonte en plein fondu (sortie
 * tronquée) ou traîne invisible dans le DOM. Ce test est le seul lien.
 */
describe('bubble exit budget', () => {
  it('BUBBLE_OUT_MS matches --t-bubble-out in tokens.css', () => {
    const css = readFileSync('src/styles/tokens.css', 'utf8')
    const m = css.match(/--t-bubble-out:\s*(\d+)ms/)
    expect(m).not.toBeNull()
    expect(Number(m![1])).toBe(BUBBLE_OUT_MS)
  })
})

describe("l'aura d'arrivée", () => {
  const tokens = readFileSync('src/styles/tokens.css', 'utf8')

  it('déclare sa propriété animée avec @property', () => {
    // LE piège. Une propriété personnalisée non déclarée ne s'interpole pas
    // dans des `@keyframes` : elle saute d'une valeur à l'autre, et l'aura
    // apparaîtrait d'un bloc au lieu de se dessiner. Rien dans la page ne le
    // signalerait — ni erreur, ni avertissement. Le viseur du télescope a déjà
    // payé ce piège (#106).
    expect(tokens).toMatch(/@property\s+--aura-sweep\s*\{[^}]*syntax:\s*'<angle>'/)
  })

  it('dépasse le demi-tour pour refermer la couture', () => {
    // À 180° exactement, les deux secteurs se touchent sans se recouvrir et
    // l'anticrénelage laisse une couture au centre haut et au centre bas —
    // les deux points d'où le tracé est parti.
    const draw = tokens.slice(tokens.indexOf('@keyframes aura-draw'))
    expect(draw).toMatch(/--aura-sweep:\s*18[1-9]deg/)
  })

  it('finit avant la frappe de la phrase', () => {
    // Les deux partent au même instant. À durée égale, elles se disputeraient
    // l'attention : l'aura attire l'œil, PUIS laisse lire.
    const aura = Number(tokens.match(/--t-aura-draw:\s*(\d+)ms/)![1])
    // La phrase la plus courte du tour fait 58 caractères à 20 ms.
    expect(aura).toBeLessThan(58 * 20)
  })

  it('est coupée sous mouvement réduit', () => {
    expect(reducedMotionBlocks(tokens)).toContain('.bubble__aura')
  })
})
