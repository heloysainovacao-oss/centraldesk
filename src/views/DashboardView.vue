<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { Bar, Doughnut, Line } from 'vue-chartjs'
import type { ChartData, ChartOptions } from 'chart.js'
import { ANIMATION_MS } from '@/charts/setup'
import { centerText, sliceLabels } from '@/charts/doughnutLabels'
import StatusBadge from '@/components/StatusBadge.vue'
import { useGrowAnimation } from '@/composables/useGrowAnimation'
import { GROUP_COLORS, OTHERS_COLOR, SATISFACTION_COLORS, TIME_SERIES } from '@/constants/charts'
import { DEPARTMENTS } from '@/constants/departments'
import {
  PRIORITIES,
  STATUSES,
  priorityById,
  type PriorityId,
  type TicketStatus,
} from '@/constants/tickets'
import { useCategoriesStore } from '@/stores/categories'
import { formatTicketNumber, useTicketsStore } from '@/stores/tickets'
import { formatDuration } from '@/utils/format'
import {
  countBy,
  countsPerDay,
  dayRange,
  filterTickets,
  intervalRange,
  monthRange,
  satisfactionSplit,
  summarize,
  timesPerDay,
  topWithOthers,
  type DashboardFilters,
} from '@/utils/dashboard'

const tickets = useTicketsStore()
const categories = useCategoriesStore()

// ---------- Filtros ----------

const pad = (n: number) => String(n).padStart(2, '0')
const today = new Date()
const isoDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

type Mode = 'dia' | 'mes' | 'intervalo'
const MODES = [
  { id: 'dia', label: 'Dia' },
  { id: 'mes', label: 'Mês' },
  { id: 'intervalo', label: 'Intervalo' },
] as const
const mode = ref<Mode>('mes')
const dayValue = ref(isoDay(today))
const monthValue = ref(`${today.getFullYear()}-${pad(today.getMonth() + 1)}`)
const startValue = ref(isoDay(new Date(today.getFullYear(), today.getMonth(), 1)))
const endValue = ref(isoDay(today))

const sector = ref('')
const status = ref<TicketStatus | ''>('')
const category = ref('')
const priority = ref<PriorityId | ''>('')

const range = computed(() => {
  if (mode.value === 'dia' && dayValue.value) return dayRange(dayValue.value)
  if (mode.value === 'intervalo' && startValue.value && endValue.value)
    return intervalRange(startValue.value, endValue.value)
  return monthRange(monthValue.value || `${today.getFullYear()}-${pad(today.getMonth() + 1)}`)
})

const filters = computed<DashboardFilters>(() => ({
  ...range.value,
  sector: sector.value,
  status: status.value,
  category: category.value,
  priority: priority.value,
}))

const STATUS_ORDER: TicketStatus[] = ['aberto', 'em-andamento', 'resolvido']
const sectorOptions = computed(() => [
  ...new Set([...DEPARTMENTS, ...tickets.tickets.map((t) => t.sector)]),
])
const categoryOptions = computed(() => [
  ...new Set([
    ...categories.categories.map((c) => c.name),
    ...tickets.tickets.map((t) => t.category),
  ]),
])
const activeFilterCount = computed(
  () => [sector.value, status.value, category.value, priority.value].filter(Boolean).length,
)

function clearFilters() {
  sector.value = ''
  status.value = ''
  category.value = ''
  priority.value = ''
}

const filtersOpen = ref(false)

const longDate = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'long',
  year: 'numeric',
})
const shortDate = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' })
const monthName = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' })

const periodLabel = computed(() => {
  const { from, to } = range.value
  if (mode.value === 'dia') return longDate.format(new Date(from))
  if (mode.value === 'mes') return monthName.format(new Date(from))
  return `${shortDate.format(new Date(from))} – ${shortDate.format(new Date(to - 1))}`
})

// ---------- Dados ----------

const filtered = computed(() =>
  filterTickets(tickets.tickets, filters.value).sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  ),
)
const summary = computed(() => summarize(filtered.value))
const perDay = computed(() => countsPerDay(tickets.tickets, filters.value))
const times = computed(() => timesPerDay(tickets.tickets, filters.value))
const satisfaction = computed(() => satisfactionSplit(filtered.value))

