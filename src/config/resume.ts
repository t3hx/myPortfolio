/**
 * Le CV en PDF, servi par l'app (#160).
 *
 * **Deux documents, pas une traduction d'interface** (décision de l'auteur,
 * 2026-09-11). Un CV français et un CV anglais ne disent pas la même chose de
 * la même façon — l'anglais ne porte pas l'âge, ses intitulés de diplôme sont
 * glosés — et ce sont deux fichiers produits séparément par
 * `scripts/export-resume.sh`. Le chemin se résout donc par la langue, comme le
 * drapeau de la bascule.
 *
 * **Les PDF vivent dans `public/`, les sources non.** Les exports pèsent moins
 * d'un mégaoctet chacun, ils doivent arriver avec l'app qui les annonce, et
 * `.dockerignore` laisse passer `public/` — ils sont donc dans l'image. Les
 * sources Inkscape, elles, sont ignorées par git (`design/resume/`) : elles
 * n'ont pas vocation à vivre dans l'app, même partage que Blender, dont le
 * `.glb` est suivi et le `.blend` pas.
 *
 * **Le nom du fichier téléchargé n'est PAS celui de l'URL**, et c'est ce que
 * l'attribut `download` permet. L'URL peut rester interne et stable ;
 * ce que le visiteur retrouve dans son dossier de téléchargements porte son
 * nom à lui. Un recruteur qui reçoit `cv-fr.pdf` parmi trente autres ne sait
 * plus de qui il parle.
 *
 * **Le piège : rien ne signale un chemin mort.** Un `<a download>` vers un
 * fichier absent ne lève aucune erreur exploitable — le navigateur ouvre une
 * page 404 ou télécharge le HTML de l'app, selon le serveur. C'est le même
 * silence qu'un `@font-face` vers un fichier absent, et `tests/resume.test.ts`
 * est ce qui parle à sa place.
 */

import type { Locale } from '@/lib/locale'

/** Le PDF servi pour chaque langue. Typé par `Locale` : ajouter une langue ne
 *  compile pas tant qu'elle n'a pas son document. */
export const RESUME_PDF: Record<Locale, string> = {
  fr: '/resume/cv-fr.pdf',
  en: '/resume/cv-en.pdf',
}

/**
 * Ce que le visiteur voit dans son dossier de téléchargements.
 *
 * Le nom porte celui de l'auteur, parce que c'est le seul contexte que le
 * fichier emporte avec lui. Sans tiret bas ni espace : un nom de fichier
 * traverse des systèmes qui ne les traitent pas tous pareil.
 */
export const RESUME_FILENAME: Record<Locale, string> = {
  fr: 'CV-Thibault-Dubois.pdf',
  en: 'Resume-Thibault-Dubois.pdf',
}
