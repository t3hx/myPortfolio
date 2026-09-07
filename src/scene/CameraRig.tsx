import { useFrame, useThree } from '@react-three/fiber'
import gsap from 'gsap'
import { useEffect, useLayoutEffect, useRef } from 'react'
import { PerspectiveCamera, Quaternion, Vector3 } from 'three'
import { feedWheel, idleGesture } from '@/lib/gesture'
import {
  applyPose,
  blendPose,
  copyPose,
  emptyPose,
  moveDuration,
  nextStopIndex,
  verticalFov,
  type StopTransform,
} from '@/lib/stops'
import { stopParamIndex } from '@/lib/viewMode'
import { useInteraction } from '@/state/interaction'
import { LOOK_EPSILON_DEG } from '@/config/lookAround'
import { approachYaw, lookYaw, orbitPose } from '@/lib/lookAround'
import { reducedMotion } from '@/lib/clock'
import {
  TELESCOPE_APPROACH_HFOV,
  TELESCOPE_APPROACH_S,
  TELESCOPE_EYEPIECE_BACK,
  TELESCOPE_FOV_PAD,
  TELESCOPE_ZOOM_S,
} from '@/config/telescope'

/**
 * Stop-to-stop camera navigation — the interaction model chosen after user
 * testing (2026-08-05): a scroll gesture is a COMMAND ("go to the next stop"),
 * not a position input. One gesture → ONE fluid stroke to the destination,
 * driven by a single GSAP tween. No virtual scroll rail, no damping chase,
 * no settle phase — the "second movement on arrival" of the scrub model is
 * structurally impossible here because there is only one easing curve.
 *
 *   molette / flèches ──► détecteur de geste ──► moveToIndex(courant ± 1)
 *   barre de menu, rail du HUD ─────────────────► moveToIndex(i)
 *   lien profond ?stop= ────────────────────────► pose posée, sans mouvement
 *
 * La règle du geste vit dans `lib/gesture.ts`, pure et testée : **un geste
 * vaut exactement UN pas, quelle que soit son intensité** (#116). Il se clôt
 * sur un silence, jamais à la fin de la course — enchaîner demande un geste
 * neuf. Un demi-tour, lui, répond tout de suite : le momentum ne s'inverse
 * jamais, donc c'est forcément une intention.
 */

// --- Feel tuning ----------------------------------------------------------------------
// La COURBE du mouvement — arbitrée sur trois candidats essayés dans un vrai
// navigateur (#115, 2026-08-24). `power3` accélère et décélère plus franchement
// que `power2` : les deux bouts sont plus lents, le milieu plus décidé, ce qui
// est ce qui fait lire le déplacement comme une intention plutôt que comme un
// glissement. `expo.inOut`, essayé aussi, exagérait au point que le milieu du
// trajet devenait illisible.
//
// Sa DURÉE ne se règle pas ici : elle se déduit de ce que le mouvement fait
// parcourir à l'œil — voir `moveDuration`, dont les références sont mesurées
// sur la scène.
const MOVE_EASE = 'power3.inOut'

interface CameraRigProps {
  stops: StopTransform[]
  /**
   * Le rayon d'orbite de chaque arrêt, dans l'ordre du tour — la profondeur de
   * son sujet, ou `0` s'il refuse le regard (voir `resolveLookPivots`).
   *
   * Passé en propriété comme `moon`, et résolu au même endroit que les ancres
   * de bulles : les deux lisent le MÊME sujet, et la résolution ne dépend que
   * du graphe et des caméras du `.glb`, tous deux figés après le chargement.
   */
  pivots: number[]
  /**
   * La pose d'arrivée de l'excursion du télescope — `CameraStop_TelescopeMoon`,
   * lue dans le `.glb` mais **hors tour** (#113).
   *
   * Passée en propriété plutôt que reprise dans `stops`, parce que c'est la
   * seule façon de dire qu'elle n'est PAS une étape : tant qu'elle fermait le
   * tableau, l'excursion la prenait par `stops[stops.length - 1]` et suivait
   * donc l'ORDRE du tour. Réordonner `CAMERA_STOPS` — geste que le fichier
   * encourage explicitement — repointait l'excursion sur un autre objet, sans
   * erreur et sans avertissement.
   *
   * `null` si la caméra manque au `.glb` : `readStopTransform()` a déjà crié,
   * et le télescope se contente alors de ne pas décoller.
   */
  moon: StopTransform | null
}

