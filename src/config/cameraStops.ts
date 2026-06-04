/**
 * The guided camera tour. Each stop references a camera **by the exact name it has
 * in Blender** (and therefore in the exported .glb). The transform (position /
 * rotation / focal length) is read from the .glb at runtime — you only define the
 * order and the UI text here.
 *
 * Your scene exposed 10 `CameraStop_*` cameras; they're ordered below into a loop
 * around the room that ends on the dramatic telescope -> moon zoom (270 mm lens).
 * Reorder / re-label freely, and drop the `caption` in as your portfolio copy.
 */
export interface CameraStop {
  /** Must match the camera object name in Blender / the .glb node name. */
  camera: string
  /** Short label for the navigation UI. */
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
  { camera: 'CameraStop_Cat', label: 'Cat' },
  { camera: 'CameraStop_GuitarPoster', label: 'Guitar' },
  { camera: 'CameraStop_PosterTelescope', label: 'Posters' },
  { camera: 'CameraStop_Telescope', label: 'Telescope' },
  { camera: 'CameraStop_TelescopeMoon', label: 'Moon' },
]
