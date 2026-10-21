<script setup lang="ts">
import { computed, nextTick, ref, useId, watch } from 'vue'
import { ROLE_LABELS, useAuthStore } from '@/stores/auth'
import { useTicketsStore, type Ticket, type TicketMessage } from '@/stores/tickets'
import { formatRelativeDay, formatShortTime } from '@/utils/format'
import { initials } from '@/utils/user'

const props = defineProps<{ ticket: Ticket }>()

const auth = useAuthStore()
const tickets = useTicketsStore()

const inputId = useId()
const draft = ref('')
const threadEl = ref<HTMLElement | null>(null)

const messages = computed(() => tickets.messagesFor(props.ticket.id))
const isClosed = computed(() => props.ticket.status === 'resolvido')
const canSend = computed(() => draft.value.trim().length > 0 && !isClosed.value)
const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
const shortcut = isMac ? '⌘ + Enter' : 'Ctrl + Enter'
const placeholder = computed(() =>
  auth.isAnalyst
    ? 'Escreva uma mensagem para o solicitante'
    : 'Escreva uma mensagem para a equipe de suporte',
)

/** Papel da pessoa neste chamado: quem abriu é o Solicitante; o analista dono é o Responsável. */
function roleInTicket(message: TicketMessage) {
  if (message.authorEmail === props.ticket.authorEmail) return 'Solicitante'
  if (message.authorEmail === props.ticket.assigneeEmail) return 'Responsável'
  return ROLE_LABELS[message.authorRole]
}

function isMine(message: TicketMessage) {
  return message.authorEmail === auth.currentUser?.email
}

function send() {
  if (!canSend.value || !auth.currentUser) return
  tickets.sendMessage(props.ticket.id, auth.currentUser, draft.value)
  draft.value = ''
}

// Ctrl + Enter (ou ⌘ + Enter no Mac) envia; Enter sozinho quebra a linha.
function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
    event.preventDefault()
    send()
  }
}

// Mostra a mensagem nova (enviada aqui ou recebida de outra aba).
watch(
  () => messages.value.length,
  async (length, previous) => {
    if (length <= previous) return
    await nextTick()
    threadEl.value?.lastElementChild?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  },
)
</script>

<template>
  <section class="chat card" aria-labelledby="chat-title">
    <h2 id="chat-title" class="chat__title">Conversa</h2>

    <div ref="threadEl" class="chat__thread" aria-live="polite">
      <p class="event">
        <span>
          Chamado aberto por {{ ticket.authorName ?? ticket.authorEmail }} ·
          <time :datetime="ticket.createdAt">{{ formatRelativeDay(ticket.createdAt) }}</time>
        </span>
      </p>

      <template v-for="message in messages" :key="message.id">
        <p v-if="message.kind === 'evento'" class="event">
          <span>
            {{ message.body }} ·
            <time :datetime="message.createdAt">{{ formatShortTime(message.createdAt) }}</time>
          </span>
        </p>

        <article
          v-else
          class="msg"
          :class="[`msg--${message.authorRole}`, { 'msg--mine': isMine(message) }]"
        >
          <span class="msg__avatar" aria-hidden="true">{{ initials(message.authorName) }}</span>
          <div class="msg__content">
            <header class="msg__meta">
              <strong>{{ message.authorName }}</strong>
              · {{ roleInTicket(message) }} ·
              <time :datetime="message.createdAt">{{ formatShortTime(message.createdAt) }}</time>
            </header>
            <p class="msg__bubble">{{ message.body }}</p>
          </div>
        </article>
      </template>
    </div>

    <p v-if="isClosed" class="chat__closed">Chamado encerrado. A conversa foi finalizada.</p>
    <form v-else class="composer" @submit.prevent="send">
      <label :for="inputId" class="composer__label">Novo comentário</label>
      <textarea
        :id="inputId"
        v-model="draft"
        class="composer__input"
        rows="3"
        :placeholder="placeholder"
        :aria-describedby="`${inputId}-hint`"
        @keydown="handleKeydown"
      />
      <div class="composer__footer">
        <span :id="`${inputId}-hint`" class="composer__hint">
          <kbd>{{ shortcut }}</kbd> para enviar · Enter quebra a linha
        </span>
        <button type="submit" class="btn btn--primary composer__send" :disabled="!canSend">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M21 3 10.5 13.5M21 3l-6.5 18-4-7.5-7.5-4z" />
          </svg>
          Enviar
        </button>
      </div>
    </form>
  </section>
</template>

<style scoped>
.chat {
  padding: 28px 24px 24px;
}

.chat__title {
  margin-bottom: 20px;
  font-size: 1.125rem;
  font-weight: 800;
  color: var(--navy-800);
}

.chat__thread {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.event {
  display: flex;
  align-items: center;
  gap: 12px;
  color: var(--text-muted);
  font-size: 0.8125rem;
  text-align: center;
}

.event::before,
.event::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--card-border);
}

.event span {
  max-width: 80%;
}

.msg {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  max-width: 82%;
}

.msg--mine {
  flex-direction: row-reverse;
  align-self: flex-end;
}

.msg__avatar {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  font-size: 0.75rem;
  font-weight: 800;
}

.msg--usuario .msg__avatar {
  background: var(--blue-500);
  color: var(--navy-900);
}

.msg--analista .msg__avatar {
  background: var(--orange-500);
  color: var(--navy-900);
}

.msg__content {
  display: grid;
  gap: 6px;
  min-width: 0;
}

.msg--mine .msg__content {
  justify-items: end;
}

.msg__meta {
  color: var(--text-muted);
  font-size: 0.8125rem;
}

.msg__meta strong {
  color: var(--navy-800);
  font-weight: 700;
}

.msg__bubble {
  padding: 12px 16px;
  border-radius: 12px;
  background: #f1f3f7;
  color: var(--text);
  font-size: 0.9375rem;
  line-height: 1.55;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.msg--analista .msg__bubble {
  background: #e6effc;
}

.chat__closed {
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid var(--card-border);
  color: var(--text-muted);
  font-size: 0.875rem;
  text-align: center;
}

.composer {
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid var(--card-border);
}

.composer__label {
  display: block;
  margin-bottom: 10px;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text);
}

.composer__input {
  width: 100%;
  min-height: 92px;
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--text);
  font-size: 0.9375rem;
  line-height: 1.5;
  resize: vertical;
}

.composer__input::placeholder {
  color: var(--text-soft);
}

.composer__input:focus {
  outline: none;
  border-color: var(--navy-700);
  box-shadow: 0 0 0 3px rgba(20, 47, 128, 0.15);
}

.composer__footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: 12px;
}

.composer__hint {
  color: var(--text-muted);
  font-size: 0.75rem;
}

kbd {
  padding: 2px 6px;
  border: 1px solid var(--border);
  border-bottom-width: 2px;
  border-radius: 4px;
  background: #fff;
  color: var(--text);
  font-family: inherit;
  font-size: 0.6875rem;
  font-weight: 700;
}

.composer__send svg {
  width: 18px;
  height: 18px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.composer__send:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

@media (max-width: 640px) {
  .chat {
    padding: 22px 16px 18px;
  }

  .msg {
    max-width: 94%;
  }
}
</style>
