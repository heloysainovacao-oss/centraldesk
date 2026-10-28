<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import StatusBadge from '@/components/StatusBadge.vue'
import { DEPARTMENTS } from '@/constants/departments'
import {
  PRIORITIES,
  STATUSES,
  priorityById,
  type PriorityId,
  type TicketStatus,
} from '@/constants/tickets'
import { useAuthStore } from '@/stores/auth'
import { formatTicketNumber, useTicketsStore, type Ticket } from '@/stores/tickets'
import { formatTimeAgo } from '@/utils/format'
import {
  browsableTickets,
  originOf,
  sectorRelations,
  type SectorRelation,
} from '@/utils/ticketScope'

// "Todos os chamados" (administrador): todos os chamados de todos os setores.
// "Chamados do setor" (coordenador): o que o setor dele abriu ou recebeu.
// Só acompanha: atender continua sendo na tela Atendimentos.

const auth = useAuthStore()
const tickets = useTicketsStore()

const isCoordinator = computed(() => auth.isCoordinator)
const sector = computed(() => auth.currentUser?.department ?? '')

const title = computed(() => (isCoordinator.value ? 'Chamados do setor' : 'Todos os chamados'))
const lead = computed(() =>
  isCoordinator.value
    ? `Tudo o que ${sector.value} abriu ou recebeu, em qualquer status. Você é avisado quando alguém do setor abre um chamado.`
    : 'Todos os chamados de todos os setores, em qualquer status. Use os filtros para afunilar.',
)

const updatedAt = (t: Ticket) => t.updatedAt ?? t.createdAt

/** Todos os chamados que a pessoa pode acompanhar, do mais recente para o mais antigo. */
const scoped = computed(() =>
  // Cópia: ordenar não pode mexer na lista guardada no store.
  [...browsableTickets(auth.currentUser, tickets.tickets)].sort((a, b) =>
    updatedAt(b).localeCompare(updatedAt(a)),
  ),
)

// ---------- Visualização (coordenador) ----------

/** Chamado aberto por outra pessoa do setor: o coordenador acompanha e a visualização é registrada. */
function needsView(t: Ticket): boolean {
  return (
    isCoordinator.value && originOf(t) === sector.value && t.authorEmail !== auth.currentUser?.email
  )
}

/** Ainda em aberto e a coordenação não abriu. Encerrados antigos não pedem atenção. */
function isUnseen(t: Ticket): boolean {
  return (
    needsView(t) && t.status !== 'resolvido' && !tickets.viewedBy(t, auth.currentUser?.email ?? '')
  )
}

function isSeen(t: Ticket): boolean {
  return needsView(t) && tickets.viewedBy(t, auth.currentUser?.email ?? '')
}

const unseenCount = computed(() => scoped.value.filter(isUnseen).length)

// ---------- Filtros ----------

const search = ref('')
const origin = ref('')
const target = ref('')
const relation = ref<SectorRelation | ''>('')
const category = ref('')
const priority = ref<PriorityId | ''>('')
const period = ref<0 | 7 | 30 | 90>(0)
const onlyUnseen = ref(false)

const PERIODS = [
  { days: 0, label: 'Qualquer data' },
  { days: 7, label: 'Últimos 7 dias' },
  { days: 30, label: 'Últimos 30 dias' },
  { days: 90, label: 'Últimos 90 dias' },
] as const

const RELATIONS: { id: SectorRelation | ''; label: string }[] = [
  { id: '', label: 'Abertos e recebidos pelo setor' },
  { id: 'origem', label: 'Abertos pelo setor' },
  { id: 'destino', label: 'Recebidos pelo setor' },
]

const categoryOptions = computed(() =>
  [...new Set(scoped.value.map((t) => t.category))].sort((a, b) => a.localeCompare(b, 'pt-BR')),
)

