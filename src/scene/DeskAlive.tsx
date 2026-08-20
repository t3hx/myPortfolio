import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import {
  AdditiveBlending,
  Box3,
  BufferAttribute,
  BufferGeometry,
  Object3D,
  Points,
  ShaderMaterial,
  Vector3,
} from 'three'
import { MUG_SURFACE, PC_FANS, SMOKE_PUFFS, SMOKE_SIZE_MAX, SMOKE_SIZE_MIN } from '@/config/desk'
import { fanAxis, fanDirection, fanSpeed, puff } from '@/lib/desk'

/**
 * Le bureau qui respire (issue #35) : les dix ventilateurs du boîtier tournent,
 * la tasse de café fume.
 *
 * **Les ventilateurs ne touchent aucun matériau** — ce sont des rotations, au
 * même titre que le chat. **La fumée, elle, est de la géométrie NOUVELLE**, pas
 * un matériau cuit modifié : c'est ce qui la garde compatible avec le pipeline
 * non éclairé. On n'a rien reconstruit, on a ajouté.
 *
 * **`prefers-reduced-motion` coupe les deux, et cache la fumée.** La coupure ne
 * suffirait pas pour elle : figées, les bouffées resteraient VISIBLES, alors
 * que les rendus de référence de Blender n'en contiennent aucune. La boucle de
 * comparaison capture en mouvement réduit (voir `playwright.config.ts`), donc
 * l'arrêt du bureau doit y retrouver exactement la pièce que Blender a rendue.
 */
interface DeskAliveProps {
  /** La scène du `.glb`, telle que `RoomModel` la passe à `onReady`. */
  scene: Object3D
}

/**
 * Une bouffée est un point rond et flou, dessiné par le fragment shader —
 * plutôt qu'une texture à charger. Le dégradé est en puissance quatre : un
 * dégradé linéaire donne un disque à bord net qu'on lit comme une bille.
 */
const SMOKE_VERT = /* glsl */ `
  attribute float size;
  attribute float alpha;
  varying float vAlpha;
  void main() {
    vAlpha = alpha;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = size;
    gl_Position = projectionMatrix * mv;
  }
`
const SMOKE_FRAG = /* glsl */ `
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - vec2(0.5));
    if (d > 0.5) discard;
    float soft = pow(1.0 - d * 2.0, 4.0);
    gl_FragColor = vec4(vec3(0.82, 0.84, 0.86), vAlpha * soft);
  }
`

export function DeskAlive({ scene }: DeskAliveProps) {
  const smoke = useRef<Points>(null)

  const rig = useMemo(() => {
    const fans = PC_FANS.map((name) => {
      const object = scene.getObjectByName(name)
      if (!object) {
        // Même discipline qu'une caméra absente dans `extractStops` : on saute
        // et on le dit, plutôt que de tomber ou de se taire.
        console.warn(`[desk] ventilateur « ${name} » absent du .glb — ignoré`)
        return null
      }
      const box = new Box3().setFromObject(object)
      const size = box.getSize(new Vector3())
      return { object, axis: fanAxis([size.x, size.y, size.z]) }
    }).filter((f): f is { object: Object3D; axis: 0 | 1 | 2 } => f !== null)

    // La fumée part de la SURFACE du café, pas du centre de la tasse.
    const mug = scene.getObjectByName(MUG_SURFACE)
    if (!mug) console.warn(`[desk] « ${MUG_SURFACE} » absent du .glb — pas de fumée`)
    const box = mug ? new Box3().setFromObject(mug) : null
    const origin = box ? box.getCenter(new Vector3()).setY(box.max.y) : null
    const radius = box ? (box.max.x - box.min.x) / 2 : 0

    return { fans, origin, radius }
  }, [scene])

  const geometry = useMemo(() => {
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(new Float32Array(SMOKE_PUFFS * 3), 3))
    g.setAttribute('size', new BufferAttribute(new Float32Array(SMOKE_PUFFS), 1))
    g.setAttribute('alpha', new BufferAttribute(new Float32Array(SMOKE_PUFFS), 1))
    return g
  }, [])

  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: SMOKE_VERT,
        fragmentShader: SMOKE_FRAG,
        transparent: true,
        // Pas d'écriture de profondeur : sans ça, les bouffées se découpent
        // les unes les autres et le filet se disloque.
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    [],
  )

  useEffect(
    () => () => {
      geometry.dispose()
      material.dispose()
    },
    [geometry, material],
  )

  const reduced = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches, [])

  useFrame((_, delta) => {
    if (reduced) return

    for (let i = 0; i < rig.fans.length; i++) {
      const fan = rig.fans[i]
      fan.object.rotation[(['x', 'y', 'z'] as const)[fan.axis]] +=
        fanSpeed(i) * fanDirection(i) * Math.PI * 2 * delta
    }

    const points = smoke.current
    if (!points || !rig.origin) return
    const time = performance.now() / 1000
    const pos = points.geometry.getAttribute('position') as BufferAttribute
    const size = points.geometry.getAttribute('size') as BufferAttribute
    const alpha = points.geometry.getAttribute('alpha') as BufferAttribute

    for (let i = 0; i < SMOKE_PUFFS; i++) {
      const p = puff(i, SMOKE_PUFFS, time)
      // Le point de départ est réparti sur le disque du café : toutes les
      // bouffées partant du centre feraient une colonne, pas une nappe.
      const a = (i / SMOKE_PUFFS) * Math.PI * 2
      const r = rig.radius * 0.45
      pos.setXYZ(
        i,
        rig.origin.x + Math.cos(a) * r + p.driftX,
        rig.origin.y + p.rise,
        rig.origin.z + Math.sin(a) * r + p.driftZ,
      )
      size.setX(i, SMOKE_SIZE_MIN + (SMOKE_SIZE_MAX - SMOKE_SIZE_MIN) * p.age)
      alpha.setX(i, p.opacity)
    }
    pos.needsUpdate = true
    size.needsUpdate = true
    alpha.needsUpdate = true
  })

  // Figée, la fumée resterait visible : les rendus de référence n'en ont
  // aucune, et l'arrêt du bureau ne correspondrait plus.
  if (reduced || !rig.origin) return null

  return <points ref={smoke} geometry={geometry} material={material} frustumCulled={false} />
}
