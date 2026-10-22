import { Fragment } from 'react'
import { layout } from '@/lib/richText'

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
 *
 * Le composant ne découpe RIEN lui-même : les consignes, les sauts de ligne et
 * l'avancée de la frappe sont trois découpes croisées, et elles vivent dans
 * `layout`, une fonction pure que les tests peuvent lire (#32). Découper ici
 * remettrait dans le DOM une logique qui ne s'y relit qu'à l'œil — et c'est
 * ainsi qu'une émoticône se faisait couper au milieu de sa paire d'unités.
 */
export function Typed({ text, shown }: { text: string; shown: number }) {
  const lines = layout(text, shown)

  return (
    <>
      {lines.map((line, i) => (
        <Fragment key={i}>
          {/* Le saut est un `<br>` et non un `white-space` de CSS : la variante
              sans titre de l'accueil pose `nowrap`, qui réduirait le saut à une
              espace sans que rien ne le dise. Voir `layout`. */}
          {i > 0 && <br />}
          {line.map((span, j) => {
            // La consigne garde son enveloppe même quand elle n'est pas encore
            // écrite : c'est elle qui porte l'accent et le balayage, et la faire
            // apparaître au dernier caractère ferait clignoter la couleur.
            const contenu = (
              <>
                {span.written}
                {span.pending && (
                  <span aria-hidden="true" style={{ visibility: 'hidden' }}>
                    {span.pending}
                  </span>
                )}
              </>
            )
            return span.cue ? (
              <span className="cue" key={j}>
                {contenu}
              </span>
            ) : (
              <span key={j}>{contenu}</span>
            )
          })}
        </Fragment>
      ))}
    </>
  )
}
