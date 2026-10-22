<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import StatusBadge from '@/components/StatusBadge.vue'
import { SECTORS, STATUSES, priorityById, type TicketStatus } from '@/constants/tickets'
import { useAuthStore } from '@/stores/auth'
import { useCategoriesStore } from '@/stores/categories'
import { formatTicketNumber, useTicketsStore, type Ticket } from '@/stores/tickets'
import { initials } from '@/utils/user'

// `mine`: lista só os chamados abertos pela própria pessoa ("Chamados que abri" do analista).
const props = defineProps<{ mine?: boolean }>()

const auth = useAuthStore()
const categories = useCategoriesStore()
const tickets = useTicketsStore()

// Na fila, o analista vê os chamados de todos; nos outros casos, só os próprios.
const isQueue = computed(() => auth.isAnalyst && !props.mine)

const list = computed(() => {
  if (!auth.currentUser) return []
  return isQueue.value ? tickets.allTickets() : tickets.ticketsBy(auth.currentUser.email)
})

const heading = computed(() =>
  isQueue.value ? 'Atendimentos' : auth.isAnalyst ? 'Chamados que abri' : 'Meus chamados',
)

// Filtro por setor de destino (em Atendimentos).
const sectorFilter = ref('')
const sectorOptions = computed(() =>
  SECTORS.map((s) => s.name).filter((name) => list.value.some((t) => t.sector === name)),
)
const bySector = computed(() =>
  sectorFilter.value ? list.value.filter((t) => t.sector === sectorFilter.value) : list.value,
)

const statusFilter = ref<TicketStatus | 'todos'>('todos')
const filters = computed(() => [
  { id: 'todos' as const, label: 'Todos', count: bySector.value.length },
  ...(Object.keys(STATUSES) as TicketStatus[]).map((id) => ({
    id,
    label: STATUSES[id].label,
    count: bySector.value.filter((t) => t.status === id).length,
  })),
])
const visible = computed(() =>
  statusFilter.value === 'todos'
    ? bySector.value
    : bySector.value.filter((t) => t.status === statusFilter.value),
)

const dateFormat = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
})

function formatDate(iso: string) {
  return dateFormat.format(new Date(iso))
}

// --- Assumir direto pela lista (Atendimentos) ---
const feedback = ref('')
let feedbackTimer: ReturnType<typeof setTimeout> | undefined

function assume(ticket: Ticket) {
  if (!auth.currentUser) return
  tickets.assign(ticket.id, auth.currentUser)
  feedback.value = `Você assumiu o chamado ${formatTicketNumber(ticket.id)}. Ele passou para "Em andamento".`
  clearTimeout(feedbackTimer)
  feedbackTimer = setTimeout(() => (feedback.value = ''), 5000)
}

function isMe(email?: string) {
  return !!email && email === auth.currentUser?.email
}
</script>

