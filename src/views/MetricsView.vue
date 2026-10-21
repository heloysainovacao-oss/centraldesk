<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import DailyLineChart from '@/components/charts/DailyLineChart.vue'
import DonutChart from '@/components/charts/DonutChart.vue'
import StarRating from '@/components/StarRating.vue'
import { useGrowAnimation } from '@/composables/useGrowAnimation'
import { BAR_COLOR, DAILY_SERIES } from '@/constants/charts'
import { PRIORITIES } from '@/constants/tickets'
import { formatTicketNumber, useTicketsStore } from '@/stores/tickets'
import { formatDuration } from '@/utils/format'
import {
  byAnalyst,
  byCategory,
  byPriority,
  dailySeries,
  oldestUnassigned,
  periodBounds,
  periodStats,
} from '@/utils/metrics'
import { initials } from '@/utils/user'

const tickets = useTicketsStore()

// --- Período ---
const PERIODS = [7, 30, 90] as const
const days = ref<(typeof PERIODS)[number]>(30)
const now = ref(new Date())

// Todos os números e gráficos "crescem" do zero até o valor real em 3 segundos.
const { progress, start } = useGrowAnimation(3000)
onMounted(start)
watch(days, () => {
  now.value = new Date()
  start()
})

const bounds = computed(() => periodBounds(days.value, now.value))
const inPeriod = computed(() =>
  tickets.tickets.filter((t) => {
    const created = new Date(t.createdAt).getTime()
    return created >= bounds.value.current.from && created < bounds.value.current.to
  }),
)

const current = computed(() =>
  periodStats(tickets.tickets, bounds.value.current.from, bounds.value.current.to),
)
const previous = computed(() =>
  periodStats(tickets.tickets, bounds.value.previous.from, bounds.value.previous.to),
)

// --- Formatação animada ---
const grow = (value: number) => value * progress.value
const percent = (rate: number | null) => (rate === null ? '—' : `${Math.round(grow(rate * 100))}%`)
const duration = (ms: number | null) => (ms === null ? '—' : formatDuration(grow(ms)))

type Delta = { text: string; tone: 'good' | 'bad' | 'neutral'; arrow: '▲' | '▼' | '' }

/** Variação em pontos percentuais; subir é bom. */
function ppDelta(cur: number | null, prev: number | null): Delta | null {
  if (cur === null || prev === null) return null
  const diff = Math.round((cur - prev) * 100)
  if (diff === 0) return { text: 'igual ao período anterior', tone: 'neutral', arrow: '' }
  return {
    text: `${Math.abs(diff)} p.p.`,
    tone: diff > 0 ? 'good' : 'bad',
    arrow: diff > 0 ? '▲' : '▼',
  }
}

/** Variação de tempo; ficar mais rápido é bom. */
function timeDelta(cur: number | null, prev: number | null): Delta | null {
  if (cur === null || prev === null) return null
  const diff = cur - prev
  if (Math.abs(diff) < 60000)
    return { text: 'igual ao período anterior', tone: 'neutral', arrow: '' }
  return diff < 0
    ? { text: `${formatDuration(-diff)} mais rápido`, tone: 'good', arrow: '▼' }
    : { text: `${formatDuration(diff)} mais lento`, tone: 'bad', arrow: '▲' }
}

// --- Satisfação (avaliações dos chamados encerrados) ---
const ratingFormat = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

const satisfaction = computed(() => {
  const cur = current.value.avgRating
  const prev = previous.value.avgRating
  let delta: Delta | null = null
  if (cur !== null && prev !== null) {
    const diff = Math.round((cur - prev) * 10) / 10
    delta =
      diff === 0
        ? { text: 'igual ao período anterior', tone: 'neutral', arrow: '' }
        : {
            text: `${ratingFormat.format(Math.abs(diff))} ${diff > 0 ? 'a mais' : 'a menos'}`,
            tone: diff > 0 ? 'good' : 'bad',
            arrow: diff > 0 ? '▲' : '▼',
          }
  }
  return { avg: cur, rated: current.value.rated, delta }
})

