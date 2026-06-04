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
