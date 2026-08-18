import { useCallback, useMemo, useRef } from 'react'
import { CAMERA_STOPS } from '@/config/cameraStops'
import { MENU_SECTIONS, MENU_SOCIALS } from '@/content/menu'
import { useInteraction } from '@/state/interaction'
import { Logo } from '@/ui/Logo'

/**
 * La barre de menu persistante (issue #26), recréée depuis les maquettes de
 * `docs/design/screens/` — son anatomie vit dans `docs/design/tokens.css`.
 *
 * Elle est atteignable depuis n'importe quel point du tour parce qu'elle n'est
 * jamais démontée : le repos à 40 % d'opacité est ce qui lui permet d'être là
 * en permanence sans concurrencer la pièce.
 *
 * Trois routages d'entrée à ne pas casser :
 *
 * - **Molette** : la barre ne la capture PAS. CameraRig écoute sur `.stage` et
 *   n'ignore que `.panel` ; un survol du menu continue donc de piloter le tour.
 *   C'est voulu — la barre n'a rien à faire défiler.
 * - **Flèches** : CameraRig les utilise pour avancer d'un arrêt. Quand le focus
 *   est DANS la barre, ↑↓ déplacent le focus d'un item à l'autre, et le rig les
 *   ignore (garde `.menu`, pendant clavier de la garde `.panel` de la molette).
 * - **Souris** : un clic à la souris rend la main au tour (`blur`), sinon les
 *   flèches resteraient prisonnières du menu après un simple clic. Une
 *   activation au clavier (`detail === 0`) garde le focus, elle.
 */
export function Menu() {
  const stopIndex = useInteraction((s) => s.stopIndex)
  const requestStop = useInteraction((s) => s.requestStop)
  const nav = useRef<HTMLElement>(null)

  // Un arrêt cité par le menu mais absent de CAMERA_STOPS est ignoré avec un
  // avertissement — même discipline que `extractStops` pour une caméra absente
  // du .glb : une entrée de menu qui ne mène nulle part est pire qu'une entrée
  // manquante.
  const sections = useMemo(
    () =>
      MENU_SECTIONS.map((section) => {
        const index = CAMERA_STOPS.findIndex((s) => s.label === section.stop)
        if (index === -1) {
          console.warn(`[menu] "${section.label}" vise l'arrêt "${section.stop}", absent de CAMERA_STOPS`)
        }
        return { ...section, index }
      }).filter((s) => s.index !== -1),
    [],
  )

  const socials = useMemo(() => MENU_SOCIALS.filter((s) => s.href), [])

  // Focus glissant : ↑↓ parcourent les items focusables de la barre, dans
  // l'ordre du DOM. `stopPropagation` n'est pas suffisant seul — la garde
  // `.menu` du rig est ce qui l'empêche vraiment d'avancer d'un arrêt.
  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    const items = Array.from(nav.current?.querySelectorAll<HTMLElement>('[data-menu-item]') ?? [])
    if (items.length === 0) return
    const from = items.indexOf(document.activeElement as HTMLElement)
    const step = e.key === 'ArrowDown' ? 1 : -1
    const next = from === -1 ? 0 : (from + step + items.length) % items.length
    e.preventDefault()
    items[next].focus()
  }, [])

  return (
    <nav className="menu" aria-label="Menu" ref={nav} onKeyDown={onKeyDown}>
      <Logo className="menu__logo" />
      <div className="menu__rule menu__rule--head" />

      {sections.map((section) => {
        const active = section.index === stopIndex
        return (
          <button
            key={section.label}
            type="button"
            data-menu-item
            className={`menu__link${active ? ' menu__link--active' : ''}`}
            aria-current={active ? 'true' : undefined}
            onClick={(e) => {
              requestStop(section.index)
              // detail > 0 : clic souris. On rend les flèches au tour.
              if (e.detail > 0) e.currentTarget.blur()
            }}
          >
            <span>{section.label}</span>
          </button>
        )
      })}

      <div className="menu__rule menu__rule--mid" />

      {socials.map((social) => (
        <a
          key={social.label}
          data-menu-item
          className="menu__social"
          href={social.href}
          title={social.title}
          target="_blank"
          rel="noreferrer"
        >
          {social.label}
        </a>
      ))}

      {/* FR/EN : le bilingue est l'issue #33. EN reste un <span> et pas un
          bouton désactivé — un bouton, même `disabled`, arrive avec sa propre
          apparence système, et son gris à 45 % suffit à le lire comme la moitié
          inactive d'un indicateur. */}
      <div className="menu__lang">
        <span className="menu__lang-on">FR</span>
        <span className="menu__lang-rule" />
        <span className="menu__lang-off" aria-disabled="true" title="Version anglaise à venir">
          EN
        </span>
      </div>
    </nav>
  )
}
