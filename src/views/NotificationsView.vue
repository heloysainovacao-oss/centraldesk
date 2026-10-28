<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useNotificationsStore, type AppNotification } from '@/stores/notifications'
import { formatTicketNumber, useTicketsStore } from '@/stores/tickets'
import { formatShortTime } from '@/utils/format'

// Notificações do coordenador: alguém do setor abriu um chamado.
// Abrir o chamado marca a notificação como lida e registra a visualização.

const auth = useAuthStore()
const notifications = useNotificationsStore()
const tickets = useTicketsStore()

const email = computed(() => auth.currentUser?.email ?? '')
const all = computed(() => notifications.forUser(email.value))
const unread = computed(() => all.value.filter((n) => !n.readAt).length)
const onlyUnread = ref(false)

const unreadLabel = computed(() => {
  if (!all.value.length) return 'Você ainda não recebeu notificações.'
  if (!unread.value) return 'Tudo lido por aqui.'
  return unread.value === 1 ? '1 notificação não lida.' : `${unread.value} notificações não lidas.`
})

function dayLabel(iso: string, now = new Date()) {
  const value = new Date(iso)
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (value.toDateString() === now.toDateString()) return 'Hoje'
  if (value.toDateString() === yesterday.toDateString()) return 'Ontem'
  return 'Anteriores'
}

const groups = computed(() => {
  const list = onlyUnread.value ? all.value.filter((n) => !n.readAt) : all.value
  const result: { label: string; items: AppNotification[] }[] = []
  for (const n of list) {
    const label = dayLabel(n.createdAt)
    let group = result.find((g) => g.label === label)
    if (!group) result.push((group = { label, items: [] }))
    group.items.push(n)
  }
  return result
})

/** O chamado já foi visualizado por mim (mesmo que a notificação tenha sido lida antes). */
function viewed(n: AppNotification) {
  const ticket = tickets.ticketById(n.ticketId)
  return !!ticket && tickets.viewedBy(ticket, email.value)
}
</script>

<template>
  <div class="page">
    <header class="header">
      <div>
        <h1 class="page-title">Notificações</h1>
        <p class="page-subtitle" role="status">{{ unreadLabel }}</p>
      </div>
      <button
        type="button"
        class="btn btn--secondary"
        :disabled="!unread"
        @click="notifications.markAllRead(email)"
      >
        Marcar todas como lidas
      </button>
    </header>

    <label v-if="all.length" class="check">
      <input v-model="onlyUnread" type="checkbox" />
      Só não lidas
    </label>

    <section class="card list" aria-label="Lista de notificações">
      <template v-for="group in groups" :key="group.label">
        <h2 class="group">{{ group.label }}</h2>
        <article
          v-for="n in group.items"
          :key="n.id"
          class="item"
          :class="{ 'item--unread': !n.readAt }"
        >
          <span class="item__icon" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <path d="M3 9h18M8 13h8M8 17h5" />
            </svg>
          </span>
          <div class="item__body">
            <p class="item__text">
              <strong>{{ n.actorName }}</strong
              >, do seu setor ({{ n.actorDepartment }}), abriu um chamado para
              <strong>{{ n.targetSector }}</strong
              >:
              <RouterLink :to="{ name: 'ticket', params: { id: n.ticketId } }" class="item__ticket">
                {{ formatTicketNumber(n.ticketId) }} · {{ n.ticketTitle }}
              </RouterLink>
            </p>
            <p class="item__meta">
              <time :datetime="n.createdAt">{{ formatShortTime(n.createdAt) }}</time>
              <span class="tag">Chamado do setor</span>
              <span v-if="viewed(n)" class="tag tag--seen">Visualizado por você</span>
            </p>
            <div class="item__actions">
              <RouterLink
                :to="{ name: 'ticket', params: { id: n.ticketId } }"
                class="btn btn--primary btn--small"
              >
                Ver chamado
              </RouterLink>
              <button
                v-if="!n.readAt"
                type="button"
                class="link-button"
                @click="notifications.markRead(n.id)"
              >
                Marcar como lida
              </button>
            </div>
          </div>
          <span v-if="!n.readAt" class="item__dot"><span class="sr-only">Não lida</span></span>
        </article>
      </template>

      <div v-if="!groups.length" class="empty">
        <p class="empty__title">Tudo em dia</p>
        <p>
          {{
            all.length
              ? 'Nenhuma notificação não lida.'
              : 'Quando alguém do seu setor abrir um chamado, você recebe um aviso aqui.'
          }}
        </p>
      </div>
    </section>
  </div>
</template>

<style scoped>
.page {
  display: grid;
  gap: 16px;
  max-width: 920px;
}

.header {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
}

.check {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  justify-self: end;
  min-height: 40px;
  color: var(--navy-800);
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
}

.check input {
  width: 18px;
  height: 18px;
  accent-color: var(--navy-800);
}

.list {
  overflow: hidden;
  padding: 0;
}

.group {
  margin: 0;
  padding: 12px 20px 8px;
  border-top: 1px solid var(--card-border);
  background: #f8fafc;
  color: var(--text-muted);
  font-size: 0.75rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.group:first-child {
  border-top: 0;
}

.item {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 16px 20px;
  border-top: 1px solid var(--card-border);
}

.item--unread {
  background: #fffaf7;
}

.item__icon {
  display: grid;
  flex: none;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: #e8f0ff;
  color: var(--navy-800);
}

.item__icon svg {
  width: 20px;
  height: 20px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.item__body {
  display: grid;
  flex: 1;
  gap: 6px;
  min-width: 0;
}

.item__text {
  margin: 0;
  color: #1e293b;
  font-size: 0.92rem;
  line-height: 1.5;
}

.item__ticket {
  color: var(--link);
  font-weight: 700;
  text-decoration: none;
}

.item__ticket:hover {
  text-decoration: underline;
}

.item__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--text-muted);
  font-size: 0.8rem;
}

.tag {
  padding: 2px 8px;
  border-radius: 999px;
  background: #eef1f6;
  color: var(--navy-800);
  font-size: 0.72rem;
  font-weight: 700;
}

.tag--seen {
  background: #e3f5ea;
  color: #17643a;
}

.item__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: 2px;
}

.btn--small {
  height: 34px;
  padding: 0 14px;
  font-size: 0.84rem;
}

.link-button {
  padding: 8px 10px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--link);
  font: inherit;
  font-size: 0.84rem;
  font-weight: 700;
  cursor: pointer;
}

.link-button:hover {
  background: #eef4fc;
}

.item__dot {
  flex: none;
  width: 10px;
  height: 10px;
  margin-top: 6px;
  border-radius: 50%;
  background: var(--orange-500);
}

.empty {
  padding: 48px 24px;
  color: var(--text-muted);
  text-align: center;
}

.empty p {
  margin: 4px 0 0;
}

.empty__title {
  color: var(--navy-800);
  font-size: 1rem;
  font-weight: 800;
}
</style>
