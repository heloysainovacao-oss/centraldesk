<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import { ROLE_LABELS, isStaffRole, useAuthStore, type User, type UserRole } from '@/stores/auth'
import { useTicketsStore } from '@/stores/tickets'
import { ACTION_ERRORS, ANONYMOUS_NAME, useUsersStore, type UserActionResult } from '@/stores/users'
import { formatCpf } from '@/utils/cpf'
import { formatDate } from '@/utils/format'
import { initials } from '@/utils/user'

const auth = useAuthStore()
const usersStore = useUsersStore()
const tickets = useTicketsStore()

usersStore.reload()

type Situation = 'ativo' | 'inativo' | 'anonimizado'

const SITUATION_LABELS: Record<Situation, string> = {
  ativo: 'Ativo',
  inativo: 'Inativo',
  anonimizado: 'Anonimizado',
}

function situationOf(user: User): Situation {
  if (user.anonymizedAt) return 'anonimizado'
  return user.active ? 'ativo' : 'inativo'
}

function isSelf(user: User) {
  return user.email === auth.currentUser?.email
}

const monthYear = new Intl.DateTimeFormat('pt-BR', { month: '2-digit', year: 'numeric' })

// ---------- Busca, filtros e paginação ----------

const search = ref('')
const department = ref('')
const role = ref<UserRole | ''>('')
const situation = ref<Situation | ''>('')

const departments = computed(() =>
  [...new Set(usersStore.users.map((u) => u.department).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, 'pt-BR'),
  ),
)

const filtered = computed(() => {
  const term = search.value.trim().toLowerCase()
  return usersStore.users.filter((u) => {
    if (department.value && u.department !== department.value) return false
    if (role.value && u.role !== role.value) return false
    if (situation.value && situationOf(u) !== situation.value) return false
    if (!term) return true
    return u.name.toLowerCase().includes(term) || u.email.includes(term)
  })
})

const PAGE_SIZE = 8
const page = ref(1)
const pageCount = computed(() => Math.max(1, Math.ceil(filtered.value.length / PAGE_SIZE)))
const visible = computed(() =>
  filtered.value.slice((page.value - 1) * PAGE_SIZE, page.value * PAGE_SIZE),
)

watch([search, department, role, situation], () => (page.value = 1))
watch(pageCount, (count) => {
  if (page.value > count) page.value = count
})

// ---------- Menu de ações (⋮) ----------

const openMenu = ref<string | null>(null)

function toggleMenu(email: string) {
  openMenu.value = openMenu.value === email ? null : email
  if (openMenu.value) {
    nextTick(() => {
      document.querySelector<HTMLElement>('.menu [role="menuitem"]:not(:disabled)')?.focus()
    })
  }
}

function closeMenu() {
  openMenu.value = null
}

function onDocumentPointer(event: PointerEvent) {
  if (!(event.target as HTMLElement).closest('.actions')) closeMenu()
}

function onDocumentKey(event: KeyboardEvent) {
  if (event.key === 'Escape' && openMenu.value) {
    const email = openMenu.value
    closeMenu()
    document.querySelector<HTMLElement>(`[data-menu-for="${email}"]`)?.focus()
  }
}

onMounted(() => {
  document.addEventListener('pointerdown', onDocumentPointer)
  document.addEventListener('keydown', onDocumentKey)
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocumentPointer)
  document.removeEventListener('keydown', onDocumentKey)
})

// ---------- Ações ----------

type ActionType =
  'make-admin' | 'remove-admin' | 'deactivate' | 'reactivate' | 'anonymize' | 'delete'

interface ActionInfo {
  title: string
  confirmLabel: string
  danger?: boolean
  text: (name: string) => string
  done: (name: string) => string
}

