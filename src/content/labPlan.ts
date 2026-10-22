/**
 * Le plan du lab (#141) : le dessin du bureau qui se trace trait par trait
 * pendant la phase « La conception » de l'intro (#145).
 *
 * La donnée est le RÉSULTAT d'une classification faite en session Claude
 * Design — 2 346 tracés répartis en onze lots par orientation (H, V, D) et
 * épaisseur (2, 1, 0,5), plus les tracés complexes (DR) et les câbles (CA).
 * Le code qui l'a produite n'a pas été livré ; `design/intro/lab-data.js` est
 * la copie lisible, `labPlan.json` la copie servie, et `tests/labPlan.test.ts`
 * vérifie que les deux sont la même donnée.
 *
 * Elle est chargée À LA DEMANDE : 94 Ko de chemins SVG n'ont rien à faire dans
 * le chunk d'App3D, qui est déjà le plus lourd du site. L'intro la demande à
 * T = 0 ; elle n'est dessinée qu'à T ≈ 9,5 s.
 */

/** Un tracé : le `d` du chemin SVG et son épaisseur de trait, en px du plan. */
export type LabStroke = [d: string, width: number]

export type LabBatch = (typeof LAB_PLAN_ORDER)[number]

export type LabPlan = {
  /** La boîte de vue du dessin : 1920 × 1050, pas 1080 — l'intro le décale. */
  vb: [number, number]
  order: readonly LabBatch[]
  batches: Record<LabBatch, LabStroke[]>
}

/**
 * L'ordre du tracé, tel que le handoff l'a chronométré : lot k part à
 * 9,5 + k × 0,26 s. Les horizontales d'abord, épaisses puis fines, puis les
 * verticales, les diagonales, les tracés complexes et enfin les câbles.
 */
export const LAB_PLAN_ORDER = [
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
] as const

export async function loadLabPlan(): Promise<LabPlan> {
  const { default: plan } = await import('./labPlan.json')
  // Le JSON est typé `number[]` / `string[]` par inférence ; sa forme réelle
  // est garantie par tests/labPlan.test.ts, pas par une validation à chaud.
  return plan as unknown as LabPlan
}
