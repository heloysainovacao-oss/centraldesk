import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { readStoredUsers, useAuthStore, writeStoredUsers, type RegisterData } from '../auth'

const maria: RegisterData = {
  name: 'Maria Silva',
  cpf: '529.982.247-25',
  department: 'Inovação',
  email: 'Maria@ContabilizaPE.com.br',
  password: 'senha-forte',
}

describe('auth store', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    setActivePinia(createPinia())
  })

  it('registers a user and starts a session', async () => {
    const auth = useAuthStore()
    expect(await auth.register(maria)).toBe('ok')
    expect(auth.currentUser).toMatchObject({
      name: 'Maria Silva',
      cpf: '52998224725',
      department: 'Inovação',
      email: 'maria@contabilizape.com.br',
      role: 'usuario',
      active: true,
    })
    expect(auth.currentUser?.createdAt).toBeTruthy()
    expect(auth.isAnalyst).toBe(false)
  })

  it('rejects a duplicate e-mail or CPF', async () => {
    const auth = useAuthStore()
    await auth.register(maria)
    expect(await auth.register({ ...maria, cpf: '111.444.777-35' })).toBe('email-taken')
    expect(await auth.register({ ...maria, email: 'outra@contabilizape.com.br' })).toBe('cpf-taken')
  })

  it('logs in only with the right password', async () => {
    const auth = useAuthStore()
    await auth.register(maria)
    auth.logout()

    expect(await auth.login('maria@contabilizape.com.br', 'errada')).toBe('invalid')
    expect(auth.isAuthenticated).toBe(false)
    expect(await auth.login(' MARIA@contabilizape.com.br ', 'senha-forte')).toBe('ok')
    expect(auth.currentUser).not.toHaveProperty('passwordHash')
  })

  it('blocks inactive accounts and ends their session', async () => {
    const auth = useAuthStore()
    await auth.register(maria)
    expect(auth.refreshSession()).toBe(true)

    const users = readStoredUsers().map((u) => ({ ...u, active: false }))
    writeStoredUsers(users)

    expect(auth.refreshSession()).toBe(false)
    expect(auth.isAuthenticated).toBe(false)
    expect(await auth.login('maria@contabilizape.com.br', 'senha-forte')).toBe('inactive')
  })
})
