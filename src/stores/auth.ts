import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { onlyDigits } from '@/utils/cpf'

// Autenticação provisória, só no navegador (contas em localStorage).
// Serve para desenvolver as telas; deve ser trocada por uma API real antes de ir para produção.

export const CORPORATE_DOMAIN = 'contabilizape.com.br'

export type UserRole = 'usuario' | 'analista'

export const ROLE_LABELS: Record<UserRole, string> = {
  usuario: 'Usuário',
  analista: 'Analista de suporte',
}

export interface User {
  name: string
  email: string
  cpf: string
  department: string
  role: UserRole
  /** Contas inativas não conseguem entrar no sistema. */
  active: boolean
  createdAt?: string
}

export type RegisterData = Omit<User, 'role' | 'active' | 'createdAt'> & { password: string }

export type RegisterResult = 'ok' | 'email-taken' | 'cpf-taken'
export type LoginResult = 'ok' | 'invalid' | 'inactive'

export interface StoredUser extends User {
  passwordHash: string
}

export const USERS_KEY = 'centraldesk:users'
const SESSION_KEY = 'centraldesk:session'

// A sessão fica no sessionStorage: cada aba tem o próprio login. Assim dá para testar o chat
// com o usuário numa aba e o analista em outra.
const sessionStore = () => sessionStorage

function readJson<T>(key: string, fallback: T, storage: Storage = localStorage): T {
  try {
    const raw = storage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

export function readStoredUsers(): StoredUser[] {
  return readJson<StoredUser[]>(USERS_KEY, [])
}

export function writeStoredUsers(users: StoredUser[]) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users))
}

export async function hashPassword(password: string): Promise<string> {
  const data = new TextEncoder().encode(password)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

/** Contas antigas (antes de perfis e status existirem) viram usuários comuns e ativos. */
export function toPublicUser({ passwordHash: _, ...user }: StoredUser): User {
  return { ...user, role: user.role ?? 'usuario', active: user.active ?? true }
}

export const useAuthStore = defineStore('auth', () => {
  const currentUser = ref<User | null>(readJson<User | null>(SESSION_KEY, null, sessionStore()))
  const isAuthenticated = computed(() => currentUser.value !== null)
  const isAnalyst = computed(() => currentUser.value?.role === 'analista')

  function setSession(user: User | null) {
    currentUser.value = user
    if (user) sessionStore().setItem(SESSION_KEY, JSON.stringify(user))
    else sessionStore().removeItem(SESSION_KEY)
  }

  async function register(data: RegisterData): Promise<RegisterResult> {
    const users = readStoredUsers()
    const email = normalizeEmail(data.email)
    const cpf = onlyDigits(data.cpf)
    if (users.some((u) => u.email === email)) return 'email-taken'
    if (users.some((u) => u.cpf === cpf)) return 'cpf-taken'

    const user: User = {
      name: data.name.trim(),
      email,
      cpf,
      department: data.department,
      role: 'usuario',
      active: true,
      createdAt: new Date().toISOString(),
    }
    writeStoredUsers([...users, { ...user, passwordHash: await hashPassword(data.password) }])
    setSession(user)
    return 'ok'
  }

  async function login(email: string, password: string): Promise<LoginResult> {
    const stored = readStoredUsers().find((u) => u.email === normalizeEmail(email))
    if (!stored || stored.passwordHash !== (await hashPassword(password))) return 'invalid'

    const user = toPublicUser(stored)
    if (!user.active) return 'inactive'
    setSession(user)
    return 'ok'
  }

  /**
   * Confere se a conta logada ainda existe e está ativa (um analista pode ter desativado ou
   * excluído a conta). Se não, encerra a sessão. Também atualiza dados que mudaram.
   */
  function refreshSession(): boolean {
    if (!currentUser.value) return false
    const stored = readStoredUsers().find((u) => u.email === currentUser.value?.email)
    const user = stored && toPublicUser(stored)
    if (!user || !user.active) {
      setSession(null)
      return false
    }
    setSession(user)
    return true
  }

  function logout() {
    setSession(null)
  }

  return { currentUser, isAuthenticated, isAnalyst, register, login, refreshSession, logout }
})
