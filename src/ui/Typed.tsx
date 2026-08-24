import { parseCues } from '@/lib/richText'

/**
 * Le texte en train de s'écrire, et le reste **rendu mais invisible**.
 *
 * Partagé par la bulle du tour et l'encadré de la visée : la pièce écrit ce
 * qu'elle dit, et elle l'écrit partout de la même façon.
 *
 * C'est ce qui réserve la hauteur de la phrase entière dès le premier
 * caractère. Sans cela la boîte pousse ligne à ligne : une bulle du tour est
 * centrée sur son ancre, donc elle grandirait des deux côtés et l'objet désigné
 * semblerait bouger pendant qu'on lit ; l'encadré de la visée, lui, est calé
 * par le bas et remonterait à mesure qu'il parle. `visibility: hidden` occupe la place sans peindre
 * — `display: none` ne l'occuperait pas, et `opacity: 0` laisserait le texte
 * sélectionnable et lisible par un lecteur d'écran.
 */
export function Typed({ text, shown }: { text: string; shown: number }) {
  // Les segments sont découpés sur le texte MARQUÉ, mais la frappe compte sur
  // le texte NU : le visiteur ne voit pas les `**`, ils ne doivent donc pas lui
  // coûter des millisecondes ni décaler l'endroit où la phrase s'arrête.
  const segments = parseCues(text)
  let déjà = 0

  return (
    <>
      {segments.map((seg) => {
        const visible = Math.min(seg.text.length, Math.max(0, shown - déjà))
        const début = déjà
        déjà += seg.text.length
        const écrit = seg.text.slice(0, visible)
        const reste = seg.text.slice(visible)
        // La consigne garde son enveloppe même quand elle n'est pas encore
        // écrite : c'est elle qui porte l'accent et le balayage, et la faire
        // apparaître au dernier caractère ferait clignoter la couleur.
        const contenu = (
          <>
            {écrit}
            {reste && (
              <span aria-hidden="true" style={{ visibility: 'hidden' }}>
                {reste}
              </span>
            )}
          </>
        )
        return seg.cue ? (
          <span className="bubble__cue" key={début}>
            {contenu}
          </span>
        ) : (
          <span key={début}>{contenu}</span>
        )
      })}
    </>
  )
}