const avgFirstResponseMs = computed(() => {
  const values = filtered.value
    .filter((t) => t.assignedAt)
    .map((t) => new Date(t.assignedAt!).getTime() - new Date(t.createdAt).getTime())
  return values.length ? values.reduce((s, v) => s + v, 0) / values.length : null
})

const sectorGroups = computed(() =>
  topWithOthers(
    countBy(filtered.value, (t) => t.sector),
    GROUP_COLORS.length,
    'Outros setores',
  ).map((g, i) => ({
    ...g,
    color: g.label === 'Outros setores' ? OTHERS_COLOR : GROUP_COLORS[i]!,
  })),
)
// Até 5 categorias + "Outras categorias", para a legenda caber no painel.
const categoryGroups = computed(() =>
  topWithOthers(
    countBy(filtered.value, (t) => t.category),
    5,
    'Outras categorias',
  ).map((g) => ({
    ...g,
    color: g.label === 'Outras categorias' ? OTHERS_COLOR : categories.colorOf(g.label),
  })),
)
const satisfactionGroups = computed(() => [
  {
    label: 'Satisfeitos',
    count: satisfaction.value.satisfied,
    color: SATISFACTION_COLORS.satisfied,
  },
  {
    label: 'Insatisfeitos',
    count: satisfaction.value.unsatisfied,
    color: SATISFACTION_COLORS.unsatisfied,
  },
])

// ---------- Animação de 3 s ----------

const { progress, start } = useGrowAnimation(ANIMATION_MS || 1)
const chartKey = computed(() => JSON.stringify(filters.value))
onMounted(start)
watch(chartKey, start)

const grow = (n: number) => Math.round(n * progress.value)
const durationOf = (ms: number | null) => (ms === null ? '—' : formatDuration(ms * progress.value))

const kpis = computed(() => [
  { label: 'Criados', value: String(grow(summary.value.total)), tone: 'navy' },
  { label: 'Encerrados', value: String(grow(summary.value.resolved)), tone: 'green' },
  { label: 'Aguardando', value: String(grow(summary.value.open)), tone: 'amber' },
  { label: 'Em andamento', value: String(grow(summary.value.inProgress)), tone: 'blue' },
  { label: 'Média de 1ª resposta', value: durationOf(avgFirstResponseMs.value), tone: 'navy' },
  {
    label: 'Média de resolução',
    value: durationOf(summary.value.avgResolutionMs),
    tone: 'muted',
  },
])

const share = (count: number, total: number) => (total ? Math.round((count / total) * 100) : 0)
const sum = (rows: { count: number }[]) => rows.reduce((s, r) => s + r.count, 0)

// ---------- Gráficos ----------

const dayLabel = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' })
const animation = { duration: ANIMATION_MS, easing: 'easeOutCubic' } as const
/** Fonte maior nos eixos e dicas do dashboard (é feito para ser lido de longe). */
const axisFont = { size: 14, weight: 600 } as const
const tooltipFonts = { titleFont: { size: 14 }, bodyFont: { size: 14 } } as const

/** Criados (linha tracejada) x Encerrados (barras), como no modelo. */
const createdVsSolvedData = computed(
  () =>
    ({
      labels: perDay.value.map((d) => dayLabel.format(d.day)),
      datasets: [
        {
          type: 'line',
          label: 'Criados',
          data: perDay.value.map((d) => d.opened),
          borderColor: '#eb6834',
          backgroundColor: '#eb6834',
          borderWidth: 2,
          borderDash: [5, 4],
          pointRadius: 0,
          pointHoverRadius: 4,
          tension: 0.25,
          order: 1,
        },
        {
          type: 'bar',
          label: 'Encerrados',
          data: perDay.value.map((d) => d.resolved),
          backgroundColor: '#1c5cab',
          borderRadius: 3,
          maxBarThickness: 14,
          order: 2,
        },
      ],
    }) as unknown as ChartData<'bar'>,
)

const createdVsSolvedOptions: ChartOptions<'bar'> = {
  animation,
  interaction: { mode: 'index', intersect: false },
  plugins: { legend: { display: false }, tooltip: tooltipFonts },
  scales: {
    x: { grid: { display: false }, ticks: { maxTicksLimit: 10, maxRotation: 0, font: axisFont } },
    y: { beginAtZero: true, ticks: { precision: 0, maxTicksLimit: 5, font: axisFont } },
  },
}

