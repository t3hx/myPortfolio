import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import { BufferAttribute, Color, type Mesh, type MeshBasicMaterial, type Object3D } from 'three'
import {
  LED_PERIOD,
  LED_RAMP,
  LED_SPREAD,
  LED_TILES_MATERIAL,
  LED_TILES_OBJECT,
  LED_TINT,
} from '@/config/nanoleaf'
import { tileRanks } from '@/lib/nanoleaf'

/**
 * Le dégradé animé des tuiles NanoLeaf (issue #36).
 *
 * **C'est la première animation du lot qui touche à un matériau cuit**, et elle
 * le fait de la façon la plus étroite possible : `onBeforeCompile` sur le SEUL
 * `Mat_LEDEmissive`. Le matériau reste un `MeshBasicMaterial`, le pipeline non
 * éclairé n'est pas modifié, aucune lumière n'est ajoutée — on injecte trois
 * lignes dans son fragment shader et rien d'autre.
 *
 * **Le mélange se fait AVEC la couleur cuite, pas à sa place** (`LED_TINT`) : le
 * panneau garde sa luminosité et sa place dans l'image, le dégradé ne fait que
 * la teinter. Remplacer le bake nous ferait perdre le droit de dire que le
 * rendu vient de Blender.
 *
 * **Sous mouvement réduit, le matériau n'est pas touché DU TOUT.** Pas figé sur
 * une teinte : intact. C'est ce qui garantit que la boucle de comparaison,
 * qui capture en mouvement réduit, voit exactement le bake — et donc que la
 * règle WYSIWYG reste vérifiable malgré une animation permanente.
 *
 * Les 14 tuiles sont des triangles qui ne partagent aucun sommet : chacune
 * reçoit un rang, donc un aplat, et la vague avance vraiment de tuile en tuile.
 */
interface NanoLeafProps {
  /** La scène du `.glb`, telle que `RoomModel` la passe à `onReady`. */
  scene: Object3D
}

export function NanoLeaf({ scene }: NanoLeafProps) {
  const reduced = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches, [])

  const uniforms = useMemo(() => ({ uLedTime: { value: 0 } }), [])

  useEffect(() => {
    if (reduced) return

    const panel = scene.getObjectByName(LED_TILES_OBJECT)
    if (!panel) {
      console.warn(`[nanoleaf] « ${LED_TILES_OBJECT} » absent du .glb — pas de dégradé`)
      return
    }

    let mesh: Mesh | null = null
    panel.traverse((child) => {
      const m = child as Mesh
      const name = (m.material as { name?: string } | undefined)?.name
      if (m.isMesh && name === LED_TILES_MATERIAL) mesh = m
    })
    if (!mesh) {
      console.warn(`[nanoleaf] « ${LED_TILES_MATERIAL} » introuvable — pas de dégradé`)
      return
    }

    const target = mesh as Mesh
    const geometry = target.geometry
    const position = geometry.getAttribute('position')
    // Les tuiles ne partagent aucun sommet ; l'index est donc trivial et on
    // peut lire les positions en triplets, dans l'ordre.
    geometry.setAttribute(
      'aTile',
      new BufferAttribute(tileRanks(position.array as ArrayLike<number>), 1),
    )

    const material = target.material as MeshBasicMaterial
    const ramp = LED_RAMP.map((hex) => new Color(hex))

    material.onBeforeCompile = (shader) => {
      shader.uniforms.uLedTime = uniforms.uLedTime
      shader.uniforms.uRamp = { value: ramp }
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          '#include <common>\nattribute float aTile;\nvarying float vTile;',
        )
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvTile = aTile;')
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
           uniform float uLedTime;
           uniform vec3 uRamp[3];
           varying float vTile;`,
        )
        .replace(
          '#include <dithering_fragment>',
          `#include <dithering_fragment>
           // Le rang de la tuile fait avancer la vague ; le temps la déplace.
           float p = fract(vTile * ${LED_SPREAD.toFixed(3)} - uLedTime / ${LED_PERIOD.toFixed(1)});
           float s = p * 3.0;
           int i = int(floor(s));
           // Cyclique : le dernier arrêt revient au premier, sans couture.
           vec3 a = i == 0 ? uRamp[0] : (i == 1 ? uRamp[1] : uRamp[2]);
           vec3 b = i == 0 ? uRamp[1] : (i == 1 ? uRamp[2] : uRamp[0]);
           vec3 tint = mix(a, b, smoothstep(0.0, 1.0, fract(s)));
           // LA TEINTE CHANGE LA COULEUR, JAMAIS LA LUMINOSITÉ. Multiplier le
           // bake par la teinte puis rehausser faisait déborder les canaux et
           // saturait le panneau : il devenait plus lumineux que ce que Blender
           // avait cuit, donc plus criard. En ramenant la teinte à la luminance
           // du bake, on ne déplace que la couleur — le panneau garde
           // exactement sa place dans l'image.
           float lumBake = dot(gl_FragColor.rgb, vec3(0.2126, 0.7152, 0.0722));
           float lumTint = max(dot(tint, vec3(0.2126, 0.7152, 0.0722)), 1e-4);
           vec3 tinted = tint * (lumBake / lumTint);
           gl_FragColor.rgb = mix(gl_FragColor.rgb, tinted, ${LED_TINT.toFixed(2)});`,
        )
    }
    material.needsUpdate = true

    return () => {
      // Le matériau est rendu à son état cuit : ce composant est démontable
      // sans laisser de trace, et un rechargement à chaud ne l'empile pas.
      material.onBeforeCompile = () => {}
      material.needsUpdate = true
      geometry.deleteAttribute('aTile')
    }
  }, [scene, reduced, uniforms])

  useFrame((_, delta) => {
    if (reduced) return
    uniforms.uLedTime.value += delta
  })

  return null
}
