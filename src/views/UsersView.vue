<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import { ROLE_LABELS, useAuthStore, type User } from '@/stores/auth'
import { useTicketsStore } from '@/stores/tickets'
import { useUsersStore } from '@/stores/users'
import { formatCpf } from '@/utils/cpf'
import { formatDate } from '@/utils/format'
import { initials } from '@/utils/user'

const auth = useAuthStore()
const usersStore = useUsersStore()
const tickets = useTicketsStore()

usersStore.reload()

// --- Lista, busca e filtros ---

const search = ref('')
const statusFilter = ref<'todos' | 'ativos' | 'inativos'>('todos')

const filters = computed(() => [
  { id: 'todos' as const, label: 'Todos', count: usersStore.users.length },
  {
    id: 'ativos' as const,
    label: 'Ativos',
    count: usersStore.users.filter((u) => u.active).length,
  },
  {
    id: 'inativos' as const,
    label: 'Inativos',
    count: usersStore.users.filter((u) => !u.active).length,
  },
])

const visible = computed(() => {
  const term = search.value.trim().toLowerCase()
  return usersStore.users.filter((u) => {
    if (statusFilter.value === 'ativos' && !u.active) return false
    if (statusFilter.value === 'inativos' && u.active) return false
    return !term || u.name.toLowerCase().includes(term) || u.email.includes(term)
  })
})

function isSelf(user: User) {
  return user.email === auth.currentUser?.email
}

// --- Perfil (janela lateral) ---

const profileEl = ref<HTMLDialogElement | null>(null)
const selectedEmail = ref<string | null>(null)
const selected = computed(() =>
  selectedEmail.value ? usersStore.userByEmail(selectedEmail.value) : undefined,
)

function openProfile(user: User) {
  selectedEmail.value = user.email
  profileEl.value?.showModal()
}

function closeProfile() {
  profileEl.value?.close()
}

const profileDetails = computed(() => {
  const user = selected.value
  if (!user) return []
  return [
    { label: 'E-mail', value: user.email },
    { label: 'CPF', value: user.cpf ? formatCpf(user.cpf) : '—' },
    { label: 'Departamento', value: user.department || '—' },
    { label: 'Perfil', value: ROLE_LABELS[user.role] },
    { label: 'Cadastro', value: user.createdAt ? formatDate(user.createdAt) : '—' },
    { label: 'Chamados abertos', value: String(tickets.ticketsBy(user.email).length) },
  ]
})

// --- Ações ---

const feedback = ref('')
let feedbackTimer: ReturnType<typeof setTimeout> | undefined

function notify(message: string) {
  feedback.value = message
  clearTimeout(feedbackTimer)
  feedbackTimer = setTimeout(() => (feedback.value = ''), 4000)
}

function toggleActive(user: User) {
  if (!auth.currentUser) return
  const result = usersStore.setActive(user.email, !user.active, auth.currentUser.email)
  if (result === 'ok') notify(`${user.name} foi ${user.active ? 'desativado(a)' : 'ativado(a)'}.`)
}

const deleteOpen = ref(false)

function confirmDelete() {
  const user = selected.value
  deleteOpen.value = false
  if (!user || !auth.currentUser) return
  if (usersStore.remove(user.email, auth.currentUser.email) === 'ok') {
    closeProfile()
    notify(`A conta de ${user.name} foi excluída.`)
  }
}

// Se a conta selecionada sumir (excluída em outra aba), fecha o perfil.
watch(selected, (user) => {
  if (!user && profileEl.value?.open) closeProfile()
})
</script>

