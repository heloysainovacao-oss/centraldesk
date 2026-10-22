<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import RatingCard from '@/components/RatingCard.vue'
import ResolveDialog from '@/components/ResolveDialog.vue'
import TicketChat from '@/components/TicketChat.vue'
import TicketTimeline from '@/components/TicketTimeline.vue'
import { priorityById } from '@/constants/tickets'
import { useCategoriesStore } from '@/stores/categories'
import { useAuthStore } from '@/stores/auth'
import { formatTicketNumber, useTicketsStore, type TicketResolution } from '@/stores/tickets'
import { useUsersStore } from '@/stores/users'
import { formatDateTime, formatDuration } from '@/utils/format'
import { initials } from '@/utils/user'

const auth = useAuthStore()
const categories = useCategoriesStore()
const tickets = useTicketsStore()
const users = useUsersStore()
const route = useRoute()

const ticket = computed(() => {
  const found = tickets.ticketById(Number(route.params.id))
  // Usuários só veem os próprios chamados; analistas veem todos.
  if (!found || (!auth.isAnalyst && found.authorEmail !== auth.currentUser?.email)) return null
  return found
})

const listLabel = computed(() => (auth.isAnalyst ? 'Atendimentos' : 'Meus chamados'))
const justCreated = computed(() => route.query.novo !== undefined)
const priority = computed(() => ticket.value && priorityById(ticket.value.priority))
const canManage = computed(() => auth.isAnalyst && ticket.value?.status !== 'resolvido')

const people = computed(() => {
  const t = ticket.value
  if (!t) return []
  return [
    {
      label: 'Solicitante',
      name: t.authorName ?? t.authorEmail,
      detail: t.authorDepartment,
      kind: 'usuario',
    },
    {
      label: 'Responsável',
      name: t.assigneeName,
      detail: t.assigneeDepartment,
      kind: 'analista',
    },
  ]
})

const times = computed(() => {
  const t = ticket.value
  if (!t) return []
  const opened = new Date(t.createdAt).getTime()
  const firstResponse = tickets.firstResponseAt(t.id)
  return [
    { label: 'Aberto em', value: formatDateTime(t.createdAt) },
    { label: 'Assumido em', value: t.assignedAt ? formatDateTime(t.assignedAt) : '—' },
    { label: 'Encerrado em', value: t.resolvedAt ? formatDateTime(t.resolvedAt) : '—' },
    {
      label: 'Tempo de resposta',
      value: firstResponse
        ? formatDuration(new Date(firstResponse).getTime() - opened)
        : 'aguardando',
      highlight: Boolean(firstResponse),
    },
    {
      label: 'Tempo de resolução',
      value: t.resolvedAt ? formatDuration(new Date(t.resolvedAt).getTime() - opened) : 'em aberto',
      highlight: Boolean(t.resolvedAt),
    },
  ]
})

// --- Ações do analista ---

function handleAssign() {
  if (ticket.value && auth.currentUser) tickets.assign(ticket.value.id, auth.currentUser)
}

const assignOpen = ref(false)
const assignTo = ref('')
const assignOptions = computed(() =>
  users.activeAnalysts.filter((a) => a.email !== ticket.value?.assigneeEmail),
)

function openAssign() {
  users.reload()
  assignTo.value = assignOptions.value[0]?.email ?? ''
  assignOpen.value = true
}

function confirmAssign() {
  const analyst = users.userByEmail(assignTo.value)
  if (ticket.value && analyst && auth.currentUser) {
    tickets.reassign(ticket.value.id, analyst, auth.currentUser)
  }
  assignOpen.value = false
}

const resolveOpen = ref(false)

function confirmResolve(resolution: TicketResolution) {
  if (!ticket.value || !auth.currentUser) return
  if (tickets.resolve(ticket.value.id, auth.currentUser, resolution)) resolveOpen.value = false
}
</script>