function normalize(text: string) {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

/** Filtros, menos o de status (as abas mostram a contagem de cada status). */
const filtered = computed(() => {
  const term = normalize(search.value.trim()).replace(/^#0*/, '')
  const since = period.value ? Date.now() - period.value * 24 * 60 * 60 * 1000 : 0
  return scoped.value.filter((t) => {
    if (origin.value && originOf(t) !== origin.value) return false
    if (target.value && t.sector !== target.value) return false
    if (relation.value && !sectorRelations(t, sector.value).includes(relation.value)) return false
    if (category.value && t.category !== category.value) return false
    if (priority.value && t.priority !== priority.value) return false
    if (since && new Date(t.createdAt).getTime() < since) return false
    if (onlyUnseen.value && !isUnseen(t)) return false
    if (term) {
      const haystack = normalize(`${t.title} ${t.id} ${t.authorName ?? t.authorEmail}`)
      if (!haystack.includes(term)) return false
    }
    return true
  })
})

const status = ref<TicketStatus | 'todos'>('todos')
const tabs = computed(() => [
  { id: 'todos' as const, label: 'Todos', count: filtered.value.length },
  ...(Object.keys(STATUSES) as TicketStatus[]).map((id) => ({
    id,
    label: id === 'aberto' ? 'Abertos' : id === 'resolvido' ? 'Encerrados' : STATUSES[id].label,
    count: filtered.value.filter((t) => t.status === id).length,
  })),
])

const visible = computed(() =>
  status.value === 'todos'
    ? filtered.value
    : filtered.value.filter((t) => t.status === status.value),
)

const hasFilters = computed(
  () =>
    !!(
      search.value ||
      origin.value ||
      target.value ||
      relation.value ||
      category.value ||
      priority.value ||
      period.value ||
      onlyUnseen.value
    ) || status.value !== 'todos',
)

function clearFilters() {
  search.value = ''
  origin.value = ''
  target.value = ''
  relation.value = ''
  category.value = ''
  priority.value = ''
  period.value = 0
  onlyUnseen.value = false
  status.value = 'todos'
}

// ---------- Paginação ----------

const PAGE_SIZE = 10
const page = ref(1)
const pageCount = computed(() => Math.max(1, Math.ceil(visible.value.length / PAGE_SIZE)))
const pageRows = computed(() =>
  visible.value.slice((page.value - 1) * PAGE_SIZE, page.value * PAGE_SIZE),
)

watch([search, origin, target, relation, category, priority, period, onlyUnseen, status], () => {
  page.value = 1
})
watch(pageCount, (count) => {
  if (page.value > count) page.value = count
})

/** Botões de página: primeira, última e as vizinhas da atual; "…" no lugar das outras. */
const pageItems = computed<(number | '…')[]>(() => {
  const total = pageCount.value
  const near = new Set([1, total, page.value - 1, page.value, page.value + 1])
  const items: (number | '…')[] = []
  for (let n = 1; n <= total; n++) {
    if (near.has(n)) items.push(n)
    else if (items[items.length - 1] !== '…') items.push('…')
  }
  return items
})

const footer = computed(() => {
  const total = scoped.value.length
  const shown = pageRows.value.length
  return (
    `Mostrando ${shown} de ${visible.value.length} ${visible.value.length === 1 ? 'chamado' : 'chamados'}` +
    (visible.value.length !== total ? ` (${total} no total)` : '')
  )
})
</script>

<template>
  <header class="header">
    <div class="header__text">
      <h1 class="page-title">{{ title }}</h1>
      <p class="page-subtitle">{{ lead }}</p>
    </div>
    <span v-if="isCoordinator" class="sector-chip">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3 21h18M5 21V8l7-5 7 5v13M9 21v-6h6v6" />
      </svg>
      Setor: {{ sector }}
    </span>
  </header>

  <div v-if="isCoordinator && unseenCount" class="notice" role="status">
    <span class="notice__dot" aria-hidden="true" />
    <span>
      <strong>{{ unseenCount }}</strong>
      {{
        unseenCount === 1
          ? 'chamado do seu setor em aberto ainda não foi visualizado'
          : 'chamados do seu setor em aberto ainda não foram visualizados'
      }}
      por você.
    </span>
    <button v-if="!onlyUnseen" type="button" class="link-button" @click="onlyUnseen = true">
      Ver só esses
    </button>
  </div>

  <section class="card panel" aria-labelledby="tituloLista">
    <h2 id="tituloLista" class="sr-only">Lista de chamados</h2>

    <div class="tabs" role="tablist" aria-label="Status">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        type="button"
        role="tab"
        class="tab"
        :class="{ 'tab--on': status === tab.id }"
        :aria-selected="status === tab.id"
        @click="status = tab.id"
      >
        {{ tab.label }} <span>{{ tab.count }}</span>
      </button>
    </div>

    <div class="filters">
      <label class="search">
        <span class="sr-only">Buscar chamados</span>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input v-model="search" type="search" placeholder="Título, número ou solicitante" />
      </label>

      <template v-if="!isCoordinator">
        <label>
          <span class="sr-only">Setor de origem</span>
          <select v-model="origin" class="fsel">
            <option value="">Origem: todos os setores</option>
            <option v-for="d in DEPARTMENTS" :key="d" :value="d">{{ d }}</option>
          </select>
        </label>
        <label>
          <span class="sr-only">Setor de destino</span>
          <select v-model="target" class="fsel">
            <option value="">Destino: todos os setores</option>
            <option v-for="d in DEPARTMENTS" :key="d" :value="d">{{ d }}</option>
          </select>
        </label>
      </template>
      <label v-else>
        <span class="sr-only">Relação com o setor</span>
        <select v-model="relation" class="fsel">
          <option v-for="r in RELATIONS" :key="r.id" :value="r.id">{{ r.label }}</option>
        </select>
      </label>

      <label>
        <span class="sr-only">Categoria</span>
        <select v-model="category" class="fsel">
          <option value="">Todas as categorias</option>
          <option v-for="c in categoryOptions" :key="c" :value="c">{{ c }}</option>
        </select>
      </label>
      <label>
        <span class="sr-only">Prioridade</span>
        <select v-model="priority" class="fsel">
          <option value="">Todas as prioridades</option>
          <option v-for="p in [...PRIORITIES].reverse()" :key="p.id" :value="p.id">
            {{ p.label }}
          </option>
        </select>
      </label>
      <label>
        <span class="sr-only">Período de abertura</span>
        <select v-model.number="period" class="fsel">
          <option v-for="p in PERIODS" :key="p.days" :value="p.days">{{ p.label }}</option>
        </select>
      </label>
      <label v-if="isCoordinator" class="check">
        <input v-model="onlyUnseen" type="checkbox" />
        Só não visualizados
      </label>
      <button v-if="hasFilters" type="button" class="link-button" @click="clearFilters">
        Limpar filtros
      </button>
    </div>

    <div class="table-scroll">
      <table class="table">
        <thead>
          <tr>
            <th scope="col">Chamado</th>
            <th scope="col">Origem → destino</th>
            <th scope="col">Solicitante</th>
            <th scope="col">Status</th>
            <th scope="col">Prioridade</th>
            <th scope="col">Responsável</th>
            <th scope="col">Atualizado</th>
            <th scope="col"><span class="sr-only">Ações</span></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="t in pageRows" :key="t.id" :class="{ 'row--unseen': isUnseen(t) }">
            <td class="cell-title">
              <RouterLink
                :to="{ name: 'ticket', params: { id: t.id } }"
                class="cell-title__link"
                :title="t.title"
              >
                {{ t.title }}
              </RouterLink>
              <span class="cell-title__meta">
                <span class="mono">{{ formatTicketNumber(t.id) }}</span>
                <span v-if="isUnseen(t)" class="tag tag--new">Não visualizado</span>
                <span v-else-if="isSeen(t)" class="tag tag--seen">Visualizado</span>
              </span>
            </td>
            <td>
              <span class="route" :title="`${originOf(t) ?? '—'} → ${t.sector}`">
                <span
                  class="route__from"
                  :class="{ route__mine: isCoordinator && originOf(t) === sector }"
                  >{{ originOf(t) ?? '—' }}</span
                >
                <svg viewBox="0 0 24 24" role="img" aria-label="para">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
                <span
                  class="route__to"
                  :class="{ route__mine: isCoordinator && t.sector === sector }"
                  >{{ t.sector }}</span
                >
              </span>
            </td>
            <td class="ellipsis">{{ t.authorName ?? t.authorEmail }}</td>
            <td><StatusBadge :status="t.status" /></td>
            <td>
              <span class="priority">
                <span class="dot" :style="{ background: priorityById(t.priority).color }" />
                {{ priorityById(t.priority).label }}
              </span>
            </td>
            <td class="ellipsis" :class="{ muted: !t.assigneeName }">
              {{ t.assigneeName ?? 'Sem responsável' }}
            </td>
            <td class="muted nowrap">
              <time :datetime="updatedAt(t)">{{ formatTimeAgo(updatedAt(t)) }}</time>
            </td>
            <td class="cell-action">
              <RouterLink
                :to="{ name: 'ticket', params: { id: t.id } }"
                class="btn-open"
                :aria-label="`Abrir ${t.title}`"
              >
                Abrir
              </RouterLink>
            </td>
          </tr>
        </tbody>
      </table>

      <p v-if="!pageRows.length" class="empty">
        <template v-if="!scoped.length">
          {{
            isCoordinator
              ? `Nenhum chamado do setor ${sector} por enquanto.`
              : 'Nenhum chamado aberto no sistema ainda.'
          }}
        </template>
        <template v-else>
          Nenhum chamado com esses filtros.
          <button type="button" class="link-button" @click="clearFilters">Limpar filtros</button>
        </template>
      </p>
    </div>

    <footer class="panel__footer">
      <span>{{ footer }}</span>
      <nav v-if="pageCount > 1" class="pager" aria-label="Paginação">
        <button type="button" class="pager__btn" :disabled="page === 1" @click="page--">
          Anterior
        </button>
        <template v-for="(n, i) in pageItems" :key="`${n}-${i}`">
          <span v-if="n === '…'" class="pager__gap" aria-hidden="true">…</span>
          <button
            v-else
            type="button"
            class="pager__btn pager__num"
            :class="{ 'pager__btn--on': n === page }"
            :aria-current="n === page ? 'page' : undefined"
            :aria-label="`Página ${n}`"
            @click="page = n"
          >
            {{ n }}
          </button>
        </template>
        <button type="button" class="pager__btn" :disabled="page === pageCount" @click="page++">
          Próxima
        </button>
      </nav>
    </footer>
  </section>
</template>

<style scoped>
.header {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px 16px;
  margin-bottom: 20px;
}

.header__text {
  flex: 1 1 420px;
}

.sector-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 34px;
  padding: 0 14px;
  border-radius: 999px;
  background: #e8f0ff;
  color: var(--navy-800);
  font-size: 0.84rem;
  font-weight: 800;
}

.sector-chip svg {
  width: 16px;
  height: 16px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2.2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.notice {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
  padding: 12px 16px;
  border: 1px solid #ffd6c9;
  border-radius: 10px;
  background: #fff5f1;
  color: var(--navy-800);
  font-size: 0.9rem;
}

.notice__dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--orange-500);
}

