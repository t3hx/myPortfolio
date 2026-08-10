import { useCallback, useState, type RefObject } from 'react'
import { Vector3 } from 'three'
import { CAMERA_STOPS } from '@/config/cameraStops'
import type { StopTransform } from '@/lib/stops'
import { Bubble } from '@/scene/Bubble'
import { CameraRig } from '@/scene/CameraRig'
import { Outlines } from '@/scene/Outlines'
import { RoomModel } from '@/scene/RoomModel'
import { useInteraction } from '@/state/interaction'

/**
 * Scene contents. Navigation is stop-to-stop (CameraRig owns the wheel and
 * commands GSAP strokes); panels keep their native wheel because the rig
 * ignores events targeting them.
 *
 * The Cat stop carries the demo <Bubble> (issue #47): screen-projection
 * anchoring, explicit portal to App3D's `.bubble-layer`, capped zIndexRange.
 * The bubble is purely narrative — it opens nothing; the panel's wheel
 * routing stays validated by the HUD's "Open panel" button. Per-stop
 * content/anchors are issue #48.
 */
interface ExperienceProps {
  /** Stable DOM layer OUTSIDE the ScrollControls scroller — see App.tsx. */
  bubbleLayer: RefObject<HTMLDivElement>
}

export function Experience({ bubbleLayer }: ExperienceProps) {
  const [stops, setStops] = useState<StopTransform[]>([])
  const phase = useInteraction((s) => s.phase)
  const stopIndex = useInteraction((s) => s.stopIndex)
  const setReady = useInteraction((s) => s.setReady)

  const onReady = useCallback(
    (ordered: StopTransform[]) => {
      setStops(ordered)
      setReady()
    },
    [setReady],
  )

  // Anchor the demo bubble 1.2 m in front of the Cat stop camera.
  const catIndex = CAMERA_STOPS.findIndex((s) => s.label === 'Cat')
  const cat = stops[catIndex]
  const bubblePos = cat
    ? new Vector3(0, 0, -1.2).applyQuaternion(cat.quaternion).add(cat.position)
    : null
  const bubbleVisible = phase === 'parked' && stopIndex === catIndex

  return (
    <>
      <RoomModel onReady={onReady} />

      {/* Stop-to-stop navigation model (2026-08-05): no ScrollControls — the
          wheel is owned and gestures command GSAP strokes; see CameraRig. */}
      {stops.length > 0 && <CameraRig stops={stops} />}

      {/* Contours spike: ?outline=off|hull|edges|both — see Outlines.tsx. */}
      {stops.length > 0 && <Outlines />}

      {bubblePos && (
        <Bubble
          anchor={bubblePos}
          portal={bubbleLayer}
          visible={bubbleVisible}
          kicker={`${String(catIndex + 1).padStart(2, '0')} — ${CAMERA_STOPS[catIndex].label}`}
        >
          {CAMERA_STOPS[catIndex].caption}
        </Bubble>
      )}
    </>
  )
}
