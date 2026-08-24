import { Fragment } from 'react'
import { UI } from '@/content/ui'
import { LOCALES, t } from '@/lib/locale'
import { useLocale } from '@/state/locale'

/**
 * La bascule FR/EN — **les deux langues affichées, les deux cliquables**.
 *
 * Elle a d'abord montré une seule étiquette, celle de l'autre langue : en
 * français, un bouton marqué « EN ». Illisible, et pour deux raisons qui se
 * cumulent. Un bouton isolé ne dit pas s'il ÉTIQUETTE l'état courant ou s'il
 * ANNONCE sa destination — « EN » se lit aussi bien « vous êtes en anglais »
 * que « passer en anglais », et les deux lectures sont exactement contraires.
 * Et il ne dit pas non plus quelles langues existent : on ne peut pas choisir
 * dans une liste qu'on ne voit pas. Afficher les deux règle les deux d'un
 * coup : la paire EST la liste, et le contraste dit laquelle est active.
 *
 * **Le côté actif reste un bouton, et reste cliquable.** Le désactiver ferait
 * disparaître l'indicateur, or c'est lui qui répond à « dans quelle langue
 * suis-je ». Même arbitrage que la barre verticale de la scène.
 *
 * **Elle sert la pré-sélection ET le site classique**, et c'est ce qui l'a
 * sortie de `ClassicApp` : la langue se choisit AVANT de choisir l'expérience.
 * `useLocale` étant un store global mémorisé, la décision prise sur l'écran de
 * choix vaut ensuite pour les deux portfolios sans que rien n'ait à la
 * transporter — et pour les visites suivantes, puisque `resolveLocale` fait
 * passer un choix mémorisé avant toute détection.
 *
 * La barre de la scène 3D garde la sienne (`.menu__lang`) : elle est verticale,
 * elle vit dans une réglette, c'est une autre mise en page — pas un autre avis.
 */
export function LangToggle({ className }: { className?: string }) {
  const locale = useLocale((s) => s.locale)
  const setLocale = useLocale((s) => s.setLocale)

  return (
    <div
      className={className ? `lang ${className}` : 'lang'}
      role="group"
      aria-label={t(UI.menu.switchTo, locale)}
    >
      {LOCALES.map((code, i) => (
        <Fragment key={code}>
          {i > 0 && <span className="lang__rule" aria-hidden="true" />}
          <button
            type="button"
            className={code === locale ? 'lang__on' : 'lang__off'}
            aria-current={code === locale ? 'true' : undefined}
            title={t(UI.menu.switchTo, code)}
            onClick={() => setLocale(code)}
          >
            {code.toUpperCase()}
          </button>
        </Fragment>
      ))}
    </div>
  )
}
