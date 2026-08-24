import { useFrame, useThree } from '@react-three/fiber'
import gsap from 'gsap'
import { useEffect, useRef } from 'react'
import { PerspectiveCamera, Quaternion, Vector3 } from 'three'
import { applyProgress, nextStopIndex, verticalFov, type StopTransform } from '@/lib/stops'
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
// Un SAUT (barre de menu, rail du HUD) ne suit pas le parcours : il va droit à
// l'arrêt visé. Un peu plus long qu'un pas, parce qu'il couvre en général plus
// de distance — mais une seule course, donc lisible d'un bout à l'autre.
const JUMP_DURATION = 1.6
const JUMP_EASE = 'power2.inOut'
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
  /**
   * La pose d'arrivée de l'excursion du télescope — `CameraStop_TelescopeMoon`,
   * lue dans le `.glb` mais **hors tour** (#113).
   *
   * Passée en propriété plutôt que reprise dans `stops`, parce que c'est la
   * seule façon de dire qu'elle n'est PAS une étape : tant qu'elle fermait le
   * tableau, l'excursion la prenait par `stops[stops.length - 1]` et suivait
   * donc l'ORDRE du tour. Réordonner `CAMERA_STOPS` — geste que le fichier
   * encourage explicitement — repointait l'excursion sur un autre objet, sans
   * erreur et sans avertissement.
   *
   * `null` si la caméra manque au `.glb` : `readStopTransform()` a déjà crié,
   * et le télescope se contente alors de ne pas décoller.
   */
  moon: StopTransform | null
}

