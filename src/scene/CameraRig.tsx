import { useFrame, useThree } from '@react-three/fiber'
import gsap from 'gsap'
import { useEffect, useRef } from 'react'
import { PerspectiveCamera, Quaternion, Vector3 } from 'three'
import { applyProgress, verticalFov, type StopTransform } from '@/lib/stops'
import { stopParamIndex } from '@/lib/viewMode'
import { useInteraction } from '@/state/interaction'
import {
  TELESCOPE_APPROACH_HFOV,
  TELESCOPE_APPROACH_S,
  TELESCOPE_EYEPIECE_BACK,
  TELESCOPE_FOV_PAD,
  TELESCOPE_ZOOM_S,
} from '@/config/telescope'

/**
 * Stop-to-stop camera navigation — the interaction model chosen after user
 * testing (2026-08-05): a scroll gesture is a COMMAND ("go to the next stop"),
 * not a position input. One gesture → ONE fluid stroke to the destination,
 * driven by a single GSAP tween. No virtual scroll rail, no damping chase,
 * no settle phase — the "second movement on arrival" of the scrub model is
 * structurally impossible here because there is only one easing curve.
 *
 *   wheel flick / hold  ──►  gesture detector  ──►  goToIndex(current ± 1)
 *   arrow keys / rail clicks ────────────────────►  goToIndex(i)
 *   ?stop= deep link ────────────────────────────►  instant applyProgress
 *
 * Gesture rules (trackpad momentum-proof):
 *   - accumulated wheel delta ≥ GESTURE_THRESHOLD fires a step, then the
 *     gesture is CONSUMED: its momentum tail can never fire a second step
 *   - a gesture closes after GESTURE_RESET_MS of silence, or when the stroke
 *     completes — so a deliberate held scroll chains stops one by one, while
 *     a flick moves exactly one
 */

// --- Feel tuning ----------------------------------------------------------------------
const STEP_DURATION = 1.2 // seconds per stop-to-stop stroke
// Marked acceleration/deceleration: long slow ends, franc through the middle.
// Try 'power2.inOut' (softer) or 'expo.inOut' (most dramatic) to taste.
const STEP_EASE = 'power3.inOut'
const GESTURE_THRESHOLD_PX = 65 // accumulated wheel delta that fires a step
const GESTURE_RESET_MS = 250 // silence that closes a gesture
const MIN_COUNTED_DELTA = 6 // ignore sub-pixel jitter only — gentle trackpad
// swipes emit 5-20px deltas and MUST count (28 used to eat whole gestures)
// After a stroke completes, the SAME gesture's dying momentum tail keeps
// emitting: only events above this fraction of the gesture's peak count
// again. Peak-proportional, so gentle held scrolls (low peak) still chain.
const TAIL_GUARD_RATIO = 0.35

interface CameraRigProps {
  stops: StopTransform[]
}