const timesData = computed<ChartData<'line'>>(() => ({
  labels: times.value.map((d) => dayLabel.format(d.day)),
  datasets: [...TIME_SERIES].reverse().map((s) => ({
    label: s.label,
    data: times.value.map((d) => (d[s.key] === null ? null : Number(d[s.key]!.toFixed(1)))),
    borderColor: s.color,
    backgroundColor: `${s.color}${s.key === 'responseHours' ? 'cc' : '66'}`,
    borderWidth: 2,
    fill: 'origin',
    pointRadius: 0,
    pointHoverRadius: 4,
    tension: 0.3,
    spanGaps: true,
  })),
}))

const timesOptions: ChartOptions<'line'> = {
  animation,
  interaction: { mode: 'index', intersect: false },
  plugins: {
    legend: { display: false },
    tooltip: {
      ...tooltipFonts,
      callbacks: { label: (c) => `${c.dataset.label}: ${c.formattedValue} h` },
    },
  },
  scales: {
    x: { grid: { display: false }, ticks: { maxTicksLimit: 10, maxRotation: 0, font: axisFont } },
    y: {
      beginAtZero: true,
      ticks: { maxTicksLimit: 5, callback: (v) => `${v} h`, font: axisFont },
    },
  },
}

const doughnutOptions: ChartOptions<'doughnut'> = {
  animation: { ...animation, animateRotate: true },
  cutout: '58%',
  plugins: { legend: { display: false }, tooltip: tooltipFonts },
}

function doughnutData(rows: { label: string; count: number; color: string }[]) {
  return {
    labels: rows.map((r) => r.label),
    datasets: [
      {
        data: rows.map((r) => r.count),
        backgroundColor: rows.map((r) => r.color),
        borderColor: '#fff',
        borderWidth: 2,
      },
    ],
  } as ChartData<'doughnut'>
}

const sectorPlugins = [
  sliceLabels,
  centerText(() => ({ value: String(sum(sectorGroups.value)), label: 'chamados' })),
]
const categoryPlugins = [
  sliceLabels,
  centerText(() => ({ value: String(sum(categoryGroups.value)), label: 'chamados' })),
]
const satisfactionPlugins = [
  centerText(() => ({
    value: satisfaction.value.rate === null ? '—' : `${Math.round(satisfaction.value.rate * 100)}%`,
    label: 'satisfeitos',
  })),
]

// Os dados de cada rosca só mudam quando os filtros mudam (não a cada quadro da animação).
const donuts = computed(() => [
  {
    id: 'setor',
    title: 'Por setor',
    rows: sectorGroups.value,
    data: doughnutData(sectorGroups.value),
    plugins: sectorPlugins,
    total: sum(sectorGroups.value),
  },
  {
    id: 'categoria',
    title: 'Por categoria',
    rows: categoryGroups.value,
    data: doughnutData(categoryGroups.value),
    plugins: categoryPlugins,
    total: sum(categoryGroups.value),
  },
  {
    id: 'satisfacao',
    title: 'Satisfação',
    rows: satisfactionGroups.value,
    data: doughnutData(satisfactionGroups.value),
    plugins: satisfactionPlugins,
    total: satisfaction.value.rated,
  },
])

// ---------- Tela cheia ----------

const rootEl = ref<HTMLElement | null>(null)
const nativeFullscreen = ref(false)
// Plano B: se o navegador recusar a tela cheia, o dashboard cobre a janela inteira.
const windowFullscreen = ref(false)
const isFullscreen = computed(() => nativeFullscreen.value || windowFullscreen.value)

function syncFullscreen() {
  nativeFullscreen.value = document.fullscreenElement === rootEl.value
}

async function toggleFullscreen() {
  if (windowFullscreen.value) {
    windowFullscreen.value = false
    return
  }
  if (document.fullscreenElement) {
    await document.exitFullscreen()
    return
  }
  const el = rootEl.value
  if (!el?.requestFullscreen) {
    windowFullscreen.value = true
    return
  }
  // Alguns navegadores recusam ou nunca respondem: se a tela cheia não começar
  // em meio segundo, usamos o plano B.
  el.requestFullscreen().catch(() => (windowFullscreen.value = true))
  setTimeout(() => {
    if (!document.fullscreenElement) windowFullscreen.value = true
  }, 500)
}

function onKey(event: KeyboardEvent) {
  if (event.key === 'Escape' && windowFullscreen.value) windowFullscreen.value = false
}

