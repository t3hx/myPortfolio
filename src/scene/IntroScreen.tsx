import { Html } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { useMemo, type RefObject } from 'react'
import { Matrix4, Quaternion, Vector3, type Object3D } from 'three'
import {
  INTRO_FRAME,
  INTRO_SAFE_INSET_PX,
  INTRO_SCREEN_MARGIN,
  SCREEN_MATERIAL,
} from '@/config/intro'
import { CLEAR_COLOR } from '@/config/renderPipeline'
import { screenLayout } from '@/lib/introLayout'
import { findScreenPlane } from '@/lib/screenPlane'
import { poseVerticalFov, type StopTransform } from '@/lib/stops'

/**
 * La couche de l'intro, posée sur l'écran principal (issue #142).
 *
 * C'est du DOM dans la 3D : un drei `<Html transform>` épinglé au plan de
 * l'écran, qui suit la caméra. À Home il remplit la fenêtre — le cadrage tient
 * à l'intérieur de l'écran, avec 2 % de débord — et au premier défilement il
 * recule AVEC le moniteur, en perspective. C'est ce qui rend « affichée par
 * l'écran principal » vrai après la révélation, et non seulement avant.
 *
 * Pas une texture dans le `.glb` : `Mat_MonitorScreen` couvre les deux
 * moniteurs, et la boucle de comparaison capture le tampon WebGL de `home` à
 * 0,000 %. Le DOM lui est invisible par construction.
 *
 * Le plan est DÉRIVÉ du graphe (`findScreenPlane`), jamais écrit en dur ; la
 * pose est un calcul pur (`screenLayout`) : le cadre est contenu dans ce que
 * la fenêtre montre à Home, hors barre de menu, avec une marge, et centré sur
 * l'écran. Il se recalcule quand la fenêtre change de taille.
 */
interface IntroScreenProps {
  /** La scène du `.glb`, telle que `RoomModel` la passe à `onReady`. */
  scene: Object3D
  /** La caméra de l'arrêt Home : c'est elle qui désigne l'écran principal. */
  home: StopTransform
  /** La couche DOM stable d'App3D, sous les bulles et le menu. */
  portal: RefObject<HTMLDivElement>
}

const RAD = Math.PI / 180
const FORWARD = new Vector3(0, 0, -1)

export function IntroScreen({ scene, home, portal }: IntroScreenProps) {
  const size = useThree((s) => s.size)

  const placement = useMemo(() => {
    const plane = findScreenPlane(scene, SCREEN_MATERIAL, home)
    if (!plane) return null
    // L'élément regarde son +Z local : la base (droite, haut, normale) du
    // rectangle est exactement l'orientation qu'il lui faut.
    const quaternion = new Quaternion().setFromRotationMatrix(
      new Matrix4().makeBasis(plane.right, plane.up, plane.normal),
    )
    return { plane, quaternion }
  }, [scene, home])

  const layout = useMemo(() => {
    if (!placement) return null
    const { plane } = placement
    // Ce que la caméra Home montre à la profondeur de l'écran, avec la règle
    // de cadrage du tour (horizontal, borné à Home — #135).
    const aspect = size.width / size.height
    const depth = plane.center
      .clone()
      .sub(home.position)
      .dot(FORWARD.clone().applyQuaternion(home.quaternion))
    const visibleHeight = 2 * depth * Math.tan((poseVerticalFov(home, aspect) * RAD) / 2)
    return screenLayout({
      screen: plane,
      frame: INTRO_FRAME,
      viewport: size,
      visible: { width: visibleHeight * aspect, height: visibleHeight },
      insetPx: INTRO_SAFE_INSET_PX,
      margin: INTRO_SCREEN_MARGIN,
    })
  }, [placement, home, size])

  // Garde anti-repli : drei résout sa cible AU RENDER, et sans elle il
  // portalerait dans le conteneur du canvas — même piège que la bulle.
  if (!placement || !layout || !portal.current) return null
  const { plane, quaternion } = placement

  return (
    <Html
      transform
      position={plane.center}
      quaternion={quaternion}
      distanceFactor={layout.distanceFactor}
      portal={portal}
      zIndexRange={[40, 0]}
      pointerEvents="none"
    >
      {/* L'encre de l'intro est celle du fond de la pièce : une seule source. */}
      <div
        className="intro-screen"
        style={{
          width: layout.screen.width,
          height: layout.screen.height,
          background: CLEAR_COLOR,
        }}
      >
        <div
          className="intro-frame"
          style={{ width: layout.frame.width, height: layout.frame.height }}
        />
      </div>
    </Html>
  )
}
