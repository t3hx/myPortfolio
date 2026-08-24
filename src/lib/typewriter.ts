import { plainText } from '@/lib/richText'

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
 *     20 ms →  1,16 s … 2,02 s   retenu (arbitrage à l'écran, 2026-08-24)
 *     26 ms →  1,51 s … 2,63 s   premier essai, jugé encore un peu lent
 *     40 ms →  2,32 s … 4,04 s   on attend la machine
 *
 * Le repère : la frappe doit rester assez lente pour qu'on la VOIE écrire —
 * sinon autant afficher — et finir avant que le lecteur ait fini de lire, sinon
 * elle le retient. La fourchette retenue tombe juste sous celle d'un mouvement
 * de caméra (1,15 à 2,1 s, #115) : l'arrêt finit de parler un peu avant qu'on
 * ait fini d'y arriver, ce qui laisse la phrase se poser plutôt que courir
 * après la caméra.
 */
export const TYPE_MS_PER_CHAR = 20

/**
 * Le temps qu'il faut pour écrire ce texte, en millisecondes.
 *
 * Compté sur le texte NU : les marqueurs de consigne (`**…**`) ne s'affichent
 * pas, donc ils ne coûtent rien à la frappe. Les compter allongerait la durée
 * d'une phrase à proportion de son balisage, ce qui n'a aucun sens à l'écran.
 */
export function typeDuration(text: string): number {
  return plainText(text).length * TYPE_MS_PER_CHAR
}

/**
 * Ce qui est visible d'un texte après `elapsed` millisecondes de frappe.
 *
 * `duration` est passée plutôt que recalculée : c'est elle qui décide de la
 * fin, et c'est la MÊME valeur que celle sur laquelle l'arbitrage des gestes se
 * prononce. Deux calculs de la même durée, c'est deux réponses possibles à
 * « est-ce que ça écrit encore ».
 */
export function typedLength(text: string, elapsed: number, duration: number): number {
  const longueur = plainText(text).length
  if (elapsed >= duration) return longueur
  if (elapsed <= 0) return 0
  return Math.min(longueur, Math.floor(elapsed / TYPE_MS_PER_CHAR))
}
