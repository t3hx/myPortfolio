/// <reference types="vite/client" />
/// <reference types="web-bluetooth" />
// ^ @vueuse/core's type defs reference Web Bluetooth globals. The @vue/tsconfig base
//   sets `types: []` (no auto-inclusion of @types/*), so we pull these in explicitly.

// Allow importing 3D assets from /src as URLs if you ever move them out of /public.
declare module '*.glb' {
  const src: string
  export default src
}
declare module '*.gltf' {
  const src: string
  export default src
}
