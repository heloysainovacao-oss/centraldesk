import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
  USERS_KEY,
  readStoredUsers,
  toPublicUser,
  writeStoredUsers,
  type StoredUser,
  type User,
} from './auth'

// Gestão das contas (tela "Usuários"). Usa a mesma lista de contas do login.

export type UserActionResult = 'ok' | 'not-found' | 'self'

export const useUsersStore = defineStore('users', () => {
  const stored = ref<StoredUser[]>(readStoredUsers())

  // Mudanças feitas em outra aba aparecem aqui também.
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', (event) => {
      if (event.key === USERS_KEY) stored.value = readStoredUsers()
    })
  }

  const users = computed<User[]>(() =>
    stored.value.map(toPublicUser).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
  )

  const activeAnalysts = computed(() =>
    users.value.filter((u) => u.role === 'analista' && u.active),
  )

  function reload() {
    stored.value = readStoredUsers()
  }

  function save(next: StoredUser[]) {
    writeStoredUsers(next)
    stored.value = next
  }

  function userByEmail(email: string): User | undefined {
    return users.value.find((u) => u.email === email)
  }

  /** Ativa ou desativa uma conta. Ninguém pode desativar a própria conta. */
  function setActive(email: string, active: boolean, actingEmail: string): UserActionResult {
    if (email === actingEmail) return 'self'
    const current = readStoredUsers()
    if (!current.some((u) => u.email === email)) return 'not-found'
    save(current.map((u) => (u.email === email ? { ...u, active } : u)))
    return 'ok'
  }

  /**
   * Exclui a conta. Os chamados que a pessoa abriu continuam no histórico, com o nome dela.
   * Ninguém pode excluir a própria conta.
   */
  function remove(email: string, actingEmail: string): UserActionResult {
    if (email === actingEmail) return 'self'
    const current = readStoredUsers()
    if (!current.some((u) => u.email === email)) return 'not-found'
    save(current.filter((u) => u.email !== email))
    return 'ok'
  }

  return { users, activeAnalysts, reload, userByEmail, setActive, remove }
})
