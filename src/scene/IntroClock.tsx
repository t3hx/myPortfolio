import { useEffect } from 'react'
import { CAMERA_STOPS } from '@/config/cameraStops'
import { INTRO_BUBBLE_DELAY_MS, INTRO_DELAY_MS, INTRO_HOME_STOP } from '@/config/intro'
import { reducedMotion } from '@/lib/clock'
import { INTRO_DURATION_S, introOpening, introTime, isSkipGesture } from '@/lib/intro'
import { stopParamIndex } from '@/lib/viewMode'
import { useInteraction } from '@/state/interaction'

/**
 * Le pilote de l'intro (#143). Ne rend rien : il fait avancer l'état du store
 * — départ, dernière image, libération de la bulle — et consomme le geste de
 * saut. Le dessin (#144 à #146) lit `introTime()` dans sa propre boucle
 * d'images ; rien ici ne republie T par React, ce qui coûterait un rendu par
 * image à côté d'une scène 3D.
 *
 * Quatre règles, toutes vérifiées dans `tests/intro.test.ts` :
 *
 * - **Elle démarre une petite latence après la découverte**, jamais sur la
 *   même image : `INTRO_DELAY_MS` après `revealed`.
 * - **Elle s'ouvre sur la dernière image** sous `prefers-reduced-motion`, ou
 *   quand un lien direct fait commencer la visite ailleurs qu'à Home.
 * - **Le geste de saut est pris AVANT le rig.** `CameraRig` écoute la molette
 *   sur `.stage` et Échap sur `window`, en phase de bouillonnement ; un
 *   écouteur en phase de capture sur `window` passe avant les deux, et
 *   `stopImmediatePropagation` fait que le même geste ne fait pas AUSSI un pas
 *   vers Desk.
 * - **La bulle attend une seconde** après la dernière image
 *   (`INTRO_BUBBLE_DELAY_MS`) — sauf quand l'intro s'ouvre déjà dessus, où il
 *   n'y a rien à laisser respirer.
 */
export function IntroClock() {
  const ready = useInteraction((s) => s.ready)
  const revealed = useInteraction((s) => s.revealed)
  const startedAt = useInteraction((s) => s.introStartedAt)
  const done = useInteraction((s) => s.introDone)
  const released = useInteraction((s) => s.introReleased)

  // L'ouverture : jouer, ou se poser d'emblée sur la dernière image.
  useEffect(() => {
    if (!ready || startedAt !== null || done) return
    const initial = stopParamIndex()
    const startsAtHome = initial === null || CAMERA_STOPS[initial]?.label === INTRO_HOME_STOP
    if (introOpening({ reducedMotion: reducedMotion(), startsAtHome }) === 'settle') {
      const { finishIntro, releaseIntro } = useInteraction.getState()
      finishIntro()
      releaseIntro()
      return
    }
    if (!revealed) return
    const timer = window.setTimeout(
      () => useInteraction.getState().startIntro(performance.now()),
      INTRO_DELAY_MS,
    )
    return () => window.clearTimeout(timer)
  }, [ready, revealed, startedAt, done])

  // La course : une boucle d'images qui ne fait qu'attendre T = 20.
  useEffect(() => {
    if (startedAt === null || done) return
    let frame = 0
    const tick = () => {
      if (introTime(useInteraction.getState(), performance.now()) >= INTRO_DURATION_S) {
        useInteraction.getState().finishIntro()
        return
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [startedAt, done])

  // La libération : la bulle parle une seconde après la dernière image.
  useEffect(() => {
    if (!done || released) return
    const timer = window.setTimeout(
      () => useInteraction.getState().releaseIntro(),
      INTRO_BUBBLE_DELAY_MS,
    )
    return () => window.clearTimeout(timer)
  }, [done, released])

  // Le geste de saut, consommé avant le rig.
  useEffect(() => {
    if (startedAt === null || done) return
    const onGesture = (e: WheelEvent | KeyboardEvent) => {
      const s = useInteraction.getState()
      const atHome = s.phase === 'parked' && CAMERA_STOPS[s.stopIndex]?.label === INTRO_HOME_STOP
      const skip = isSkipGesture(
        { type: e.type, key: 'key' in e ? e.key : undefined },
        { running: !s.introDone, atHome },
      )
      if (!skip) return
      e.preventDefault()
      e.stopImmediatePropagation()
      s.finishIntro()
    }
    window.addEventListener('wheel', onGesture, { capture: true, passive: false })
    window.addEventListener('keydown', onGesture, { capture: true })
    return () => {
      window.removeEventListener('wheel', onGesture, { capture: true })
      window.removeEventListener('keydown', onGesture, { capture: true })
    }
  }, [startedAt, done])

  return null
}
