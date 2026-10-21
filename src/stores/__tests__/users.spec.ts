import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { writeStoredUsers, type StoredUser } from '../auth'
import { ANONYMOUS_NAME, useUsersStore } from '../users'

const account = (name: string, role: string, active = true): StoredUser => ({
  name,
  email: `${name.toLowerCase()}@contabilizape.com.br`,
  cpf: '52998224725',
  department: 'Inovação',
  role: role as StoredUser['role'],
  active,
  passwordHash: 'x',
})

const ANA = 'ana@contabilizape.com.br' // administradora que faz as ações
const BRUNO = 'bruno@contabilizape.com.br'
const CARLA = 'carla@contabilizape.com.br'

describe('users store', () => {
  beforeEach(() => {
    localStorage.clear()
    writeStoredUsers([
      account('Bruno', 'usuario'),
      account('Ana', 'admin'),
      account('Carla', 'admin'),
    ])
    setActivePinia(createPinia())
  })

  it('lists users by name without exposing passwords', () => {
    const store = useUsersStore()
    expect(store.users.map((u) => u.name)).toEqual(['Ana', 'Bruno', 'Carla'])
    expect(store.users[0]).not.toHaveProperty('passwordHash')
  })

  it('treats old "analista" accounts as administrators', () => {
    writeStoredUsers([account('Ana', 'admin'), account('Davi', 'analista')])
    setActivePinia(createPinia())
    const store = useUsersStore()
    expect(store.userByEmail('davi@contabilizape.com.br')?.role).toBe('admin')
    expect(store.activeAnalysts.map((u) => u.name)).toEqual(['Ana', 'Davi'])
  })

  it('promotes a user to administrator and back', () => {
    const store = useUsersStore()
    expect(store.setRole(BRUNO, 'admin', ANA)).toBe('ok')
    expect(store.userByEmail(BRUNO)?.role).toBe('admin')
    expect(store.setRole(BRUNO, 'usuario', ANA)).toBe('ok')
    expect(store.userByEmail(BRUNO)?.role).toBe('usuario')
  })

  it('never leaves the system without an active administrator', () => {
    writeStoredUsers([account('Ana', 'admin'), account('Carla', 'admin')])
    setActivePinia(createPinia())
    const store = useUsersStore()

    expect(store.setActive(ANA, false, CARLA)).toBe('ok')
    // Agora a Carla é a única administradora ativa.
    expect(store.setRole(CARLA, 'usuario', ANA)).toBe('last-admin')
    expect(store.setActive(CARLA, false, ANA)).toBe('last-admin')
    expect(store.remove(CARLA, ANA)).toBe('last-admin')
  })

  it('deactivates and reactivates accounts', () => {
    const store = useUsersStore()
    expect(store.setActive(BRUNO, false, ANA)).toBe('ok')
    expect(store.userByEmail(BRUNO)?.active).toBe(false)
    expect(store.setActive(BRUNO, true, ANA)).toBe('ok')
    expect(store.userByEmail(BRUNO)?.active).toBe(true)
  })

  it('anonymizes only deactivated accounts, removing personal data', () => {
    const store = useUsersStore()
    expect(store.anonymize(BRUNO, ANA).result).toBe('still-active')

    store.setActive(BRUNO, false, ANA)
    const { result, newEmail } = store.anonymize(BRUNO, ANA)
    expect(result).toBe('ok')

    const anon = store.userByEmail(newEmail!)
    expect(anon).toMatchObject({ name: ANONYMOUS_NAME, cpf: '', active: false })
    expect(anon?.anonymizedAt).toBeTruthy()
    expect(store.userByEmail(BRUNO)).toBeUndefined()
    expect(store.setActive(newEmail!, true, ANA)).toBe('anonymized')
  })

  it('deletes accounts', () => {
    const store = useUsersStore()
    expect(store.remove(BRUNO, ANA)).toBe('ok')
    expect(store.users).toHaveLength(2)

    setActivePinia(createPinia())
    expect(useUsersStore().users).toHaveLength(2)
  })

  it('does not let someone change their own account', () => {
    const store = useUsersStore()
    expect(store.setActive(ANA, false, ANA)).toBe('self')
    expect(store.setRole(ANA, 'usuario', ANA)).toBe('self')
    expect(store.remove(ANA, ANA)).toBe('self')
  })
})
