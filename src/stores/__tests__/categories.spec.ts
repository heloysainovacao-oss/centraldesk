import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { FALLBACK_COLOR, normalizeHex, useCategoriesStore } from '../categories'

describe('categories store', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('starts with the default categories, all active', () => {
    const store = useCategoriesStore()
    expect(store.categories.map((c) => c.name)).toContain('Hardware')
    expect(store.active).toHaveLength(store.categories.length)
  })

  it('creates a category and keeps it after reload', () => {
    const store = useCategoriesStore()
    expect(store.create('  Telefonia ', '0891b2')).toBe('ok')

    setActivePinia(createPinia())
    const reloaded = useCategoriesStore()
    expect(reloaded.colorOf('Telefonia')).toBe('#0891B2')
    expect(reloaded.active.map((c) => c.name)).toContain('Telefonia')
  })

  it('rejects empty names, duplicates and invalid colors', () => {
    const store = useCategoriesStore()
    expect(store.create('   ', '#0891B2')).toBe('empty-name')
    expect(store.create('hardware', '#0891B2')).toBe('duplicate')
    expect(store.create('Telefonia', '#12')).toBe('invalid-color')
  })

  it('renames and recolors, returning the previous name', () => {
    const store = useCategoriesStore()
    const hardware = store.categories.find((c) => c.name === 'Hardware')!
    const { result, previousName } = store.update(hardware.id, 'Equipamentos', '#16A34A')
    expect(result).toBe('ok')
    expect(previousName).toBe('Hardware')
    expect(store.colorOf('Equipamentos')).toBe('#16A34A')
  })

  it('deactivates categories without losing them', () => {
    const store = useCategoriesStore()
    const hardware = store.categories.find((c) => c.name === 'Hardware')!
    store.setActive(hardware.id, false)
    expect(store.active.map((c) => c.name)).not.toContain('Hardware')
    expect(store.colorOf('Hardware')).not.toBe(FALLBACK_COLOR)
  })

  it('uses a neutral color for unknown categories', () => {
    expect(useCategoriesStore().colorOf('Não existe')).toBe(FALLBACK_COLOR)
  })

  it('normalizes hex codes', () => {
    expect(normalizeHex('0891b2')).toBe('#0891B2')
    expect(normalizeHex(' #ea580c ')).toBe('#EA580C')
  })
})