export function CameraRig({ stops, moon }: CameraRigProps) {
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
  // Le vol direct d'un saut, et le drapeau qui fait taire la boucle du tour
  // pendant qu'il écrit la caméra lui-même.
  const flight = useRef<gsap.core.Tween | null>(null)
  const flying = useRef(false)

  /** One fluid stroke to a stop. The only mover of `pos` during the tour. */
  function goToIndex(index: number, duration = STEP_DURATION) {
    const clamped = Math.min(Math.max(index, 0), stops.length - 1)
    if (clamped === targetIndex.current && !stroke.current) return
    targetIndex.current = clamped
    const store = useInteraction.getState()
    store.setPhase('touring')
    store.setStopIndex(clamped)
    stroke.current?.kill()
    // Un pas pendant un vol : le vol perd, mais il doit d'abord rendre la main
    // à la boucle, sinon `pos.p` avancerait sans que rien ne l'affiche.
    flight.current?.kill()
    flight.current = null
    flying.current = false
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

  /**
   * Un SAUT vers un arrêt quelconque : la caméra va DROIT à sa pose, sans
   * repasser par les arrêts intermédiaires.
   *
   * `goToIndex` interpole `pos.p`, une position continue sur la POLYLIGNE des
   * arrêts : aller de 9 à 0 traverse donc réellement 8, 7, 6… La caméra
   * rembobinait tout le parcours en 1,2 s, c'est-à-dire trop vite pour qu'on y
   * lise quoi que ce soit — et pour rien, puisqu'on a demandé un endroit précis.
   *
   * Le vol direct est impératif, sur le modèle de l'excursion du télescope :
   * il écrit la caméra lui-même, `flying` fait taire la boucle du tour pendant
   * ce temps, et `pos.p` n'est recalé sur l'arrêt visé qu'à l'arrivée — la
   * boucle reprend donc la main sur un état cohérent.
   *
   * Mesuré avant de l'écrire : entre deux arrêts éloignés, le segment droit
   * reste dans le volume de la pièce (tous les arrêts sont dedans et regardent
   * vers les murs). Le pire cas, Accueil → Scoreboard, frôle la bibliothèque
   * à mi-course sans la traverser.
   */
  function jumpToIndex(index: number) {
    const clamped = Math.min(Math.max(index, 0), stops.length - 1)
    const target = stops[clamped]
    if (!target) return
    stroke.current?.kill()
    stroke.current = null
    flight.current?.kill()

    const store = useInteraction.getState()
    store.setPhase('touring')
    // Comme `goToIndex` : l'item du menu s'allume au DÉPART, pas à l'arrivée.
    store.setStopIndex(clamped)
    targetIndex.current = clamped

    const fromP = camera.position.clone()
    const fromQ = camera.quaternion.clone()
    const fromFov = camera.fov
    const toFov = verticalFov(target.hfov, camera.aspect)
    const t = { v: 0 }
    flying.current = true
    flight.current = gsap.to(t, {
      v: 1,
      duration: JUMP_DURATION,
      ease: JUMP_EASE,
      onUpdate: () => {
        camera.position.lerpVectors(fromP, target.position, t.v)
        camera.quaternion.copy(fromQ).slerp(target.quaternion, t.v)
        camera.fov = fromFov + (toFov - fromFov) * t.v
        camera.updateProjectionMatrix()
      },
      onComplete: () => {
        flight.current = null
        flying.current = false
        // La boucle du tour reprend ICI, et sur la bonne case : sans ce recalage
        // le premier défilement repartirait de l'arrêt qu'on avait quitté.
        pos.p = clamped
        useInteraction.getState().setPhase('parked')
        armed.current = true
        acc.current = 0
        tailMode.current = true
      },
    })
  }

  /**
   * Un PAS dans le tour, dans la direction donnée.
   *
   * Deux mouvements différents sortent d'ici, et c'est voulu. Un pas vers un
   * arrêt voisin suit le parcours (`goToIndex`) — sur un segment, la polyligne
   * EST la droite. Le bouclage du dernier arrêt vers le premier, lui, n'est pas
   * un pas voisin : passé par `pos.p`, il rembobinerait toute la pièce à
   * l'envers, ce qui est précisément le mouvement illisible qu'un saut de menu
   * a cessé de produire. Il part donc en vol direct.
   */
  function stepBy(dir: 1 | -1) {
    const from = targetIndex.current
    const next = nextStopIndex(from, dir, stops.length)
    if (next === null) return
    // Un pas vers un arrêt VOISIN suit le parcours ; le bouclage, lui, n'est
    // pas voisin et part en vol direct.
    if (Math.abs(next - from) === 1) goToIndex(next)
    else jumpToIndex(next)
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
        stepBy(Math.sign(acc.current) as 1 | -1)
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
      stepBy(forward ? 1 : -1)
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
      if (stops.length === 0 || !moon) return

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
              // La lune est ARRIVÉE. C'est ce moment-là que l'encadré attend,
              // et pas l'ouverture de la visée : entre les deux, on regarde un
              // ciel lointain, et une phrase sur la lune y désignerait un
              // sujet qu'on ne voit pas encore.
              onComplete: () => useInteraction.getState().revealMoon(),
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
            // La lune redevient stylisée ICI, et pas à la touche `Échap` : à
            // l'instant de la sortie elle remplit encore l'écran, et l'échange
            // s'y verrait autant qu'au clic. À la fin du retour, elle est
            // redevenue un petit disque dans la fenêtre.
            useInteraction.getState().showDetailedMoon(false)
          },
        })
      }
    })
    return unsub
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stops, moon, camera])

  // --- Per-frame: ONE camera write, owned by the current phase ------------------------
  useFrame(() => {
    if (stops.length === 0) return
    const { phase, consumeStopRequest } = useInteraction.getState()

    // HUD-requested jumps (stop rail clicks).
    // Les sauts — barre de menu, rail du HUD — vont DROIT au but. Un pas de
    // molette ou de flèche continue de suivre le parcours, ce qui revient au
    // même sur un segment : entre deux arrêts voisins, la polyligne EST la
    // droite.
    const requested = consumeStopRequest()
    if (requested !== null && (phase === 'touring' || phase === 'parked')) {
      jumpToIndex(requested)
    }

    // La sonde est écrite AVANT les sorties anticipées, sinon elle se fige à
    // l'état d'avant pendant tout ce qui ne passe pas par la boucle du tour —
    // un vol direct, une excursion — et raconte que rien ne bouge au moment
    // précis où on la lit pour savoir ce qui bouge. Mesuré : elle annonçait
    // encore l'arrêt de départ pendant les 1,6 s d'un saut.
    if (import.meta.env.DEV) {
      ;(window as unknown as Record<string, unknown>).__rigDebug = {
        p: pos.p,
        target: targetIndex.current,
        phase,
        stroking: !!stroke.current,
        flying: flying.current,
      }
    }

    // PANEL_OPEN / TELESCOPE own the camera (frozen or excursion tween).
    if (phase === 'panel' || phase === 'telescope' || returning.current || flying.current) return

    applyProgress(camera, stops, pos.p)
  })

  return null
}
