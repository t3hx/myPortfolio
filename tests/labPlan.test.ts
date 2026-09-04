import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { LAB_PLAN_ORDER, loadLabPlan } from '@/content/labPlan'

/**
 * Le plan du lab (#141) : le dessin qui se trace trait par trait pendant la
 * phase 2 de l'intro. La donnée est le RÉSULTAT d'une classification faite en
 * session Claude Design (design/intro/lab-data.js) ; le code qui l'a produite
 * n'a pas été livré. Ce test verrouille donc la forme du fichier tel qu'il a
 * été reçu — l'ordre des lots est celui du README du handoff, le compte est
 * celui du fichier (2 346, là où le README en annonce 2 274).
 */
describe('the lab plan', () => {
  it('draws its eleven batches in the order the handoff timed', () => {
    expect(LAB_PLAN_ORDER).toEqual([
      'H2',
      'H1',
      'H05',
      'V2',
      'V1',
      'V05',
      'D2',
      'D1',
      'D05',
      'DR',
      'CA',
    ])
  })

  it('carries every stroke of the handoff, each as [path, width]', async () => {
    const plan = await loadLabPlan()
    expect(plan.vb).toEqual([1920, 1050])
    expect(plan.order).toEqual(LAB_PLAN_ORDER)
    expect(Object.keys(plan.batches).sort()).toEqual([...LAB_PLAN_ORDER].sort())
    let total = 0
    for (const key of plan.order) {
      for (const [d, width] of plan.batches[key]) {
        expect(d).toMatch(/^M[\d.\- ]/)
        expect(width).toBeGreaterThan(0)
        total += 1
      }
    }
    expect(total).toBe(2346)
  })

  it('is the same data the design handoff holds', () => {
    // La copie de design/ est la référence lisible par un designer, celle de
    // src/ est celle que l'app charge : deux fichiers, une seule donnée.
    const src = readFileSync('design/intro/lab-data.js', 'utf8')
    const handoff = JSON.parse(src.replace(/^window\.LAB_ART=/, '').replace(/;\s*$/, ''))
    const shipped = JSON.parse(readFileSync('src/content/labPlan.json', 'utf8'))
    expect(shipped).toEqual(handoff)
  })
})