onMounted(() => {
  document.addEventListener('fullscreenchange', syncFullscreen)
  document.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => {
  document.removeEventListener('fullscreenchange', syncFullscreen)
  document.removeEventListener('keydown', onKey)
})

// ---------- Lista de chamados (janela) ----------

const listEl = ref<HTMLDialogElement | null>(null)
const search = ref('')
const PAGE_SIZE = 12
const page = ref(1)

const searched = computed(() => {
  const term = search.value.trim().toLowerCase()
  if (!term) return filtered.value
  return filtered.value.filter(
    (t) =>
      t.title.toLowerCase().includes(term) ||
      formatTicketNumber(t.id).includes(term) ||
      (t.authorName ?? '').toLowerCase().includes(term) ||
      (t.assigneeName ?? '').toLowerCase().includes(term),
  )
})
const pageCount = computed(() => Math.max(1, Math.ceil(searched.value.length / PAGE_SIZE)))
const pageRows = computed(() =>
  searched.value.slice((page.value - 1) * PAGE_SIZE, page.value * PAGE_SIZE),
)
watch([search, chartKey], () => (page.value = 1))

const rowDate = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})
</script>

<template>
  <div
    ref="rootEl"
    class="dash"
    :class="{ 'dash--fullscreen': isFullscreen, 'dash--window': windowFullscreen }"
  >
    <!-- Cabeçalho + filtros -->
    <header class="dash__top">
      <div class="dash__heading">
        <nav v-if="!isFullscreen" class="breadcrumb" aria-label="Você está em">
          <RouterLink :to="{ name: 'metrics' }">Painel de métricas</RouterLink>
          <span aria-hidden="true">/</span>
          <span aria-current="page">Dashboard</span>
        </nav>
        <h1 class="dash__title">Dashboard de atendimento</h1>
      </div>

      <div class="dash__toolbar">
        <div class="segmented" role="group" aria-label="Tipo de período">
          <button
            v-for="m in MODES"
            :key="m.id"
            type="button"
            :class="{ active: mode === m.id }"
            :aria-pressed="mode === m.id"
            @click="mode = m.id"
          >
            {{ m.label }}
          </button>
        </div>
        <label v-if="mode === 'dia'" class="control">
          <span class="sr-only">Dia</span>
          <input v-model="dayValue" type="date" />
        </label>
        <label v-else-if="mode === 'mes'" class="control">
          <span class="sr-only">Mês</span>
          <input v-model="monthValue" type="month" />
        </label>
        <template v-else>
          <label class="control">
            <span class="sr-only">De</span>
            <input v-model="startValue" type="date" />
          </label>
          <label class="control">
            <span class="sr-only">Até</span>
            <input v-model="endValue" type="date" />
          </label>
        </template>

        <div class="filters">
          <button
            type="button"
            class="tool-btn"
            :aria-expanded="filtersOpen"
            @click="filtersOpen = !filtersOpen"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4" /></svg>
            Filtros
            <span v-if="activeFilterCount" class="tool-btn__count">{{ activeFilterCount }}</span>
          </button>
          <div v-if="filtersOpen" class="filters__panel">
            <label class="control control--block">
              <span>Setor</span>
              <select v-model="sector">
                <option value="">Todos os setores</option>
                <option v-for="s in sectorOptions" :key="s" :value="s">{{ s }}</option>
              </select>
            </label>
            <label class="control control--block">
              <span>Status</span>
              <select v-model="status">
                <option value="">Todos</option>
                <option v-for="st in STATUS_ORDER" :key="st" :value="st">
                  {{ STATUSES[st].label }}
                </option>
              </select>
            </label>
            <label class="control control--block">
              <span>Categoria</span>
              <select v-model="category">
                <option value="">Todas</option>
                <option v-for="c in categoryOptions" :key="c" :value="c">{{ c }}</option>
              </select>
            </label>
            <label class="control control--block">
              <span>Prioridade</span>
              <select v-model="priority">
                <option value="">Todas</option>
                <option v-for="p in PRIORITIES" :key="p.id" :value="p.id">{{ p.label }}</option>
              </select>
            </label>
            <div class="filters__actions">
              <button type="button" class="link-btn" @click="clearFilters">Limpar</button>
              <button
                type="button"
                class="btn btn--primary btn--small"
                @click="filtersOpen = false"
              >
                Aplicar
              </button>
            </div>
          </div>
        </div>

        <button type="button" class="tool-btn" @click="listEl?.showModal()">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />
          </svg>
          Ver chamados
        </button>
        <button type="button" class="tool-btn" @click="toggleFullscreen">
          <svg v-if="!isFullscreen" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
          </svg>
          <svg v-else viewBox="0 0 24 24" aria-hidden="true">
            <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
          </svg>
          {{ isFullscreen ? 'Sair da tela cheia' : 'Tela cheia' }}
        </button>
      </div>
    </header>

    <!-- Faixa de indicadores -->
    <section class="card kpis" aria-label="Indicadores do período">
      <p class="kpis__period">
        <span>{{ periodLabel }}</span>
        <small v-if="activeFilterCount">
          {{ activeFilterCount }} {{ activeFilterCount === 1 ? 'filtro' : 'filtros' }}
        </small>
      </p>
      <div v-for="k in kpis" :key="k.label" class="kpi" :class="`kpi--${k.tone}`">
        <strong>{{ k.value }}</strong>
        <span>{{ k.label }}</span>
      </div>
    </section>

    <!-- Gráficos principais -->
    <section class="card panel panel--a">
      <header class="panel__head">
        <h2>Criados × Encerrados por dia</h2>
        <ul class="legend">
          <li><i class="legend__dash" style="border-color: #eb6834" />Criados</li>
          <li><i style="background: #1c5cab" />Encerrados</li>
        </ul>
      </header>
      <div class="panel__chart">
        <Bar
          :key="`a-${chartKey}`"
          :data="createdVsSolvedData"
          :options="createdVsSolvedOptions"
          role="img"
          aria-label="Chamados criados e encerrados por dia"
        />
      </div>
      <table class="sr-only">
        <caption>
          Chamados criados e encerrados por dia
        </caption>
        <tr v-for="d in perDay" :key="d.day.getTime()">
          <td>{{ dayLabel.format(d.day) }}</td>
          <td>{{ d.opened }} criados</td>
          <td>{{ d.resolved }} encerrados</td>
        </tr>
      </table>
    </section>

    <section class="card panel panel--b">
      <header class="panel__head">
        <h2>Tempo de 1ª resposta e resolução (horas)</h2>
        <ul class="legend">
          <li v-for="s in TIME_SERIES" :key="s.key">
            <i :style="{ background: s.color }" />{{ s.label }}
          </li>
        </ul>
      </header>
      <div class="panel__chart">
        <Line
          :key="`b-${chartKey}`"
          :data="timesData"
          :options="timesOptions"
          role="img"
          aria-label="Tempo médio de primeira resposta e de resolução por dia, em horas"
        />
      </div>
      <table class="sr-only">
        <caption>
          Tempo médio por dia, em horas
        </caption>
        <tr v-for="d in times" :key="d.day.getTime()">
          <td>{{ dayLabel.format(d.day) }}</td>
          <td>1ª resposta: {{ d.responseHours?.toFixed(1) ?? '—' }}</td>
          <td>Resolução: {{ d.resolutionHours?.toFixed(1) ?? '—' }}</td>
        </tr>
      </table>
    </section>

    <!-- Roscas -->
    <section v-for="donut in donuts" :key="donut.id" class="card panel panel--donut">
      <header class="panel__head">
        <h2>{{ donut.title }}</h2>
        <small v-if="donut.id === 'satisfacao'" class="panel__note">
          4–5★ satisfeitos · {{ satisfaction.rated }}
          {{ satisfaction.rated === 1 ? 'avaliação' : 'avaliações' }}
        </small>
      </header>
      <div v-if="donut.total" class="donut">
        <div class="donut__chart">
          <Doughnut
            :key="`${donut.id}-${chartKey}`"
            :data="donut.data"
            :options="doughnutOptions"
            :plugins="donut.plugins"
            role="img"
            :aria-label="`${donut.title}: gráfico de rosca`"
          />
        </div>
        <ul class="donut__legend">
          <li v-for="r in donut.rows" :key="r.label">
            <i :style="{ background: r.color }" />
            <span :title="r.label">{{ r.label }}</span>
            <b>{{ share(r.count, donut.total) }}%</b>
          </li>
        </ul>
      </div>
      <p v-else class="panel__empty">Sem dados no período.</p>
    </section>

    <!-- Lista de chamados -->
    <dialog ref="listEl" class="list-dialog" aria-labelledby="list-title">
      <header class="list-dialog__head">
        <div>
          <h2 id="list-title">Chamados</h2>
          <p>{{ periodLabel }} · {{ filtered.length }} chamados</p>
        </div>
        <label class="search">
          <span class="sr-only">Buscar chamado</span>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="6.5" />
            <path d="m20 20-4.2-4.2" />
          </svg>
          <input v-model="search" type="search" placeholder="Buscar por título, número ou pessoa" />
        </label>
        <button type="button" class="list-dialog__close" title="Fechar" @click="listEl?.close()">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
          <span class="sr-only">Fechar</span>
        </button>
      </header>
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th scope="col">Chamado</th>
              <th scope="col">Setor</th>
              <th scope="col">Solicitante</th>
              <th scope="col">Responsável</th>
              <th scope="col">Prioridade</th>
              <th scope="col">Status</th>
              <th scope="col">Aberto em</th>
              <th scope="col">Nota</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="t in pageRows" :key="t.id">
              <th scope="row">
                <RouterLink :to="{ name: 'ticket', params: { id: t.id } }" class="ticket-link">
                  <small>{{ formatTicketNumber(t.id) }}</small>
                  {{ t.title }}
                </RouterLink>
              </th>
              <td>{{ t.sector }}</td>
              <td>{{ t.authorName ?? t.authorEmail }}</td>
              <td>{{ t.assigneeName ?? '—' }}</td>
              <td>
                <span class="dot" :style="{ background: priorityById(t.priority).color }" />
                {{ priorityById(t.priority).label }}
              </td>
              <td><StatusBadge :status="t.status" /></td>
              <td class="muted">{{ rowDate.format(new Date(t.createdAt)) }}</td>
              <td>
                <span v-if="t.rating" class="rating">★ {{ t.rating }}</span>
                <span v-else class="muted">—</span>
              </td>
            </tr>
          </tbody>
        </table>
        <p v-if="!pageRows.length" class="panel__empty">Nenhum chamado encontrado.</p>
      </div>
      <footer class="list-dialog__foot">
        <span>Mostrando {{ pageRows.length }} de {{ searched.length }}</span>
        <div class="pager">
          <button
            type="button"
            class="btn btn--secondary btn--small"
            :disabled="page <= 1"
            @click="page--"
          >
            Anterior
          </button>
          <span>{{ page }} / {{ pageCount }}</span>
          <button
            type="button"
            class="btn btn--secondary btn--small"
            :disabled="page >= pageCount"
            @click="page++"
          >
            Próxima
          </button>
        </div>
      </footer>
    </dialog>
  </div>
