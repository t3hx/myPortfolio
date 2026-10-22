import type { ReactNode } from 'react'
import { plainLength } from '@/lib/richText'
import { Typed } from '@/ui/Typed'

/**
 * L'INTÉRIEUR d'une bulle — l'aura, le rappel vers le sujet, le titre, le texte
 * en train de s'écrire, le chevron « la suite ».
 *
 * Partagé par les deux endroits où la pièce parle : les bulles du tour, ancrées
 * en 3D par `Bubble`, et l'encadré de la lune, posé dans la visée du télescope.
 * Les deux avaient le même balisage recopié, et ça s'est vu comme ça se voit
 * toujours — l'un a reçu l'aura (#128) et l'autre non, si bien que la lune avait
 * un « traitement particulier » que personne n'avait décidé.
 *
 * Ce composant ne connaît ni ancrage, ni horloge, ni pagination : il reçoit ce
 * qu'il faut afficher. C'est ce qui permettra de paginer l'encadré de la lune le
 * jour où on le voudra, sans rien lui redonner de ce que la bulle a déjà.
 */
export interface BubbleCardProps {
  /** « NN — Objet ». Absent = variante inline, point et phrase sur une ligne. */
  kicker?: string
  /** La phrase entière. */
  text: string
  /** Combien de caractères en sont visibles. */
  shown: number
  /** Rappel de 44 px vers le sujet, du côté indiqué. */
  tick?: 'left' | 'right' | 'top'
  /** Il reste une page après celle-ci. */
  hasNext?: boolean
  /** Contenu supplémentaire posé dans la boîte (rien aujourd'hui). */
  children?: ReactNode
}

export function BubbleCard({
  kicker,
  text,
  shown,
  tick,
  hasNext = false,
  children,
}: BubbleCardProps) {
  const written = shown >= plainLength(text)
  return (
    <>
      {/* L'aura d'arrivée (#128). Elle est posée AVANT le contenu et en
          `position: absolute`, donc elle ne participe pas à la mise en page :
          la boîte a exactement la même taille avec et sans elle. */}
      <span className="bubble__aura" aria-hidden="true" />

      {/* Le chevron « la suite ». Une bulle qui a fini de parler et une bulle
          qui attend qu'on tourne la page se ressemblent trait pour trait —
          rien, dans le texte, ne dit qu'il en reste. Un signe, pas une phrase.
          Il attend la fin de la frappe : tant que le texte s'écrit, la suite
          n'est pas encore la question. */}
      {hasNext && written && <span className="bubble__next" aria-hidden="true" />}

      {tick && <span className={`bubble__tick bubble__tick--${tick}`} aria-hidden="true" />}

      {kicker ? (
        <>
          <header className="bubble__kicker">
            <span className="bubble__dot" />
            <span className="bubble__label">{kicker}</span>
          </header>
          <p className="bubble__text">
            <Typed text={text} shown={shown} />
          </p>
        </>
      ) : (
        <div className="bubble__inline">
          <span className="bubble__dot" />
          <p className="bubble__text">
            <Typed text={text} shown={shown} />
          </p>
        </div>
      )}
      {children}
    </>
  )
}
