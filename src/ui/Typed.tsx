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
  if (shown >= text.length) return <>{text}</>
  return (
    <>
      {text.slice(0, shown)}
      <span aria-hidden="true" style={{ visibility: 'hidden' }}>
        {text.slice(shown)}
      </span>
    </>
  )
}