</template>

<style scoped>
/*
 * Grade de uma tela só: cabeçalho, faixa de indicadores, 2 gráficos e 3 roscas.
 * Ocupa exatamente a altura disponível; os gráficos se ajustam ao espaço.
 */
.dash {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  grid-template-rows: auto auto minmax(0, 1.15fr) minmax(0, 1fr);
  gap: 14px;
  height: calc(100vh - 64px);
  min-height: 640px;
}

.dash--fullscreen {
  height: 100vh;
  padding: 20px 24px;
  background: var(--page-bg);
}

.dash--window {
  position: fixed;
  inset: 0;
  z-index: 50;
  overflow: auto;
}

.dash__top {
  display: flex;
  flex-wrap: wrap;
  grid-column: 1 / -1;
  align-items: flex-end;
  justify-content: space-between;
  gap: 10px 16px;
}

.breadcrumb {
  display: flex;
  gap: 6px;
  margin-bottom: 4px;
  font-size: 0.8125rem;
}

.breadcrumb a {
  color: var(--link);
  text-decoration: none;
}

.breadcrumb [aria-hidden] {
  color: var(--text-soft);
}

.dash__title {
  color: var(--navy-800);
  font-size: 1.75rem;
  font-weight: 800;
  letter-spacing: -0.02em;
}