const ACTIONS: Record<ActionType, ActionInfo> = {
  'make-admin': {
    title: 'Tornar administrador?',
    confirmLabel: 'Tornar administrador',
    text: (n) =>
      `${n} passará a atender chamados (fila de atendimento, chat, Painel de métricas) e a gerenciar usuários, perfis e contas.`,
    done: (n) => `${n} agora é administrador.`,
  },
  'remove-admin': {
    title: 'Remover administrador?',
    confirmLabel: 'Remover administrador',
    text: (n) =>
      `${n} voltará a ser usuário: deixará de atender chamados e de gerenciar usuários. Os chamados em que é responsável continuam com o nome dele até serem reatribuídos.`,
    done: (n) => `${n} agora é usuário.`,
  },
  deactivate: {
    title: 'Desativar conta?',
    confirmLabel: 'Desativar conta',
    danger: true,
    text: (n) =>
      `${n} não conseguirá mais entrar no sistema. Você pode reativar a conta quando quiser.`,
    done: (n) => `A conta de ${n} foi desativada.`,
  },
  reactivate: {
    title: 'Reativar conta?',
    confirmLabel: 'Reativar conta',
    text: (n) => `${n} poderá voltar a entrar no sistema.`,
    done: (n) => `A conta de ${n} foi reativada.`,
  },
  anonymize: {
    title: 'Anonimizar dados?',
    confirmLabel: 'Anonimizar dados',
    danger: true,
    text: (n) =>
      `O nome, o e-mail e o CPF de ${n} serão apagados, inclusive nos chamados e conversas, que continuam no histórico como "${ANONYMOUS_NAME}". Esta ação não pode ser desfeita.`,
    done: () => 'Os dados pessoais foram removidos.',
  },
  delete: {
    title: 'Excluir conta?',
    confirmLabel: 'Excluir conta',
    danger: true,
    text: (n) =>
      `A conta de ${n} será excluída e a pessoa não poderá mais entrar. Os chamados continuam no histórico com o nome dela. Para remover também os dados pessoais, prefira anonimizar. Esta ação não pode ser desfeita.`,
    done: (n) => `A conta de ${n} foi excluída.`,
  },
}

const pending = ref<{ type: ActionType; user: User } | null>(null)
const pendingInfo = computed(() => pending.value && ACTIONS[pending.value.type])

function ask(type: ActionType, user: User) {
  closeMenu()
  pending.value = { type, user }
}

const feedback = ref<{ text: string; tone: 'ok' | 'error' } | null>(null)
let feedbackTimer: ReturnType<typeof setTimeout> | undefined

function notify(text: string, tone: 'ok' | 'error' = 'ok') {
  feedback.value = { text, tone }
  clearTimeout(feedbackTimer)
  feedbackTimer = setTimeout(() => (feedback.value = null), 5000)
}

function confirmPending() {
  const action = pending.value
  pending.value = null
  if (!action || !auth.currentUser) return
  const me = auth.currentUser.email
  const { email, name } = action.user
  let result: UserActionResult

  switch (action.type) {
    case 'make-admin':
      result = usersStore.setRole(email, 'admin', me)
      break
    case 'remove-admin':
      result = usersStore.setRole(email, 'usuario', me)
      break
    case 'deactivate':
      result = usersStore.setActive(email, false, me)
      break
    case 'reactivate':
      result = usersStore.setActive(email, true, me)
      break
    case 'anonymize': {
      const outcome = usersStore.anonymize(email, me)
      result = outcome.result
      if (outcome.newEmail) tickets.anonymizePerson(email, outcome.newEmail, ANONYMOUS_NAME)
      if (detailsEmail.value === email) detailsEmail.value = outcome.newEmail ?? null
      break
    }
    case 'delete':
      result = usersStore.remove(email, me)
      if (result === 'ok' && detailsEmail.value === email) closeDetails()
      break
  }

  if (result === 'ok') notify(ACTIONS[action.type].done(name))
  else notify(ACTION_ERRORS[result], 'error')
}

// ---------- Detalhes ----------

const detailsEl = ref<HTMLDialogElement | null>(null)
const detailsEmail = ref<string | null>(null)
const details = computed(() =>
  detailsEmail.value ? usersStore.userByEmail(detailsEmail.value) : undefined,
)

