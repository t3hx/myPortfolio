import { useFrame, useThree } from '@react-three/fiber'
import { useScroll } from '@react-three/drei'
import gsap from 'gsap'
import { useEffect, useMemo, useRef } from 'react'
import { PerspectiveCamera, Quaternion, Vector3 } from 'three'
import { applyProgress, type StopTransform } from '@/lib/stops'
import { stopParamIndex } from '@/lib/viewMode'
import { useInteraction } from '@/state/interaction'

/**
 * The scroll → camera orchestration locked in the design doc (eng-review issue 1):
 *
 *   wheel / touch / arrow keys
 *             │
 *             ▼
 *   drei ScrollControls (virtual damped scroll, offset 0→1)   ← single source of truth
 *             │  useScroll().offset, read every frame
 *             ▼
 *   useFrame(() => timeline.progress(offset))                 ← GSAP owns the easing
 *             │
 *             ▼
 *   applyProgress(camera)                                     ← one camera write per frame
 *
 * `offset` is READ-ONLY (derived from the hidden scroller's scrollTop), so the
 * snap mechanism tweens `el.scrollTop` through a proxy — drei's damping then
 * smooths the follow. This is risk point #1 from the spike scope.
 */

const SNAP_IDLE_MS = 220
// Segment-space distance under which we consider the camera parked. Loose on
// purpose: drei's damping is asymptotic and rests at its own epsilon.
const SNAP_EPSILON = 0.02
// If momentum ends within this fraction past a stop, settle back to it;
// otherwise keep going in the gesture's direction (never a visible reversal).
const DIRECTIONAL_TOLERANCE = 0.12

interface CameraRigProps {
  stops: StopTransform[]
}

