import { describe, expect, it } from 'vitest'
import { parseStopParam } from '@/lib/viewMode'
import { CAMERA_STOPS } from '@/config/cameraStops'

/**
 * `?stop=` a deux familles de cibles depuis #97 : les arrêts du tour, et la
 * VUE LUNE — qui n'est pas un arrêt (#113) mais reste adressable, parce que la
 * boucle de comparaison a besoin d'un chemin déterministe vers elle et que
 * `?stop=Moon` était un lien valide et partageable avant que la lune ne quitte
 * le tour. Le parseur est pur pour que ces règles se vérifient en Node.
 */
describe('parseStopParam', () => {
  it('répond « none » sans paramètre ou avec une valeur vide', () => {
    expect(parseStopParam(null)).toEqual({ kind: 'none' })
    expect(parseStopParam('')).toEqual({ kind: 'none' })
  })

  it('retrouve un arrêt par son label, insensible à la casse', () => {
    expect(parseStopParam('Home')).toEqual({ kind: 'stop', index: 0 })
    expect(parseStopParam('telescope')).toEqual({
      kind: 'stop',
      index: CAMERA_STOPS.findIndex((s) => s.label === 'Telescope'),
    })
  })

  it('accepte un préfixe, premier arrêt gagnant', () => {
    expect(parseStopParam('book')).toEqual({
      kind: 'stop',
      index: CAMERA_STOPS.findIndex((s) => s.label === 'Bookshelf'),
    })
  })

  it('reconnaît la vue lune — le lien cassé par #113 redevient valide', () => {
    expect(parseStopParam('moon')).toEqual({ kind: 'moon' })
    expect(parseStopParam('Moon')).toEqual({ kind: 'moon' })
    // l'ancien nom complet du nœud caméra, pour les liens historiques
    expect(parseStopParam('telescopemoon')).toEqual({ kind: 'moon' })
  })

  it('un arrêt du tour prime sur la lune à préfixe égal', () => {
    // « t » et « tele » désignent Telescope, jamais TelescopeMoon : le tour
    // d'abord, l'excursion ensuite — même priorité que dans l'app.
    expect(parseStopParam('tele')).toEqual({
      kind: 'stop',
      index: CAMERA_STOPS.findIndex((s) => s.label === 'Telescope'),
    })
  })

  it('classe le reste en « unknown », valeur conservée pour le warning', () => {
    expect(parseStopParam('nope')).toEqual({ kind: 'unknown', value: 'nope' })
  })
})
