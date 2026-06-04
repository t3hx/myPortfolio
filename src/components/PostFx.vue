<script setup lang="ts">
/**
 * OPTIONAL post-processing to recover EEVEE's bloom on the emissive parts of the
 * scene (LED tiles, monitors, the purple PC glow).
 *
 * IMPORTANT: when this is active, the TresCanvas tone mapping must be NoToneMapping,
 * because tone mapping is done here as the LAST effect instead (AGX, to match Blender).
 * PortfolioScene.vue already wires that up via the `postFx` flag — just flip it on.
 */
import { BloomPmndrs, EffectComposerPmndrs, ToneMappingPmndrs } from '@tresjs/post-processing'
import { ToneMappingMode } from 'postprocessing'
</script>

<template>
  <EffectComposerPmndrs>
    <BloomPmndrs
      :intensity="0.7"
      :luminance-threshold="0.9"
      :luminance-smoothing="0.2"
      mipmap-blur
    />
    <ToneMappingPmndrs :mode="ToneMappingMode.AGX" />
  </EffectComposerPmndrs>
</template>