function openDetails(user: User) {
  closeMenu()
  detailsEmail.value = user.email
  detailsEl.value?.showModal()
}

function closeDetails() {
  detailsEl.value?.close()
}

const detailRows = computed(() => {
  const user = details.value
  if (!user) return []
  const rows = [
    { label: 'E-mail', value: user.anonymizedAt ? '—' : user.email },
    { label: 'CPF', value: user.cpf ? formatCpf(user.cpf) : '—' },
    { label: 'Departamento', value: user.department || '—' },
    { label: 'Perfil', value: ROLE_LABELS[user.role] },
    { label: 'Cadastro', value: user.createdAt ? formatDate(user.createdAt) : '—' },
    { label: 'Chamados abertos', value: String(tickets.ticketsBy(user.email).length) },
  ]
  if (isStaffRole(user.role)) {
    rows.push({
      label: 'Chamados atendidos',
      value: String(tickets.tickets.filter((t) => t.assigneeEmail === user.email).length),
    })
  }
  if (user.anonymizedAt) {
    rows.push({ label: 'Anonimizado em', value: formatDate(user.anonymizedAt) })
  }
  return rows
})
</script>

<template>
  <header class="header">
    <h1 class="page-title">Usuários</h1>
    <p class="page-subtitle">
      Gerencie contas e privilégios. Contas podem ser desativadas e depois anonimizadas, mantendo o
      histórico de chamados.
    </p>
  </header>

  <p
    v-if="feedback"
    class="feedback"
    :class="`feedback--${feedback.tone}`"
    :role="feedback.tone === 'error' ? 'alert' : 'status'"
  >
    {{ feedback.text }}
  </p>

  <section class="card panel" aria-label="Lista de usuários">
    <div class="toolbar">
      <label class="search">
        <span class="sr-only">Buscar usuário</span>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="11" cy="11" r="6.5" />
          <path d="m20 20-4.2-4.2" />
        </svg>
        <input v-model="search" type="search" placeholder="Buscar por nome ou e-mail" />
      </label>
      <label>
        <span class="sr-only">Departamento</span>
        <select v-model="department" class="select">
          <option value="">Todos os departamentos</option>
          <option v-for="d in departments" :key="d" :value="d">{{ d }}</option>
        </select>
      </label>
      <label>
        <span class="sr-only">Perfil</span>
        <select v-model="role" class="select">
          <option value="">Todos os perfis</option>
          <option v-for="(label, key) in ROLE_LABELS" :key="key" :value="key">{{ label }}</option>
        </select>
      </label>
      <label>
        <span class="sr-only">Situação</span>
        <select v-model="situation" class="select">
          <option value="">Todas as situações</option>
          <option v-for="(label, key) in SITUATION_LABELS" :key="key" :value="key">
            {{ label }}
          </option>
        </select>
      </label>
    </div>

    <div class="table-head" aria-hidden="true">
      <span>Usuário</span>
      <span>Departamento</span>
      <span>Perfil</span>
      <span>Situação</span>
      <span />
    </div>

    <ul class="rows">
      <li
        v-for="user in visible"
        :key="user.email"
        class="row"
        :class="{ 'row--muted': situationOf(user) !== 'ativo' }"
      >
        <span class="row__user">
          <span
            class="avatar"
            :class="user.anonymizedAt ? 'avatar--anon' : `avatar--${user.role}`"
            aria-hidden="true"
          >
            {{ user.anonymizedAt ? '–' : initials(user.name) }}
          </span>
          <span class="row__who">
            <strong>
              {{ user.name }}
              <small v-if="isSelf(user)" class="row__you">você</small>
            </strong>
            <span v-if="user.anonymizedAt">
              dados removidos em {{ monthYear.format(new Date(user.anonymizedAt)) }}
            </span>
            <span v-else>{{ user.email }}</span>
          </span>
        </span>
        <span class="row__dept">{{ user.department || '—' }}</span>
        <span
          ><span class="badge" :class="`role--${user.role}`">{{
            ROLE_LABELS[user.role]
          }}</span></span
        >
        <span>
          <span class="badge" :class="`situation--${situationOf(user)}`">
            {{ SITUATION_LABELS[situationOf(user)] }}
          </span>
        </span>

        <span class="actions">
          <button
            type="button"
            class="actions__toggle"
            :data-menu-for="user.email"
            :aria-expanded="openMenu === user.email"
            aria-haspopup="menu"
            :title="`Ações para ${user.name}`"
            @click="toggleMenu(user.email)"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="5" r="1.6" />
              <circle cx="12" cy="12" r="1.6" />
              <circle cx="12" cy="19" r="1.6" />
            </svg>
            <span class="sr-only">Ações para {{ user.name }}</span>
          </button>

          <div v-if="openMenu === user.email" class="menu" role="menu">
            <button type="button" role="menuitem" @click="openDetails(user)">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              Ver detalhes
            </button>

            <template v-if="!user.anonymizedAt && !isSelf(user)">
              <button
                v-if="user.role !== 'admin'"
                type="button"
                role="menuitem"
                @click="ask('make-admin', user)"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 3 5 6v5c0 4.5 3 8.3 7 10 4-1.7 7-5.5 7-10V6z" />
                </svg>
                Tornar administrador
              </button>
              <button v-else type="button" role="menuitem" @click="ask('remove-admin', user)">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 3 5 6v5c0 4.5 3 8.3 7 10 4-1.7 7-5.5 7-10V6zM9 12h6" />
                </svg>
                Remover administrador
              </button>

              <hr />

              <button
                v-if="user.active"
                type="button"
                role="menuitem"
                class="menu__danger"
                @click="ask('deactivate', user)"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="12" r="9" />
                  <path d="m5.6 5.6 12.8 12.8" />
                </svg>
                Desativar conta
              </button>
              <button v-else type="button" role="menuitem" @click="ask('reactivate', user)">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M4 12a8 8 0 1 0 2.3-5.7M4 4v4h4" />
                </svg>
                Reativar conta
              </button>
              <button
                type="button"
                role="menuitem"
                :disabled="user.active"
                :title="user.active ? 'Desative a conta antes de anonimizar' : undefined"
                @click="ask('anonymize', user)"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M3 3l18 18" />
                  <path d="M10.6 5.1A10.6 10.6 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4.1" />
                  <path d="M6.6 6.6C3.8 8.4 2 12 2 12s3.6 7 10 7a9.7 9.7 0 0 0 5.4-1.6" />
                </svg>
                Anonimizar dados
                <small v-if="user.active">desative antes</small>
              </button>
            </template>

            <button
              v-if="!isSelf(user)"
              type="button"
              role="menuitem"
              class="menu__danger"
              @click="ask('delete', user)"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
              </svg>
              Excluir conta
            </button>
          </div>
        </span>
      </li>
    </ul>

    <p v-if="!visible.length" class="empty">Nenhum usuário encontrado com esses filtros.</p>

    <footer class="footer">
      <span>Mostrando {{ visible.length }} de {{ filtered.length }} usuários</span>
      <div class="pager">
        <button
          type="button"
          class="btn btn--secondary btn--small"
          :disabled="page <= 1"
          @click="page--"
        >
          Anterior
        </button>
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
  </section>

  <!-- Detalhes da conta -->
  <dialog
    ref="detailsEl"
    class="details"
    aria-labelledby="details-title"
    @close="detailsEmail = null"
  >
    <div v-if="details" class="details__body">
      <button type="button" class="details__close" title="Fechar" @click="closeDetails">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
        <span class="sr-only">Fechar</span>
      </button>
      <div class="details__top">
        <span
          class="avatar avatar--large"
          :class="details.anonymizedAt ? 'avatar--anon' : `avatar--${details.role}`"
          aria-hidden="true"
        >
          {{ details.anonymizedAt ? '–' : initials(details.name) }}
        </span>
        <div>
          <h2 id="details-title" class="details__name">{{ details.name }}</h2>
          <span class="badge" :class="`situation--${situationOf(details)}`">
            {{ SITUATION_LABELS[situationOf(details)] }}
          </span>
        </div>
      </div>
      <dl class="details__grid">
        <div v-for="item in detailRows" :key="item.label">
          <dt>{{ item.label }}</dt>
          <dd>{{ item.value }}</dd>
        </div>
      </dl>
      <p v-if="isSelf(details)" class="details__note">
        Esta é a sua conta. Para mudar o seu perfil ou situação, peça a outro administrador.
      </p>
    </div>
  </dialog>

  <ConfirmDialog
    :open="!!pending"
    :title="pendingInfo?.title ?? ''"
    :confirm-label="pendingInfo?.confirmLabel"
    :danger="pendingInfo?.danger"
    @confirm="confirmPending"
    @close="pending = null"
  >
    {{ pending && pendingInfo?.text(pending.user.name) }}
  </ConfirmDialog>
