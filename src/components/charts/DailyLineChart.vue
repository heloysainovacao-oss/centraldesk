<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { DAILY_SERIES as SERIES } from '@/constants/charts'
import type { DailyPoint } from '@/utils/metrics'

const props = defineProps<{
  points: DailyPoint[]
  /** 0 → 1: as linhas sobem da base até o valor real. */
  progress: number
}>()

const HEIGHT = 260
const PAD = { top: 12, right: 16, bottom: 28, left: 32 }

const container = ref<HTMLElement | null>(null)
const width = ref(640)
let observer: ResizeObserver | undefined

onMounted(() => {
  if (!container.value) return
  observer = new ResizeObserver(([entry]) => {
    if (entry) width.value = Math.max(280, entry.contentRect.width)
  })
  observer.observe(container.value)
})
onBeforeUnmount(() => observer?.disconnect())

const plotW = computed(() => width.value - PAD.left - PAD.right)
const plotH = HEIGHT - PAD.top - PAD.bottom

// Escala "redonda" no eixo Y: 4 divisões de valores inteiros.
const yMax = computed(() => {
  const max = Math.max(1, ...props.points.flatMap((p) => [p.opened, p.resolved]))
  const step = Math.max(1, Math.ceil(max / 4))
  return step * 4
})
const yTicks = computed(() => [0, 1, 2, 3, 4].map((i) => (yMax.value / 4) * i))

const x = (i: number) =>
  PAD.left + (props.points.length > 1 ? (i / (props.points.length - 1)) * plotW.value : 0)
const y = (v: number) => PAD.top + plotH - (v / yMax.value) * plotH

const paths = computed(() =>
  SERIES.map((s) => ({
    ...s,
    d: props.points
      .map(
        (p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p[s.key] * props.progress).toFixed(1)}`,
      )
      .join(' '),
  })),
)

const dayLabel = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' })
const longDay = new Intl.DateTimeFormat('pt-BR', {
  weekday: 'short',
  day: '2-digit',
  month: 'short',
})

// Até 5 rótulos no eixo X, espaçados por igual.
const xLabels = computed(() => {
  const n = props.points.length
  if (!n) return []
  const count = Math.min(5, n)
  const idx = Array.from({ length: count }, (_, k) =>
    Math.round((k / Math.max(1, count - 1)) * (n - 1)),
  )
  return [...new Set(idx)].map((i) => ({
    i,
    text: dayLabel.format(props.points[i]!.day),
    anchor: i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle',
  }))
})

// --- Dica ao passar o mouse ---
const hover = ref<number | null>(null)

function onMove(event: PointerEvent) {
  const svg = event.currentTarget as SVGElement
  const rect = svg.getBoundingClientRect()
  const px = ((event.clientX - rect.left) / rect.width) * width.value
  const n = props.points.length
  if (!n) return
  const i = Math.round(((px - PAD.left) / plotW.value) * (n - 1))
  hover.value = Math.min(n - 1, Math.max(0, i))
}

const tooltip = computed(() => {
  if (hover.value === null) return null
  const p = props.points[hover.value]
  if (!p) return null
  const left = (x(hover.value) / width.value) * 100
  return { p, left, alignRight: left > 60 }
})
</script>

<template>
  <div ref="container" class="chart">
    <svg
      :viewBox="`0 0 ${width} ${HEIGHT}`"
      :width="width"
      :height="HEIGHT"
      role="img"
      aria-label="Gráfico de chamados abertos e encerrados por dia"
      @pointermove="onMove"
      @pointerleave="hover = null"
    >
      <g class="grid">
        <g v-for="t in yTicks" :key="t">
          <line :x1="PAD.left" :x2="width - PAD.right" :y1="y(t)" :y2="y(t)" />
          <text :x="PAD.left - 8" :y="y(t)" text-anchor="end" dominant-baseline="middle">
            {{ Math.round(t) }}
          </text>
        </g>
      </g>
      <line class="baseline" :x1="PAD.left" :x2="width - PAD.right" :y1="y(0)" :y2="y(0)" />
      <text
        v-for="l in xLabels"
        :key="l.i"
        class="x-label"
        :x="x(l.i)"
        :y="HEIGHT - 8"
        :text-anchor="l.anchor"
      >
        {{ l.text }}
      </text>

      <line
        v-if="tooltip"
        class="crosshair"
        :x1="x(hover!)"
        :x2="x(hover!)"
        :y1="PAD.top"
        :y2="y(0)"
      />

      <path
        v-for="s in paths"
        :key="s.key"
        :d="s.d"
        fill="none"
        :stroke="s.color"
        stroke-width="2"
        stroke-linejoin="round"
        stroke-linecap="round"
      />

      <template v-if="tooltip">
        <circle
          v-for="s in SERIES"
          :key="s.key"
          :cx="x(hover!)"
          :cy="y(tooltip.p[s.key] * progress)"
          r="4.5"
          :fill="s.color"
          stroke="#fff"
          stroke-width="2"
        />
      </template>
    </svg>

    <div
      v-if="tooltip"
      class="tooltip"
      :class="{ 'tooltip--right': tooltip.alignRight }"
      :style="{ left: `${tooltip.left}%` }"
      role="presentation"
    >
      <strong>{{ longDay.format(tooltip.p.day) }}</strong>
      <span v-for="s in SERIES" :key="s.key">
        <i :style="{ background: s.color }" />{{ s.label }}
        <b>{{ tooltip.p[s.key] }}</b>
      </span>
    </div>

    <!-- Os mesmos dados em tabela, para leitores de tela -->
    <table class="sr-only">
      <caption>
        Chamados abertos e encerrados por dia
      </caption>
      <thead>
        <tr>
          <th scope="col">Dia</th>
          <th v-for="s in SERIES" :key="s.key" scope="col">{{ s.label }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="p in points" :key="p.day.getTime()">
          <th scope="row">{{ dayLabel.format(p.day) }}</th>
          <td>{{ p.opened }}</td>
          <td>{{ p.resolved }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.chart {
  position: relative;
  width: 100%;
}

svg {
  display: block;
  width: 100%;
  height: auto;
  overflow: visible;
  touch-action: pan-y;
}

.grid line {
  stroke: #e9ecf2;
  stroke-width: 1;
}

.grid text,
.x-label {
  fill: #8a91a3;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

.baseline {
  stroke: #c9cfdb;
  stroke-width: 1;
}

.crosshair {
  stroke: #8a91a3;
  stroke-width: 1;
  stroke-dasharray: 3 3;
}

.tooltip {
  position: absolute;
  top: 0;
  z-index: 2;
  display: grid;
  gap: 4px;
  min-width: 150px;
  padding: 10px 12px;
  border: 1px solid var(--card-border);
  border-radius: 10px;
  background: #fff;
  box-shadow: 0 8px 24px rgba(11, 34, 105, 0.12);
  color: var(--text);
  font-size: 0.8125rem;
  pointer-events: none;
  transform: translateX(12px);
}

.tooltip--right {
  transform: translateX(calc(-100% - 12px));
}

.tooltip strong {
  margin-bottom: 2px;
  color: var(--navy-800);
}

.tooltip span {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-muted);
}

.tooltip i {
  width: 12px;
  height: 2px;
  border-radius: 1px;
}

.tooltip b {
  margin-left: auto;
  color: var(--text);
  font-variant-numeric: tabular-nums;
}
</style>