const kpis = computed(() => [
  {
    label: 'Taxa de resposta',
    value: percent(current.value.responseRate),
    bar: current.value.responseRate,
    barColor: BAR_COLOR,
    delta: ppDelta(current.value.responseRate, previous.value.responseRate),
    note: 'chamados assumidos',
  },
  {
    label: 'Tempo médio de resposta',
    value: duration(current.value.avgResponseMs),
    caption: 'da abertura até ser assumido',
    delta: timeDelta(current.value.avgResponseMs, previous.value.avgResponseMs),
  },
  {
    label: 'Tempo médio de resolução',
    value: duration(current.value.avgResolutionMs),
    caption: 'da abertura até o encerramento',
    delta: timeDelta(current.value.avgResolutionMs, previous.value.avgResolutionMs),
  },
  {
    label: 'Taxa de encerramento',
    value: percent(current.value.closeRate),
    bar: current.value.closeRate,
    barColor: '#1e8a4c',
    delta: ppDelta(current.value.closeRate, previous.value.closeRate),
    note: `${current.value.resolved} de ${current.value.opened} chamados`,
  },
])

const openNow = computed(() => tickets.tickets.filter((t) => t.status !== 'resolvido'))
const unassigned = computed(() => openNow.value.filter((t) => !t.assigneeEmail).length)

const series = computed(() => dailySeries(tickets.tickets, days.value, now.value))

const priorities = computed(() =>
  byPriority(inPeriod.value).map((p) => ({
    ...p,
    color: PRIORITIES.find((x) => x.id === p.key)!.color,
  })),
)

const categories = computed(() => byCategory(inPeriod.value))
const maxCategory = computed(() => Math.max(1, ...categories.value.map((c) => c.count)))

const analysts = computed(() =>
  byAnalyst(tickets.tickets, bounds.value.current.from, bounds.value.current.to),
)

const waiting = computed(() => oldestUnassigned(tickets.tickets, 5))

function waitingFor(iso: string) {
  const minutes = Math.max(0, (now.value.getTime() - new Date(iso).getTime()) / 60000)
  if (minutes >= 60 * 24) {
    const d = Math.floor(minutes / (60 * 24))
    return `aguardando há ${d} ${d === 1 ? 'dia' : 'dias'}`
  }
  if (minutes >= 60) return `aguardando há ${Math.floor(minutes / 60)} h`
  return `aguardando há ${Math.round(minutes)} min`
}
</script>