.panel {
  overflow: hidden;
  padding: 0;
}

.tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 0 20px;
  border-bottom: 1px solid var(--card-border);
}

.tab {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 46px;
  padding: 0 14px;
  border: 0;
  background: transparent;
  box-shadow: inset 0 -2px 0 transparent;
  color: var(--text-muted);
  font: inherit;
  font-size: 0.9rem;
  font-weight: 700;
  cursor: pointer;
}

.tab span {
  display: inline-grid;
  place-items: center;
  min-width: 22px;
  height: 22px;
  padding: 0 6px;
  border-radius: 11px;
  background: #eef1f6;
  color: var(--navy-800);
  font-size: 0.75rem;
}

.tab--on {
  box-shadow: inset 0 -2px 0 var(--navy-800);
  color: var(--navy-800);
}

.tab--on span {
  background: var(--navy-800);
  color: #fff;
}

.tab:focus-visible {
  outline: 2px solid var(--navy-700);
  outline-offset: -2px;
}

.filters {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  padding: 14px 20px;
  border-bottom: 1px solid var(--card-border);
}

.search {
  position: relative;
  flex: 1 1 240px;
  max-width: 360px;
}

.search svg {
  position: absolute;
  top: 11px;
  left: 14px;
  width: 18px;
  height: 18px;
  fill: none;
  stroke: var(--text-soft);
  stroke-width: 2;
  stroke-linecap: round;
}

