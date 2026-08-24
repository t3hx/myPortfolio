import type { ReactNode } from 'react'
import { WireCube } from '@/ui/classic/WireCube'
import { revealDelay } from '@/ui/classic/useReveal'
import { REVEAL_KICKER_MS, REVEAL_TITLE_MS } from '@/config/classic'

/**
 * L'en-tête commun à toutes les sections : un kicker numéroté, puis un titre
 * dont la PREMIÈRE LETTRE porte un cube.
 *
 * **Sur la lettre, pas sur le titre.** Une lettre est un objet — elle a un
 * centre, une hauteur, une place ; un titre est une ligne, et un cube posé au
 * milieu d'une ligne ne désigne rien. C'est ce qui fait lire le cube comme une
 * initiale enluminée plutôt que comme une décoration flottante, et c'est
 * pourquoi la lettre est isolée dans son propre `inline-block` : sans lui, le
 * cube absolu se positionnerait par rapport au titre entier.
 *
 * Le cube n'a que quatre faces ici, contre six à l'accueil : à 0,9 em les deux
 * faces horizontales se réduisent à un trait et n'ajoutent que du bruit.
 */
export function SectionHead({
  kicker,
  title,
  children,
}: {
  kicker: string
  /** Le titre. Sa première lettre reçoit le cube ; le reste suit. */
  title: string
  /** Le contenu de la section, à l'intérieur du groupe révélé avec l'en-tête. */
  children?: ReactNode
}) {
  const [first, ...rest] = [...title]

  return (
    <>
      <div className="classic-kicker classic-reveal" style={revealDelay(REVEAL_KICKER_MS)}>
        <span className="classic-dot" aria-hidden="true" />
        <span>{kicker}</span>
      </div>
      <h2 className="classic-h2 classic-reveal" style={revealDelay(REVEAL_TITLE_MS)}>
        <span className="classic-mark">
          <span className="classic-mark__cube" aria-hidden="true">
            <WireCube faces={4} />
          </span>
          {first}
        </span>
        {rest.join('')}
      </h2>
      {children}
    </>
  )
}