<template>
  <nav class="breadcrumb" aria-label="Você está em">
    <RouterLink :to="{ name: 'tickets' }">{{ listLabel }}</RouterLink>
    <span aria-hidden="true">/</span>
    <span aria-current="page" class="breadcrumb__current">
      {{ ticket ? formatTicketNumber(ticket.id) : 'Chamado' }}
    </span>
  </nav>

  <section v-if="!ticket" class="card not-found">
    <h1 class="page-title">Chamado não encontrado</h1>
    <p class="page-subtitle">Ele pode ter sido removido ou você não tem acesso a ele.</p>
    <RouterLink :to="{ name: 'tickets' }" class="btn btn--secondary">
      Voltar para {{ listLabel.toLowerCase() }}
    </RouterLink>
  </section>

  <div v-else class="page">
    <div v-if="justCreated" class="success" role="status">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
      Chamado <strong>{{ formatTicketNumber(ticket.id) }}</strong> aberto. A equipe do setor
      {{ ticket.sector }} já foi avisada e pode falar com você por aqui.
    </div>

    <header class="head">
      <div class="head__text">
        <h1 class="head__title">{{ ticket.title }}</h1>
        <div class="chips">
          <StatusBadge :status="ticket.status" />
          <span
            v-if="priority"
            class="chip"
            :style="{ background: priority.tint, color: priority.text }"
          >
            <span class="chip__dot" :style="{ background: priority.color }" />
            Prioridade {{ priority.label.toLowerCase() }}
          </span>
          <span class="chip chip--plain">
            <span
              class="chip__square"
              :style="{ background: categories.colorOf(ticket.category) }"
            />
            {{ ticket.category }}
          </span>
          <span class="chip chip--sector" title="Setor de destino">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M4 21V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v16M15 9h4a1 1 0 0 1 1 1v11M8 8h3M8 12h3M8 16h3M3 21h18"
              />
            </svg>
            <span class="sr-only">Setor de destino:</span> {{ ticket.sector }}
          </span>
        </div>
      </div>

      <div v-if="canManage" class="head__actions">
        <button type="button" class="btn btn--secondary" @click="openAssign">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M14 4h6v6M20 4l-7 7M10 20H4v-6M4 20l7-7" />
          </svg>
          {{ ticket.status === 'aberto' ? 'Atribuir' : 'Reatribuir' }}
        </button>
        <button
          v-if="ticket.status === 'aberto'"
          type="button"
          class="btn btn--primary"
          @click="handleAssign"
        >
          Assumir chamado
        </button>
        <button v-else type="button" class="btn btn--primary" @click="resolveOpen = true">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
          Encerrar chamado
        </button>
      </div>
    </header>

    <TicketTimeline :ticket="ticket" />

    <div class="layout">
      <div class="main">
        <section class="card block">
          <h2 class="block__label">Descrição</h2>
          <p class="description">{{ ticket.description }}</p>
        </section>

        <section
          v-if="ticket.status === 'resolvido' && ticket.resolutionSummary"
          class="card block resolution"
          aria-labelledby="resolution-title"
        >
          <h2 id="resolution-title" class="block__label">Resolução</h2>
          <p class="resolution__summary">{{ ticket.resolutionSummary }}</p>
          <p class="resolution__details">{{ ticket.resolutionDetails }}</p>
          <p class="resolution__meta">
            Encerrado
            <template v-if="ticket.assigneeName"> por {{ ticket.assigneeName }}</template>
            <template v-if="ticket.resolvedAt">
              em {{ formatDateTime(ticket.resolvedAt) }}</template
            >
          </p>
        </section>

        <RatingCard v-if="ticket.status === 'resolvido'" :ticket="ticket" />

        <TicketChat :ticket="ticket" />
      </div>

      <aside class="side">
        <section class="card people">
          <div v-for="person in people" :key="person.label" class="person">
            <h2 class="block__label">{{ person.label }}</h2>
            <div v-if="person.name" class="person__row">
              <span class="avatar" :class="`avatar--${person.kind}`" aria-hidden="true">
                {{ initials(person.name) }}
              </span>
              <span class="person__who">
                <strong>{{ person.name }}</strong>
                <small v-if="person.detail">{{ person.detail }}</small>
              </span>
            </div>
            <p v-else class="person__empty">Ninguém assumiu ainda</p>
          </div>
        </section>

        <section class="card times">
          <dl>
            <div v-for="item in times" :key="item.label" class="times__row">
              <dt>{{ item.label }}</dt>
              <dd :class="{ 'times__value--highlight': item.highlight }">{{ item.value }}</dd>
            </div>
          </dl>
        </section>
      </aside>
    </div>

    <ConfirmDialog
      :open="assignOpen"
      :title="ticket.status === 'aberto' ? 'Atribuir chamado' : 'Reatribuir chamado'"
      confirm-label="Confirmar"
      :confirm-disabled="!assignTo"
      @confirm="confirmAssign"
      @close="assignOpen = false"
    >
      <template v-if="assignOptions.length">
        <label class="dialog-label" for="assign-to">Novo responsável</label>
        <select id="assign-to" v-model="assignTo" class="dialog-select">
          <option v-for="analyst in assignOptions" :key="analyst.email" :value="analyst.email">
            {{ analyst.name }}{{ analyst.email === auth.currentUser?.email ? ' (você)' : '' }}
          </option>
        </select>
        <p class="dialog-note">A mudança fica registrada na conversa do chamado.</p>
      </template>
      <p v-else>Não há outro administrador ativo para receber este chamado.</p>
    </ConfirmDialog>

    <ResolveDialog
      :open="resolveOpen"
      :ticket-number="formatTicketNumber(ticket.id)"
      @confirm="confirmResolve"
      @close="resolveOpen = false"
    />
  </div>
