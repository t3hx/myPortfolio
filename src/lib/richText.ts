/**
 * Le marquage des CONSIGNES dans une phrase (#129).
 *
 * Certaines phrases ne racontent pas la pièce : elles demandent quelque chose au
 * visiteur — « un coup de molette et on y va ». Ces mots-là s'écrivent
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

/**
 * Le nombre de caractères que le visiteur VOIT dans un texte marqué.
 *
 * **Compté en caractères et non en unités UTF-16**, ce qui n'est pas la même
 * chose dès qu'une émoticône entre dans la copy (#32) : `😅` occupe deux
 * unités, si bien qu'une frappe comptée en unités s'arrête un instant au
 * milieu de la paire — et une moitié de paire de substitution n'est pas un
 * caractère, c'est un glyphe cassé que le navigateur peint pendant 20 ms.
 *
 * La limite assumée : un caractère est ici un POINT DE CODE, pas un graphème.
 * Une séquence composée avec un liant (drapeaux, familles) se couperait donc
 * encore. La copy n'en contient aucune, et un segmenteur ICU appelé à chaque
 * frame pour toutes les bulles montées coûterait plus que ce qu'il corrige.
 */
export function plainLength(source: string): number {
  return [...plainText(source)].length
}

/** Un fragment de ligne : son texte, son rôle, et ce qui en est déjà écrit. */
export interface Span extends Segment {
  /** Le préfixe déjà frappé. */
  written: string
  /** Le reste, rendu mais invisible — c'est lui qui réserve la hauteur. */
  pending: string
}

/**
 * Le texte marqué découpé en LIGNES de fragments, à l'avancée `shown`.
 *
 * Trois découpes se croisent ici, et c'est pour ça qu'elles vivent dans une
 * fonction pure plutôt que dans le composant : le marquage des consignes, les
 * sauts de ligne demandés par la rédaction (#32) et l'avancée de la frappe.
 * Aucune des trois ne se relit dans le DOM autrement qu'à l'œil, sur une
 * animation de deux secondes ; `Typed` ne fait plus que rendre le résultat.
 *
 * **Le saut de ligne est un `\n` dans la chaîne, et il est rendu par un `<br>`,
 * jamais par un `white-space` de CSS.** La variante sans titre de l'accueil
 * pose `white-space: nowrap` — qui réduit les sauts à une espace : une
 * rédaction qui y aurait coupé sa phrase n'aurait rien vu se produire, et rien
 * ne le lui aurait dit. Un `<br>` coupe même sous `nowrap`.
 *
 * Le saut coûte un caractère de frappe : il s'affiche, sous la forme d'une
 * rupture. Les marqueurs `**…**`, eux, ne s'affichent pas et ne coûtent rien.
 */
export function layout(source: string, shown: number): Span[][] {
  const lines: Span[][] = [[]]
  let budget = shown
  for (const segment of parseCues(source)) {
    const parts = segment.text.split('\n')
    for (const [i, part] of parts.entries()) {
      if (i > 0) {
        budget = Math.max(0, budget - 1)
        lines.push([])
      }
      // Une part vide (un saut collé à un autre, ou en bout de segment) ne
      // porte rien à rendre : la ligne, elle, existe déjà et suffit à faire
      // la rupture. Un fragment vide de plus ne serait qu'un `<span>` mort.
      if (part === '') continue
      const chars = [...part]
      const vus = Math.min(chars.length, Math.max(0, budget))
      budget -= chars.length
      lines[lines.length - 1].push({
        text: part,
        cue: segment.cue,
        written: chars.slice(0, vus).join(''),
        pending: chars.slice(vus).join(''),
      })
    }
  }
  return lines
}