<template>
  <header class="header">
    <div>
      <h1 class="page-title">{{ heading }}</h1>
      <p class="page-subtitle">
        {{
          isQueue
            ? 'Chamados enviados a todos os setores. Clique em um chamado para conversar com o solicitante.'
            : 'Acompanhe os chamados que você abriu e converse com a equipe de suporte.'
        }}
      </p>
    </div>
    <RouterLink v-if="auth.isAnalyst && mine" :to="{ name: 'new-ticket' }" class="btn btn--primary">
      Novo chamado
    </RouterLink>
  </header>

  <div v-if="list.length" class="toolbar">
    <div class="filters" role="group" aria-label="Filtrar por status">
      <button
        v-for="filter in filters"
        :key="filter.id"
        type="button"
        class="filters__item"
        :class="{ 'filters__item--active': statusFilter === filter.id }"
        :aria-pressed="statusFilter === filter.id"
        @click="statusFilter = filter.id"
      >
        {{ filter.label }} <span>{{ filter.count }}</span>
      </button>
    </div>
    <label v-if="isQueue && sectorOptions.length > 1" class="sector-filter">
      <span class="sr-only">Setor de destino</span>
      <select v-model="sectorFilter">
        <option value="">Todos os setores</option>
        <option v-for="name in sectorOptions" :key="name" :value="name">{{ name }}</option>
      </select>
    </label>
  </div>

  <p v-if="feedback" class="feedback" role="status">{{ feedback }}</p>

  <section v-if="list.length" class="card list" aria-label="Lista de chamados">
    <div class="list__head" :class="{ 'list__head--analyst': isQueue }" aria-hidden="true">
      <span>Chamado</span>
      <span v-if="isQueue">Solicitante</span>
      <span>Categoria</span>
      <span>Prioridade</span>
      <span>Status</span>
      <span v-if="isQueue">Responsável</span>
      <span>Aberto em</span>
    </div>
    <ul>
      <li v-for="ticket in visible" :key="ticket.id">
        <!-- A linha inteira abre o chamado (link "esticado" no título); o botão Assumir fica por cima. -->
        <div class="row" :class="{ 'row--analyst': isQueue }">
          <span class="row__title">
            <span class="row__number">
              {{ formatTicketNumber(ticket.id) }}
              <span class="row__sector">{{ ticket.sector }}</span>
              <span v-if="tickets.messageCount(ticket.id)" class="row__messages">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M4 5h16v11H8l-4 4z" />
                </svg>
                {{ tickets.messageCount(ticket.id) }}
                <span class="sr-only">mensagens</span>
              </span>
            </span>
            <RouterLink :to="{ name: 'ticket', params: { id: ticket.id } }" class="row__link">
              <strong>{{ ticket.title }}</strong>
            </RouterLink>
          </span>
          <span v-if="isQueue" class="row__author">
            {{ ticket.authorName ?? ticket.authorEmail }}
            <small v-if="ticket.authorDepartment">{{ ticket.authorDepartment }}</small>
          </span>
          <span class="row__cell">
            <span class="dot" :style="{ background: categories.colorOf(ticket.category) }" />
            {{ ticket.category }}
          </span>
          <span class="row__cell">
            <span class="dot" :style="{ background: priorityById(ticket.priority).color }" />
            {{ priorityById(ticket.priority).label }}
          </span>
          <span class="row__status">
            <StatusBadge :status="ticket.status" />
            <span
              v-if="!isQueue && tickets.awaitingRating(ticket)"
              class="row__rate"
              title="Avalie o atendimento deste chamado"
            >
              ★ Avaliar
            </span>
            <span
              v-else-if="ticket.rating"
              class="row__rated"
              :title="`Avaliado com ${ticket.rating} de 5`"
            >
              ★ {{ ticket.rating }}
            </span>
          </span>
          <span v-if="isQueue" class="row__assignee">
            <template v-if="ticket.assigneeName">
              <span class="avatar" aria-hidden="true">{{ initials(ticket.assigneeName) }}</span>
              <span class="row__assignee-name">
                {{ ticket.assigneeName }}
                <small v-if="isMe(ticket.assigneeEmail)">você</small>
              </span>
            </template>
            <button
              v-else-if="ticket.status !== 'resolvido'"
              type="button"
              class="btn btn--primary btn--assume"
              :aria-label="`Assumir o chamado ${formatTicketNumber(ticket.id)}`"
              @click="assume(ticket)"
            >
              Assumir
            </button>
            <span v-else class="row__none">—</span>
          </span>
          <span class="row__date">{{ formatDate(ticket.createdAt) }}</span>
        </div>
      </li>
    </ul>
    <p v-if="!visible.length" class="list__empty">Nenhum chamado com esses filtros.</p>
  </section>

  <section v-else class="card empty">
    <template v-if="isQueue">
      <h2>Nenhum atendimento por aqui</h2>
      <p>Quando alguém abrir um chamado para qualquer setor, ele aparece aqui.</p>
    </template>
    <template v-else>
      <h2>Você ainda não abriu nenhum chamado</h2>
      <p>Quando precisar de ajuda, abra um chamado para o setor responsável.</p>
      <RouterLink :to="{ name: 'new-ticket' }" class="btn btn--primary">Abrir chamado</RouterLink>
    </template>
  </section>
</template>

<style scoped>
.header {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  max-width: 1140px;
  margin-bottom: 20px;
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  max-width: 1140px;
  margin-bottom: 16px;
}

.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.sector-filter select {
  height: 36px;
  padding: 0 32px 0 12px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: #fff
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%230b2269' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")
    no-repeat right 12px center / 14px;
  color: var(--navy-800);
  font-size: 0.875rem;
  font-weight: 600;
  appearance: none;
  cursor: pointer;
}