</template>

<style scoped>
.breadcrumb {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 18px;
  font-size: 0.875rem;
  color: var(--text);
}

.breadcrumb a {
  color: var(--link);
  font-weight: 500;
  text-decoration: none;
}

.breadcrumb a:hover {
  text-decoration: underline;
}

.breadcrumb [aria-hidden] {
  color: var(--text-soft);
}

.breadcrumb__current {
  font-variant-numeric: tabular-nums;
}

.page {
  display: grid;
  gap: 20px;
  max-width: 1140px;
}

.success {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 18px;
  border: 1px solid #bfe3cd;
  border-radius: 10px;
  background: #ecf8f1;
  color: #17643a;
  font-size: 0.9375rem;
}

.success svg,
.head svg {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px 24px;
}

.head__text {
  min-width: 0;
}

.head__title {
  font-size: 1.875rem;
  font-weight: 800;
  line-height: 1.2;
  letter-spacing: -0.02em;
  color: var(--navy-800);
  overflow-wrap: anywhere;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
}

.chips :deep(.badge),
.chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  border-radius: 999px;
  font-size: 0.8125rem;
  font-weight: 600;
}

.chip--plain {
  color: var(--navy-800);
}

.chip--sector {
  border: 1px solid var(--card-border);
  background: #fff;
  color: var(--navy-800);
}

.chip--sector svg {
  width: 14px;
  height: 14px;
  stroke-width: 1.8;
}

.chip__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.chip__square {
  width: 8px;
  height: 8px;
  border-radius: 2px;
}

.head__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 300px;
  gap: 24px;
  align-items: start;
}

.main {
  display: grid;
  gap: 20px;
  min-width: 0;
}

.block {
  padding: 24px;
}

.block__label {
  margin-bottom: 10px;
  color: var(--text-muted);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.resolution {
  border-color: #cdebd8;
  background: linear-gradient(180deg, #f3fbf6 0%, #fff 70%);
}

.resolution__summary {
  color: var(--navy-800);
  font-size: 1rem;
  font-weight: 700;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.resolution__details {
  margin-top: 10px;
  color: var(--text);
  font-size: 0.9375rem;
  line-height: 1.65;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.resolution__meta {
  margin-top: 14px;
  color: var(--text-muted);
  font-size: 0.8125rem;
}

.description {
  color: var(--text);
  font-size: 0.9375rem;
  line-height: 1.65;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.side {
  display: grid;
  gap: 16px;
}

.people {
  display: grid;
  gap: 20px;
  padding: 22px 20px;
}

.person__row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.avatar {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  color: var(--navy-900);
  font-size: 0.8125rem;
  font-weight: 800;
}

.avatar--usuario {
  background: var(--blue-500);
}

.avatar--analista {
  background: var(--orange-500);
}

.person__who {
  display: grid;
  min-width: 0;
}

.person__who strong {
  color: var(--navy-800);
  font-size: 0.9375rem;
}

.person__who small {
  color: var(--text-muted);
  font-size: 0.8125rem;
}

.person__empty {
  color: var(--text-muted);
  font-size: 0.875rem;
}

.times {
  padding: 6px 20px;
}

.times dl {
  margin: 0;
}

.times__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 0;
  font-size: 0.875rem;
}

.times__row + .times__row {
  border-top: 1px solid var(--card-border);
}

.times dt {
  color: var(--text-muted);
}

.times dd {
  margin: 0;
  color: var(--navy-800);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.times__value--highlight {
  color: var(--link) !important;
}

.dialog-label {
  display: block;
  margin: 8px 0;
  color: var(--text);
  font-size: 0.875rem;
  font-weight: 600;
}

.dialog-select {
  width: 100%;
  height: 46px;
  padding: 0 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: #fff;
  color: var(--text);
  font-size: 0.9375rem;
}

.dialog-note {
  margin-top: 10px;
  font-size: 0.8125rem;
}

.not-found {
  display: grid;
  justify-items: start;
  gap: 16px;
  max-width: 640px;
  padding: 32px;
}

@media (max-width: 1000px) {
  .layout {
    grid-template-columns: 1fr;
  }

  .side {
    grid-template-columns: 1fr 1fr;
    order: -1;
  }
}

@media (max-width: 640px) {
  .head__title {
    font-size: 1.5rem;
  }

  .head__actions,
  .head__actions .btn {
    flex: 1;
  }

  .side {
    grid-template-columns: 1fr;
  }
}
</style>
