Put your exported Blender scene here as:  scene.glb
(or change MODEL_SRC in src/config/blenderMatch.ts)

Blender glTF 2.0 export checklist for a faithful match:
  • Format: glTF Binary (.glb)
  • Include  ▸ Cameras   ✔  (required — drives the camera tour)
  • Include  ▸ Punctual Lights ✔  (KHR_lights_punctual)
  • Data ▸ Mesh ▸ Apply Modifiers ✔
  • Data ▸ Material ▸ Emissive Strength ✔  (keeps the neon/LED glow > 1)
  • Animation ▸ enable, and bake the curtain animation if you want it to play
  • (optional) Compression ▸ Draco  — already supported by the loader

Line Art bake (maximum "Blender ink" fidelity — see design doc, contours spike):
  The runtime draws silhouettes (inverted hull) and crease ink (fat lines) on
  its own, but YOUR artistic line selection (edge marks, material boundaries,
  chained strokes) only survives if you bake the view-INDEPENDENT lines into
  the export. Silhouettes must NOT be baked (they depend on the camera; the
  runtime hull handles them).

  1. Add a Line Art Grease Pencil object (Object ▸ Grease Pencil ▸ Scene Line Art)
  2. In its Line Art modifier: enable Crease + Edge Marks + Material Borders,
     DISABLE Contour (view-dependent — the runtime owns it)
  3. Apply the modifier, then convert:  GP object ▸ Convert To ▸ Curve,
     then Curve ▸ Convert To ▸ Mesh (gives thin world-space ribbons; set a
     tiny bevel on the curve first for visible thickness, e.g. 0.002)
  4. Name the result  LineArt_Baked  (the loader will style/exclude it by name:
     no shadows, no raycast, ink material)
  5. Re-export. The runtime keeps: hull = silhouettes, baked mesh = your marks.

