import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import type { Mesh, MeshBasicMaterial, Object3D } from 'three'
import {
  CURTAIN_BOTTOM,
  CURTAIN_DRIFT,
  CURTAIN_MATERIAL,
  CURTAIN_OBJECTS,
  CURTAIN_PERIOD,
  CURTAIN_PERIOD_2,
  CURTAIN_SWAY,
  CURTAIN_TOP,
  CURTAIN_WAVES,
} from '@/config/curtains'

/**
 * Les rideaux dans une brise (issue #38).
 *
 * **Un déplacement de sommets, dans le vertex shader du seul `Mat_Curtain`.**
 * Le matériau reste celui que `RoomModel` a reconstruit, sa texture cuite est
 * intacte : on ne touche pas à ce qui est affiché, seulement à l'endroit où le
 * tissu se trouve. Aucune lumière, aucun matériau remplacé.
 *
 * **Le haut est fixe, l'ourlet est libre.** L'amplitude croît du haut vers le
 * bas en `smoothstep`, parce qu'un rideau est accroché à une tringle : la
 * même amplitude partout ferait glisser toute la chute latéralement, comme un
 * panneau rigide.
 *
 * **L'amplitude est contrainte par la scène, pas par le goût.** La boîte du
 * rideau gauche chevauche déjà celle du télescope de 7,8 cm en Z et partage sa
 * plage en X : à 3 cm d'ourlet, le tissu respire ; plus large, il traverse
 * l'instrument.
 *
 * **Les deux rideaux sont désynchronisés par leur position monde.** Ils
 * partagent un matériau et une géométrie locale identique : sans ce décalage,
 * ils ondulaient exactement ensemble, ce qui se lit comme un mécanisme et non
 * comme du vent.
 *
 * Sous mouvement réduit, le matériau n'est pas touché — pas figé sur une
 * position, intact. C'est ce qui garde la boucle de comparaison devant le bake.
 */
interface CurtainsProps {
  /** La scène du `.glb`, telle que `RoomModel` la passe à `onReady`. */
  scene: Object3D
}

export function Curtains({ scene }: CurtainsProps) {
  const reduced = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches, [])
  const uniforms = useMemo(() => ({ uBreeze: { value: 0 } }), [])

  useEffect(() => {
    if (reduced) return

    let material: MeshBasicMaterial | null = null
    for (const name of CURTAIN_OBJECTS) {
      const object = scene.getObjectByName(name)
      if (!object) {
        console.warn(`[curtains] « ${name} » absent du .glb — pas de brise`)
        continue
      }
      object.traverse((child) => {
        const mesh = child as Mesh
        const m = mesh.material as MeshBasicMaterial | undefined
        if (mesh.isMesh && m?.name === CURTAIN_MATERIAL) material = m
      })
    }
    if (!material) {
      console.warn(`[curtains] « ${CURTAIN_MATERIAL} » introuvable — pas de brise`)
      return
    }

    // Les deux rideaux PARTAGENT ce matériau : une seule injection les anime
    // tous les deux, et c'est leur position monde qui les désynchronise.
    const target: MeshBasicMaterial = material
    target.onBeforeCompile = (shader) => {
      shader.uniforms.uBreeze = uniforms.uBreeze
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uBreeze;')
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
           // Zéro à la tringle, un à l'ourlet : le rideau est ACCROCHÉ en haut.
           float drop = smoothstep(${CURTAIN_TOP.toFixed(3)}, ${CURTAIN_BOTTOM.toFixed(3)}, position.y);
           // La position monde du rideau décale sa phase : les deux panneaux
           // partagent géométrie et matériau, et ondulaient sinon à l'unisson.
           float seed = modelMatrix[3].z * 3.7;
           float across = position.z * ${(CURTAIN_WAVES * 6.2831853).toFixed(4)};
           float w =
             sin(uBreeze * ${(6.2831853 / CURTAIN_PERIOD).toFixed(4)} + across + seed) * 0.65 +
             sin(uBreeze * ${(6.2831853 / CURTAIN_PERIOD_2).toFixed(4)} - across * 1.7 + seed * 1.3) * 0.35;
           // Le souffle entre et sort de la pièce : l'axe fin du tissu.
           transformed.x += drop * ${CURTAIN_SWAY.toFixed(4)} * w;
           // Le balancement LATÉRAL, le long de la tringle. C'est lui qui rend
           // le mouvement visible : à l'arrêt Télescope la caméra regarde
           // presque dans l'axe du souffle, et sans cette composante la
           // silhouette du rideau ne bougeait pas d'un pixel.
           // Déphasé d'un quart de cycle : gonflement et balancement d'un vrai
           // tissu ne culminent pas au même instant, ils se suivent.
           float wLat = sin(uBreeze * ${(6.2831853 / CURTAIN_PERIOD).toFixed(4)} + across + seed + 1.5708);
           transformed.z += drop * ${CURTAIN_DRIFT.toFixed(4)} * wLat;
           // Un rideau qui se creuse se raccourcit un peu — sans cela, l'ourlet
           // glisse à plat et le tissu a l'air d'un panneau qui pivote.
           transformed.y += drop * ${(CURTAIN_SWAY * 0.22).toFixed(4)} * abs(w);`,
        )
    }
    target.needsUpdate = true

    return () => {
      target.onBeforeCompile = () => {}
      target.needsUpdate = true
    }
  }, [scene, reduced, uniforms])

  useFrame((_, delta) => {
    if (reduced) return
    uniforms.uBreeze.value += delta
  })

  return null
}
