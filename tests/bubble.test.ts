import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
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
    const css = readFileSync('docs/design/tokens.css', 'utf8')
    const m = css.match(/--t-bubble-out:\s*(\d+)ms/)
    expect(m).not.toBeNull()
    expect(Number(m![1])).toBe(BUBBLE_OUT_MS)
  })
})