<template>
  <header class="header">
    <div>
      <h1 class="page-title">Painel de métricas</h1>
      <p class="page-subtitle">Últimos {{ days }} dias · comparado ao período anterior</p>
    </div>
    <div class="periods" role="group" aria-label="Período">
      <button
        v-for="p in PERIODS"
        :key="p"
        type="button"
        class="periods__item"
        :class="{ 'periods__item--active': days === p }"
        :aria-pressed="days === p"
        @click="days = p"
      >
        {{ p }} dias
      </button>
    </div>
  </header>

  <div class="dashboard">
    <!-- Indicadores principais -->
    <section class="kpis" aria-label="Indicadores">
      <article v-for="kpi in kpis" :key="kpi.label" class="card kpi">
        <h2 class="kpi__label">{{ kpi.label }}</h2>
        <p class="kpi__value">{{ kpi.value }}</p>
        <div v-if="kpi.bar !== undefined" class="kpi__bar" aria-hidden="true">
          <span
            :style="{ width: `${(kpi.bar ?? 0) * 100 * progress}%`, background: kpi.barColor }"
          />
        </div>
        <p v-if="kpi.caption" class="kpi__caption">{{ kpi.caption }}</p>
        <p v-if="kpi.delta" class="kpi__delta" :class="`kpi__delta--${kpi.delta.tone}`">
          <span v-if="kpi.delta.arrow" aria-hidden="true">{{ kpi.delta.arrow }}</span>
          {{ kpi.delta.text }}<template v-if="kpi.note"> · {{ kpi.note }}</template>
        </p>
        <p v-else-if="kpi.note" class="kpi__delta kpi__delta--neutral">{{ kpi.note }}</p>
        <p v-else class="kpi__delta kpi__delta--neutral">sem dados para comparar</p>
      </article>

      <article class="card kpi">
        <h2 class="kpi__label">Satisfação</h2>
        <p class="kpi__value">
          {{ satisfaction.avg === null ? '—' : ratingFormat.format(grow(satisfaction.avg)) }}
          <small v-if="satisfaction.avg !== null" class="kpi__unit">/ 5</small>
        </p>
        <StarRating
          v-if="satisfaction.avg !== null"
          :model-value="grow(satisfaction.avg)"
          readonly
          size="small"
          label="Nota média"
        />
        <p
          v-if="satisfaction.delta"
          class="kpi__delta"
          :class="`kpi__delta--${satisfaction.delta.tone}`"
        >
          <span v-if="satisfaction.delta.arrow" aria-hidden="true">{{
            satisfaction.delta.arrow
          }}</span>
          {{ satisfaction.delta.text }} · {{ satisfaction.rated }}
          {{ satisfaction.rated === 1 ? 'avaliação' : 'avaliações' }}
        </p>
        <p v-else class="kpi__delta kpi__delta--neutral">
          {{
            satisfaction.rated
              ? `${satisfaction.rated} ${satisfaction.rated === 1 ? 'avaliação' : 'avaliações'}`
              : 'nenhuma avaliação no período'
          }}
        </p>
      </article>

      <article class="card kpi kpi--highlight">
        <h2 class="kpi__label">Abertos agora</h2>
        <p class="kpi__value">{{ Math.round(grow(openNow.length)) }}</p>
        <span v-if="unassigned" class="kpi__alert">
          {{ Math.round(grow(unassigned)) }} sem responsável
        </span>
        <span v-else class="kpi__ok">Todos com responsável</span>
        <RouterLink :to="{ name: 'tickets' }" class="kpi__link">Ver fila</RouterLink>
      </article>
    </section>

    <!-- Abertos x encerrados e prioridades -->
    <div class="row row--wide">
      <section class="card panel">
        <header class="panel__head">
          <h2>Abertos e encerrados por dia</h2>
          <ul class="legend">
            <li v-for="s in DAILY_SERIES" :key="s.key">
              <i :style="{ background: s.color }" />{{ s.label }}
            </li>
          </ul>
        </header>
        <DailyLineChart :points="series" :progress="progress" />
      </section>

      <section class="card panel">
        <header class="panel__head"><h2>Por prioridade</h2></header>
        <DonutChart :slices="priorities" :progress="progress" center-label="chamados" />
        <ul class="shares">
          <li v-for="p in priorities" :key="p.key">
            <i :style="{ background: p.color }" />
            {{ p.label }}
            <b>{{ Math.round(grow(p.share * 100)) }}%</b>
          </li>
        </ul>
      </section>
    </div>

    <!-- Categorias e atendentes -->
    <div class="row row--split">
      <section class="card panel">
        <header class="panel__head"><h2>Por categoria</h2></header>
        <ul v-if="categories.length" class="bars">
          <li v-for="c in categories" :key="c.key">
            <span class="bars__label">{{ c.label }}</span>
            <b class="bars__value">{{ Math.round(grow(c.count)) }}</b>
            <span class="bars__track" aria-hidden="true">
              <span
                :style="{
                  width: `${(c.count / maxCategory) * 100 * progress}%`,
                  background: BAR_COLOR,
                }"
              />
            </span>
          </li>
        </ul>
        <p v-else class="empty">Nenhum chamado aberto no período.</p>
      </section>

      <section class="card panel">
        <header class="panel__head"><h2>Desempenho por atendente</h2></header>
        <table v-if="analysts.length" class="table">
          <thead>
            <tr>
              <th scope="col">Atendente</th>
              <th scope="col">Assumidos</th>
              <th scope="col">Encerrados</th>
              <th scope="col">Tempo de resposta</th>
              <th scope="col">Tempo de resolução</th>
              <th scope="col">Avaliação</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="a in analysts" :key="a.email">
              <th scope="row">
                <span class="avatar" aria-hidden="true">{{ initials(a.name) }}</span>
                {{ a.name }}
              </th>
              <td>{{ Math.round(grow(a.assumed)) }}</td>
              <td>{{ Math.round(grow(a.resolved)) }}</td>
              <td class="muted">{{ duration(a.avgResponseMs) }}</td>
              <td class="muted">{{ duration(a.avgResolutionMs) }}</td>
              <td>
                <span v-if="a.avgRating !== null" class="rating-cell">
                  ★ {{ ratingFormat.format(grow(a.avgRating)) }}
                </span>
                <span v-else class="muted">—</span>
              </td>
            </tr>
          </tbody>
        </table>
        <p v-else class="empty">Nenhum atendimento no período.</p>
      </section>
    </div>

    <!-- Fila parada -->
    <section class="card panel">
      <header class="panel__head">
        <h2>Mais antigos sem responsável</h2>
        <RouterLink :to="{ name: 'tickets' }" class="panel__link">Abrir fila</RouterLink>
      </header>
      <ul v-if="waiting.length" class="waiting">
        <li v-for="t in waiting" :key="t.id">
          <RouterLink :to="{ name: 'ticket', params: { id: t.id } }" class="waiting__item">
            <span>
              <strong>{{ t.title }}</strong>
              <small>
                {{ formatTicketNumber(t.id) }} · {{ t.authorName ?? t.authorEmail }}
                <template v-if="t.authorDepartment"> · {{ t.authorDepartment }}</template>
              </small>
            </span>
            <span class="waiting__time">{{ waitingFor(t.createdAt) }}</span>
          </RouterLink>
        </li>
      </ul>
      <p v-else class="empty">Nenhum chamado aguardando responsável.</p>
    </section>
  </div>
