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
    },
  }),
)