.search input,
.fsel {
  height: 40px;
  border: 1px solid var(--border);
  border-radius: 9px;
  background: #fff;
  color: var(--navy-800);
  font: inherit;
  font-size: 0.875rem;
}

.search input {
  width: 100%;
  padding: 0 14px 0 42px;
}

.fsel {
  max-width: 100%;
  padding: 0 12px;
}

.search input:focus,
.fsel:focus {
  border-color: var(--blue-500);
  outline: none;
  box-shadow: 0 0 0 3px rgba(31, 157, 230, 0.18);
}

.check {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 40px;
  color: var(--navy-800);
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
}

.check input {
  width: 16px;
  height: 16px;
  accent-color: var(--navy-800);
}

.link-button {
  padding: 8px 10px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--link);
  font: inherit;
  font-size: 0.875rem;
  font-weight: 700;
  cursor: pointer;
}

.link-button:hover {
  background: #eef4fc;
}

.table-scroll {
  overflow-x: auto;
}

.table {
  width: 100%;
  min-width: 1080px;
  border-collapse: collapse;
}

.table th {
  padding: 10px 14px;
  background: #f8fafc;
  color: var(--text-muted);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-align: left;
  text-transform: uppercase;
  white-space: nowrap;
}

.table th:first-child,
.table td:first-child {
  padding-left: 20px;
}

