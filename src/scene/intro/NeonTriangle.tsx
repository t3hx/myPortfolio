import { forwardRef } from 'react'
import { GLOW_WIDTHS, TRI_D, TRI_SIDES } from '@/lib/neonTriangle'

/**
 * Le triangle de la favicon, en néon SVG (#144).
 *
 * La géométrie est celle de `public/favicon.svg` et de `src/ui/Logo.tsx` :
 * boîte de 32, pointe en bas. Le néon est fait de QUATRE traits superposés par
 * côté — 16, 9, 4,2 et 1,8 px, du plus large et plus transparent au plus fin
 * et plus blanc — et pas d'un `filter: blur`, qu'un navigateur rastériserait à
 * chaque image du zoom. Les épaisseurs sont divisées par l'échelle locale pour
 * rester constantes à l'écran quelle que soit la taille du triangle.
 *
 * Le composant rend la structure une fois ; `applyTriangle` l'anime en
 * écrivant des attributs, sans jamais repasser par React.
 */
interface NeonTriangleProps {
  accent: string
  core: string
}

export const NeonTriangle = forwardRef<SVGGElement, NeonTriangleProps>(function NeonTriangle(
  { accent, core },
  ref,
) {
  return (
    <g ref={ref} opacity="0">
      <path d={TRI_D} fill="none" stroke={accent} strokeOpacity="0.4" strokeLinejoin="round" />
      {TRI_SIDES.map((d) => (
        <g key={d}>
          {GLOW_WIDTHS.map((w, i) => (
            <path
              key={w}
              d={d}
              fill="none"
              stroke={i === GLOW_WIDTHS.length - 1 ? core : accent}
              strokeLinecap="round"
            />
          ))}
        </g>
      ))}
    </g>
  )
})
