/**
 * Le logo — un triangle au trait lumineux (décision du 2026-08-10, en
 * remplacement du losange des premières maquettes). SVG plutôt que div :
 * un `clip-path` rognerait la bordure et sa lueur, là où un `stroke` +
 * `drop-shadow` gardent le trait net et le halo entier.
 *
 * Un seul logo dans le produit (issue #65) : pré-sélection, menu et preloader
 * rendent CE composant. La forme et son habillage vivent dans `.logo`
 * (`docs/design/tokens.css`) ; `className` n'apporte que la taille et la
 * respiration propres à la surface (`presel__logo`, `menu__logo`,
 * `preload__logo`).
 */
export function Logo({ className }: { className?: string }) {
  // Pointe en bas (retourné le 2026-08-10 sur retour utilisateur).
  return (
    <svg
      className={className ? `logo ${className}` : 'logo'}
      viewBox="0 0 16 16"
      aria-hidden="true"
    >
      <path d="M2 2.5 H14 L8 13.5 Z" />
    </svg>
  )
}
