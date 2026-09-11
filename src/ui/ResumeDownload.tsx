import { RESUME_FILENAME, RESUME_PDF } from '@/config/resume'
import { CV } from '@/content/cv'
import { t, type Locale } from '@/lib/locale'

/**
 * Le lien qui rapporte le CV en PDF (#161, #162).
 *
 * **Un seul composant pour les deux expériences**, comme `LangToggle` (#29) et
 * comme `Mark` (#169) : la règle est une — le bon document pour la langue, et
 * un nom de fichier que le visiteur reconnaîtra. Deux liens recopiés auraient
 * divergé au premier changement, et le plus probable serait le pire : une
 * langue servant le document de l'autre.
 *
 * **Aucun JavaScript**, c'est un `<a download>`. Rien à intercepter, rien à
 * empêcher, et le lien fonctionne au clic milieu comme au clic droit.
 *
 * L'anatomie appartient à la surface — la scène a sa pastille, le site
 * classique la sienne — donc la classe est passée. Ce qui est partagé, c'est
 * la décision, pas les pixels.
 */
export function ResumeDownload({ locale, className }: { locale: Locale; className: string }) {
  return (
    <a
      className={className}
      href={RESUME_PDF[locale]}
      // Le nom du fichier enregistré, indépendant de l'URL : l'adresse reste
      // interne et stable, le visiteur retrouve un nom qui dit de qui il parle.
      download={RESUME_FILENAME[locale]}
    >
      {t(CV.downloadLabel, locale)}
    </a>
  )
}