<template>
  <header class="header">
    <h1 class="page-title">Usuários</h1>
    <p class="page-subtitle">
      Pessoas com acesso ao CentralDesk. Contas inativas não conseguem entrar no sistema.
    </p>
  </header>

  <div class="toolbar">
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
    <label class="search">
      <span class="sr-only">Buscar usuário</span>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="11" cy="11" r="6.5" />
        <path d="m20 20-4.2-4.2" />
      </svg>
      <input v-model="search" type="search" placeholder="Buscar por nome ou e-mail" />
    </label>
  </div>

  <p v-if="feedback" class="feedback" role="status">{{ feedback }}</p>

  <section class="card list" aria-label="Lista de usuários">
    <div class="list__head" aria-hidden="true">
      <span>Usuário</span>
      <span>Departamento</span>
      <span>Perfil</span>
      <span>Cadastro</span>
      <span>Status</span>
      <span />
    </div>
    <ul>
      <li
        v-for="user in visible"
        :key="user.email"
        class="row"
        :class="{ 'row--inactive': !user.active }"
      >
        <span class="row__user">
          <span class="avatar" :class="`avatar--${user.role}`" aria-hidden="true">
            {{ initials(user.name) }}
          </span>
          <span class="row__who">
            <strong>
              {{ user.name }}
              <small v-if="isSelf(user)" class="row__you">você</small>
            </strong>
            <span>{{ user.email }}</span>
          </span>
        </span>
        <span class="row__muted">{{ user.department || '—' }}</span>
        <span>
          <span class="role" :class="`role--${user.role}`">{{ ROLE_LABELS[user.role] }}</span>
        </span>
        <span class="row__muted">{{ user.createdAt ? formatDate(user.createdAt) : '—' }}</span>
        <span>
          <span class="status" :class="user.active ? 'status--on' : 'status--off'">
            {{ user.active ? 'Ativo' : 'Inativo' }}
          </span>
        </span>
        <span class="row__actions">
          <button type="button" class="btn btn--secondary btn--small" @click="openProfile(user)">
            Ver perfil
          </button>
        </span>
      </li>
    </ul>
    <p v-if="!visible.length" class="list__empty">Nenhum usuário encontrado.</p>
  </section>

  <!-- Perfil do usuário -->
  <dialog
    ref="profileEl"
    class="profile"
    aria-labelledby="profile-title"
    @close="selectedEmail = null"
  >
    <div v-if="selected" class="profile__body">
      <button type="button" class="profile__close" title="Fechar" @click="closeProfile">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
        <span class="sr-only">Fechar</span>
      </button>

      <div class="profile__top">
        <span class="avatar avatar--large" :class="`avatar--${selected.role}`" aria-hidden="true">
          {{ initials(selected.name) }}
        </span>
        <div>
          <h2 id="profile-title" class="profile__name">{{ selected.name }}</h2>
          <span class="status" :class="selected.active ? 'status--on' : 'status--off'">
            {{ selected.active ? 'Ativo' : 'Inativo' }}
          </span>
        </div>
      </div>

      <dl class="profile__details">
        <div v-for="item in profileDetails" :key="item.label">
          <dt>{{ item.label }}</dt>
          <dd>{{ item.value }}</dd>
        </div>
      </dl>

      <p v-if="isSelf(selected)" class="profile__note">
        Esta é a sua conta. Você não pode desativar nem excluir a própria conta.
      </p>

      <div class="profile__actions">
        <button
          type="button"
          class="btn btn--danger-outline"
          :disabled="isSelf(selected)"
          @click="deleteOpen = true"
        >
          Excluir conta
        </button>
        <button
          type="button"
          class="btn"
          :class="selected.active ? 'btn--secondary' : 'btn--primary'"
          :disabled="isSelf(selected)"
          @click="toggleActive(selected)"
        >
          {{ selected.active ? 'Desativar conta' : 'Ativar conta' }}
        </button>
      </div>
    </div>
  </dialog>

  <ConfirmDialog
    :open="deleteOpen"
    title="Excluir conta?"
    confirm-label="Excluir conta"
    danger
    @confirm="confirmDelete"
    @close="deleteOpen = false"
  >
    A conta de <strong>{{ selected?.name }}</strong> será excluída e a pessoa não poderá mais
    entrar. Os chamados que ela abriu continuam no histórico. Esta ação não pode ser desfeita.
  </ConfirmDialog>
</template>

