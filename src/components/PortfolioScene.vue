<script setup lang="ts">
import { KeyboardControls } from '@tresjs/cientos'
import { TresCanvas, type TresContext } from '@tresjs/core'
import { NoToneMapping, type PerspectiveCamera } from 'three'
import { ref, shallowRef } from 'vue'
import RoomModel from '@/components/RoomModel.vue'
import PostFx from '@/components/PostFx.vue'
import TourControls from '@/components/TourControls.vue'
import { useCameraTour, type StopTransform } from '@/composables/useCameraTour'
import { useStopParam, useViewMode } from '@/composables/useViewMode'
import { CAMERA_STOPS } from '@/config/cameraStops'
import {
  CLEAR_COLOR,
  MODEL_SRC,
  OUTPUT_COLOR_SPACE,
  SHADOW_MAP_TYPE,
  TONE_MAPPING,
  TONE_MAPPING_EXPOSURE,
  WORLD_AMBIENT_COLOR,
  WORLD_AMBIENT_INTENSITY,
} from '@/config/blenderMatch'

const postFx = ref(true) // bloom + AGX tone-mapping pass (see PostFx.vue)

// View mode is resolved once from the URL at module load — see useViewMode.ts.
// 'tour' is the default; ?debug-fly opts into first-person nav.
const mode = useViewMode()

const loading = ref(true)
const cameraRef = shallowRef<PerspectiveCamera | null>(null)
const stops = shallowRef<Map<string, StopTransform>>(new Map())

const tour = useCameraTour(cameraRef, stops)

function onReady(ctx: TresContext) {
  // Soft shadows to match the EEVEE look.
  ctx.renderer.instance.shadowMap.type = SHADOW_MAP_TYPE
}

function onModelReady(payload: { stops: Map<string, StopTransform> }) {
  stops.value = payload.stops
  loading.value = false

  // Optional ?stop=<label> deep-link: snap to that camera stop on first load.
  // Matches the friendly label from cameraStops.ts (case-insensitive); 'bookshelfplant'
  // also resolves under the shorter 'bookshelf' alias used in docs/renders/refs/.
  const target = useStopParam()
  if (!target) return
  const index = CAMERA_STOPS.findIndex(
    (s) => s.label.toLowerCase() === target || s.label.toLowerCase().startsWith(target),
  )
  if (index !== -1) tour.snapTo(index)
}

function select(index: number) {
  if (mode === 'tour') tour.goTo(index)
}
</script>

<template>
  <div class="stage">
    <TresCanvas
      :clear-color="CLEAR_COLOR"
      :tone-mapping="postFx ? NoToneMapping : TONE_MAPPING"
      :tone-mapping-exposure="TONE_MAPPING_EXPOSURE"
      :output-color-space="OUTPUT_COLOR_SPACE"
      shadows
      @ready="onReady"
    >
      <!-- Our render camera. In 'tour' mode the tour tweens this between stops;
           in 'fly' mode KeyboardControls drives it from WASD/ZQSD + mouse-look.
           The .glb's own cameras are only read for their transforms, never made active.
           Initial pose is a sensible seed near the Home stop so the first frame isn't
           at the origin. -->
      <TresPerspectiveCamera
        ref="cameraRef"
        :fov="37.85"
        :near="0.05"
        :far="1000"
        :position="[0, 1.1, -1.718]"
        :look-at="[0, 1.1, 0]"
      />

      <!-- Ambient defaults to 0 intensity in blenderMatch.ts — kept here as a knob
           in case a future scene needs world fill. See WORLD_AMBIENT_INTENSITY docs. -->
      <TresAmbientLight :color="WORLD_AMBIENT_COLOR" :intensity="WORLD_AMBIENT_INTENSITY" />

      <Suspense>
        <RoomModel :src="MODEL_SRC" @ready="onModelReady" />
      </Suspense>

      <!-- WASD on QWERTY / ZQSD on AZERTY + mouse-look (PointerLock under the hood). -->
      <KeyboardControls v-if="mode === 'fly'" :move-speed="0.05" />

      <Suspense v-if="postFx">
        <PostFx />
      </Suspense>
    </TresCanvas>

    <Transition name="fade">
      <div v-if="loading" class="loader">
        <span class="spinner" />
        <p>Loading scene…</p>
      </div>
    </Transition>

    <TourControls
      v-if="mode === 'tour' && !loading"
      :current-index="tour.currentIndex.value"
      :disabled="tour.isTweening.value"
      @select="select"
      @prev="tour.prev()"
      @next="tour.next()"
    />

    <div v-if="mode === 'fly' && !loading" class="fly-hint">
      <p><strong>Click</strong> to capture mouse · <kbd>Esc</kbd> to release</p>
      <p>Move: <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> (or <kbd>Z</kbd><kbd>Q</kbd><kbd>S</kbd><kbd>D</kbd>) · Arrow keys also work</p>
    </div>
  </div>
</template>

<style scoped>
.stage {
  position: fixed;
  inset: 0;
  background: #04050c;
}
.loader {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  color: rgba(190, 215, 255, 0.7);
  font-family: ui-monospace, monospace;
  font-size: 13px;
  letter-spacing: 0.08em;
}
.spinner {
  width: 26px;
  height: 26px;
  border: 2px solid rgba(120, 200, 255, 0.2);
  border-top-color: #6fd0ff;
  border-radius: 50%;
  animation: spin 0.9s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
.fade-leave-active {
  transition: opacity 0.6s ease;
}
.fade-leave-to {
  opacity: 0;
}
.fly-hint {
  position: absolute;
  top: clamp(12px, 3vh, 28px);
  left: 50%;
  transform: translateX(-50%);
  padding: 10px 14px;
  border: 1px solid rgba(120, 200, 255, 0.18);
  border-radius: 10px;
  background: rgba(6, 9, 20, 0.55);
  backdrop-filter: blur(10px);
  color: rgba(190, 215, 255, 0.75);
  font-family: 'JetBrains Mono', ui-monospace, 'SFMono-Regular', monospace;
  font-size: 12px;
  letter-spacing: 0.03em;
  line-height: 1.6;
  text-align: center;
  pointer-events: none;
}
.fly-hint p {
  margin: 0;
}
.fly-hint kbd {
  display: inline-block;
  padding: 1px 6px;
  margin: 0 2px;
  border: 1px solid rgba(120, 200, 255, 0.35);
  border-radius: 4px;
  background: rgba(120, 200, 255, 0.08);
  color: #eaf4ff;
  font-size: 11px;
}
</style>
