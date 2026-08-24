import { useEffect, useRef } from 'react'
import { haloOffset, haloStep, scrollProgress } from '@/lib/classic'
import { reducedMotion } from '@/lib/clock'

/**
 * La braise qui suit le défilement (spec §7) — la seule chose qui bouge
 * derrière toute la page.
 *
 * **Un seul halo.** Le premier essai en avait plusieurs, à des vitesses
 * différentes ; on ne lisait plus une pièce éclairée mais un fond animé. Un
 * seul, très large et très plat, se lit comme une lueur au ras du sol dont on
 * s'éloigne — ce que la scène 3D fait avec son bake, et que cette page doit
 * obtenir sans un seul pixel de 3D.
 *
 * **La traîne est l'effet, pas un détail de mise en œuvre.** À 0,02 de lissage
 * par image, le halo continue de glisser plusieurs secondes après l'arrêt du
 * défilement : c'est ce retard qui lui donne une masse. Attaché directement à
 * `scrollY`, il devient un calque collé à la molette et cesse d'exister en tant
 * qu'ambiance.
 *
 * **La boucle est coupée sous `prefers-reduced-motion`, pas figée** — et le
 * halo reste peint, à sa position de départ, celle que la session design a
 * cadrée sur le bas de l'accueil. Le prototype se contentait de
 * `animation-duration: .01s`, qui ne touche que le CSS et laissait cette
 * boucle-ci tourner : une page « sans animation » dont le fond dérivait quand
 * même.
 *
 * Elle écrit dans le DOM directement, sans passer par l'état de React : c'est
 * une transformation par image, et la faire transiter par un rendu ferait
 * re-rendre toute la page soixante fois par seconde pour déplacer un dégradé.
 */
export function EmberHalo() {
  const sheet = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = sheet.current
    if (!el) return
    if (reducedMotion()) return

    let frame = 0
    let current = 0
    const tick = () => {
      const doc = document.scrollingElement ?? document.documentElement
      const target = scrollProgress(window.scrollY, doc.scrollHeight, window.innerHeight)
      current = haloStep(current, target)
      // `offsetHeight` et non `205vh` recalculé à la main : la nappe est
      // dimensionnée par le CSS, et le lire évite que les deux se contredisent
      // le jour où le jeton change d'un seul côté.
      el.style.transform = `translate3d(0, ${haloOffset(current, el.offsetHeight, window.innerHeight).toFixed(1)}px, 0)`
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [])

  return (
    <div className="classic-halo" aria-hidden="true">
      <div className="classic-halo__sheet" ref={sheet} />
    </div>
  )
}
