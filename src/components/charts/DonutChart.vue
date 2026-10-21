<script setup lang="ts">
import { computed, ref } from 'vue'

interface DonutSlice {
  key: string
  label: string
  count: number
  color: string
}

const props = defineProps<{
  slices: DonutSlice[]
  /** 0 → 1: o anel é desenhado no sentido horário até se completar. */
  progress: number
  centerLabel: string
}>()

const SIZE = 160
const STROKE = 22
const R = (SIZE - STROKE) / 2
const C = 2 * Math.PI * R
const GAP = 2 // espaço entre fatias, na cor da superfície

const total = computed(() => props.slices.reduce((sum, s) => sum + s.count, 0))

const arcs = computed(() => {
  const visible = props.slices.filter((s) => s.count > 0)
  const gap = visible.length > 1 ? GAP : 0
  let offset = 0
  return visible.map((s) => {
    const full = (s.count / total.value) * C
    const length = Math.max(0, full * props.progress - gap)
    const arc = { ...s, length, offset: offset * props.progress }
    offset += full
    return arc
  })
})

const hovered = ref<string | null>(null)
</script>

<template>
  <div class="donut">
    <svg :viewBox="`0 0 ${SIZE} ${SIZE}`" role="img" :aria-label="`${total} ${centerLabel}`">
      <circle
        :cx="SIZE / 2"
        :cy="SIZE / 2"
        :r="R"
        fill="none"
        stroke="#eef1f6"
        :stroke-width="STROKE"
      />
      <g :transform="`rotate(-90 ${SIZE / 2} ${SIZE / 2})`">
        <circle
          v-for="a in arcs"
          :key="a.key"
          :cx="SIZE / 2"
          :cy="SIZE / 2"
          :r="R"
          fill="none"
          :stroke="a.color"
          :stroke-width="hovered === a.key ? STROKE + 4 : STROKE"
          :stroke-dasharray="`${a.length} ${C}`"
          :stroke-dashoffset="-a.offset"
          class="donut__arc"
          @pointerenter="hovered = a.key"
          @pointerleave="hovered = null"
        >
          <title>{{ a.label }}: {{ a.count }}</title>
        </circle>
      </g>
      <text :x="SIZE / 2" :y="SIZE / 2 - 4" text-anchor="middle" class="donut__total">
        {{ Math.round(total * progress) }}
      </text>
      <text :x="SIZE / 2" :y="SIZE / 2 + 16" text-anchor="middle" class="donut__label">
        {{ centerLabel }}
      </text>
    </svg>
  </div>
</template>

<style scoped>
.donut svg {
  display: block;
  width: 100%;
  max-width: 170px;
  margin: 0 auto;
}

.donut__arc {
  transition: stroke-width 0.15s;
  cursor: default;
}

.donut__total {
  fill: var(--navy-800);
  font-size: 26px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}

.donut__label {
  fill: #8a91a3;
  font-size: 11px;
}
</style>
