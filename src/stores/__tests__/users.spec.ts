import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { writeStoredUsers, type StoredUser } from '../auth'
import { useUsersStore } from '../users'

const account = (name: string, email: string, role: StoredUser['role']): StoredUser => ({
  name,
  email,
  cpf: '',
  department: 'Inovação',
  role,
  active: true,
  passwordHash: 'x',
})

describe('users store', () => {
  beforeEach(() => {
    localStorage.clear()
    writeStoredUsers([
      account('Bruno', 'bruno@contabilizape.com.br', 'usuario'),
      account('Ana', 'ana@contabilizape.com.br', 'analista'),
    ])
    setActivePinia(createPinia())
  })

  it('lists users by name without exposing passwords', () => {
    const store = useUsersStore()
    expect(store.users.map((u) => u.name)).toEqual(['Ana', 'Bruno'])
    expect(store.users[0]).not.toHaveProperty('passwordHash')
    expect(store.activeAnalysts.map((u) => u.name)).toEqual(['Ana'])
  })

  it('deactivates and reactivates accounts', () => {
    const store = useUsersStore()
    expect(store.setActive('bruno@contabilizape.com.br', false, 'ana@contabilizape.com.br')).toBe(
      'ok',
    )
    expect(store.userByEmail('bruno@contabilizape.com.br')?.active).toBe(false)

    store.setActive('bruno@contabilizape.com.br', true, 'ana@contabilizape.com.br')
    expect(store.userByEmail('bruno@contabilizape.com.br')?.active).toBe(true)
  })

  it('deletes accounts', () => {
    const store = useUsersStore()
    expect(store.remove('bruno@contabilizape.com.br', 'ana@contabilizape.com.br')).toBe('ok')
    expect(store.users).toHaveLength(1)

    setActivePinia(createPinia())
    expect(useUsersStore().users).toHaveLength(1)
  })

  it('does not let someone deactivate or delete their own account', () => {
    const store = useUsersStore()
    const me = 'ana@contabilizape.com.br'
    expect(store.setActive(me, false, me)).toBe('self')
    expect(store.remove(me, me)).toBe('self')
    expect(store.userByEmail(me)?.active).toBe(true)
  })
})
