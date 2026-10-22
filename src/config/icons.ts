/**
 * Les marques servies depuis `public/icons/` (#168).
 *
 * Deux familles, et la frontière n'est pas le sujet : c'est la façon de les
 * peindre.
 *
 * **Les MARQUES sont monochromes et se rendent par un masque CSS**, coloré par
 * `currentColor`. Une seule marque sert alors la vignette du CV, la barre de
 * menu et ses 40 % d'opacité de repos, sans un fichier par contexte.
 *
 * **Ce n'est pas une préférence, les fichiers l'imposent** : ils portent
 * `fill="currentColor"`, et `currentColor` dans une balise `<img>` n'a aucun
 * contexte dont hériter — il vaut noir, donc invisible sur du verre fumé.
 *
 * **Les DRAPEAUX sont l'exception, et elle est assumée.** Un drapeau tricolore
 * passé en masque se réduirait à un disque plein. Ils se rendent en `<img>`, et
 * le gris de la langue inactive vient d'un `filter: grayscale(1)` sur le MÊME
 * fichier — jamais d'un second fichier, qui serait une chose de plus à garder
 * synchrone pour un effet que le navigateur calcule (#164).
 *
 * ## L'harmonisation, et ce qu'elle ne règle pas
 *
 * Les fichiers viennent de jeux d'icônes différents, avec des `viewBox` de 24,
 * 32 ou 128. Ce n'est pas ce qui se voyait : une marque se met à l'échelle de
 * sa boîte. Ce qui se voyait, c'est la MARGE que chaque dessin laissait à
 * l'intérieur — mesuré, le remplissage allait de 79 % (three.js) à 100 %
 * (blender, github, vitest, vue), si bien qu'à 16 px three.js paraissait un
 * cinquième plus petit que GitHub sans que rien ne l'explique.
 *
 * Chaque `viewBox` est donc rogné sur le dessin puis carré : la plus grande
 * dimension touche le bord, le dessin est centré dans l'autre. Vérifié après
 * coup, les seize remplissent leur boîte à 100 %, sous Firefox et sous Chromium.
 *
 * **La taille n'était que la moitié du problème.** L'ENCRE — la part du carré
 * réellement peinte — va de 14,9 % à 86,4 %, mesurée en comptant les pixels du
 * masque à 96 px (2026-09-11) :
 *
 *     vue 14,9 · three.js 15,9 · tailwind 20,5 · gsap 23,0 · vitest 24,3
 *     figma 25,2 · docker 27,0 · react 27,1 · blender 37,6 · claude 39,7
 *     github 42,8 · vite 46,8 · postgresql 52,9 · node.js 65,1
 *     typescript 85,9 · javascript 86,4
 *
 * `docker` est arrivé après (#169) : son dessin remplissait déjà 98 % de sa
 * boîte, il ne lui manquait que le rognage carré, et son encre de 27,0 % le
 * place dans la famille des silhouettes, à côté de React.
 *
 * Un glyphe détouré dans un carré plein ne lit pas comme une marque, il lit
 * comme un pavé, et il écrase les silhouettes posées à côté. L'encre ne se
 * normalise pas dans les deux sens — une silhouette ne peut pas en gagner sans
 * qu'on redessine la marque — donc ce qui se fait est un PLAFOND. Le seuil et
 * son application relèvent du rendu (#169) : au-delà de 45 %, la marque est
 * peinte plus petite dans la même vignette.
 *
 * ## Ce qui a été modifié dans les fichiers, et rien d'autre
 *
 * Les tracés ne sont pas touchés. Trois modifications, toutes vérifiables :
 *
 *  1. le `viewBox`, rogné et carré ;
 *  2. `fill="currentColor"` ajouté à three.js, qui n'en avait aucun et tombait
 *     donc en noir ;
 *  3. `color="#000"` retiré de three.js — posé sur un groupe, il REDÉFINIT
 *     `currentColor` pour ses enfants, si bien que le fichier se disait
 *     contextuel et peignait du noir. Sous masque ça ne se voit pas ; le jour
 *     où il est posé en ligne, si. `tests/icons.test.ts` l'interdit maintenant.
 *
 * Une quatrième, sur LinkedIn seul : son carré arrondi était un sous-tracé
 * séparé du même `d`, et il est supprimé. L'encre passe de 74,3 % à 49,3 %, la
 * famille de GitHub (42,8 %) — les deux marques de la barre se ressemblent
 * enfin. Le sous-tracé exact est noté sur #167, donc l'opération est réversible
 * depuis la trace sans garder un second fichier ici.
 *
 * `gsap.svg` est un LOGOTYPE et non une icône, deux fois et demie plus large
 * que haut. Réduit à 16 px il est illisible : pour cette entrée, le repli par
 * initiale est plus honnête, et c'est une décision de #169.
 *
 * Les marques sont la propriété de leurs détenteurs respectifs ; ces fichiers
 * ne servent qu'à les désigner.
 */

import type { Locale } from '@/lib/locale'

/**
 * Les marques monochromes, par nom de fichier.
 *
 * **Le tableau EST l'inventaire du dossier**, et `tests/icons.test.ts` le
 * vérifie dans les deux sens : un chemin déclaré qui ne pointe vers rien laisse
 * une vignette muette, sans une erreur nulle part ; un fichier non déclaré est
 * servi au visiteur et affiché par personne.
 */
export const MARKS = {
  blender: '/icons/blender.svg',
  'claude-ai': '/icons/claude-ai.svg',
  docker: '/icons/docker.svg',
  figma: '/icons/figma.svg',
  github: '/icons/github.svg',
  gsap: '/icons/gsap.svg',
  javascript: '/icons/javascript.svg',
  linkedin: '/icons/linkedin.svg',
  nodejs: '/icons/nodejs.svg',
  postgresql: '/icons/postgresql.svg',
  react: '/icons/react.svg',
  'tailwind-css': '/icons/tailwind-css.svg',
  threejs: '/icons/threejs.svg',
  typescript: '/icons/typescript.svg',
  vitejs: '/icons/vitejs.svg',
  vitest: '/icons/vitest.svg',
  vuejs: '/icons/vuejs.svg',
} as const

/**
 * Le drapeau de chaque langue.
 *
 * Typé par `Locale` : ajouter une langue à l'app ne compile pas tant qu'elle
 * n'a pas son drapeau, ce qui vaut mieux qu'une bascule à moitié illustrée.
 */
export const FLAGS: Record<Locale, string> = {
  fr: '/icons/lang-fr.svg',
  en: '/icons/lang-en.svg',
}
