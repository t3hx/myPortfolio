import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/**
 * L'écran de pré-sélection sur petit écran (#188) — depuis #186, c'est la
 * première chose qu'un visiteur mobile voit.
 *
 * Ce fichier verrouille ce qu'aucune capture desktop ne montre : `styles.css`
 * fige `html, body, #root` en `overflow: hidden` (il le faut, pour la scène),
 * donc un écran de pré-sélection plus haut que le viewport est TRONQUÉ sans
 * recours — la seconde carte et la note disparaissent, et rien ne le dit.
 * Mesuré : ~700 px de contenu en colonne, contre ~660 px de viewport sur un
 * téléphone en portrait, et ~390 px en paysage.
 */

const shell = readFileSync('src/styles/styles.css', 'utf8')

/** Le corps de la règle `.presel { … }` (la règle seule, pas ses enfants). */
function preselRule(): string {
  const m = shell.match(/\.presel \{([^}]*)\}/)
  expect(m, 'règle .presel introuvable').not.toBeNull()
  return m![1]
}

describe("l'écran de pré-sélection sur petit écran (#188)", () => {
  it('défile quand il déborde — le document, lui, ne défilera jamais', () => {
    // `html, body, #root` sont `overflow: hidden` : si `.presel` ne porte pas
    // son propre défilement, un viewport plus bas que le contenu coupe la
    // seconde carte et la note, sans barre, sans rebond, sans indice.
    expect(preselRule()).toMatch(/overflow-y:\s*auto/)
  })

  it('centre en `safe center`, jamais en `center` nu — la leçon du CV', () => {
    // Un `center` nu sur un conteneur qui défile déborde des DEUX côtés, et un
    // conteneur ne défile jamais en négatif : le haut — logo, question —
    // devient inatteignable. `safe` retombe sur `flex-start` exactement là,
    // et un navigateur qui ignore le mot-clé retombe au même endroit.
    expect(preselRule()).toMatch(/justify-content:\s*safe center/)
    expect(preselRule()).not.toMatch(/justify-content:\s*center\b/)
  })

  it('a des règles mobiles, au breakpoint de la maison (720 px)', () => {
    // `classic.css` et `tokens.css` cassent à 720 px ; un troisième seuil
    // ferait trois définitions de « petit écran » pour un seul site. Le bloc
    // doit contenir des règles `.presel` — un breakpoint vide passerait aussi.
    const mobile = shell.match(/@media \(max-width: 720px\) \{([\s\S]*?)\n\}/)
    expect(mobile, 'bloc @media (max-width: 720px) introuvable dans styles.css').not.toBeNull()
    expect(mobile![1]).toMatch(/\.presel/)
  })
})
