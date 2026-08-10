/**
 * Le logo — un triangle au trait lumineux (décision du 2026-08-10, en
 * remplacement du losange des premières maquettes). SVG plutôt que div :
 * un `clip-path` rognerait la bordure et sa lueur, là où un `stroke` +
 * `drop-shadow` gardent le trait net et le halo entier. Les autres écrans du
 * design system (menu, preloader) portent encore le losange — à propager une
 * fois le triangle validé.
 */
export function Logo() {
  // Pointe en bas (retourné le 2026-08-10 sur retour utilisateur).
  return (
    <svg className="presel__logo" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M2 2.5 H14 L8 13.5 Z" />
    </svg>
  )
}
