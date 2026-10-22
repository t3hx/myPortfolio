/**
 * Le déchiffrage — **une seule implémentation pour les deux expériences**.
 *
 * Il est né avec le CV de la scène (#93), où quinze titres se déchiffrent en
 * cascade ; l'accueil du site classique (#29) demande exactement la même
 * animation, avec d'autres réglages. En écrire une seconde aurait donné deux
 * versions d'un effet identitaire, qui dérivent l'une de l'autre en silence :
 * c'est précisément ce que ce fichier existe pour empêcher.
 *
 * Ce qui varie d'un appelant à l'autre est passé en propriété — la durée, le
 * jeu de glyphes, la période de tirage. Ce qui ne varie pas est la RÈGLE, et
 * elle est ici : les caractères se figent de gauche à droite, les espaces ne
 * sont jamais brouillés, le tirage est déterministe.
 *
 * `tests/cv.test.ts` verrouille ces trois points sur CE fichier. L'horloge qui
 * alimente `elapsed` vit à côté, dans `src/lib/decrypt.ts`.
 */

/**
 * Les glyphes tirés au sort par défaut — celui du CV de la scène.
 *
 * Majuscules, chiffres et symboles : de quoi lire « du code », sans caractère
 * assez large pour déformer une chasse fixe. **Aucun espace**, jamais : ce sont
 * les espaces du texte d'origine qui gardent la silhouette du mot pendant tout
 * le brouillage, et un espace dans le jeu y ouvrirait des trous mouvants.
 */
export const DECRYPT_CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#@%&$*/<>'

/**
 * Le jeu de l'accueil du site classique — **sans lettres, et c'est une
 * décision de la session design** (`docs/PORTFOLIO_2D.md`, §1).
 *
 * Le CV déchiffre des intitulés ; l'accueil déchiffre un NOM PROPRE, en très
 * grand, seul à l'écran. Avec des lettres dans le jeu, le brouillage produit
 * des mots plausibles — on lit des quasi-noms pendant 1,7 s au lieu de voir un
 * nom se résoudre. Sans lettres, il n'y a rien à lire avant la fin, ce qui est
 * l'effet recherché.
 */
export const DECRYPT_CHARSET_CODE = '#/\\<>[]{}=+*%$&@0123456789'

/** Période de tirage par défaut : au-delà, on voit les glyphes clignoter un à
 *  un ; en deçà, le bruit scintille et fatigue. */
export const DECRYPT_FRAME_MS = 40

/**
 * Un texte déchiffré : les caractères se figent de gauche à droite, ceux qui
 * restent tirent un glyphe au sort.
 *
 * **Les espaces ne sont jamais brouillés** : ce sont eux qui gardent la
 * silhouette du mot pendant toute l'animation, sans quoi on ne lit qu'un bloc
 * de bruit.
 *
 * Le tirage est **déterministe**, dérivé de l'image et de la position, et non
 * de `Math.random()` : ce composant est rendu pendant la phase de rendu de
 * React, où un appel non pur donnerait un résultat différent à chaque re-rendu
 * déclenché par autre chose que l'horloge.
 *
 * Le composant reste **pur** — il dérive son texte du temps qu'on lui passe,
 * il ne le mesure jamais. C'est ce qui permet à une horloge unique d'en piloter
 * quinze.
 */
export function Scrambled({
  text,
  elapsed,
  delay = 0,
  duration,
  charset = DECRYPT_CHARSET,
  frameMs = DECRYPT_FRAME_MS,
}: {
  text: string
  /** Le temps publié par `useDecryptClock`. `null` = affiche le texte final. */
  elapsed: number | null
  /** Le retard de ce texte dans une cascade. */
  delay?: number
  duration: number
  charset?: string
  frameMs?: number
}) {
  if (elapsed === null || elapsed >= delay + duration) return <>{text}</>

  const progress = Math.max((elapsed - delay) / duration, 0)
  const settled = Math.floor(progress * text.length)
  const frame = Math.floor(elapsed / frameMs)

  return (
    <>
      {text
        .split('')
        .map((char, i) => {
          if (i < settled || char === ' ') return char
          const n = (i * 2654435761 + frame * 40503) >>> 0
          return charset[n % charset.length]
        })
        .join('')}
    </>
  )
}
