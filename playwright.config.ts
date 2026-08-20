import { defineConfig } from '@playwright/test'

/**
 * La boucle de comparaison de renders (issues #44, #45, #46).
 *
 * Un seul navigateur, un seul cadre. Tout le reste de ce fichier existe pour
 * une raison : **une capture qui n'est pas reproductible ne compare rien.**
 *
 * `test:e2e` est un script DISTINCT de `test` (#44) et Vitest ne ramasse rien
 * d'ici : sa clé `include` ne prend que les fichiers `.test.ts`, alors que ces
 * spécifications sont des `.spec.ts`. Les deux coureurs découvrent tout seuls,
 * et un fichier Playwright exécuté par Vitest échoue de façon incompréhensible.
 */
export default defineConfig({
  testDir: 'tests/e2e',
  // Onze scènes de 3 Mo décodées par un rasteriseur logiciel : le temps ne
  // vient pas du test, il vient du chargement.
  timeout: 90_000,
  // La comparaison est un mesurage. Réessayer ne stabilise pas un pixel, ça
  // masque une dérive intermittente — et une dérive intermittente est une
  // dérive.
  retries: 0,
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],

  use: {
    baseURL: 'http://localhost:4173',
    // Le cadre des références de `docs/renders/refs/` — 1920×1080 depuis leur
    // re-rendu du 2026-08-20 (#99). C'est le RATIO qui décide du cadrage, le
    // tour ajustant son champ HORIZONTALEMENT (`src/lib/stops.ts`) : rester en
    // 16:9 conserve l'image, changer de ratio la changerait. La définition,
    // elle, doit être exactement celle des références — sans quoi la
    // comparaison échoue sur les dimensions au lieu de comparer.
    // `deviceScaleFactor` explicite, sinon un écran Retina rendrait du
    // 3840×2160 et il n'y aurait plus de comparaison du tout.
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    launchOptions: {
      // Aucun runner GitHub n'a de GPU : sans ces drapeaux, pas de contexte
      // WebGL du tout et la scène est noire. On les passe AUSSI en local pour
      // que les deux environnements rasterisent avec le même moteur — la
      // tolérance mesurée sur cette machine n'a de sens qu'à cette condition.
      args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
    },
  },

  // Un seul navigateur (#44). Le préréglage `devices['Desktop Chrome']` est
  // délibérément écarté : il redéclare `viewport` et `deviceScaleFactor`, et un
  // `use` de projet l'emporte sur celui du fichier — le cadre des références
  // dépendrait alors d'un préréglage de Playwright, pas de ce fichier.
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],

  webServer: {
    // Le serveur de dev suffit : ce qu'on compare est ce que WebGL dessine, et
    // three.js ne dessine pas autrement selon que Vite a minifié ou non. Le
    // build de production, lui, est déjà vérifié par `ci.yml`.
    command: 'pnpm dev --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
})
