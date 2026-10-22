import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import { useInteraction } from '@/state/interaction'

/**
 * Le verrou de la découverte : `ready` n'est pas « la scène est parsée », c'est
 * **« une image de la pièce est à l'écran, à la pose que Blender a composée »**.
 *
 * C'est le seul travail de ce composant, et il existe parce que les deux
 * choses n'arrivent pas au même moment. `ready` allume le fondu du
 * préchargeur ; il était émis par `onReady`, dans l'effet passif de
 * `RoomModel`, donc AVANT que `CameraRig` n'ait posé la caméra — celle-ci
 * n'est placée que dans un effet du rendu suivant. Entre les deux, le canvas
 * WebGL montre encore sa dernière image : la pièce vue depuis la caméra par
 * défaut de R3F, à l'origine, tournée vers le fond de la pièce.
 *
 * Mesuré au chargement, sur GPU, image par image (1440 × 900) :
 *
 *   t = 1551,9 ms  préchargeur opaque         caméra (0, 0, 5)      ← défaut
 *   t = 1662,6 ms  préchargeur à 0,73         caméra (0, 0, 5)      ← VU
 *   t = 1683,4 ms  préchargeur à 0,09         caméra (0, 1,1, −1,718)
 *
 * Le fondu du préchargeur est une transition d'opacité, donc portée par le
 * compositeur : elle continue de s'effacer même quand le fil principal est
 * occupé. Une pause de quelques dizaines de millisecondes après le montage —
 * il en tombe une là, les contours construisant 146 `EdgesGeometry` — suffit
 * donc à découvrir cette image-là. Le visiteur voit la pièce en 3D avant de
 * voir l'écran, ce que toute l'intro existe pour éviter.
 *
 * D'où le verrou : `useFrame` s'exécute AVANT le rendu de son image (R3F
 * appelle ses abonnés, puis dessine), et la mise à jour de React qui part
 * d'ici n'est traitée qu'après le retour du `requestAnimationFrame`. L'image
 * dessinée à la bonne pose est donc dans le tampon avant que le fondu ne
 * puisse commencer.
 *
 * Deux conditions, et les deux comptent : ce composant n'est monté qu'avec les
 * arrêts (voir `Experience`), et `CameraRig` pose la caméra dans un effet de
 * MISE EN PAGE — synchrone, dans la même validation, donc avant toute image.
 * Un effet passif, lui, peut passer après une image déjà peinte : c'est
 * exactement le défaut corrigé ici.
 */
export function ReadyGate() {
  const announced = useRef(false)

  useFrame(() => {
    if (announced.current) return
    announced.current = true
    useInteraction.getState().setReady()
  })

  return null
}
