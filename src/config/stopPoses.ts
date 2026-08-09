/**
 * Camera stop poses — position, orientation and PER-STOP FOV.
 *
 * Provenance: sampled from the legacy export (the pre-2026-07-20 scene.glb,
 * which still contained real Blender cameras) via @gltf-transform world
 * matrices. The current export (portfolio_final.glb) ships NO cameras and no
 * CameraStop_* empties, and the interaction spec's pose table
 * (docs/PORTFOLIO_3D_INTERACTIONS.md §3.1) has positions/rotations but NOT the
 * focal lengths — these numbers are the only surviving source of the per-stop
 * lenses (32.3° standard, 4.3° telescope-moon zoom, 53.7° guitar wide…).
 *
 * Values are in Three.js space (Y-up), ready for direct use. If the stops move
 * in Blender, re-add CameraStop_* cameras to the export and the runtime
 * extraction takes precedence over this table (see resolveStops in lib/stops).
 */
export interface StopPose {
  position: [number, number, number]
  quaternion: [number, number, number, number]
  fov: number
}

export const STOP_POSES: Record<string, StopPose> = {
  // DELIBERATE: Home is a flat, screen-filling framing of the monitor — it
  // reads as a 2D image until the first scroll pulls the camera back and the
  // room reveals itself as 3D. That reveal is the opening beat of the tour;
  // never "fix" this pose into a room overview.
  CameraStop_Home: {
    position: [0, 1.1, -1.718],
    quaternion: [0, 0, 0, 1],
    fov: 32.269,
  },
  CameraStop_Desk: {
    position: [0, 1.46, 0.08],
    quaternion: [-0.114762, 0, 0, 0.993393],
    fov: 32.269,
  },
  CameraStop_Scoreboard: {
    position: [-0.28, 1.5, 0.5],
    quaternion: [0, 0.707107, 0, 0.707107],
    fov: 32.269,
  },
  CameraStop_BookshelfPlant: {
    position: [-0.52, 1.61, -1.48],
    quaternion: [-0.09841, 0.700225, 0.09841, 0.700225],
    fov: 51.481,
  },
  CameraStop_Cabinet: {
    position: [0.78, 1.24, -0.9],
    quaternion: [-0.263789, -0.175555, -0.04889, 0.947209],
    fov: 24.314,
  },
  CameraStop_Cat: {
    position: [-1.035, 1.789, -1.995],
    quaternion: [0.149081, 0.377668, -0.061751, 0.911772],
    fov: 22.895,
  },
  CameraStop_GuitarPoster: {
    position: [-1.21, -0.027, -1.647],
    quaternion: [0.346574, 0.217615, -0.083002, 0.908648],
    fov: 53.702,
  },
  CameraStop_PosterTelescope: {
    position: [0.78, 1.6, -1.82],
    quaternion: [0, -0.707107, 0, 0.707107],
    fov: 32.269,
  },
  CameraStop_Telescope: {
    position: [-0.2, 1, 1],
    quaternion: [0.094399, -0.548389, 0.062481, 0.828525],
    fov: 32.269,
  },
  CameraStop_TelescopeMoon: {
    position: [1.96947, 1.2851, 0.35627],
    quaternion: [0.167322, -0.426996, 0.080733, 0.884963],
    fov: 4.295,
  },
}
