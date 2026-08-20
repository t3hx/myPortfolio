import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'
import { CAMERA_STOPS } from '@/config/cameraStops'
import { REFS_DIR, captureStop, ceilingFor, diffAgainstReference } from './renderComparison'

/**
 * Chaque arrêt du tour comparé à son rendu Blender (#45, #46).
 *
 * La liste vient de `CAMERA_STOPS` : ajouter un arrêt ajoute son test, et
 * personne n'a à penser à l'écrire. Un arrêt sans référence ÉCHOUE au lieu
 * d'être sauté — un test silencieusement absent couvre exactement autant que
 * pas de test, mais donne l'impression du contraire.
 */
for (const stop of CAMERA_STOPS) {
  const label = stop.label.toLowerCase()

  test(`l'arrêt ${stop.label} rend comme sa référence Blender`, async ({ page }, testInfo) => {
    const refPath = join(REFS_DIR, `${label}.png`)
    expect(
      existsSync(refPath),
      `référence manquante : ${refPath} — re-rendre l'arrêt depuis Blender`,
    ).toBe(true)

    const shot = await captureStop(page, stop.label)
    const result = diffAgainstReference(shot, label)

    // L'image de différence part avec le rapport : un taux tout seul ne dit pas
    // OÙ ça a bougé, et c'est la seule chose qu'on veut savoir en CI.
    await testInfo.attach(`${label}-actual`, {
      path: result.actualPath,
      contentType: 'image/png',
    })
    if (result.diffPath) {
      await testInfo.attach(`${label}-diff`, {
        path: result.diffPath,
        contentType: 'image/png',
      })
    }

    const { maxRatio, deviation } = ceilingFor(label)

    // Le taux est écrit dans le rapport même au vert : c'est lui qui permettra
    // de resserrer la tolérance le jour où le rendu se rapprochera. L'écart
    // connu, lui, est répété à chaque exécution — une exception qu'on ne relit
    // jamais devient une exception permanente.
    testInfo.annotations.push({
      type: 'écart',
      description: `${(result.ratio * 100).toFixed(3)} % (${result.differing} px sur ${result.total})`,
    })
    if (deviation) {
      testInfo.annotations.push({
        type: 'écart connu',
        description:
          deviation.kind === 'tracked'
            ? `${deviation.reason} — plafond porté à ${(maxRatio * 100).toFixed(1)} %`
            : deviation.reason,
      })
    }

    // La capture et son diff sont déjà écrits et attachés : l'arrêt reste
    // documenté même quand il n'est pas comparable. Ce qui s'arrête ici, c'est
    // la CONCLUSION — un plafond assez haut pour absorber un écart de cette
    // taille rendrait un vert sur un arrêt que plus personne ne vérifie.
    if (deviation?.kind === 'unverified') {
      test.fixme(true, `${label} non vérifié : ${deviation.reason}`)
    }

    expect(
      result.ratio,
      `${label} : ${(result.ratio * 100).toFixed(3)} % de pixels différents, ` +
        `plafond ${(maxRatio * 100).toFixed(1)} %` +
        (deviation ? ` (écart connu : ${deviation.reason})` : '') +
        (result.diffPath ? ` — voir ${result.diffPath}` : ''),
    ).toBeLessThanOrEqual(maxRatio)
  })
}
