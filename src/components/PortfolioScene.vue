<script setup lang="ts">
import { OrbitControls } from '@tresjs/cientos'
import { TresCanvas, type TresContext } from '@tresjs/core'
import { NoToneMapping, type PerspectiveCamera } from 'three'
import { ref, shallowRef } from 'vue'
import RoomModel from '@/components/RoomModel.vue'
import PostFx from '@/components/PostFx.vue'
import TourControls from '@/components/TourControls.vue'
import { useCameraTour, type StopTransform } from '@/composables/useCameraTour'
import {
  CLEAR_COLOR,
  MODEL_SRC,
  OUTPUT_COLOR_SPACE,
  SHADOW_MAP_TYPE,
  TONE_MAPPING,
  TONE_MAPPING_EXPOSURE,
} from '@/config/blenderMatch'

// Flip these to taste.
const postFx = ref(false) // bloom + AGX tone-mapping pass (see PostFx.vue)
const freeLook = ref(false) // OrbitControls instead of the guided tour

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
  if (payload.stops.size === 0) freeLook.value = true
}

function select(index: number) {
  if (!freeLook.value) tour.goTo(index)
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
      <!-- Our render camera. The tour tweens this; the .glb's own cameras are only
           read for their transforms, never made active. Initial pose is a sensible
           seed near the Home stop so the first frame isn't at the origin. -->
      <TresPerspectiveCamera
        ref="cameraRef"
        :fov="37.85"
        :near="0.05"
        :far="1000"
        :position="[0, 1.1, -1.718]"
        :look-at="[0, 1.1, 0]"
      />

      <!-- Faint ambient approximating the dim Blender world contribution. -->
      <TresAmbientLight :color="'#0a1430'" :intensity="0.15" />

      <Suspense>
        <RoomModel :src="MODEL_SRC" @ready="onModelReady" />
      </Suspense>

      <OrbitControls v-if="freeLook" make-default />

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
      v-if="!freeLook && !loading"
      :current-index="tour.currentIndex.value"
      :disabled="tour.isTweening.value"
      @select="select"
      @prev="tour.prev()"
      @next="tour.next()"
    />
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
</style>