.dash__toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.segmented {
  display: flex;
  gap: 3px;
  padding: 3px;
  border-radius: 9px;
  background: #e9edf3;
}

.segmented button {
  height: 32px;
  padding: 0 12px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--text-muted);
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
}

.segmented button.active {
  background: #fff;
  color: var(--navy-800);
  box-shadow: 0 1px 3px rgba(11, 34, 105, 0.12);
}

.control input,
.control select {
  height: 38px;
  padding: 0 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: #fff;
  color: var(--text);
  font-size: 0.875rem;
}

.control--block {
  display: grid;
  gap: 4px;
}

.control--block span {
  color: var(--text-muted);
  font-size: 0.75rem;
  font-weight: 600;
}

.control--block select {
  width: 100%;
}

.tool-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 38px;
  padding: 0 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: #fff;
  color: var(--navy-800);
  font-size: 0.875rem;
  font-weight: 700;
  cursor: pointer;
}

.tool-btn:hover {
  background: #f0f2f7;
}

.tool-btn svg {
  width: 16px;
  height: 16px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.tool-btn__count {
  display: grid;
  place-items: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 999px;
  background: var(--navy-800);
  color: #fff;
  font-size: 0.6875rem;
}

.filters {
  position: relative;
}

.filters__panel {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: 20;
  display: grid;
  gap: 12px;
  width: 260px;
  padding: 16px;
  border: 1px solid var(--card-border);
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 16px 40px rgba(11, 34, 105, 0.16);
}

.filters__actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.link-btn {
  padding: 0;
  border: 0;
  background: none;
  color: var(--link);
  font-size: 0.8125rem;
  font-weight: 700;
  text-decoration: underline;
  cursor: pointer;
}

.btn--small {
  height: 34px;
  padding: 0 14px;
  font-size: 0.8125rem;
}

/* Faixa de indicadores */
.kpis {
  display: grid;
  grid-column: 1 / -1;
  grid-template-columns: minmax(0, 1fr) repeat(6, minmax(0, 1.1fr));
  align-items: center;
  gap: 12px;
  padding: 14px 20px;
}

.kpis__period {
  display: grid;
  gap: 2px;
  color: var(--navy-800);
  font-size: 1.125rem;
  font-weight: 800;
}

.kpis__period span::first-letter {
  text-transform: uppercase;
}

.kpis__period small {
  color: var(--text-muted);
  font-size: 0.875rem;
  font-weight: 600;
}

.kpi {
  display: grid;
  gap: 2px;
  padding-left: 12px;
  border-left: 3px solid var(--kpi-color, var(--navy-800));
}

.kpi strong {
  color: var(--navy-800);
  font-size: clamp(1.375rem, 1.85vw, 2.25rem);
  font-weight: 800;
  line-height: 1.15;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.kpi span {
  color: var(--text-muted);
  font-size: 0.875rem;
  font-weight: 600;
}

.kpi--navy {
  --kpi-color: var(--navy-800);
}

.kpi--green {
  --kpi-color: #1baf7a;
}

.kpi--amber {
  --kpi-color: #eda100;
}

.kpi--blue {
  --kpi-color: #2a78d6;
}

.kpi--muted {
  --kpi-color: #5598e7;
}

/* Painéis */
.panel {
  position: relative;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  padding: 14px 18px;
}

.panel--a,
.panel--b {
  grid-column: span 3;
}

.panel--donut {
  grid-column: span 2;
}

.panel__head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 4px 12px;
  margin-bottom: 8px;
}

.panel__head h2 {
  color: var(--navy-800);
  font-size: 1.125rem;
  font-weight: 800;
}

.panel__note {
  color: var(--text-muted);
  font-size: 0.8125rem;
}

.panel__chart {
  position: relative;
  flex: 1;
  min-height: 0;
}

.panel__empty {
  margin: auto;
  color: var(--text-muted);
  font-size: 0.875rem;
}

.legend {
  display: flex;
  gap: 12px;
  margin: 0;
  padding: 0;
  list-style: none;
  color: var(--text-muted);
  font-size: 0.875rem;
}

.legend li {
  display: flex;
  align-items: center;
  gap: 6px;
}

.legend i {
  width: 12px;
  height: 12px;
  border-radius: 2px;
}

.legend .legend__dash {
  width: 16px;
  height: 0;
  border-top: 2px dashed;
  border-radius: 0;
}

.donut {
  display: grid;
  grid-template-columns: minmax(0, 0.85fr) minmax(0, 1.15fr);
  align-items: center;
  gap: 12px;
  flex: 1;
  min-height: 0;
}

.donut__chart {
  position: relative;
  height: 100%;
  min-height: 0;
}

.donut__legend {
  display: grid;
  align-content: center;
  gap: clamp(4px, 0.5vw, 9px);
  margin: 0;
  padding: 0;
  overflow: hidden;
  max-height: 100%;
  list-style: none;
  font-size: clamp(0.8125rem, 0.95vw, 1rem);
  line-height: 1.25;
}

.donut__legend li {
  display: grid;
  grid-template-columns: 12px 1fr auto;
  align-items: center;
  gap: 8px;
  color: var(--text);
}

.donut__legend i {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}

.donut__legend span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.donut__legend b {
  color: var(--navy-800);
  font-variant-numeric: tabular-nums;
}

/* Janela "Ver chamados" */
.list-dialog {
  width: min(1100px, calc(100vw - 32px));
  max-height: calc(100vh - 48px);
  padding: 0;
  border: 0;
  border-radius: 16px;
  color: var(--text);
  box-shadow: 0 24px 60px rgba(7, 26, 87, 0.25);
}

.list-dialog[open] {
  display: flex;
  flex-direction: column;
}

.list-dialog::backdrop {
  background: rgba(7, 26, 87, 0.45);
}

.list-dialog__head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px 20px;
  padding: 18px 20px;
  border-bottom: 1px solid var(--card-border);
}

