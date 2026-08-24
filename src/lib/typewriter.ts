/**
 * La machine à écrire des bulles (#121) — **une fonction pure**, pour que la
 * règle soit vérifiable sans navigateur ni horloge.
 *
 * Un texte ne s'affiche pas d'un coup : il s'écrit, caractère par caractère, à
 * cadence constante. C'est ce qui fait qu'une bulle *parle* au lieu d'étiqueter
 * un objet.
 */

/**
 * Millisecondes par caractère. **Mesurée sur la copy livrée, pas choisie.**
 * Les dix phrases françaises font de 58 à 101 caractères, ce qui donne :
 *
 *     15 ms →  0,87 s … 1,51 s   trop rapide, c'est un fondu, pas une frappe
 *     26 ms →  1,51 s … 2,63 s   retenu
 *     40 ms →  2,32 s … 4,04 s   on attend la machine
 *
 * Le repère : la frappe doit rester assez lente pour qu'on la VOIE écrire —
 * sinon autant afficher — et finir avant que le lecteur ait fini de lire, sinon
 * elle le retient. Une seconde et demie à deux secondes et demie est aussi
 * l'ordre de grandeur d'un mouvement de caméra (1,15 à 2,1 s, #115) : l'arrêt
 * finit de parler à peu près quand on finit d'y arriver.
 */
export const TYPE_MS_PER_CHAR = 26

/** Le temps qu'il faut pour écrire ce texte, en millisecondes. */
export function typeDuration(text: string): number {
  return text.length * TYPE_MS_PER_CHAR
}

/**
 * Ce qui est visible d'un texte après `elapsed` millisecondes.
 *
 * `elapsed === null` veut dire « pas d'animation » — avant le départ, après la
 * fin, ou sous `prefers-reduced-motion` — et rend le texte ENTIER. C'est le
 * contrat de `useElapsed`, et c'est ce qui fait que couper l'animation affiche
 * la phrase au lieu de l'effacer.
 */
export function typedLength(text: string, elapsed: number | null): number {
  if (elapsed === null) return text.length
  if (elapsed <= 0) return 0
  return Math.min(text.length, Math.floor(elapsed / TYPE_MS_PER_CHAR))
}
