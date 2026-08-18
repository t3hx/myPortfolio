import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { BUBBLES, bubbleAnnouncement, bubbleKicker } from '@/content/bubbles'

/**
 * Accessibilité des bulles (issue #49).
 *
 * Les trois critères de l'issue tiennent à des détails invisibles à l'œil et
 * qu'aucun rendu ne signale : un texte annoncé deux fois, une région live
 * sortie de l'arbre par un `display: none`, une levée de `pointer-events`
 * étendue à toute la bulle. Ce fichier fige ce que le navigateur ne dira pas.
 */

const styles = readFileSync('src/styles.css', 'utf8')
const bubbleSource = readFileSync('src/scene/Bubble.tsx', 'utf8')

/**
 * Les corps de TOUTES les règles portant exactement ce sélecteur, concaténés :
 * `.bubble-layer .bubble__text` en a deux (le reset des maquettes, la levée
 * d'accessibilité) et la cascade les additionne — le test doit en faire autant
 * plutôt que de dépendre de l'ordre des déclarations.
 */
function ruleBody(css: string, selector: string): string {
  // Les commentaires d'abord : sans ça, le prélude d'une règle emporte le bloc
  // /* … */ qui la précède et aucun sélecteur ne se compare jamais égal.
  const rules = [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^}]*)\}/g)]
    .filter((m) => m[1].trim().split(/\s*,\s*/).includes(selector))
    .map((m) => m[2])
  expect(rules.length, `règle ${selector} absente de styles.css`).toBeGreaterThan(0)
  return rules.join('\n')
}

describe('bubbleAnnouncement', () => {
  it('dit le sujet puis la phrase', () => {
    const desk = BUBBLES.findIndex((b) => b.stop === 'Desk')
    expect(bubbleAnnouncement(BUBBLES, desk)).toBe(
      `${BUBBLES[desk].subject}. ${BUBBLES[desk].text}`,
    )
  })

  it('se limite à la phrase quand la bulle n’a pas de sujet (home)', () => {
    const home = BUBBLES.findIndex((b) => b.stop === 'Home')
    expect(BUBBLES[home].subject).toBeUndefined()
    expect(bubbleAnnouncement(BUBBLES, home)).toBe(BUBBLES[home].text)
  })

  it('n’annonce jamais le numéro du kicker', () => {
    // « 01 — Le bureau » se prononce « zéro un tiret cadratin » : un repère
    // visuel, pas une information. Le sujet, lui, situe l'objet cadré.
    BUBBLES.forEach((_, i) => {
      const kicker = bubbleKicker(BUBBLES, i)
      if (!kicker) return
      expect(bubbleAnnouncement(BUBBLES, i)).not.toContain(kicker)
    })
  })

  it('donne à chaque arrêt du tour quelque chose à dire', () => {
    BUBBLES.forEach((bubble, i) => {
      expect(bubbleAnnouncement(BUBBLES, i)).toContain(bubble.text)
    })
  })

  it('rend une chaîne vide hors de la table — une région live vide se tait', () => {
    // Le cas réel : un arrêt de CAMERA_STOPS sans bulle. `findIndex` rend -1,
    // et l'annonceur ne doit pas rendre « undefined ».
    expect(bubbleAnnouncement(BUBBLES, -1)).toBe('')
    expect(bubbleAnnouncement(BUBBLES, BUBBLES.length)).toBe('')
  })
})

describe('la phrase est sélectionnable sans voler la molette', () => {
  it('relève pointer-events sur le seul .bubble__text', () => {
    const text = ruleBody(styles, '.bubble-layer .bubble__text')
    expect(text).toMatch(/pointer-events:\s*auto/)
    expect(text).toMatch(/user-select:\s*text/)
  })

  it('laisse la couche entière transparente aux pointeurs', () => {
    // Si `.bubble-layer` reprenait les événements, la bulle intercepterait les
    // clics sur toute sa boîte — fond et marges compris — au lieu du texte.
    expect(ruleBody(styles, '.bubble-layer')).toMatch(/pointer-events:\s*none/)
  })
})

describe('la région live et la bulle peinte ne disent pas la même chose deux fois', () => {
  it('garde .sr-only dans l’arbre d’accessibilité', () => {
    const srOnly = ruleBody(styles, '.sr-only')
    expect(srOnly).not.toMatch(/display:\s*none/)
    expect(srOnly).not.toMatch(/visibility:\s*hidden/)
    expect(srOnly).toMatch(/clip-path:|clip:/)
  })

  it('masque l’article de la bulle aux lecteurs d’écran', () => {
    // Le pendant de <StopAnnouncer> : lever cet aria-hidden ferait lire la
    // phrase une fois annoncée, une fois parcourue.
    expect(bubbleSource).toMatch(/<article[^>]*aria-hidden="true"/s)
  })
})