.table th:last-child,
.table td:last-child {
  padding-right: 20px;
}

.table td {
  max-width: 220px;
  padding: 12px 14px;
  border-top: 1px solid var(--card-border);
  color: var(--navy-800);
  font-size: 0.875rem;
  font-weight: 600;
  vertical-align: middle;
}

.table tbody tr:hover {
  background: #f8fafd;
}

.row--unseen {
  background: #fffaf7;
  box-shadow: inset 3px 0 0 var(--orange-500);
}

.cell-title {
  max-width: 320px !important;
}

.cell-title__link {
  display: block;
  overflow: hidden;
  color: #0f1f3d;
  font-size: 0.92rem;
  font-weight: 700;
  text-decoration: none;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cell-title__link:hover {
  color: var(--link);
  text-decoration: underline;
}

.cell-title__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: 3px;
}

.mono {
  color: var(--text-soft);
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 0.75rem;
}

.tag {
  padding: 1px 8px;
  border-radius: 999px;
  font-size: 0.6875rem;
  font-weight: 800;
}

.tag--new {
  background: #ffe9e2;
  color: #a33b1a;
}

.tag--seen {
  background: #e3f5ea;
  color: #17643a;
}

/* Nomes de setor inteiros: quando não cabem, o destino desce para a linha de baixo. */
.route {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px 6px;
  min-width: 170px;
  line-height: 1.35;
}

.route span {
  white-space: nowrap;
}

.route svg {
  flex: none;
  width: 14px;
  height: 14px;
  fill: none;
  stroke: var(--text-soft);
  stroke-width: 2.4;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.route__to {
  font-weight: 800;
}

.route__mine {
  padding: 1px 6px;
  border-radius: 5px;
  background: #e8f0ff;
}

.ellipsis {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.muted {
  color: var(--text-muted) !important;
  font-weight: 600;
}

.nowrap {
  white-space: nowrap;
}

.priority {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  white-space: nowrap;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.cell-action {
  text-align: right;
}

.btn-open {
  display: inline-flex;
  align-items: center;
  height: 34px;
  padding: 0 14px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: #fff;
  color: var(--navy-800);
  font-size: 0.84rem;
  font-weight: 700;
  text-decoration: none;
}

.btn-open:hover {
  background: #eef1f6;
}

.btn-open:focus-visible,
.cell-title__link:focus-visible,
.link-button:focus-visible,
.pager__btn:focus-visible {
  outline: 2px solid var(--navy-700);
  outline-offset: 2px;
}

.empty {
  margin: 0;
  padding: 40px 20px;
  border-top: 1px solid var(--card-border);
  color: var(--text-muted);
  text-align: center;
}

.panel__footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 20px;
  border-top: 1px solid var(--card-border);
  color: var(--text-muted);
  font-size: 0.84rem;
}

.pager {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.pager__btn {
  min-width: 36px;
  height: 36px;
  padding: 0 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: #fff;
  color: var(--navy-800);
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

.pager__btn:disabled {
  color: var(--text-soft);
  cursor: not-allowed;
}

.pager__gap {
  display: grid;
  place-items: center;
  min-width: 20px;
  color: var(--text-soft);
  font-weight: 700;
}

.pager__btn--on {
  border-color: var(--navy-800);
  background: var(--navy-800);
  color: #fff;
}

@media (max-width: 640px) {
  .tabs,
  .filters,
  .panel__footer {
    padding-inline: 14px;
  }

  .search,
  .filters label:not(.check),
  .fsel {
    flex: 1 1 100%;
    width: 100%;
    max-width: none;
  }
}
</style>
