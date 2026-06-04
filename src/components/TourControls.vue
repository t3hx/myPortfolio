<script setup lang="ts">
import { CAMERA_STOPS } from '@/config/cameraStops'

defineProps<{
  currentIndex: number
  disabled?: boolean
}>()

const emit = defineEmits<{
  select: [index: number]
  prev: []
  next: []
}>()
</script>

<template>
  <nav class="hud">
    <button class="arrow" :disabled="disabled" aria-label="Previous" @click="emit('prev')">‹</button>

    <ul class="stops">
      <li v-for="(stop, i) in CAMERA_STOPS" :key="stop.camera">
        <button
          class="stop"
          :class="{ active: i === currentIndex }"
          :disabled="disabled"
          @click="emit('select', i)"
        >
          {{ stop.label }}
        </button>
      </li>
    </ul>

    <button class="arrow" :disabled="disabled" aria-label="Next" @click="emit('next')">›</button>
  </nav>
</template>

<style scoped>
.hud {
  position: absolute;
  bottom: clamp(12px, 4vh, 36px);
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border: 1px solid rgba(120, 200, 255, 0.18);
  border-radius: 999px;
  background: rgba(6, 9, 20, 0.55);
  backdrop-filter: blur(10px);
  font-family: 'JetBrains Mono', ui-monospace, 'SFMono-Regular', monospace;
  max-width: min(92vw, 760px);
}
.stops {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 4px;
  list-style: none;
  margin: 0;
  padding: 0;
}
.stop,
.arrow {
  appearance: none;
  border: 1px solid transparent;
  background: transparent;
  color: rgba(190, 215, 255, 0.65);
  font: inherit;
  font-size: 12px;
  letter-spacing: 0.04em;
  padding: 6px 12px;
  border-radius: 999px;
  cursor: pointer;
  transition:
    color 0.2s,
    background 0.2s,
    border-color 0.2s;
}
.arrow {
  font-size: 18px;
  line-height: 1;
  padding: 4px 10px;
}
.stop:hover:not(:disabled),
.arrow:hover:not(:disabled) {
  color: #eaf4ff;
  background: rgba(120, 200, 255, 0.08);
}
.stop.active {
  color: #07101f;
  background: linear-gradient(180deg, #8fe3ff, #4aa8ff);
  border-color: rgba(143, 227, 255, 0.6);
  box-shadow: 0 0 16px rgba(74, 168, 255, 0.45);
}
.stop:disabled,
.arrow:disabled {
  opacity: 0.4;
  cursor: default;
}
</style>
