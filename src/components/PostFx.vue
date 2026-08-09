<script setup lang="ts">
/**
 * Post-processing chain to match the Blender EEVEE references.
 *
 *   1. Bloom        — recover emissive glow on PC fans, LED tiles, cat eyes, etc.
 *   2. Tone mapping — AgX, the same view transform Blender uses (single biggest factor
 *                     in matching the look).
 *   3. Hue/Saturation — small saturation boost to compensate for AgX's intentional
 *                       highlight desaturation. Order matters: applied AFTER tone
 *                       mapping so it acts on already-clamped LDR values, not HDR.
 *
 * IMPORTANT: when this is active, the TresCanvas tone mapping must be NoToneMapping,
 * because tone mapping is done here as the LAST effect instead. PortfolioScene.vue
 * already wires that up via the `postFx` flag.
 */
import {
  BloomPmndrs,
  EffectComposerPmndrs,
  HueSaturationPmndrs,
  ToneMappingPmndrs,
} from '@tresjs/post-processing'
import { ToneMappingMode } from 'postprocessing'
import {
  BLOOM_INTENSITY,
  BLOOM_LUMINANCE_SMOOTHING,
  BLOOM_LUMINANCE_THRESHOLD,
  SATURATION,
} from '@/config/blenderMatch'
</script>

<template>
  <EffectComposerPmndrs>
    <BloomPmndrs
      :intensity="BLOOM_INTENSITY"
      :luminance-threshold="BLOOM_LUMINANCE_THRESHOLD"
      :luminance-smoothing="BLOOM_LUMINANCE_SMOOTHING"
      mipmap-blur
    />
    <ToneMappingPmndrs :mode="ToneMappingMode.AGX" />
    <HueSaturationPmndrs :saturation="SATURATION" />
  </EffectComposerPmndrs>
</template>
