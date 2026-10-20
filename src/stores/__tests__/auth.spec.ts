import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAuthStore, type RegisterData } from '../auth'

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
    setActivePinia(createPinia())
  })

  it('registers a user and starts a session', async () => {
    const auth = useAuthStore()
    expect(await auth.register(maria)).toBe('ok')
    expect(auth.currentUser).toEqual({
      name: 'Maria Silva',
      cpf: '52998224725',
      department: 'Inovação',
      email: 'maria@contabilizape.com.br',
    })
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

    expect(await auth.login('maria@contabilizape.com.br', 'errada')).toBe(false)
    expect(auth.isAuthenticated).toBe(false)
    expect(await auth.login(' MARIA@contabilizape.com.br ', 'senha-forte')).toBe(true)
    expect(auth.currentUser).not.toHaveProperty('passwordHash')
  })
})
