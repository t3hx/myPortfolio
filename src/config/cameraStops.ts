/**
 * The guided camera tour. Each stop references a camera **by the exact name it has
 * in Blender** (and therefore in the exported .glb). The transform (position /
 * rotation / focal length) is read from the .glb at runtime — you only define the
 * order and the UI text here.
 *
 * Ported unchanged from the Vue prototype: order = tour order = scroll order.
 */
export interface CameraStop {
  /** Must match the camera object name in Blender / the .glb node name. */
  camera: string
  /** Short label for the navigation UI (also the `?stop=` deep-link key). */
  label: string
  /** Optional caption shown while parked at this stop. */
  caption?: string
}

export const CAMERA_STOPS: CameraStop[] = [
  { camera: 'CameraStop_Home', label: 'Home', caption: 'Welcome.' },
  { camera: 'CameraStop_Desk', label: 'Desk', caption: 'Where the work happens.' },
  { camera: 'CameraStop_Scoreboard', label: 'Scoreboard' },
  { camera: 'CameraStop_BookshelfPlant', label: 'Bookshelf' },
  { camera: 'CameraStop_Cabinet', label: 'Cabinet' },
  { camera: 'CameraStop_Cat', label: 'Cat', caption: 'Chief nap officer. Do not disturb during business hours (all hours).' },
  { camera: 'CameraStop_GuitarPoster', label: 'Guitar' },
  { camera: 'CameraStop_PosterTelescope', label: 'Posters' },
  { camera: 'CameraStop_Telescope', label: 'Telescope' },
  { camera: 'CameraStop_TelescopeMoon', label: 'Moon' },
]