</template>

<style scoped>
.header {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  max-width: 1140px;
  margin-bottom: 24px;
}

.periods {
  display: flex;
  gap: 4px;
  padding: 4px;
  border-radius: 10px;
  background: #e9edf3;
}

.periods__item {
  height: 36px;
  padding: 0 14px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--text-muted);
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
}

.periods__item--active {
  background: #fff;
  color: var(--navy-800);
  box-shadow: 0 1px 3px rgba(11, 34, 105, 0.12);
}

.dashboard {
  display: grid;
  gap: 20px;
  max-width: 1140px;
}

/* KPIs */
.kpis {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 16px;
}

.kpi {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
  padding: 20px;
}

.kpi__label {
  color: var(--text);
  font-size: 0.875rem;
  font-weight: 600;
  line-height: 1.35;
}

.kpi__value {
  margin-top: 6px;
  color: var(--navy-800);
  font-size: 2rem;
  font-weight: 800;
  line-height: 1.1;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.kpi__unit {
  color: var(--text-soft);
  font-size: 1rem;
  font-weight: 700;
}

.rating-cell {
  color: #8a5a00;
  white-space: nowrap;
}

.kpi__bar {
  height: 6px;
  margin-top: 6px;
  overflow: hidden;
  border-radius: 3px;
  background: #e9edf3;
}

.kpi__bar span {
  display: block;
  height: 100%;
  border-radius: 3px;
}

.kpi__caption {
  color: var(--text-muted);
  font-size: 0.8125rem;
  line-height: 1.4;
}

.kpi__delta {
  margin-top: auto;
  padding-top: 6px;
  font-size: 0.8125rem;
  font-weight: 700;
  line-height: 1.4;
}

.kpi__delta--good {
  color: #17643a;
}

.kpi__delta--bad {
  color: #b23a22;
}

.kpi__delta--neutral {
  color: var(--text-muted);
  font-weight: 500;
}

.kpi--highlight {
  border-color: var(--navy-800);
  background: var(--navy-800);
  color: #fff;
}

.kpi--highlight .kpi__label,
.kpi--highlight .kpi__value {
  color: #fff;
}

.kpi__alert,
.kpi__ok {
  align-self: flex-start;
  margin-top: 6px;
  padding: 4px 12px;
  border-radius: 999px;
  font-size: 0.8125rem;
  font-weight: 700;
}

.kpi__alert {
  background: var(--orange-500);
  color: #fff;
}

.kpi__ok {
  background: rgba(255, 255, 255, 0.12);
}

.kpi__link {
  align-self: flex-start;
  margin-top: 10px;
  color: #9fd2f5;
  font-size: 0.875rem;
  font-weight: 700;
}

/* Painéis */
.row {
  display: grid;
  gap: 20px;
}

.row--wide {
  grid-template-columns: minmax(0, 1fr) 300px;
}

.row--split {
  grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.5fr);
}