.list-dialog__head h2 {
  color: var(--navy-800);
  font-size: 1.125rem;
  font-weight: 800;
}

.list-dialog__head p {
  color: var(--text-muted);
  font-size: 0.8125rem;
}

.list-dialog__head p::first-letter {
  text-transform: uppercase;
}

.search {
  position: relative;
  flex: 1 1 260px;
  margin-left: auto;
}

.search svg {
  position: absolute;
  top: 50%;
  left: 12px;
  width: 18px;
  height: 18px;
  fill: none;
  stroke: var(--text-soft);
  stroke-width: 2;
  stroke-linecap: round;
  transform: translateY(-50%);
}

.search input {
  width: 100%;
  height: 40px;
  padding: 0 12px 0 38px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  font-size: 0.875rem;
}

.list-dialog__close {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  padding: 0;
  border: 0;
  border-radius: 10px;
  background: #eef1f6;
  color: var(--navy-800);
  cursor: pointer;
}

.list-dialog__close svg {
  width: 18px;
  height: 18px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2.2;
  stroke-linecap: round;
}

.table-wrap {
  flex: 1;
  overflow: auto;
}

.table {
  width: 100%;
  min-width: 900px;
  border-collapse: collapse;
  font-size: 0.8125rem;
}

.table th,
.table td {
  padding: 11px 14px;
  border-bottom: 1px solid var(--card-border);
  text-align: left;
}

