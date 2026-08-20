import js from '@eslint/js'
import prettier from 'eslint-config-prettier/flat'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import globals from 'globals'
import tseslint from 'typescript-eslint'

/**
 * ESLint 10, configuration à plat (issue #21).
 *
 * La CI appelait déjà `pnpm run --if-present lint` : sans script, l'étape
 * passait au vert sans rien vérifier. C'est ce script qui manquait, pas le
 * workflow — ne rien ajouter là-bas.
 *
 * Règles NON typées (`recommended`, pas `recommendedTypeChecked`) : le typage
 * du projet tourne sur le compilateur natif TypeScript 7, dont le paquet npm
 * n'expose aucune API JavaScript, tandis que typescript-eslint lit l'API v6
 * montée à côté (voir package.json). Faire cohabiter deux versions du
 * compilateur sur le MÊME `tsconfig.json` pour des règles typées, c'est se
 * préparer un écart silencieux entre ce que `tsc` voit et ce que le linter
 * croit voir. `pnpm type-check` reste la source de vérité sur les types ; le
 * linter s'occupe de ce que le typage ne dit pas.
 */
export default tseslint.config(
  { ignores: ['dist', 'docs/design/**', 'public/**'] },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      // Les deux règles historiques, celles qui décrivent le contrat des hooks.
      // Volontairement PAS le preset `recommended` de la v7 : il embarque
      // désormais les seize règles du React Compiler, qui modélisent un flux
      // de données React pur. Cette app est une coquille impérative
      // react-three-fiber — muter un matériau three.js depuis un effet
      // (`immutability`, Outlines.tsx) est le motif normal, pas une faute, et
      // `set-state-in-effect` condamne le démontage différé de la bulle validé
      // en #47. Adopter le React Compiler est une décision à part entière.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
      // Vite : un module qui exporte autre chose qu'un composant casse le
      // rafraîchissement à chaud. `allowConstantExport` couvre les constantes
      // exportées à côté d'un composant (Preloader.tsx, Bubble.tsx).
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      // Le préfixe `_` est la convention pour un paramètre volontairement ignoré.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },

  // Node : fichiers de configuration et scripts, hors du navigateur.
  {
    files: ['*.config.{js,ts}', 'scripts/**'],
    languageOptions: { globals: globals.node },
  },

  // En DERNIER : neutralise les règles de mise en forme qui doubleraient
  // Prettier. Un désaccord entre les deux outils est une boucle infinie.
  prettier,
)
