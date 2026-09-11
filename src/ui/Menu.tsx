import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CAMERA_STOPS } from '@/config/cameraStops'
import { MENU_SECTIONS, MENU_SOCIALS } from '@/content/menu'
import { UI } from '@/content/ui'
import { LOCALES, t } from '@/lib/locale'
import { useLocale } from '@/state/locale'
import { useInteraction } from '@/state/interaction'
import { BUBBLE_IN_MS } from '@/scene/Bubble'
import { Logo } from '@/ui/Logo'
import { Mark } from '@/ui/Mark'

/**
 * La barre de menu persistante (issue #26), recréée depuis les maquettes de
 * `design/screens/` — son anatomie vit dans `src/styles/tokens.css`.
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
  const released = useInteraction((s) => s.introReleased)
  const nav = useRef<HTMLElement>(null)
  const locale = useLocale((s) => s.locale)
  const setLocale = useLocale((s) => s.setLocale)

  // Un arrêt cité par le menu mais absent de CAMERA_STOPS est ignoré avec un
  // avertissement — même discipline que `extractStops` pour une caméra absente
  // du .glb : une entrée de menu qui ne mène nulle part est pire qu'une entrée
  // manquante.
  const sections = useMemo(
    () =>
      MENU_SECTIONS.map((section) => {
        const index = CAMERA_STOPS.findIndex((s) => s.label === section.stop)
        if (index === -1) {
          console.warn(
            `[menu] "${section.label}" vise l'arrêt "${section.stop}", absent de CAMERA_STOPS`,
          )
        }
        return { ...section, index }
      }).filter((s) => s.index !== -1),
    [],
  )

  const socials = useMemo(() => MENU_SOCIALS.filter((s) => s.href), [])

  /**
   * **Elle arrive APRÈS la première bulle**, jamais avec elle et jamais avant
   * (décision produit, 2026-09-07). Elle était là dès la première image, donc
   * pendant toute l'intro : l'animation qui joue sur l'écran est la première
   * chose du site, et une barre de navigation posée à côté disait déjà qu'il y
   * avait autre chose à faire. Elle est du MOBILIER — elle arrive quand la
   * pièce a fini de parler.
   *
   * Le repère est `introReleased`, celui-là même qui laisse la bulle d'accueil
   * s'ouvrir, plus la durée de son entrée : la barre apparaît une fois la
   * phrase posée, pas pendant qu'elle se pose. Sur un lien direct ou sous
   * mouvement réduit, l'intro s'ouvre sur sa dernière image et libère tout de
   * suite — la barre suit donc à 480 ms, sans cas particulier.
   */
  const [furnished, setFurnished] = useState(false)
  useEffect(() => {
    if (!released) return setFurnished(false)
    const timer = window.setTimeout(() => setFurnished(true), BUBBLE_IN_MS)
    return () => window.clearTimeout(timer)
  }, [released])

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
    <nav
      className={`menu${furnished ? '' : ' menu--waiting'}`}
      aria-label={t(UI.menu.region, locale)}
      ref={nav}
      onKeyDown={onKeyDown}
    >
      <Logo className="menu__logo" />
      <div className="menu__rule menu__rule--head" />

      {sections.map((section) => {
        const active = section.index === stopIndex
        return (
          <button
            key={section.stop}
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
            <span>{t(section.label, locale)}</span>
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
          // Le nom accessible est du TEXTE, et il est nécessaire dès que la
          // marque est un masque : un masque n'a pas de contenu, donc sans lui
          // le lien s'annoncerait par son URL. `title` seul ne suffit pas — il
          // n'est pas lu de façon fiable et n'apparaît qu'au survol souris.
          aria-label={social.title}
          target="_blank"
          rel="noreferrer"
        >
          <Mark icon={social.icon} fallback={social.label} />
        </a>
      ))}

      {/* FR/EN, vivant depuis #33. Les deux côtés sont des boutons : c'était
          un `<span>` désactivé tant que l'anglais n'existait pas, parce qu'un
          bouton, même `disabled`, arrive avec sa propre apparence système. Le
          côté actif reste rendu et cliquable — le désactiver ferait disparaître
          l'indicateur, or c'est lui qui dit dans quelle langue on est.
          Le clic souris rend les flèches au tour, comme les sections. */}
      <div className="menu__lang">
        {LOCALES.map((code, i) => (
          <Fragment key={code}>
            {i > 0 && <span className="menu__lang-rule" />}
            <button
              type="button"
              className={code === locale ? 'menu__lang-on' : 'menu__lang-off'}
              aria-current={code === locale ? 'true' : undefined}
              title={t(UI.menu.switchTo, code)}
              onClick={(e) => {
                setLocale(code)
                if (e.detail > 0) e.currentTarget.blur()
              }}
            >
              {code.toUpperCase()}
            </button>
          </Fragment>
        ))}
      </div>
    </nav>
  )
}