</template>

<style scoped>
.header {
  margin-bottom: 20px;
}

.feedback {
  max-width: 1140px;
  margin-bottom: 16px;
  padding: 12px 16px;
  border-radius: 10px;
  font-size: 0.875rem;
}

.feedback--ok {
  border: 1px solid #bfe3cd;
  background: #ecf8f1;
  color: #17643a;
}

.feedback--error {
  border: 1px solid #f1c4c4;
  background: #fdf0f0;
  color: #a32b2a;
}

.panel {
  max-width: 1140px;
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  padding: 16px 20px;
}

.search {
  position: relative;
  flex: 1 1 260px;
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

.search input,
.select {
  width: 100%;
  height: 40px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: #fff;
  color: var(--text);
  font-size: 0.875rem;
}

.search input {
  padding: 0 12px 0 38px;
}

.select {
  padding: 0 32px 0 12px;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%230b2269' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
  background-position: right 10px center;
  background-repeat: no-repeat;
  background-size: 14px;
  cursor: pointer;
}

.search input:focus,
.select:focus {
  outline: none;
  border-color: var(--navy-700);
  box-shadow: 0 0 0 3px rgba(20, 47, 128, 0.15);
}

.table-head,
.row {
  display: grid;
  grid-template-columns: minmax(0, 2.4fr) 1.3fr 1.2fr 1fr 48px;
  gap: 16px;
  align-items: center;
  padding: 0 20px;
}

.table-head {
  height: 40px;
  border-block: 1px solid var(--card-border);
  background: #f8f9fc;
  color: var(--text-muted);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.rows {
  margin: 0;
  padding: 0;
  list-style: none;
}

.row {
  min-height: 64px;
  padding-block: 10px;
  font-size: 0.875rem;
}

.row + .row {
  border-top: 1px solid var(--card-border);
}

.row--muted .row__who,
.row--muted .row__dept {
  opacity: 0.7;
}

.row__user {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.row__who {
  display: grid;
  min-width: 0;
}

.row__who strong {
  overflow: hidden;
  color: var(--navy-800);
  font-size: 0.9375rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row__who > span {
  overflow: hidden;
  color: var(--text-muted);
  font-size: 0.8125rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row__you {
  margin-left: 4px;
  padding: 1px 6px;
  border-radius: 4px;
  background: #eef1f6;
  color: var(--text-muted);
  font-size: 0.6875rem;
  font-weight: 700;
}

.row__dept {
  color: var(--text);
}

.avatar {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  color: var(--navy-900);
  font-size: 0.75rem;
  font-weight: 800;
}

.avatar--usuario {
  background: var(--blue-500);
}

.avatar--admin {
  background: var(--orange-500);
}

.avatar--anon {
  background: #eef1f6;
  color: var(--text-muted);
}

.avatar--large {
  width: 56px;
  height: 56px;
  font-size: 1rem;
}

.badge {
  display: inline-block;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 700;
  white-space: nowrap;
}

.role--admin {
  background: #e3e8f6;
  color: var(--navy-800);
}

.role--usuario {
  background: #eef0f4;
  color: #4d5566;
}

.situation--ativo {
  background: #e3f5ea;
  color: #17643a;
}

.situation--inativo {
  background: #fdf1d6;
  color: #8a5a00;
}

.situation--anonimizado {
  background: #eef0f4;
  color: #5b6478;
}

/* Menu ⋮ */
.actions {
  position: relative;
  justify-self: end;
}

.actions__toggle {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  padding: 0;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--navy-800);
  cursor: pointer;
}

.actions__toggle:hover,
.actions__toggle[aria-expanded='true'] {
  background: #eef1f6;
}

.actions__toggle:focus-visible {
  outline: 2px solid var(--navy-700);
  outline-offset: 1px;
}

.actions__toggle svg {
  width: 20px;
  height: 20px;
  fill: currentColor;
}

.menu {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: 10;
  display: grid;
  min-width: 270px;
  padding: 6px;
  border: 1px solid var(--card-border);
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 16px 40px rgba(11, 34, 105, 0.16);
}

.menu button {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 10px 12px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--navy-800);
  font-size: 0.875rem;
  font-weight: 500;
  text-align: left;
  cursor: pointer;
}

.menu button:hover:not(:disabled),
.menu button:focus-visible {
  outline: none;
  background: #f1f4f9;
}

.menu button:disabled {
  color: var(--text-soft);
  cursor: not-allowed;
}

.menu button small {
  margin-left: auto;
  font-size: 0.6875rem;
  white-space: nowrap;
}

.menu svg {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.menu .menu__danger {
  color: #b23a22;
}

.menu hr {
  margin: 4px 6px;
  border: 0;
  border-top: 1px solid var(--card-border);
}

.empty {
  padding: 32px 20px;
  color: var(--text-muted);
  font-size: 0.9375rem;
  text-align: center;
}

.footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 20px;
  border-top: 1px solid var(--card-border);
  color: var(--text-muted);
  font-size: 0.875rem;
}

.pager {
  display: flex;
  gap: 8px;
}

.btn--small {
  height: 36px;
  padding: 0 14px;
  font-size: 0.8125rem;
}

.pager .btn:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

/* Detalhes */
.details {
  width: min(480px, calc(100vw - 32px));
  padding: 0;
  border: 0;
  border-radius: 16px;
  color: var(--text);
  box-shadow: 0 24px 60px rgba(7, 26, 87, 0.25);
}

.details::backdrop {
  background: rgba(7, 26, 87, 0.45);
}

.details__body {
  position: relative;
  padding: 28px;
}

.details__close {
  position: absolute;
  top: 16px;
  right: 16px;
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  padding: 0;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
}

.details__close:hover {
  background: #f0f2f7;
}

.details__close svg {
  width: 18px;
  height: 18px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
}

.details__top {
  display: flex;
  align-items: center;
  gap: 16px;
}

.details__name {
  margin-bottom: 6px;
  font-size: 1.25rem;
  font-weight: 800;
  color: var(--navy-800);
}

.details__grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px 20px;
  margin: 24px 0 0;
  padding-top: 20px;
  border-top: 1px solid var(--card-border);
}

.details__grid dt {
  color: var(--text-muted);
  font-size: 0.75rem;
  font-weight: 600;
}

.details__grid dd {
  margin: 3px 0 0;
  overflow-wrap: anywhere;
  color: var(--navy-800);
  font-size: 0.875rem;
  font-weight: 600;
}

.details__note {
  margin-top: 20px;
  padding: 10px 12px;
  border-radius: 8px;
  background: #f4f6fa;
  color: var(--text-muted);
  font-size: 0.8125rem;
}

@media (max-width: 900px) {
  .table-head {
    display: none;
  }

  .row {
    grid-template-columns: 1fr auto auto;
    gap: 8px 10px;
    padding: 14px 16px;
  }

  .row__user {
    grid-column: 1 / 3;
  }

  .actions {
    grid-column: 3;
    grid-row: 1;
  }

  .row__dept {
    grid-column: 1 / -1;
  }
}

@media (max-width: 480px) {
  .details__grid {
    grid-template-columns: 1fr;
  }
}
</style>
