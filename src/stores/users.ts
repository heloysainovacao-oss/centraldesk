import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
  USERS_KEY,
  isStaffRole,
  readStoredUsers,
  toPublicUser,
  writeStoredUsers,
  type StoredUser,
  type User,
  type UserRole,
} from './auth'

// Gestão das contas (tela "Usuários", só para administradores).
// Usa a mesma lista de contas do login.

export type UserActionResult =
  | 'ok'
  | 'not-found'
  /** Ninguém altera a própria conta por aqui. */
  | 'self'
  /** O sistema precisa manter pelo menos um administrador ativo. */
  | 'last-admin'
  /** Só contas desativadas podem ser anonimizadas. */
  | 'still-active'
  /** Contas anonimizadas não podem mais ser alteradas. */
  | 'anonymized'

export const ACTION_ERRORS: Record<Exclude<UserActionResult, 'ok'>, string> = {
  'not-found': 'Essa conta não existe mais.',
  self: 'Você não pode alterar a sua própria conta.',
  'last-admin': 'O sistema precisa de pelo menos um administrador ativo.',
  'still-active': 'Desative a conta antes de anonimizar os dados.',
  anonymized: 'Esta conta foi anonimizada e não pode mais ser alterada.',
}

export const ANONYMOUS_NAME = 'Usuário anonimizado'

export const useUsersStore = defineStore('users', () => {
  const stored = ref<StoredUser[]>(readStoredUsers())

  // Mudanças feitas em outra aba aparecem aqui também.
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', (event) => {
      if (event.key === USERS_KEY) stored.value = readStoredUsers()
    })
  }

  const users = computed<User[]>(() =>
    stored.value.map(toPublicUser).sort((a, b) => {
      // Contas anonimizadas vão para o fim da lista.
      if (!!a.anonymizedAt !== !!b.anonymizedAt) return a.anonymizedAt ? 1 : -1
      return a.name.localeCompare(b.name, 'pt-BR')
    }),
  )

  /** Quem pode receber chamados: administradores ativos. */
  const activeAnalysts = computed(() => users.value.filter((u) => isStaffRole(u.role) && u.active))

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

  /** Validações comuns: a conta existe, não é a própria e não foi anonimizada. */
  function check(
    email: string,
    actingEmail: string,
  ):
    { error: 'not-found' | 'self' | 'anonymized' } | { current: StoredUser[]; target: StoredUser } {
    const current = readStoredUsers()
    const target = current.find((u) => u.email === email)
    if (!target) return { error: 'not-found' }
    if (email === actingEmail) return { error: 'self' }
    if (target.anonymizedAt) return { error: 'anonymized' }
    return { current, target }
  }

  /** Remover este administrador deixaria o sistema sem nenhum administrador ativo? */
  function isLastActiveAdmin(current: StoredUser[], target: StoredUser) {
    if (!isStaffRole(target.role) || target.active === false) return false
    return !current.some(
      (u) => u.email !== target.email && isStaffRole(u.role) && u.active !== false,
    )
  }

  function update(current: StoredUser[], email: string, changes: Partial<StoredUser>) {
    save(current.map((u) => (u.email === email ? { ...u, ...changes } : u)))
  }

  /**
   * Muda o perfil: usuário, coordenação ou administrador. Registra qual administrador fez a
   * mudança e quando, para a administração saber quem deu cada acesso.
   */
  function setRole(email: string, role: UserRole, actingEmail: string): UserActionResult {
    const result = check(email, actingEmail)
    if ('error' in result) return result.error
    if (role !== 'admin' && isLastActiveAdmin(result.current, result.target)) return 'last-admin'
    const actor = result.current.find((u) => u.email === actingEmail)
    update(result.current, email, {
      role,
      roleChangedAt: new Date().toISOString(),
      roleChangedByName: actor?.name ?? actingEmail,
      roleChangedByEmail: actingEmail,
    })
    return 'ok'
  }

  /** Ativa ou desativa uma conta. Contas inativas não conseguem entrar. */
  function setActive(email: string, active: boolean, actingEmail: string): UserActionResult {
    const result = check(email, actingEmail)
    if ('error' in result) return result.error
    if (!active && isLastActiveAdmin(result.current, result.target)) return 'last-admin'
    update(result.current, email, { active })
    return 'ok'
  }

  /**
   * Remove os dados pessoais de uma conta desativada (nome, e-mail, CPF), mantendo o
   * histórico de chamados. Devolve o e-mail substituto, para atualizar os chamados.
   */
  function anonymize(
    email: string,
    actingEmail: string,
  ): { result: UserActionResult; newEmail?: string } {
    const checked = check(email, actingEmail)
    if ('error' in checked) return { result: checked.error }
    if (toPublicUser(checked.target).active) return { result: 'still-active' }

    const newEmail = `anonimizado-${crypto.randomUUID().slice(0, 8)}@removido.invalid`
    update(checked.current, email, {
      name: ANONYMOUS_NAME,
      email: newEmail,
      cpf: '',
      role: 'usuario',
      active: false,
      anonymizedAt: new Date().toISOString(),
      passwordHash: '',
    })
    return { result: 'ok', newEmail }
  }

  /** Exclui a conta de vez. Os chamados que a pessoa abriu continuam no histórico. */
  function remove(email: string, actingEmail: string): UserActionResult {
    const result = check(email, actingEmail)
    if ('error' in result && result.error !== 'anonymized') return result.error
    const current = readStoredUsers()
    const target = current.find((u) => u.email === email)!
    if (isLastActiveAdmin(current, target)) return 'last-admin'
    save(current.filter((u) => u.email !== email))
    return 'ok'
  }

  return { users, activeAnalysts, reload, userByEmail, setRole, setActive, anonymize, remove }
})
