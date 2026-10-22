import { defineConfig, mergeConfig } from 'vitest/config'
// Extension explicite : le futur chargeur natif de Vite ne résout plus les
// imports de config sans elle, et prévient déjà.
import viteConfig from './vite.config.ts'

// Configuration séparée de `vite.config.ts`, mais FUSIONNÉE avec elle : les
// tests héritent ainsi de l'alias `@` sans le redéclarer. Deux déclarations du
// même alias finiraient par diverger, et un test qui résout ses imports
// autrement que l'application ne teste plus l'application.
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      // Environnement Node : ces tests portent sur des maths de caméra et un
      // graphe three.js en mémoire, jamais sur le DOM ni sur WebGL.
      environment: 'node',
      include: ['tests/**/*.test.ts'],
      /**
       * La couverture (#163), et elle est VOLONTAIREMENT PARTIELLE.
       *
       * Le périmètre s'arrête à `lib`, `config`, `content` et `state` : les
       * règles pures, celles qu'un test Node peut exécuter. `src/scene` et
       * `src/ui` en sont absents — 1500 lignes — et ce n'est pas de la dette.
       * Ils sont prouvés autrement : comparaison de pixels contre les rendus
       * Blender, maquettes servant d'oracle, lectures de source, mesures dans
       * un navigateur. Aucune de ces preuves ne fait passer une ligne sous
       * l'instrumentation, si bien qu'un pourcentage GLOBAL pousserait à écrire
       * des tests qui importent des composants pour toucher des lignes : le
       * chiffre monterait, la confiance non.
       *
       * Le fournisseur est figé sur la majeure de Vitest (`~4`). Une 5.0 contre
       * une 4 n'échoue pas franchement : elle annonce « 9 tests passés sur
       * 545 » et 0 % de couverture, avec 37 erreurs non gérées. Un résultat
       * faux, du genre qu'on croit.
       */
      coverage: {
        provider: 'v8',
        // Les fichiers qu'aucun test n'importe COMPTENT, et c'est vital : un
        // module oublié ne doit pas disparaître du rapport, il doit faire
        // baisser le chiffre. C'est le comportement par défaut depuis Vitest 4,
        // qui a retiré l'option `all` — elle ne compile plus.
        include: ['src/{lib,config,content,state}/**/*.ts'],
        exclude: [
          // Ce que l'environnement Node ne PEUT PAS exécuter, et rien d'autre.
          // Chaque ligne porte sa raison : une exclusion sans motif finit par
          // couvrir autre chose que ce qu'elle disait.
          //
          // Des crochets React : il faudrait un rendu, donc un DOM.
          'src/lib/clock.ts',
          'src/lib/decrypt.ts',
          // Peint dans un `canvas` (`document.createElement`), qui n'existe pas ici.
          'src/lib/folderLabel.ts',
        ],
        reporter: ['text-summary', 'html'],
        reportsDirectory: 'test-results/coverage',
        /**
         * **Un PLANCHER, pas une cible.** Il est posé sous le mesuré du jour
         * pour qu'il ne puisse que monter : ce qu'il attrape, c'est une
         * régression — un module ajouté sans test, ou des tests retirés — pas
         * un objectif à atteindre. Le relever se fait en le mesurant, jamais
         * en l'espérant.
         */
        thresholds: { lines: 84, branches: 70, statements: 82, functions: 73 },
      },
    },
  }),
)
