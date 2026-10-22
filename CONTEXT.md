# Portfolio 3D

The visitor tours a Blender-authored room stop by stop. This glossary fixes the words the code, the issues and the design handoffs use for the same things.

## Language

### The visit

**Stop**:
A camera framing authored in Blender and listed in the tour order. `Home` is the first one.
_Avoid_: Scene, view, section

**Tour**:
The ordered list of stops. One scroll gesture moves to the next or previous stop.

**Discovery** (`revealed`):
The moment the preloader has finished fading and the visitor sees the room. Self-starting animations may only start from here.
_Avoid_: Reveal, révélation

**Reveal** (révélation):
The first scroll away from `Home`, which pulls the camera back and shows the room in volume. A product beat, never triggered by code.
_Avoid_: Discovery, transition

**Bubble**:
The one dialogue box each stop shows, anchored to the framed object. `Home` has a single-sentence bubble.

### The intro

**Intro**:
The 20-second animation shown on the main screen, playing once per page load. It starts a short beat (under a second) after discovery, never on the same frame. Three phases: Idea, Design, Realisation.
_Avoid_: Splash, boot, loader

**Main screen**:
The horizontal monitor of the desk PC, the surface the `Home` framing fills. The intro is displayed by it.
_Avoid_: Monitor, écran (ambiguous with the vertical monitor that displays the CV)

**Phase**:
One of the intro's three chapters. Each carries a phase word (GENESIS, INCUBATION, EMERGENCE) that is language-neutral by decision.
_Avoid_: Scene, act

**Plan** (le plan du lab):
The line drawing of the desk that draws itself stroke by stroke during the Design phase. The handoff's "révélation de la scène" refers to it.
_Avoid_: Scene, lab, blueprint

**Final image** (`introDone`, "la dernière image"):
The last frame of the intro: the name, the etched title, the dimmed triangle, the plan at low opacity. Reached at T = 20 s, by a skip gesture, or immediately under reduced motion. The main screen keeps it for the rest of the visit. The `Home` bubble appears one second after it is reached, never before.
_Avoid_: Freeze, gel, end, done

**Skip gesture**:
A wheel event or the Escape key during the intro. It cuts straight to the final image and does nothing else; the camera does not move, and the bubble follows one second later as usual. There is no skip button, and the gesture exists mostly for the author.
