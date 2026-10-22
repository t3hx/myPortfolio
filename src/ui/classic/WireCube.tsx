import type { Ref } from 'react'

/**
 * Le cube filaire — la signature graphique du site classique (#29).
 *
 * **Il est en CSS 3D, et c'est une dérogation assumée à la spec.**
 * `docs/PORTFOLIO_2D.md` note que l'auteur souhaitait le refaire en
 * react-three-fiber en production. Cette page ne peut pas : `App.tsx` importe
 * la scène en dynamique précisément pour que three/r3f ne parte JAMAIS sur la
 * route classique, et cette route est celle où `resolveExperience` envoie le
 * visiteur DONT LE NAVIGATEUR N'A PAS DE WEBGL. Y monter un canvas reviendrait
 * à demander un contexte WebGL à la seule personne qui a prouvé ne pas pouvoir
 * en obtenir — et à faire payer 500 ko de moteur 3D à tous les autres, qui ont
 * justement choisi de ne pas les charger.
 *
 * Six div à bord cyan pèsent zéro octet de plus et ne peuvent pas échouer.
 *
 * Les faces sont positionnées par `:nth-child` dans `classic.css`, pas ici :
 * leur transform dépend de la TAILLE du cube (150 px pour celui de l'accueil,
 * 0,45 em pour celui d'un titre), donc du contexte, et un composant qui
 * porterait les deux jeux prendrait une prop pour choisir entre deux constantes
 * que le CSS sait déjà distinguer par son sélecteur.
 */
export function WireCube({
  faces = 6,
  ref,
}: {
  faces?: 4 | 6
  /** L'élément qui PORTE la rotation. L'accueil l'écrit par image depuis sa
   *  boucle ; c'est `.classic-cube` qu'il faut tenir, pas son parent — le
   *  parent porte la perspective, et une rotation posée dessus ferait tourner
   *  le point de fuite avec le cube, ce qui l'aplatit. */
  ref?: Ref<HTMLSpanElement>
}) {
  return (
    <span className="classic-cube" ref={ref}>
      {Array.from({ length: faces }, (_, i) => (
        <span className="classic-cube__face" key={i} />
      ))}
    </span>
  )
}