export function CameraRig({ stops }: CameraRigProps) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera
  const glDom = useThree((s) => s.gl.domElement)

  // Continuous tour position in segment space [0, N-1]; the single source of
  // truth the camera renders from.
  const pos = useRef({ p: 0 }).current
  const targetIndex = useRef(0)
  const stroke = useRef<gsap.core.Tween | null>(null)
  // Gesture detector state (refs: the stroke's onComplete re-arms it).
  const acc = useRef(0)
  const armed = useRef(true)
  const prevAbs = useRef(0)
  const prevSign = useRef(0)
  const tailMode = useRef(false) // re-armed by stroke completion, same gesture

  /** One fluid stroke to a stop. The only mover of `pos` during the tour. */
  function goToIndex(index: number, duration = STEP_DURATION) {
    const clamped = Math.min(Math.max(index, 0), stops.length - 1)
    if (clamped === targetIndex.current && !stroke.current) return
    targetIndex.current = clamped
    const store = useInteraction.getState()
    store.setPhase('touring')
    store.setStopIndex(clamped)
    stroke.current?.kill()
    stroke.current = gsap.to(pos, {
      p: clamped,
      duration,
      ease: STEP_EASE,
      onComplete: () => {
        stroke.current = null
        useInteraction.getState().setPhase('parked')
        // Re-arm the gesture detector: a HELD deliberate scroll chains the
        // next stop from here. tailMode guards against the same gesture's
        // dying momentum tail counting as new input.
        armed.current = true
        acc.current = 0
        tailMode.current = true
      },
    })
  }

  // --- Input: owned wheel with gesture detection + keyboard ---------------------------
  useEffect(() => {
    if (stops.length === 0) return
    const stage = glDom.closest('.stage') ?? glDom.parentElement ?? glDom
    const store = useInteraction.getState

    let lastEventAt = 0

    const onWheel = (e: WheelEvent) => {
      // Panels own their wheel natively — never intercept it.
      if (e.target instanceof Element && e.target.closest('.panel')) return
      const { phase } = store()
      if (phase !== 'touring' && phase !== 'parked') return
      e.preventDefault()

      const now = performance.now()
      // A silence closes the gesture — but ONLY between strokes. Everything
      // mid-stroke below is deliberately CLOCK-FREE: event delivery timing is
      // unreliable under jank, while the SHAPE of momentum is not (it decays,
      // never exceeds its peak, never reverses).
      if (now - lastEventAt > GESTURE_RESET_MS && !stroke.current) {
        acc.current = 0
        armed.current = true
        prevAbs.current = 0 // gesture peak
        prevSign.current = 0
        tailMode.current = false
      }
      lastEventAt = now

      const delta = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY
      const abs = Math.abs(delta)
      if (import.meta.env.DEV) {
        const w = window as unknown as { __wheelLog?: unknown[] }
        w.__wheelLog ??= []
        w.__wheelLog.push({
          delta,
          acc: acc.current,
          armed: armed.current,
          peak: prevAbs.current,
          tail: tailMode.current,
        })
        if (w.__wheelLog.length > 50) w.__wheelLog.shift()
      }
      if (abs < MIN_COUNTED_DELTA) return

      // Fresh human intent = direction change, or a delta EXCEEDING the
      // gesture's peak so far (momentum can only decay below it).
      const reversed = prevSign.current !== 0 && Math.sign(delta) !== prevSign.current
      const spiking = abs > prevAbs.current * 1.1
      if (reversed || spiking) tailMode.current = false
      // Same gesture continuing after its stroke completed: a dying tail sits
      // far below the gesture peak — a deliberate held scroll stays near it.
      if (tailMode.current && abs < prevAbs.current * TAIL_GUARD_RATIO) return
      prevSign.current = Math.sign(delta)
      prevAbs.current = reversed ? abs : Math.max(prevAbs.current, abs)
      if (reversed) {
        armed.current = true
        acc.current = 0
      } else if (spiking) {
        armed.current = true
      }
      if (!armed.current) return

      acc.current += delta
      if (Math.abs(acc.current) >= GESTURE_THRESHOLD_PX) {
        goToIndex(targetIndex.current + Math.sign(acc.current))
        acc.current = 0
        armed.current = false
      }
    }

    const onKeyDown = (e: KeyboardEvent) => {
      const { phase, closePanel, exitTelescope } = store()
      if (e.key === 'Escape') {
        if (phase === 'panel') closePanel()
        if (phase === 'telescope') exitTelescope()
        return
      }
      // La barre de menu possède ses flèches (focus glissant d'un item à
      // l'autre) — pendant clavier de la règle `.panel` de la molette : chaque
      // surface qui a une navigation interne la garde pour elle.
      if (e.target instanceof Element && e.target.closest('.menu')) return
      if (phase !== 'touring' && phase !== 'parked') return
      const forward = ['ArrowDown', 'ArrowRight', 'PageDown'].includes(e.key)
      const backward = ['ArrowUp', 'ArrowLeft', 'PageUp'].includes(e.key)
      if (!forward && !backward) return
      e.preventDefault()
      goToIndex(targetIndex.current + (forward ? 1 : -1))
    }

    stage.addEventListener('wheel', onWheel as EventListener, { passive: false })
    window.addEventListener('keydown', onKeyDown)
    return () => {
      stage.removeEventListener('wheel', onWheel as EventListener)
      window.removeEventListener('keydown', onKeyDown)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [glDom, stops])

  // --- Placement initial (+ deep link ?stop=) : instantané, déterministe ---------------
  //
  // La phase compte autant que la pose. Elle démarre à TOURING et ne passait à
  // PARKED que par l'`onComplete` d'un tween — or le placement initial n'en
  // lance aucun. Un visiteur arrivait donc sur Accueil en phase TOURING, où
  // aucune bulle ne s'affiche : la phrase d'ouverture, « faites défiler pour
  // commencer la visite », restait invisible jusqu'au premier défilement…
  // qui quitte justement Accueil. Seul `?stop=` passait PARKED, ce qui rendait
  // le bug invisible à toutes les captures de la boucle de comparaison.
  useEffect(() => {
    if (stops.length === 0) return
    const target = stopParamIndex()
    const clamped = Math.min(Math.max(target ?? 0, 0), stops.length - 1)
    pos.p = clamped
    targetIndex.current = clamped
    applyProgress(camera, stops, clamped)
    useInteraction.getState().setStopIndex(clamped)
    useInteraction.getState().setPhase('parked')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stops, camera])

  // --- TELESCOPE phase: imperative camera excursion off the tour path -----------------
  const excursion = useRef<gsap.core.Tween | null>(null)
  const returning = useRef(false)
  const fromPos = useRef(new Vector3())
  const fromQuat = useRef(new Quaternion())

  useEffect(() => {
    const unsub = useInteraction.subscribe((state, prev) => {
      if (stops.length === 0) return
      const moon = stops[stops.length - 1]

      if (state.phase === 'telescope' && prev.phase !== 'telescope') {
        stroke.current?.kill()
        stroke.current = null
        excursion.current?.kill()
        fromPos.current.copy(camera.position)
        fromQuat.current.copy(camera.quaternion)
        const fromFov = camera.fov

        // L'OCULAIRE : la pose de la lune, reculée le long de son axe de visée.
        // Blender a déjà posé cette caméra à 58 cm du télescope, il n'y a donc
        // rien à ajouter à la scène — seulement à reculer.
        const eyePos = new Vector3(0, 0, 1)
          .applyQuaternion(moon.quaternion)
          .multiplyScalar(TELESCOPE_EYEPIECE_BACK)
          .add(moon.position)
        const eyeFov = verticalFov(TELESCOPE_APPROACH_HFOV, camera.aspect)
        const zoomFov = verticalFov(moon.hfov * TELESCOPE_FOV_PAD, camera.aspect)

        // DEUX TEMPS. En un seul vol, la caméra traversait l'instrument pour
        // finir en gros plan de lune, sans que rien ne dise qu'un télescope se
        // trouvait entre les deux. Ici on vient d'abord coller l'œil à
        // l'oculaire — c'est là que la visée s'ouvre — puis le second temps ne
        // fait plus que grossir, À L'INTÉRIEUR de la visée.
        const t = { v: 0 }
        excursion.current = gsap.to(t, {
          v: 1,
          duration: TELESCOPE_APPROACH_S,
          ease: 'power2.inOut',
          onUpdate: () => {
            camera.position.lerpVectors(fromPos.current, eyePos, t.v)
            camera.quaternion.copy(fromQuat.current).slerp(moon.quaternion, t.v)
            camera.fov = fromFov + (eyeFov - fromFov) * t.v
            camera.updateProjectionMatrix()
          },
          onComplete: () => {
            // La visée s'ouvre ICI : on est derrière l'oculaire, et le
            // grossissement qui suit se produit dans le cache circulaire.
            useInteraction.getState().settleTelescope()
            const z = { v: 0 }
            excursion.current = gsap.to(z, {
              v: 1,
              duration: TELESCOPE_ZOOM_S,
              ease: 'power2.inOut',
              onUpdate: () => {
                camera.position.lerpVectors(eyePos, moon.position, z.v)
                camera.fov = eyeFov + (zoomFov - eyeFov) * z.v
                camera.updateProjectionMatrix()
              },
            })
          },
        })
      }

      if (prev.phase === 'telescope' && state.phase !== 'telescope') {
        excursion.current?.kill()
        returning.current = true
        const backPos = camera.position.clone()
        const backQuat = camera.quaternion.clone()
        const backFov = camera.fov
        // Sample where the tour currently points. The scratch camera must
        // carry the REAL viewport aspect, or applyProgress would compute its
        // vertical fov for a square frame and the return would land zoomed.
        const railCam = new PerspectiveCamera()
        railCam.aspect = camera.aspect
        applyProgress(railCam, stops, pos.p)
        const t = { v: 0 }
        excursion.current = gsap.to(t, {
          v: 1,
          duration: 1.2,
          ease: 'power2.inOut',
          onUpdate: () => {
            camera.position.lerpVectors(backPos, railCam.position, t.v)
            camera.quaternion.copy(backQuat).slerp(railCam.quaternion, t.v)
            camera.fov = backFov + (railCam.fov - backFov) * t.v
            camera.updateProjectionMatrix()
          },
          onComplete: () => {
            returning.current = false
          },
        })
      }
    })
    return unsub
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stops, camera])

  // --- Per-frame: ONE camera write, owned by the current phase ------------------------
  useFrame(() => {
    if (stops.length === 0) return
    const { phase, consumeStopRequest } = useInteraction.getState()

    // HUD-requested jumps (stop rail clicks).
    const requested = consumeStopRequest()
    if (requested !== null && (phase === 'touring' || phase === 'parked')) {
      goToIndex(requested)
    }

    // PANEL_OPEN / TELESCOPE own the camera (frozen or excursion tween).
    if (phase === 'panel' || phase === 'telescope' || returning.current) return

    applyProgress(camera, stops, pos.p)

    if (import.meta.env.DEV) {
      ;(window as unknown as Record<string, unknown>).__rigDebug = {
        p: pos.p,
        target: targetIndex.current,
        phase,
        stroking: !!stroke.current,
      }
    }
  })

  return null
}