.panel {
  min-width: 0;
  padding: 22px 20px;
}

.panel__head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 16px;
  margin-bottom: 16px;
}

.panel__head h2 {
  color: var(--navy-800);
  font-size: 1rem;
  font-weight: 800;
}

.panel__link {
  color: var(--link);
  font-size: 0.875rem;
  font-weight: 700;
}

.legend {
  display: flex;
  gap: 16px;
  margin: 0;
  padding: 0;
  list-style: none;
  color: var(--text-muted);
  font-size: 0.8125rem;
}

.legend li {
  display: flex;
  align-items: center;
  gap: 6px;
}

.legend i {
  width: 14px;
  height: 2px;
  border-radius: 1px;
}

.shares {
  display: grid;
  gap: 10px;
  margin: 18px 0 0;
  padding: 0;
  list-style: none;
  font-size: 0.875rem;
}

.shares li {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--text);
}

.shares i {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.shares b {
  margin-left: auto;
  color: var(--navy-800);
  font-variant-numeric: tabular-nums;
}

.bars {
  display: grid;
  gap: 14px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.bars li {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 6px 12px;
  font-size: 0.875rem;
}

.bars__value {
  color: var(--navy-800);
  font-variant-numeric: tabular-nums;
}

.bars__track {
  grid-column: 1 / -1;
  height: 8px;
  overflow: hidden;
  border-radius: 4px;
  background: #eef1f6;
}

.bars__track span {
  display: block;
  height: 100%;
  border-radius: 4px;
}

.table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
}

.table th,
.table td {
  padding: 14px 8px;
  border-bottom: 1px solid var(--card-border);
  text-align: left;
  font-variant-numeric: tabular-nums;
}

.table thead th {
  padding-top: 0;
  color: var(--text-muted);
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.table tbody th {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--navy-800);
  font-weight: 600;
}

.table tbody tr:last-child th,
.table tbody tr:last-child td {
  border-bottom: 0;
}

.table td {
  color: var(--navy-800);
  font-weight: 700;
}

.table .muted {
  color: var(--text-muted);
  font-weight: 500;
}

.avatar {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--orange-500);
  color: var(--navy-900);
  font-size: 0.6875rem;
  font-weight: 800;
}

.waiting {
  margin: 0;
  padding: 0;
  list-style: none;
}

.waiting li + li {
  border-top: 1px solid var(--card-border);
}

.waiting__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 0;
  color: inherit;
  text-decoration: none;
}

.waiting__item:hover strong {
  text-decoration: underline;
}

.waiting__item > span:first-child {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.waiting__item strong {
  color: var(--navy-800);
  font-size: 0.9375rem;
}

.waiting__item small {
  color: var(--text-muted);
  font-size: 0.8125rem;
}

.waiting__time {
  flex-shrink: 0;
  color: #b23a22;
  font-size: 0.8125rem;
  font-weight: 600;
}

.empty {
  padding: 24px 0;
  color: var(--text-muted);
  font-size: 0.875rem;
  text-align: center;
}

@media (max-width: 1500px) {
  .kpis {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 1000px) {
  .row--wide,
  .row--split {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .kpis {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .kpi--highlight {
    grid-column: 1 / -1;
  }

  .table {
    display: block;
    overflow-x: auto;
  }

  .waiting__item {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }
}
</style>