.table thead th {
  position: sticky;
  top: 0;
  background: #f8f9fc;
  color: var(--text-muted);
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  white-space: nowrap;
}

.ticket-link {
  display: grid;
  color: var(--navy-800);
  font-weight: 600;
  text-decoration: none;
}

.ticket-link:hover {
  text-decoration: underline;
}

.ticket-link small {
  color: var(--text-soft);
  font-size: 0.6875rem;
}

.dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  margin-right: 6px;
  border-radius: 50%;
}

.muted {
  color: var(--text-muted);
}

.rating {
  color: #8a5a00;
  font-weight: 700;
}

.list-dialog__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 20px;
  border-top: 1px solid var(--card-border);
  color: var(--text-muted);
  font-size: 0.8125rem;
}

.pager {
  display: flex;
  align-items: center;
  gap: 8px;
}

.pager .btn:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

/* Telas pequenas ou baixas: volta a rolar, sem espremer os gráficos. */
@media (max-width: 1100px), (max-height: 680px) {
  .dash {
    grid-template-rows: auto;
    height: auto;
    min-height: 0;
  }

  .kpis {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .kpis__period {
    grid-column: 1 / -1;
  }

  .panel--a,
  .panel--b {
    grid-column: 1 / -1;
    height: 300px;
  }

  .panel--donut {
    grid-column: span 3;
    height: 260px;
  }
}

@media (max-width: 700px) {
  .dash {
    grid-template-columns: minmax(0, 1fr);
  }

  .panel--a,
  .panel--b,
  .panel--donut {
    grid-column: 1 / -1;
  }

  .kpis {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