export function CameraRig({ stops }: CameraRigProps) {
  const scroll = useScroll()
  const camera = useThree((s) => s.camera) as PerspectiveCamera

  // One GSAP timeline over a progress proxy: segment i tweens p from i to i+1
  // with power1.inOut — the scrub naturally lingers near stops and speeds up
  // between them. Scrubbed (never played) via tl.progress(offset).
  const proxy = useRef({ p: 0 }).current
  const tl = useMemo(() => {
    const t = gsap.timeline({ paused: true })
    for (let i = 0; i < stops.length - 1; i++) {
      t.to(proxy, { p: i + 1, duration: 1, ease: 'power1.inOut' }, i)
    }
    return t
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stops])

  const segments = Math.max(stops.length - 1, 1)
  const snapTween = useRef<gsap.core.Tween | null>(null)
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastInputAt = useRef(0)
  // The one true rail position (we own the wheel — see input wiring below).
  const railTarget = useRef(0)

  // ?stop= deep link: force the target progress until the damped offset has
  // caught up, so the first frames render the target stop deterministically
  // (no swoosh from stop 0) — required by the render-comparison loop.
  // Spike finding: drei's damping halts at its own epsilon BEFORE reaching a
  // far target (asymptotic approach), so a tight tolerance never releases.
  // Release on loose tolerance OR frame cap OR first user input.
  const override = useRef<number | null>(null)
  const overrideFrames = useRef(0)

  /** Deliberate navigation (keyboard, rail clicks): tween the scrollTop.
   *  No easing fight here — there is no user momentum to compete with. */
  function snapToIndex(index: number, duration = 0.9) {
    const el = scroll.el
    const clamped = Math.min(Math.max(index, 0), segments)
    const max = el.scrollHeight - el.clientHeight
    if (max <= 0) return
    snapTween.current?.kill()
    const state = { v: railTarget.current }
    snapTween.current = gsap.to(state, {
      v: (clamped / segments) * max,
      duration,
      ease: 'power2.out',
      onUpdate: () => {
        railTarget.current = state.v
        el.scrollTop = state.v
        el.dispatchEvent(new Event('scroll'))
      },
      onComplete: () => {
        snapTween.current = null
      },
    })
  }

  /** Inertia settle after free scrolling: ONE smoothing only. Write the target
   *  scrollTop instantly and let drei's damping glide the offset there —
   *  exponential, monotonic arrival by construction. A gsap tween here would
   *  compose two decelerations with drei's damping (and get killed/restarted
   *  by trackpad momentum events): that was the "saccadé" arrival bounce. */
  function settleToIndex(index: number) {
    const el = scroll.el
    const clamped = Math.min(Math.max(index, 0), segments)
    const max = el.scrollHeight - el.clientHeight
    if (max <= 0) return
    snapTween.current?.kill()
    snapTween.current = null
    railTarget.current = (clamped / segments) * max
    el.scrollTop = railTarget.current
    // Dispatch explicitly so drei retargets THIS frame (native scroll events
    // from programmatic writes arrive late) — same finding as the deep link.
    el.dispatchEvent(new Event('scroll'))
  }

  function nearestIndex(): number {
    return Math.round(scroll.offset * segments)
  }

  /** Where the user's RAW scroll actually is (offset lags behind damping). */
  function rawPos(): number {
    const el = scroll.el
    const max = el.scrollHeight - el.clientHeight
    return max > 0 ? (el.scrollTop / max) * segments : 0
  }

  /** Snap target honouring the gesture's direction: keep moving forward on a
   *  forward gesture (and vice versa); only settle back when momentum died a
   *  hair past a stop. Kills the "camera reverses on arrival" effect. */
  function directionalTarget(dir: number): number {
    const pos = rawPos()
    if (dir > 0) {
      const past = pos - Math.floor(pos)
      return past < DIRECTIONAL_TOLERANCE ? Math.floor(pos) : Math.ceil(pos)
    }
    if (dir < 0) {
      const short = Math.ceil(pos) - pos
      return short < DIRECTIONAL_TOLERANCE ? Math.ceil(pos) : Math.floor(pos)
    }
    return Math.round(pos)
  }

  // --- Input wiring: OWNED wheel (Lenis-style) + keyboard -----------------------------
  // Spike finding: letting the browser scroll natively adds a THIRD easing
  // layer — Chromium's smooth-scroll animation keeps writing scrollTop long
  // after the wheel events (late deliveries, clobbered programmatic writes,
  // post-settle drift). So the wheel is preventDefault'ed and we own the rail:
  // wheel deltas accumulate into a virtual target that WE write to scrollTop.
  // One owner, deterministic; drei's damping stays the single visual easing.
  useEffect(() => {
    const el = scroll.el
    const store = useInteraction.getState

    let gestureDir = 0

    const writeRail = (top: number) => {
      const max = el.scrollHeight - el.clientHeight
      railTarget.current = Math.min(Math.max(top, 0), max)
      el.scrollTop = railTarget.current
      el.dispatchEvent(new Event('scroll'))
    }

    const onWheel = (e: WheelEvent) => {
      const { phase } = store()
      if (phase !== 'touring' && phase !== 'parked') return
      e.preventDefault()
      const delta = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY
      if (delta !== 0) gestureDir = Math.sign(delta)
      lastInputAt.current = performance.now()
      // New user input cancels any in-flight snap and re-enters TOURING.
      override.current = null
      snapTween.current?.kill()
      snapTween.current = null
      if (phase === 'parked') store().setPhase('touring')
      writeRail(railTarget.current + delta)
      if (idleTimer.current) clearTimeout(idleTimer.current)
      idleTimer.current = setTimeout(() => {
        if (store().phase === 'touring') {
          settleToIndex(directionalTarget(gestureDir))
          gestureDir = 0
        }
      }, SNAP_IDLE_MS)
    }

    const onKeyDown = (e: KeyboardEvent) => {
      const { phase, closePanel, exitTelescope } = store()
      if (e.key === 'Escape') {
        if (phase === 'panel') closePanel()
        if (phase === 'telescope') exitTelescope()
        return
      }
      if (phase !== 'touring' && phase !== 'parked') return
      const forward = ['ArrowDown', 'ArrowRight', 'PageDown'].includes(e.key)
      const backward = ['ArrowUp', 'ArrowLeft', 'PageUp'].includes(e.key)
      if (!forward && !backward) return
      e.preventDefault()
      snapToIndex(nearestIndex() + (forward ? 1 : -1), 1.1)
    }

    // Non-passive: preventDefault is the whole point. Attached to the stage so
    // it catches wheel over the canvas AND the pass-through HUD zones; the
    // panel sits above in its own element, so its wheel never reaches us.
    const stage = el.parentElement ?? el
    stage.addEventListener('wheel', onWheel, { passive: false })
    window.addEventListener('keydown', onKeyDown)
    railTarget.current = el.scrollTop
    return () => {
      stage.removeEventListener('wheel', onWheel)
      window.removeEventListener('keydown', onKeyDown)
      if (idleTimer.current) clearTimeout(idleTimer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scroll.el, stops])

  // --- ?stop= deep link ---------------------------------------------------------------
  // Spike finding: the scroller has NO height on the mount frame (drei lays the
  // pages spacer out asynchronously), so an immediate scrollTop write clamps to
  // 0. Retry on rAF until the scroller is sized, holding the override meanwhile.
  useEffect(() => {
    const target = stopParamIndex()
    if (target === null || stops.length === 0) return
    override.current = target
    useInteraction.getState().setPhase('parked')
    useInteraction.getState().setStopIndex(target)

    // Two-part retry (both spike findings): (a) the scroller has no height on
    // the mount frame; (b) drei attaches its scroll listener a few frames later,
    // so a single write is never observed. Re-set + dispatch 'scroll' for a few
    // frames once sized, so drei reads the value whenever it starts listening.
    const el = scroll.el
    let raf = 0
    let tries = 0
    let settledFrames = 0
    const trySet = () => {
      const max = el.scrollHeight - el.clientHeight
      if (max > 0) {
        railTarget.current = (target / segments) * max
        el.scrollTop = railTarget.current
        el.dispatchEvent(new Event('scroll'))
        settledFrames += 1
        if (settledFrames >= 20) return
      }
      if (tries++ < 240) raf = requestAnimationFrame(trySet)
    }
    trySet()
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stops])

  // --- TELESCOPE phase: imperative camera excursion off the scroll rail ---------------
  const excursion = useRef<gsap.core.Tween | null>(null)
  const returning = useRef(false)
  const fromPos = useRef(new Vector3())
  const fromQuat = useRef(new Quaternion())

  useEffect(() => {
    const unsub = useInteraction.subscribe((state, prev) => {
      if (stops.length === 0) return
      const moon = stops[stops.length - 1]

      if (state.phase === 'telescope' && prev.phase !== 'telescope') {
        // Fly to the ocular (the Moon stop transform), scroll frozen by phase.
        excursion.current?.kill()
        fromPos.current.copy(camera.position)
        fromQuat.current.copy(camera.quaternion)
        const fromFov = camera.fov
        const t = { v: 0 }
        excursion.current = gsap.to(t, {
          v: 1,
          duration: 1.6,
          ease: 'power2.inOut',
          onUpdate: () => {
            camera.position.lerpVectors(fromPos.current, moon.position, t.v)
            camera.quaternion.copy(fromQuat.current).slerp(moon.quaternion, t.v)
            camera.fov = fromFov + (moon.fov - fromFov) * t.v
            camera.updateProjectionMatrix()
          },
        })
      }

      if (prev.phase === 'telescope' && state.phase !== 'telescope') {
        // Fly back to wherever the scroll rail currently points, then resume.
        excursion.current?.kill()
        returning.current = true
        const backPos = camera.position.clone()
        const backQuat = camera.quaternion.clone()
        const backFov = camera.fov
        const t = { v: 0 }
        tl.progress(scroll.offset)
        const railP = proxy.p
        const rail = { pos: new Vector3(), quat: new Quaternion(), fov: 45 }
        const railCam = new PerspectiveCamera()
        applyProgress(railCam, stops, railP)
        rail.pos.copy(railCam.position)
        rail.quat.copy(railCam.quaternion)
        rail.fov = railCam.fov
        excursion.current = gsap.to(t, {
          v: 1,
          duration: 1.2,
          ease: 'power2.inOut',
          onUpdate: () => {
            camera.position.lerpVectors(backPos, rail.pos, t.v)
            camera.quaternion.copy(backQuat).slerp(rail.quat, t.v)
            camera.fov = backFov + (rail.fov - backFov) * t.v
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
  }, [stops, camera, tl])

  // --- The per-frame contract: ONE camera write, owned by the current phase -----------
  useFrame(() => {
    if (stops.length === 0) return
    const { phase, setStopIndex, setPhase, consumeStopRequest } = useInteraction.getState()

    // HUD-requested jumps (stop rail clicks).
    const requested = consumeStopRequest()
    if (requested !== null && (phase === 'touring' || phase === 'parked')) {
      if (phase === 'parked') setPhase('touring')
      snapToIndex(requested, 1.1)
    }

    // PANEL_OPEN / TELESCOPE own the camera (frozen or excursion tween).
    if (phase === 'panel' || phase === 'telescope' || returning.current) return

    // Deep-link override: hold the target framing until damping catches up.
    if (override.current !== null) {
      const target = override.current / segments
      tl.progress(target)
      applyProgress(camera, stops, proxy.p)
      overrideFrames.current += 1
      if (Math.abs(scroll.offset - target) < 0.01 || overrideFrames.current > 120) {
        override.current = null
        overrideFrames.current = 0
      }
      return
    }

    // TOURING/PARKED: scrub the timeline with the damped offset.
    tl.progress(scroll.offset)
    applyProgress(camera, stops, proxy.p)

    const nearest = nearestIndex()
    setStopIndex(nearest)

    if (import.meta.env.DEV) {
      ;(window as unknown as Record<string, unknown>).__rigDebug = {
        offset: scroll.offset,
        raw: rawPos(),
        p: proxy.p,
        phase,
        nearest,
        snapTween: !!snapTween.current,
        override: override.current,
      }
    }

    // Park when the RAW rail rests on a stop and input has been quiet for a
    // beat. Never gate on tight damped-offset convergence: drei's damping is
    // asymptotic and its scroll-event delivery can lag, so an epsilon gate
    // either parks in transit or never parks. The visual glide finishes on its
    // own; PARKED only arms raycast/bubbles. The loose damped bound just keeps
    // bubbles from popping while the camera is still visibly travelling.
    const distRaw = Math.abs(rawPos() - nearest)
    const distDamped = Math.abs(scroll.offset * segments - nearest)
    const inputQuietMs = performance.now() - lastInputAt.current
    if (
      phase === 'touring' &&
      !snapTween.current &&
      distRaw < SNAP_EPSILON &&
      distDamped < 0.25 &&
      inputQuietMs > 400
    ) {
      setPhase('parked')
    }
  })

  return null
}