export function CameraRig({ stops, moon, pivots }: CameraRigProps) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera
  const glDom = useThree((s) => s.gl.domElement)

  /**
   * La pose que le tour affiche — LA source de vérité du rendu, et la seule.
   *
   * Elle remplace `pos.p`, une position continue sur la POLYLIGNE des arrêts.
   * Ce nombre mélangeait deux choses : *où est la caméra* et *quel chemin elle
   * suit*. Tant qu'elles étaient la même variable, tout déplacement était
   * forcément un déplacement LE LONG DU TOUR — c'est pour ça qu'un clic de menu
   * rembobinait la pièce, et pourquoi le vol direct de #113 n'a pu exister
   * qu'en sortant de la variable le temps du vol, avec un second moteur.
   * Une pose ne dit que le premier des deux, donc n'importe quel couple
   * (départ, arrivée) devient exprimable.
   */
  const pose = useRef(emptyPose()).current

  /**
   * Le regard autour du sujet (2026-08-25) — **composé au moment d'écrire, et
   * jamais fondu dans `pose`**.
   *
   * `pose` est la pose que Blender a autorisée, et la seule source de vérité du
   * rendu (#115). Y ajouter l'orbite la ferait dériver à chaque mouvement de
   * souris : le mouvement suivant partirait d'un ailleurs que personne n'a
   * composé, le retour du télescope viserait à côté, et rien ne le dirait.
   * L'orbite vit donc dans une pose de brouillon, recalculée par image à partir
   * de la vraie.
   */
  const looked = useRef(emptyPose()).current
  /** L'angle courant, en degrés. Il rejoint sa cible par lissage, et sa cible
   *  est 0 dès qu'on n'est plus à l'arrêt : le regard se déroule tout seul au
   *  départ d'un mouvement, sans qu'on ait à l'annuler. */
  const yaw = useRef(0)
  /** La position horizontale du curseur, de −1 (bord gauche) à +1. `null` tant
   *  que la souris n'a pas bougé — un tactile, un clavier, une capture. */
  const cursorX = useRef<number | null>(null)
  const from = useRef(emptyPose()).current
  const targetIndex = useRef(0)
  const move = useRef<gsap.core.Tween | null>(null)
  // L'état du détecteur de geste. Il vit dans une ref parce qu'il change
  // plusieurs fois par image et ne doit rien re-rendre ; la RÈGLE, elle, est
  // dans `lib/gesture.ts`, pure et testée (#116).
  const gesture = useRef(idleGesture())

  /**
   * Le mouvement de la caméra pendant le tour. **Un seul, pour tous les cas** :
   * un pas de molette, une flèche, un clic dans la barre, le bouclage du
   * dernier arrêt vers le premier. Ce qui les distingue est une DURÉE, pas un
   * moteur (#115).
   *
   * Il y en avait deux avant : un pas interpolait `pos.p` sur la polyligne,
   * un saut écrivait la caméra lui-même. Deux chemins pour « déplacer la
   * caméra d'un arrêt à un autre », c'est un réglage appliqué à l'un qui manque
   * à l'autre — et c'était déjà le cas, `STEP_DURATION` et `JUMP_DURATION`
   * n'ayant aucun rapport l'une avec l'autre.
   *
   * La caméra va DROIT à la pose visée. Mesuré avant de s'y fier : tous les
   * arrêts sont à l'intérieur du volume et regardent vers les murs, donc une
   * droite entre deux points de vue reste dans le vide. Le pire cas,
   * Accueil → Scoreboard, frôle la bibliothèque à mi-course sans la traverser.
   */
  function moveToIndex(index: number) {
    const clamped = Math.min(Math.max(index, 0), stops.length - 1)
    const to = stops[clamped]
    if (!to) return
    if (clamped === targetIndex.current && !move.current) return

    move.current?.kill()
    copyPose(from, pose)
    targetIndex.current = clamped

    const store = useInteraction.getState()
    store.setPhase('touring')
    // L'item du menu s'allume au DÉPART, pas à l'arrivée.
    store.setStopIndex(clamped)

    const t = { v: 0 }
    move.current = gsap.to(t, {
      v: 1,
      duration: moveDuration(from, to),
      ease: MOVE_EASE,
      onUpdate: () => blendPose(pose, from, to, t.v),
      onComplete: () => {
        move.current = null
        // Exactement la pose autorisée par Blender, sans reste d'interpolation.
        copyPose(pose, to)
        useInteraction.getState().setPhase('parked')
        // Rien n'est réarmé ici, et c'est le cœur de #116 : le détecteur
        // reprenait la main à la fin de la course, ce qui permettait au geste
        // EN COURS de tirer un pas de plus.
      },
    })
  }

  /**
   * Un PAS dans le tour, dans la direction donnée.
   *
   * Deux mouvements différents sortent d'ici, et c'est voulu. Un pas vers un
   * arrêt voisin suit le parcours (`goToIndex`) — sur un segment, la polyligne
   * EST la droite. Le bouclage du dernier arrêt vers le premier, lui, n'est pas
   * un pas voisin : passé par `pos.p`, il rembobinerait toute la pièce à
   * l'envers, ce qui est précisément le mouvement illisible qu'un saut de menu
   * a cessé de produire. Il part donc en vol direct.
   */
  /**
   * Un geste vers l'AVANT : le dialogue d'abord, le tour ensuite (#122).
   *
   * C'est ici que « N phrases = N gestes » se joue. `advanceDialogue` rend
   * `exhausted` quand il n'avait plus rien à dire, et c'est le MÊME geste qui
   * enchaîne alors sur l'arrêt suivant — pas le suivant. Sans ça, un arrêt
   * d'une seule phrase, comme l'accueil, coûterait deux gestes pour être
   * quitté, et ce serait la première impression du site.
   *
   * Seulement vers l'avant : reculer est une intention de retour, pas de
   * lecture, et doit rendre la main au tour tout de suite.
   *
   * Seulement à l'ARRÊT : pendant une course, on est déjà en train de presser
   * le pas, et arbitrer le dialogue d'un arrêt où l'on n'est pas encore n'aurait
   * pas de sens.
   */
  function advanceOrStep() {
    if (useInteraction.getState().phase !== 'parked') {
      stepBy(1)
      return
    }
    if (useInteraction.getState().advanceDialogue() === 'exhausted') stepBy(1)
  }

  function stepBy(dir: 1 | -1) {
    const next = nextStopIndex(targetIndex.current, dir, stops.length)
    if (next === null) return
    // Voisin ou bouclage, c'est le même mouvement : seule la distance change,
    // et c'est elle qui décide de la durée.
    moveToIndex(next)
  }

  // --- Input: owned wheel with gesture detection + keyboard ---------------------------
  useEffect(() => {
    if (stops.length === 0) return
    const stage = glDom.closest('.stage') ?? glDom.parentElement ?? glDom
    const store = useInteraction.getState

    const onWheel = (e: WheelEvent) => {
      // Panels own their wheel natively — never intercept it.
      if (e.target instanceof Element && e.target.closest('.panel')) return
      const { phase } = store()
      if (phase !== 'touring' && phase !== 'parked') return
      e.preventDefault()

      // `deltaMode === 1` compte en LIGNES, pas en pixels : une molette de
      // souris classique. 16 px par ligne la ramène dans la même unité que le
      // trackpad, sans quoi le seuil voudrait dire deux choses différentes
      // selon le périphérique.
      const delta = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY
      const out = feedWheel(gesture.current, delta, performance.now())
      gesture.current = out.state

      if (import.meta.env.DEV) {
        const w = window as unknown as { __wheelLog?: unknown[] }
        w.__wheelLog ??= []
        w.__wheelLog.push({ delta, step: out.step, ...out.state })
        if (w.__wheelLog.length > 50) w.__wheelLog.shift()
      }

      if (out.step === 1) advanceOrStep()
      else if (out.step === -1) stepBy(-1)
    }

    const onKeyDown = (e: KeyboardEvent) => {
      const { phase, closePanel, exitTelescope } = store()
      if (e.key === 'Escape') {
        if (phase === 'panel') closePanel()
        if (phase === 'telescope') exitTelescope()
        return
      }
      // La barre de menu possède ses flèches (focus glissant d'un item à
      // l'autre) — pendant clavier de la règle `.panel` de la molette : chaque
      // surface qui a une navigation interne la garde pour elle. Le HUD `?debug`
      // est de celles-là depuis qu'il choisit l'arrêt dans une liste déroulante,
      // où ↑↓ changent l'option : sans cette ligne, la même touche déplacerait
      // AUSSI la caméra d'un arrêt.
      if (e.target instanceof Element && e.target.closest('.menu, .hud')) return
      if (phase !== 'touring' && phase !== 'parked') return
      const forward = ['ArrowDown', 'ArrowRight', 'PageDown'].includes(e.key)
      const backward = ['ArrowUp', 'ArrowLeft', 'PageUp'].includes(e.key)
      if (!forward && !backward) return
      e.preventDefault()
      stepBy(forward ? 1 : -1)
    }

    /**
     * **La scène d'abord, le dialogue sinon.** Un clic qui vise un objet
     * interactif lui appartient — le télescope décolle, un dossier s'envole —
     * et n'avance rien. Partout ailleurs, il fait parler l'arrêt.
     *
     * Les deux survols sont déjà calculés par ceux qui en ont besoin
     * (`telescopeHovered` par un raycast par mouvement de pointeur,
     * `folderHovered` par la commode) : on les LIT, on ne les recalcule pas.
     * Refaire le raycast ici, ce serait deux réponses possibles à « qu'y a-t-il
     * sous le curseur », et un clic qui ferait les deux choses ou aucune.
     */
    const onClick = (e: MouseEvent) => {
      // Le HUD est exclu au même titre que le panneau et la barre : ses boutons
      // vivent dans `.stage`, donc un clic dessus faisait AUSSI parler l'arrêt
      // — et sur la dernière phrase d'un dialogue, « faire parler » veut dire
      // passer à l'arrêt suivant. Mesuré : ouvrir la fiche projet depuis
      // Bookshelf laissait la caméra sur Cat. Sa racine ne prend aucun
      // événement, donc `closest` ne peut désigner que ses îles interactives.
      if (e.target instanceof Element && e.target.closest('.panel, .menu, .hud')) return
      const { phase, telescopeHovered, folderHovered } = store()
      if (phase !== 'touring' && phase !== 'parked') return
      if (telescopeHovered || folderHovered) return
      advanceOrStep()
    }

    stage.addEventListener('click', onClick as EventListener)
    stage.addEventListener('wheel', onWheel as EventListener, { passive: false })
    window.addEventListener('keydown', onKeyDown)
    return () => {
      stage.removeEventListener('click', onClick as EventListener)
      stage.removeEventListener('wheel', onWheel as EventListener)
      window.removeEventListener('keydown', onKeyDown)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [glDom, stops])

  /**
   * Le curseur, en fraction de la demi-largeur du cadre (−1 à gauche, +1 à
   * droite). Écouté sur la fenêtre plutôt que sur la scène : le regard doit
   * répondre même quand le curseur passe au-dessus d'une bulle ou de la barre
   * de menu, qui couvrent une bonne part de l'écran et ne sont pas des
   * obstacles au regard.
   *
   * `pointermove` et non `mousemove` : un stylet et un doigt le déclenchent
   * aussi, et un doigt qui traîne sur l'écran est un geste de regard tout à
   * fait légitime.
   */
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      cursorX.current = (e.clientX / window.innerWidth) * 2 - 1
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => window.removeEventListener('pointermove', onMove)
  }, [])

  // --- Placement initial (+ deep link ?stop=) : instantané, déterministe ---------------
  //
  // La phase compte autant que la pose. Elle démarre à TOURING et ne passait à
  // PARKED que par l'`onComplete` d'un tween — or le placement initial n'en
  // lance aucun. Un visiteur arrivait donc sur Accueil en phase TOURING, où
  // aucune bulle ne s'affiche : la phrase d'ouverture, « faites défiler pour
  // commencer la visite », restait invisible jusqu'au premier défilement…
  // qui quitte justement Accueil. Seul `?stop=` passait PARKED, ce qui rendait
  // le bug invisible à toutes les captures de la boucle de comparaison.
  //
  // **Effet de MISE EN PAGE, et c'est la moitié d'une correction** (voir
  // `ReadyGate`) : un effet passif s'exécute après la peinture de sa propre
  // validation, si bien qu'une image pouvait être dessinée — et découverte par
  // le fondu du préchargeur — avec la caméra par défaut de R3F, à l'origine,
  // face au fond de la pièce. Ici le placement est synchrone, avant toute
  // image de cette validation ; `ReadyGate` se charge de l'autre moitié, qui
  // est de n'annoncer la découverte qu'une fois cette image DESSINÉE.
  useLayoutEffect(() => {
    if (stops.length === 0) return
    const target = stopParamIndex()
    const clamped = Math.min(Math.max(target ?? 0, 0), stops.length - 1)
    targetIndex.current = clamped
    // Posée, pas jouée : un lien profond doit être déterministe, c'est ce qui
    // rend les captures de la boucle de comparaison reproductibles.
    const stop = stops[clamped]
    if (stop) {
      copyPose(pose, stop)
      applyPose(camera, pose)
    }
    useInteraction.getState().setStopIndex(clamped)
    useInteraction.getState().setPhase('parked')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stops, camera])

  // --- TELESCOPE phase: imperative camera excursion off the tour path -----------------
  const excursion = useRef<gsap.core.Tween | null>(null)
  const returning = useRef(false)
  const fromPos = useRef(new Vector3())
  const fromQuat = useRef(new Quaternion())

  useEffect(() => {
    const unsub = useInteraction.subscribe((state, prev) => {
      if (stops.length === 0 || !moon) return

      if (state.phase === 'telescope' && prev.phase !== 'telescope') {
        move.current?.kill()
        move.current = null
        excursion.current?.kill()
        fromPos.current.copy(camera.position)
        fromQuat.current.copy(camera.quaternion)
        const fromFov = camera.fov

        // L'OCULAIRE : la pose de la lune, reculée le long de son axe de visée.
        // Blender a déjà posé cette caméra à 58 cm du télescope, il n'y a donc
        // rien à ajouter à la scène — seulement à reculer.
        const eyePos = new Vector3(0, 0, 1)
          .applyQuaternion(moon.quaternion)
          .multiplyScalar(TELESCOPE_EYEPIECE_BACK)
          .add(moon.position)
        const eyeFov = verticalFov(TELESCOPE_APPROACH_HFOV, camera.aspect)
        const zoomFov = verticalFov(moon.hfov * TELESCOPE_FOV_PAD, camera.aspect)

        // DEUX TEMPS. En un seul vol, la caméra traversait l'instrument pour
        // finir en gros plan de lune, sans que rien ne dise qu'un télescope se
        // trouvait entre les deux. Ici on vient d'abord coller l'œil à
        // l'oculaire — c'est là que la visée s'ouvre — puis le second temps ne
        // fait plus que grossir, À L'INTÉRIEUR de la visée.
        const t = { v: 0 }
        excursion.current = gsap.to(t, {
          v: 1,
          duration: TELESCOPE_APPROACH_S,
          ease: 'power2.inOut',
          onUpdate: () => {
            camera.position.lerpVectors(fromPos.current, eyePos, t.v)
            camera.quaternion.copy(fromQuat.current).slerp(moon.quaternion, t.v)
            camera.fov = fromFov + (eyeFov - fromFov) * t.v
            camera.updateProjectionMatrix()
          },
          onComplete: () => {
            // La visée s'ouvre ICI : on est derrière l'oculaire, et le
            // grossissement qui suit se produit dans le cache circulaire.
            useInteraction.getState().settleTelescope()
            const z = { v: 0 }
            excursion.current = gsap.to(z, {
              v: 1,
              duration: TELESCOPE_ZOOM_S,
              ease: 'power2.inOut',
              onUpdate: () => {
                camera.position.lerpVectors(eyePos, moon.position, z.v)
                camera.fov = eyeFov + (zoomFov - eyeFov) * z.v
                camera.updateProjectionMatrix()
              },
              // La lune est ARRIVÉE. C'est ce moment-là que l'encadré attend,
              // et pas l'ouverture de la visée : entre les deux, on regarde un
              // ciel lointain, et une phrase sur la lune y désignerait un
              // sujet qu'on ne voit pas encore.
              onComplete: () => useInteraction.getState().revealMoon(),
            })
          },
        })
      }

      if (prev.phase === 'telescope' && state.phase !== 'telescope') {
        excursion.current?.kill()
        returning.current = true
        const backPos = camera.position.clone()
        const backQuat = camera.quaternion.clone()
        const backFov = camera.fov
        // Là où le tour pointe : c'est la pose, directement. Il fallait une
        // caméra jetable tant que la pose du tour n'existait que comme une
        // progression sur la polyligne — et cette caméra devait porter le VRAI
        // rapport d'écran, sans quoi le champ vertical était calculé pour un
        // cadre carré et le retour arrivait zoomé. Le piège disparaît avec
        // elle : `applyPose` est le seul endroit qui convertit, et il lit le
        // rapport de la caméra de rendu.
        const railFov = verticalFov(pose.hfov, camera.aspect)
        const t = { v: 0 }
        excursion.current = gsap.to(t, {
          v: 1,
          duration: 1.2,
          ease: 'power2.inOut',
          onUpdate: () => {
            camera.position.lerpVectors(backPos, pose.position, t.v)
            camera.quaternion.copy(backQuat).slerp(pose.quaternion, t.v)
            camera.fov = backFov + (railFov - backFov) * t.v
            camera.updateProjectionMatrix()
          },
          onComplete: () => {
            returning.current = false
            // La lune redevient stylisée ICI, et pas à la touche `Échap` : à
            // l'instant de la sortie elle remplit encore l'écran, et l'échange
            // s'y verrait autant qu'au clic. À la fin du retour, elle est
            // redevenue un petit disque dans la fenêtre.
            useInteraction.getState().showDetailedMoon(false)
          },
        })
      }
    })
    return unsub
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stops, moon, camera])

  // --- Per-frame: ONE camera write, owned by the current phase ------------------------
  useFrame(() => {
    if (stops.length === 0) return
    const { phase, consumeStopRequest } = useInteraction.getState()

    // HUD-requested jumps (stop rail clicks).
    // Les sauts — barre de menu, rail du HUD — vont DROIT au but. Un pas de
    // molette ou de flèche continue de suivre le parcours, ce qui revient au
    // même sur un segment : entre deux arrêts voisins, la polyligne EST la
    // droite.
    const requested = consumeStopRequest()
    if (requested !== null && (phase === 'touring' || phase === 'parked')) {
      moveToIndex(requested)
    }

    // La sonde est écrite AVANT les sorties anticipées, sinon elle se fige à
    // l'état d'avant pendant tout ce qui ne passe pas par la boucle du tour —
    // un vol direct, une excursion — et raconte que rien ne bouge au moment
    // précis où on la lit pour savoir ce qui bouge. Mesuré : elle annonçait
    // encore l'arrêt de départ pendant les 1,6 s d'un saut.
    if (import.meta.env.DEV) {
      ;(window as unknown as Record<string, unknown>).__rigDebug = {
        target: targetIndex.current,
        hfov: +pose.hfov.toFixed(2),
        phase,
        moving: !!move.current,
        // Le regard autour du sujet : l'angle courant et la position qu'il
        // donne. Sans la position, vérifier qu'un arrêt REFUSE le regard
        // demanderait de comparer des captures à l'œil — or l'absence de
        // mouvement est exactement ce qu'une image ne montre pas.
        yaw: +yaw.current.toFixed(3),
        pos: [
          +camera.position.x.toFixed(4),
          +camera.position.y.toFixed(4),
          +camera.position.z.toFixed(4),
        ],
      }
    }

    // PANEL_OPEN / TELESCOPE own the camera (frozen or excursion tween).
    if (phase === 'panel' || phase === 'telescope' || returning.current) return

    // Le regard autour du sujet (2026-08-25).
    //
    // **La coupure sous « mouvement réduit » est la PREMIÈRE chose évaluée**,
    // exactement comme la boucle du chat. Un élément qui suit le curseur bouge
    // à chaque mouvement de souris, pour n'importe quelle raison : c'est le cas
    // d'école de ce que le réglage vise. Et c'est aussi ce qui garde la boucle
    // de comparaison déterministe, puisqu'elle capture en mouvement réduit.
    //
    // La cible est 0 partout ailleurs qu'à l'arrêt : le regard se DÉROULE au
    // départ d'un mouvement au lieu d'être coupé net, et il n'y a donc rien à
    // annuler quelque part.
    const radius = pivots[targetIndex.current] ?? 0
    const target =
      phase === 'parked' && !move.current && radius > 0 && !reducedMotion()
        ? lookYaw(cursorX.current ?? 0, pose.hfov)
        : 0
    yaw.current = approachYaw(yaw.current, target)

    // UNE écriture de caméra par image, depuis LA pose. Le mouvement, lui, ne
    // touche jamais la caméra : il ne fait que déplacer la pose.
    //
    // Le regard se compose ICI et ne rentre jamais dans `pose` : celle-ci
    // reste la pose que Blender a autorisée. L'y fondre la ferait dériver à
    // chaque mouvement de souris, et le mouvement suivant partirait d'un
    // ailleurs que personne n'a composé.
    if (Math.abs(yaw.current) < LOOK_EPSILON_DEG) {
      applyPose(camera, pose)
    } else {
      applyPose(camera, orbitPose(looked, pose, radius, yaw.current))
    }
  })

  return null
}
