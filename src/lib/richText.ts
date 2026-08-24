/**
 * Le marquage des CONSIGNES dans une phrase (#129).
 *
 * Certaines phrases ne racontent pas la pièce : elles demandent quelque chose au
 * visiteur — « faites défiler pour commencer la visite ». Ces mots-là s'écrivent
 * dans l'accent et un balayage les parcourt, pour qu'on ne les prenne pas pour
 * de la narration.
 *
 * **Le marquage vise des MOTS, pas une phrase entière**, et c'est ce qui a
 * décidé de la forme : une consigne vit presque toujours au milieu d'une
 * phrase qui, elle, raconte. Un drapeau par page aurait teinté « Bienvenue » et
 * « chaque objet ici a une histoire » avec.
 *
 * La syntaxe est `**ainsi**`, empruntée à Markdown parce qu'elle se lit dans le
 * code source sans qu'on ait besoin de la connaître. Ce n'est PAS du Markdown :
 * rien d'autre n'est interprété, et il n'y a pas d'échappement — un `**` isolé
 * reste un `**`.
 *
 * Le texte livré garde donc ses marqueurs, et `tests/bubbleAnchors.test.ts`
 * compare aux maquettes le texte NU, obtenu par `plainText()`. C'est ce qui
 * permet de marquer des mots sans faire diverger la copy de sa maquette.
 */

export interface Segment {
  text: string
  /** Ce segment est une consigne : accent, et balayage. */
  cue: boolean
}

/** Découpe une phrase en segments, d'après les `**…**` qu'elle porte. */
export function parseCues(source: string): Segment[] {
  const out: Segment[] = []
  let reste = source
  for (;;) {
    const début = reste.indexOf('**')
    if (début === -1) break
    const fin = reste.indexOf('**', début + 2)
    // Un marqueur ouvert et jamais refermé n'est pas une consigne à moitié :
    // c'est du texte. On le laisse tel quel plutôt que de deviner où il finit.
    if (fin === -1) break
    if (début > 0) out.push({ text: reste.slice(0, début), cue: false })
    out.push({ text: reste.slice(début + 2, fin), cue: true })
    reste = reste.slice(fin + 2)
  }
  if (reste) out.push({ text: reste, cue: false })
  return out
}

/** La phrase sans ses marqueurs — ce que le visiteur lit, et ce qu'on compare. */
export function plainText(source: string): string {
  return parseCues(source)
    .map((s) => s.text)
    .join('')
}