.row__status {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.row__rate {
  padding: 3px 8px;
  border-radius: 999px;
  background: #fdf1d6;
  color: #8a5a00;
  font-size: 0.6875rem;
  font-weight: 700;
  white-space: nowrap;
}

.row__rated {
  color: #8a5a00;
  font-size: 0.75rem;
  font-weight: 700;
  white-space: nowrap;
}

.row__sector {
  padding: 1px 7px;
  border-radius: 4px;
  background: #eef1f6;
  color: var(--text-muted);
  font-size: 0.6875rem;
  font-weight: 700;
}

.filters__item {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 36px;
  padding: 0 14px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: #fff;
  color: var(--text-muted);
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
}

.filters__item span {
  padding: 0 7px;
  border-radius: 999px;
  background: #eef1f6;
  font-size: 0.75rem;
}

.filters__item--active {
  border-color: var(--navy-800);
  background: var(--navy-800);
  color: #fff;
}

.filters__item--active span {
  background: rgba(255, 255, 255, 0.18);
}

.list {
  max-width: 1140px;
  overflow: hidden;
}

.list ul {
  margin: 0;
  padding: 0;
  list-style: none;
}

.list li + li {
  border-top: 1px solid var(--card-border);
}

.list__head,
.row {
  display: grid;
  grid-template-columns: minmax(0, 2.4fr) 1.2fr 1fr 1.1fr 1.1fr;
  gap: 16px;
  align-items: center;
  padding: 0 24px;
}

.list__head--analyst,
.row--analyst {
  grid-template-columns:
    minmax(0, 2.1fr) minmax(0, 1.2fr) minmax(0, 1.1fr) minmax(0, 0.8fr) minmax(0, 1fr)
    minmax(0, 1.3fr) minmax(0, 0.9fr);
}

.row {
  position: relative;
}

/* O título "estica" o link sobre a linha toda; o botão Assumir fica acima dele. */
.row__link {
  display: block;
  min-width: 0;
  overflow: hidden;
  color: inherit;
  text-decoration: none;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row__link::after {
  content: '';
  position: absolute;
  inset: 0;
}

.row__link:focus-visible {
  outline: none;
}

.row:has(.row__link:focus-visible) {
  outline: 2px solid var(--navy-700);
  outline-offset: -2px;
}

.row__assignee {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.row__assignee .avatar {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: var(--orange-500);
  color: var(--navy-900);
  font-size: 0.6875rem;
  font-weight: 800;
}

.row__assignee-name {
  display: grid;
  min-width: 0;
  color: var(--navy-800);
  font-weight: 600;
  line-height: 1.25;
}

.row__assignee-name small {
  color: var(--text-muted);
  font-size: 0.6875rem;
  font-weight: 600;
}

.btn--assume {
  position: relative;
  z-index: 1;
  height: 34px;
  padding: 0 16px;
  font-size: 0.8125rem;
}

.row__none {
  color: var(--text-soft);
}

.feedback {
  max-width: 1140px;
  margin-bottom: 16px;
  padding: 12px 16px;
  border: 1px solid #bfe3cd;
  border-radius: 10px;
  background: #ecf8f1;
  color: #17643a;
  font-size: 0.875rem;
}

.list__head {
  height: 44px;
  border-bottom: 1px solid var(--card-border);
  background: #f8f9fc;
  color: var(--text-muted);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.row {
  min-height: 68px;
  padding-block: 14px;
  color: var(--text);
  font-size: 0.875rem;
  text-decoration: none;
  transition: background 0.15s;
}

.row:hover {
  background: #f8f9fc;
}

.row:focus-visible {
  outline: 2px solid var(--navy-700);
  outline-offset: -2px;
}

.row__title {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.row__title strong {
  overflow: hidden;
  font-size: 0.9375rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row__number {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--text-soft);
  font-size: 0.75rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.row__messages {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  color: var(--link);
}

.row__messages svg {
  width: 13px;
  height: 13px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linejoin: round;
}

.row__author {
  display: grid;
  min-width: 0;
  font-weight: 600;
}

.row__author small {
  color: var(--text-muted);
  font-size: 0.75rem;
  font-weight: 400;
}

.row__cell {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.row__date {
  color: var(--text-muted);
}

.dot {
  width: 8px;
  height: 8px;
  flex-shrink: 0;
  border-radius: 50%;
}

.list__empty {
  padding: 32px 24px;
  color: var(--text-muted);
  font-size: 0.9375rem;
  text-align: center;
}

.empty {
  display: grid;
  justify-items: center;
  gap: 10px;
  max-width: 1140px;
  padding: 56px 24px;
  text-align: center;
}

.empty h2 {
  font-size: 1.125rem;
  font-weight: 800;
  color: var(--navy-800);
}

.empty p {
  max-width: 420px;
  margin-bottom: 10px;
  color: var(--text-muted);
  font-size: 0.9375rem;
  line-height: 1.5;
}

@media (max-width: 860px) {
  .list__head {
    display: none;
  }

  .row,
  .row--analyst {
    grid-template-columns: 1fr auto;
    gap: 8px 12px;
    padding: 16px;
  }

  .row__title,
  .row__author,
  .row__assignee {
    grid-column: 1 / -1;
  }

  .row__date {
    grid-column: 1 / -1;
    font-size: 0.8125rem;
  }
}
</style>
