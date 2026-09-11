import { existsSync, readFileSync, statSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { RESUME_FILENAME, RESUME_PDF } from '@/config/resume'
import { CV } from '@/content/cv'
import { LOCALES, t } from '@/lib/locale'

/**
 * Le CV en PDF (#159, #160).
 *
 * **Rien ne signale un chemin mort.** Un `<a download>` vers un fichier absent
 * ne lève aucune erreur exploitable : selon le serveur, le navigateur ouvre une
 * 404 ou télécharge le HTML de l'app sous un nom de PDF. C'est le même silence
 * qu'un `@font-face` vers un fichier absent (#140) et qu'un masque manquant
 * (#168), et c'est ce fichier qui parle à leur place.
 */

const composant = readFileSync('src/ui/ResumeDownload.tsx', 'utf8')
const scene = readFileSync('src/ui/CvScreen.tsx', 'utf8')
const classique = readFileSync('src/ui/ClassicApp.tsx', 'utf8')

/** Un CV s'envoie par courriel et se dépose dans des formulaires qui plafonnent
 *  souvent à un mégaoctet. Dépasser n'est pas un détail, c'est un envoi refusé.
 *  `scripts/export-resume.sh` refuse déjà de produire au-dessus ; ici on vérifie
 *  ce qui est RÉELLEMENT versionné. */
const LIMITE_OCTETS = 1_048_576

describe('les documents', () => {
  it('existent, pour chaque langue', () => {
    for (const locale of LOCALES) {
      const chemin = RESUME_PDF[locale]
      expect(chemin, locale).toMatch(/^\/resume\/.+\.pdf$/)
      expect(existsSync(`public${chemin}`), `public${chemin}`).toBe(true)
    }
  })

  it('tiennent sous le mégaoctet', () => {
    for (const locale of LOCALES) {
      const octets = statSync(`public${RESUME_PDF[locale]}`).size
      expect(octets, `${locale} : ${Math.round(octets / 1024)} Ko`).toBeLessThanOrEqual(
        LIMITE_OCTETS,
      )
    }
  })

  it('sont vraiment des PDF', () => {
    // Un fichier renommé en `.pdf` se télécharge sans broncher et ne s'ouvre
    // nulle part. Les cinq premiers octets le disent.
    for (const locale of LOCALES) {
      const tête = readFileSync(`public${RESUME_PDF[locale]}`).subarray(0, 5).toString('latin1')
      expect(tête, locale).toBe('%PDF-')
    }
  })

  it('ne portent pas deux fois le même document', () => {
    // Deux langues qui pointent le même fichier, c'est une traduction oubliée
    // que rien ne dirait : le lien marcherait, dans la mauvaise langue.
    expect(new Set(Object.values(RESUME_PDF)).size).toBe(LOCALES.length)
  })

  it('arrivent dans le dossier de téléchargements sous un nom qui dit de qui on parle', () => {
    // Le nom du fichier enregistré est indépendant de l'URL, et c'est tout
    // l'intérêt : l'adresse reste interne, le fichier voyage avec son contexte.
    // Un recruteur qui reçoit `cv-fr.pdf` parmi trente autres ne sait plus de
    // qui il s'agit.
    const famille = CV.identity.name.split(' ').at(-1)!
    for (const locale of LOCALES) {
      const nom = RESUME_FILENAME[locale]
      expect(nom, locale).toMatch(/\.pdf$/)
      expect(nom, `${locale} : ${nom}`).toContain(famille)
      // Ni espace ni tiret bas : un nom de fichier traverse des systèmes qui
      // ne les traitent pas tous de la même façon.
      expect(nom, locale).not.toMatch(/[\s_]/)
    }
  })
})

describe('le lien', () => {
  it('est un `<a download>`, sans JavaScript', () => {
    // Rien à intercepter, rien à empêcher, et le clic milieu marche.
    expect(composant).toContain('download={RESUME_FILENAME[locale]}')
    expect(composant).not.toContain('onClick')
  })

  it('est le MÊME composant dans les deux expériences', () => {
    // Deux liens recopiés auraient divergé au premier changement, et le plus
    // probable serait le pire : une langue servant le document de l'autre.
    // Même discipline que `LangToggle` (#29) et que `Mark` (#169).
    expect(scene).toContain('<ResumeDownload locale={locale} className="cv__download" />')
    expect(classique).toContain('<ResumeDownload locale={locale} className="classic-download" />')
  })

  it('dit ce qu’il fait, dans les deux langues', () => {
    for (const locale of LOCALES) {
      expect(t(CV.downloadLabel, locale).trim(), locale).not.toBe('')
    }
  })

  it('a son anatomie dans les deux systèmes de design', () => {
    // Chaque surface donne ses pixels ; ce qui est partagé, c'est la décision.
    expect(readFileSync('src/styles/tokens.css', 'utf8')).toContain('.cv__download')
    expect(readFileSync('src/styles/classic.css', 'utf8')).toContain('.classic-download')
  })

  it('n’ajoute pas une rangée au-dessus du CV', () => {
    // Le haut du CV ne bouge jamais (`.cv::before`, entretoise incompressible).
    // Le lien partage donc la ligne du nom : composé en 11 px contre 30, il
    // tient dans l'interligne déjà réservé.
    const tokens = readFileSync('src/styles/tokens.css', 'utf8')
    const règle = tokens.slice(tokens.indexOf('.cv__head {'), tokens.indexOf('.cv__name {'))
    expect(règle).toMatch(/display:\s*flex/)
    expect(scene).toContain('<div className="cv__head">')
  })
})

describe('la livraison', () => {
  it('embarque les PDF dans l’image, et laisse les sources dehors', () => {
    // `.dockerignore` est STRUCTUREL : le build ne lit que `src/`, `public/`,
    // `index.html` et les manifestes. Les PDF sont dans `public/`, donc dedans ;
    // les sources Inkscape sont dans `design/`, donc dehors — et en plus
    // ignorées par git, comme le `.blend` de Blender.
    const docker = readFileSync('.dockerignore', 'utf8')
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#'))
    expect(docker).not.toContain('public')
    expect(docker).toContain('design')
    expect(readFileSync('.gitignore', 'utf8')).toContain('design/resume/')
  })
})
