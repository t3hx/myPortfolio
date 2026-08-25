import { type CSSProperties, useEffect, useState } from 'react'
import { UI } from '@/content/ui'
import { t } from '@/lib/locale'
import { reducedMotion, useTyping } from '@/lib/clock'
import { typeDuration, typedLength } from '@/lib/typewriter'
import { useInteraction } from '@/state/interaction'
import { BubbleCard } from '@/ui/BubbleCard'
import { useLocale } from '@/state/locale'

/**
 * La visée du télescope (issue #106).
 *
 * Cliquer le télescope déclenchait déjà l'excursion vers la lune et l'échange
 * `Outside_Moon` → `Outside_Moon_Detailed`, mais rien ne disait qu'on regardait
 * DANS un télescope : on volait vers la lune, plein cadre. Ce cache circulaire
 * est ce qui fait la différence entre une caméra qui se déplace et un oculaire.
 *
 * **C'est un dégradé radial en DOM, pas une seconde passe de rendu.** La spec
 * (`docs/PORTFOLIO_3D_INTERACTIONS.md` § 2.2) laissait le choix. Le DOM gagne
 * pour deux raisons : la scène est un bake non éclairé qu'on ne retouche pas,
 * et une passe de rendu supplémentaire serait un coût GPU permanent pour ce qui
 * n'est qu'un dégradé.
 *
 * **Il n'est pas modal.** À `--z-bubble` (100) il passe SOUS la barre de menu :
 * à 300 il la couvrirait et `Échap` deviendrait la seule sortie. Même arbitrage
 * que le CV — ce qui n'est pas modal ne se comporte pas comme un modal.
 */

/** Doit égaler `--t-scope-out` de tokens.css — `tests/scope.test.ts` est la
 *  seule chose qui relie les deux. */
export const SCOPE_OUT_MS = 260

export function TelescopeScope() {
  // `telescopeSettled`, PAS `phase === 'telescope'` : la phase bascule au clic,
  // alors que la caméra met 1,6 s à rejoindre l'oculaire. Ouvrir la visée tout
  // de suite montrait le cache posé sur une pièce encore en mouvement — on
  // regardait dans un télescope avant d'y être arrivé.
  const visible = useInteraction((s) => s.telescopeSettled)
  const locale = useLocale((s) => s.locale)
  const moonRevealed = useInteraction((st) => st.moonRevealed)

  // La lune écrit sa phrase, comme les arrêts écrivent les leurs. Elle n'est
  // PAS paginée pour autant : la visée ne reçoit ni molette ni clic — `Échap`
  // en est la seule issue — donc rien n'y ferait tourner une page, et rien n'y
  // achèverait une frappe non plus. Une phrase, qui s'écrit à l'arrivée de la
  // lune et reste tant qu'on regarde.
  const phrase = t(UI.telescope.moon, locale)
  const duration = reducedMotion() ? 0 : typeDuration(phrase)
  // La visée ne reçoit aucune entrée : personne n'a besoin de savoir si ça
  // écrit encore, donc une horloge locale suffit — là où le dialogue en exige
  // une partagée avec l'arbitrage des gestes.
  const shown = typedLength(phrase, useTyping(moonRevealed, duration), duration)

  // Démontage différé, comme la bulle, la fiche et le CV : `visible` à false
  // lance le fondu, le démontage suit. Démonter tout de suite emporterait la
  // sortie avec le composant, et le cache disparaîtrait d'un coup alors que la
  // caméra, elle, met 1,6 s à revenir.
  const [mounted, setMounted] = useState(visible)
  useEffect(() => {
    if (visible) {
      setMounted(true)
      return
    }
    const timer = window.setTimeout(() => setMounted(false), SCOPE_OUT_MS)
    return () => window.clearTimeout(timer)
  }, [visible])

  if (!mounted) return null

  return (
    <div className={visible ? 'scope' : 'scope scope--out'} aria-hidden="true">
      {/* Quatre repères au BORD de l'ouverture, jamais une croix au centre :
          le centre, c'est la lune, et on ne la barre pas. */}
      <div className="scope__reticle">
        <span className="scope__tick scope__tick--n" />
        <span className="scope__tick scope__tick--s" />
        <span className="scope__tick scope__tick--w" />
        <span className="scope__tick scope__tick--e" />
      </div>

      {/* L'encadré de la lune : la MÊME bulle que partout ailleurs, pas une
          légende à part. La lune a cessé d'être un arrêt (#113), elle n'a pas
          cessé de se raconter comme les autres objets de la pièce — seul
          l'endroit change.

          En bas à droite, et seulement quand la lune est là (`moonRevealed`) :
          la visée s'ouvre sur un ciel lointain, et le grossissement dure encore
          une seconde et demie après. Elle vit DANS le cache, comme le rappel de
          sortie, pour fondre et se resserrer avec lui. */}
      {moonRevealed && (
        <article className="bubble scope__bubble">
          {/* Le MÊME intérieur que les bulles du tour (#128). La lune n'a pas
              de traitement particulier : elle parle comme le reste de la
              pièce, aura comprise — et le jour où on voudra la paginer, elle
              n'aura rien de neuf à apprendre. */}
          <BubbleCard kicker={t(UI.telescope.subject, locale)} text={phrase} shown={shown} />
        </article>
      )}

      {/* Le rappel de sortie. `Échap` est la SEULE issue de cette vue — un clic
          ailleurs ne fait rien — et personne ne devine une touche qu'on ne lui
          montre pas. Il reprend la touche capée de la fiche projet, qui dit
          déjà exactement la même chose ailleurs. */}
      <p className="scope__exit">
        <span className="sheet__key sheet__key--cue">
          <span className="cue" style={{ '--cue-delay': 'var(--t-scope-in)' } as CSSProperties}>
            {t(UI.sheet.escape, locale)}
          </span>
        </span>
        {/* Une CONSIGNE, au sens de #129 : elle demande un geste. Elle porte
            donc l'accent en permanence et le balayage repasse tant qu'on ne l'a
            pas suivie — le même traitement que « défiler » sur le site
            classique, et non le faisceau d'une phrase qui raconte.

            Sur la PHRASE, jamais sur la pastille : celle-ci a un fond et une
            bordure, et `background-clip: text` la viderait de son cadre. Le
            retard cale la première traversée après l'ouverture de la visée. */}
        <span className="cue" style={{ '--cue-delay': 'var(--t-scope-in)' } as CSSProperties}>
          {t(UI.sheet.exit, locale)}
        </span>
      </p>
    </div>
  )
}
