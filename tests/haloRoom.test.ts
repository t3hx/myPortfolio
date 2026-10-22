import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/**
 * Les halos qu'un conteneur défilant rognait (retour utilisateur, 2026-10-22).
 *
 * `overflow-y: auto` force aussi `overflow-x` à `auto` : la boîte rogne alors
 * TOUT ce qui dépasse, y compris la lueur de 40 px d'un bouton survolé posé
 * contre son bord. Le halo coupait net au ras du conteneur — un défaut qui ne
 * se voit qu'au survol, donc qu'aucune capture au repos ne montre.
 *
 * La parade est la même aux deux endroits : le conteneur s'élargit d'une
 * réserve et la rend en `padding`, si bien que le contenu ne bouge pas d'un
 * pixel mais que la lueur a la place de s'éteindre AVANT le bord.
 */
const tokens = readFileSync('src/styles/tokens.css', 'utf8')

function rule(selector: string): string {
  const start = tokens.indexOf(`\n${selector} {`)
  expect(start, `${selector} introuvable`).toBeGreaterThanOrEqual(0)
  return tokens.slice(start, tokens.indexOf('\n}', start))
}

describe('la réserve de halo', () => {
  it('existe sur la colonne de texte de la fiche projet', () => {
    const body = rule('.sheet__body')
    expect(body).toMatch(/padding-inline-start: var\(--halo-room\)/)
    expect(body).toMatch(/margin-inline-start: calc\(-1 \* var\(--halo-room\)\)/)
    expect(body).toMatch(/padding-bottom: var\(--halo-room\)/)
    expect(body).toMatch(/margin-bottom: calc\(-1 \* var\(--halo-room\)\)/)
  })

  it('existe des deux côtés du CV, sans élargir sa colonne', () => {
    const cv = rule('.cv')
    expect(cv).toContain('left: calc(50% - var(--cv-column) / 2 - var(--cv-halo-room))')
    expect(cv).toContain('width: calc(var(--cv-column) + 2 * var(--cv-halo-room))')
    expect(cv).toContain('padding-inline: var(--cv-halo-room)')
  })

  it('couvre la portée du halo de survol (flou 40 + étalement 5)', () => {
    expect(tokens).toMatch(/--halo-room: 48px;/)
    expect(tokens).toMatch(/--cv-halo-room: calc\(48 \* var\(--cv-u, 1px\)\);/)
  })
})
