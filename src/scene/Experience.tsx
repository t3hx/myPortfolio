import { Html, ScrollControls } from '@react-three/drei'
import { useCallback, useState, type RefObject } from 'react'
import { Vector3 } from 'three'
import { CAMERA_STOPS } from '@/config/cameraStops'
import type { StopTransform } from '@/lib/stops'
import { CameraRig } from '@/scene/CameraRig'
import { RoomModel } from '@/scene/RoomModel'
import { useInteraction } from '@/state/interaction'

/**
 * Scene contents. ScrollControls is the single scroll source of truth; its
 * `enabled` prop is phase-driven (belt) while the HUD overlay sits above the
 * hidden scroller in the stacking order (suspenders) — risk point #2.
 *
 * The demo bubble is a drei <Html> anchored in world space in front of the Cat
 * stop. zIndexRange is capped LOW: drei's default is ~16 million, which would
 * paint bubbles ABOVE the HUD and the panel — risk point #3, discovered by
 * reading drei's defaults, validated in the browser.
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
  const bubbleVisible = phase === 'parked' && stopIndex === catIndex && bubblePos !== null

  return (
    <>
      <RoomModel onReady={onReady} />

      {stops.length > 0 && (
        <ScrollControls
          pages={stops.length - 1}
          damping={0.2}
          enabled={phase === 'touring' || phase === 'parked'}
        >
          <CameraRig stops={stops} />
        </ScrollControls>
      )}

      {bubbleVisible && (
        <Html
          position={bubblePos}
          center
          portal={bubbleLayer}
          zIndexRange={[40, 0]}
          className="bubble-anchor"
        >
          <div className="bubble" role="note">
            <p>{CAMERA_STOPS[catIndex].caption}</p>
            <button type="button" onClick={() => useInteraction.getState().openPanel()}>
              Open a panel from here
            </button>
            <span className="bubble-tail" aria-hidden="true" />
          </div>
        </Html>
      )}
    </>
  )
}