<style scoped>
.header {
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

.search {
  position: relative;
  flex: 0 1 300px;
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
  background: #fff;
  color: var(--text);
  font-size: 0.875rem;
}

.search input:focus {
  outline: none;
  border-color: var(--navy-700);
  box-shadow: 0 0 0 3px rgba(20, 47, 128, 0.15);
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

.list {
  max-width: 1140px;
  overflow: hidden;
}

.list ul {
  margin: 0;
  padding: 0;
  list-style: none;
}

.list__head,
.row {
  display: grid;
  grid-template-columns: minmax(0, 2.4fr) 1.1fr 1.2fr 0.9fr 0.8fr auto;
  gap: 16px;
  align-items: center;
  padding: 0 24px;
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
  padding-block: 12px;
  font-size: 0.875rem;
}

.row + .row {
  border-top: 1px solid var(--card-border);
}

.row--inactive .row__user {
  opacity: 0.55;
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

.row__muted {
  color: var(--text-muted);
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

.avatar--analista {
  background: var(--orange-500);
}

.avatar--large {
  width: 56px;
  height: 56px;
  font-size: 1rem;
}

.role,
.status {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 700;
  white-space: nowrap;
}

.role--usuario {
  background: #e3f2fc;
  color: #0f6aa3;
}

.role--analista {
  background: #fde9e4;
  color: #a83a22;
}

.status--on {
  background: #e3f5ea;
  color: #17643a;
}

.status--off {
  background: #eef0f4;
  color: #5b6478;
}

.btn--small {
  height: 34px;
  padding: 0 14px;
  font-size: 0.8125rem;
}

.list__empty {
  padding: 32px 24px;
  color: var(--text-muted);
  font-size: 0.9375rem;
  text-align: center;
}

/* Perfil */
.profile {
  width: min(480px, calc(100vw - 32px));
  padding: 0;
  border: 0;
  border-radius: 16px;
  color: var(--text);
  box-shadow: 0 24px 60px rgba(7, 26, 87, 0.25);
}

.profile::backdrop {
  background: rgba(7, 26, 87, 0.45);
}

.profile__body {
  position: relative;
  padding: 28px;
}

.profile__close {
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

.profile__close:hover {
  background: #f0f2f7;
}

.profile__close svg {
  width: 18px;
  height: 18px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
}

.profile__top {
  display: flex;
  align-items: center;
  gap: 16px;
}

.profile__name {
  margin-bottom: 6px;
  font-size: 1.25rem;
  font-weight: 800;
  color: var(--navy-800);
}

.profile__details {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px 20px;
  margin: 24px 0 0;
  padding-top: 20px;
  border-top: 1px solid var(--card-border);
}

.profile__details dt {
  color: var(--text-muted);
  font-size: 0.75rem;
  font-weight: 600;
}

.profile__details dd {
  margin: 3px 0 0;
  overflow-wrap: anywhere;
  color: var(--navy-800);
  font-size: 0.875rem;
  font-weight: 600;
}

.profile__note {
  margin-top: 20px;
  padding: 10px 12px;
  border-radius: 8px;
  background: #f4f6fa;
  color: var(--text-muted);
  font-size: 0.8125rem;
}

.profile__actions {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  margin-top: 24px;
}

.profile__actions .btn:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.btn--danger-outline {
  border: 1px solid #f1c4c4;
  background: #fff;
  color: var(--error);
}

.btn--danger-outline:hover:not(:disabled) {
  background: #fdf0f0;
}

@media (max-width: 900px) {
  .list__head {
    display: none;
  }

  .row {
    grid-template-columns: 1fr auto;
    gap: 8px 12px;
    padding: 16px;
  }

  .row__user {
    grid-column: 1 / -1;
  }

  .row__actions {
    grid-column: 1 / -1;
  }
}

@media (max-width: 480px) {
  .profile__details {
    grid-template-columns: 1fr;
  }

  .profile__actions {
    flex-direction: column-reverse;
  }
}
</style>
