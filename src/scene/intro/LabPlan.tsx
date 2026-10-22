import { memo } from 'react'
import type { LabPlan as LabPlanData } from '@/content/labPlan'
import { LAB_SUBGROUPS } from '@/lib/introScene'

/**
 * Le plan du lab (#145) : 2 346 tracés qui s'écrivent lot après lot pendant la
 * phase « La conception ».
 *
 * Il est rendu UNE FOIS, et rien ne le retraverse ensuite. Ce qui bouge à
 * chaque image est le `stroke-dashoffset` de cinquante-cinq groupes, écrit par
 * la boucle d'images — jamais un `style` React de 55 clés, qui serait un rendu
 * par image.
 *
 * **Les tracés sont regroupés par vague, pas laissés à plat.** Le prototype
 * portait la variable sur chacun des 2 346 chemins ; `stroke-dashoffset`
 * s'hérite en SVG, donc la porter sur les 55 groupes dit exactement la même
 * chose avec 55 déclarations. La couleur, le remplissage, la casse de trait,
 * le pointillé et le décalage de départ sont posés une fois en CSS sur le
 * groupe racine, pour la même raison — et parce que l'accent doit pouvoir
 * changer (#147) sans reconstruire un seul chemin.
 *
 * La vague d'un tracé est son rang modulo cinq : les cinq vagues d'un lot sont
 * donc entremêlées dans le dessin, et non cinq régions distinctes. L'ordre de
 * peinture change avec le regroupement, ce qui ne se voit pas : à l'intérieur
 * d'un lot tous les traits partagent la même encre.
 *
 * `data-wave` porte le rang de la vague dans la chronologie (lot × 5 + vague),
 * qui est ce que la boucle sait calculer. Se fier à l'ordre du document
 * marcherait aujourd'hui et casserait le jour où un lot bouge.
 */
interface LabPlanProps {
  plan: LabPlanData
}

export const LabPlan = memo(function LabPlan({ plan }: LabPlanProps) {
  return (
    // Le plan est cadré 1920 × 1050, l'intro en 1920 × 1080 : le décalage est
    // celui du handoff, et il centre le dessin dans le cadre.
    <g className="intro-lab" transform="translate(0 15)">
      {plan.order.map((batch, b) =>
        Array.from({ length: LAB_SUBGROUPS }, (_, wave) => (
          <g key={`${batch}${wave}`} data-wave={b * LAB_SUBGROUPS + wave}>
            {plan.batches[batch]
              .filter((_, i) => i % LAB_SUBGROUPS === wave)
              .map(([d, width], i) => (
                <path key={i} d={d} strokeWidth={width} pathLength="1" />
              ))}
          </g>
        )),
      )}
    </g>
  )
})
