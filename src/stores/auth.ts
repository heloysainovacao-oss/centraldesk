import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { onlyDigits } from '@/utils/cpf'

// Autenticação provisória, só no navegador (localStorage).
// Serve para desenvolver as telas; deve ser trocada por uma API real antes de ir para produção.

export const CORPORATE_DOMAIN = 'contabilizape.com.br'

export interface User {
  name: string
  email: string
  cpf: string
  department: string
}

export interface RegisterData extends User {
  password: string
}

export type RegisterResult = 'ok' | 'email-taken' | 'cpf-taken'

interface StoredUser extends User {
  passwordHash: string
}

const USERS_KEY = 'centraldesk:users'
const SESSION_KEY = 'centraldesk:session'

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

async function hashPassword(password: string): Promise<string> {
  const data = new TextEncoder().encode(password)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export const useAuthStore = defineStore('auth', () => {
  const currentUser = ref<User | null>(readJson<User | null>(SESSION_KEY, null))
  const isAuthenticated = computed(() => currentUser.value !== null)

  function setSession(user: User | null) {
    currentUser.value = user
    if (user) localStorage.setItem(SESSION_KEY, JSON.stringify(user))
    else localStorage.removeItem(SESSION_KEY)
  }

  async function register(data: RegisterData): Promise<RegisterResult> {
    const users = readJson<StoredUser[]>(USERS_KEY, [])
    const email = normalizeEmail(data.email)
    const cpf = onlyDigits(data.cpf)
    if (users.some((u) => u.email === email)) return 'email-taken'
    if (users.some((u) => u.cpf === cpf)) return 'cpf-taken'

    const user: User = { name: data.name.trim(), email, cpf, department: data.department }
    const stored: StoredUser = { ...user, passwordHash: await hashPassword(data.password) }
    localStorage.setItem(USERS_KEY, JSON.stringify([...users, stored]))
    setSession(user)
    return 'ok'
  }

  async function login(email: string, password: string): Promise<boolean> {
    const users = readJson<StoredUser[]>(USERS_KEY, [])
    const user = users.find((u) => u.email === normalizeEmail(email))
    if (!user || user.passwordHash !== (await hashPassword(password))) return false

    const { passwordHash: _, ...publicUser } = user
    setSession(publicUser)
    return true
  }

  function logout() {
    setSession(null)
  }

  return { currentUser, isAuthenticated, register, login, logout }
})
