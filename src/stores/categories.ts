import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { DEFAULT_CATEGORIES } from '@/constants/tickets'

// Categorias dos chamados, gerenciadas pelos administradores na tela "Categorias".
// Salvas só no navegador (localStorage), como o resto dos dados por enquanto.

export interface Category {
  id: string
  name: string
  color: string
  /** Categorias inativas não aparecem ao abrir chamados, mas continuam nos chamados antigos. */
  active: boolean
  createdAt?: string
}

export type CategoryResult = 'ok' | 'empty-name' | 'duplicate' | 'invalid-color' | 'not-found'

export const CATEGORY_ERRORS: Record<Exclude<CategoryResult, 'ok'>, string> = {
  'empty-name': 'Informe o nome da categoria.',
  duplicate: 'Já existe uma categoria com esse nome.',
  'invalid-color': 'Use uma cor no formato #RRGGBB, por exemplo #0891B2.',
  'not-found': 'Essa categoria não existe mais.',
}

export const CATEGORY_NAME_MAX = 60

/** Cores sugeridas na janela de categoria. */
export const CATEGORY_PRESETS = [
  '#2563EB',
  '#0891B2',
  '#0D9488',
  '#16A34A',
  '#CA8A04',
  '#EA580C',
  '#DB2777',
  '#7C3AED',
] as const

/** Cor usada quando o chamado tem uma categoria que não existe mais. */
export const FALLBACK_COLOR = '#8A91A3'

export const CATEGORIES_KEY = 'centraldesk:categories'

export function isValidHex(color: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(color.trim())
}

/** Aceita "0891b2" ou "#0891b2" e devolve "#0891B2". */
export function normalizeHex(color: string): string {
  const value = color.trim().replace(/^#?/, '#')
  return value.toUpperCase()
}

const slug = (name: string) =>
  name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

function defaults(): Category[] {
  return DEFAULT_CATEGORIES.map((c) => ({
    id: slug(c.name),
    name: c.name,
    color: c.color.toUpperCase(),
    active: true,
  }))
}

function load(): Category[] {
  try {
    const raw = localStorage.getItem(CATEGORIES_KEY)
    return raw ? (JSON.parse(raw) as Category[]) : defaults()
  } catch {
    return defaults()
  }
}

export const useCategoriesStore = defineStore('categories', () => {
  const categories = ref<Category[]>(load())

  // Mudanças feitas em outra aba aparecem aqui também.
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', (event) => {
      if (event.key === CATEGORIES_KEY) categories.value = load()
    })
  }

  /** Categorias que podem ser escolhidas ao abrir um chamado. */
  const active = computed(() => categories.value.filter((c) => c.active))

  function save(next: Category[]) {
    categories.value = next
    localStorage.setItem(CATEGORIES_KEY, JSON.stringify(next))
  }

  function byId(id: string) {
    return categories.value.find((c) => c.id === id)
  }

  /** Cor de uma categoria pelo nome (é o nome que fica salvo em cada chamado). */
  function colorOf(name: string): string {
    return categories.value.find((c) => c.name === name)?.color ?? FALLBACK_COLOR
  }

  function validate(name: string, color: string, ignoreId?: string): CategoryResult {
    const clean = name.trim()
    if (!clean) return 'empty-name'
    if (!isValidHex(normalizeHex(color))) return 'invalid-color'
    const taken = categories.value.some(
      (c) => c.id !== ignoreId && c.name.toLowerCase() === clean.toLowerCase(),
    )
    return taken ? 'duplicate' : 'ok'
  }

  function create(name: string, color: string): CategoryResult {
    const result = validate(name, color)
    if (result !== 'ok') return result
    const clean = name.trim().slice(0, CATEGORY_NAME_MAX)
    let id = slug(clean) || 'categoria'
    while (byId(id)) id += '-1'
    save([
      ...categories.value,
      {
        id,
        name: clean,
        color: normalizeHex(color),
        active: true,
        createdAt: new Date().toISOString(),
      },
    ])
    return 'ok'
  }

  /**
   * Altera nome e cor. Devolve o nome anterior para que os chamados com essa
   * categoria sejam atualizados junto.
   */
  function update(
    id: string,
    name: string,
    color: string,
  ): { result: CategoryResult; previousName?: string } {
    const current = byId(id)
    if (!current) return { result: 'not-found' }
    const result = validate(name, color, id)
    if (result !== 'ok') return { result }
    const clean = name.trim().slice(0, CATEGORY_NAME_MAX)
    save(
      categories.value.map((c) =>
        c.id === id ? { ...c, name: clean, color: normalizeHex(color) } : c,
      ),
    )
    return { result: 'ok', previousName: current.name }
  }

  function setActive(id: string, isActive: boolean) {
    save(categories.value.map((c) => (c.id === id ? { ...c, active: isActive } : c)))
  }

  function remove(id: string) {
    save(categories.value.filter((c) => c.id !== id))
  }

  return { categories, active, byId, colorOf, validate, create, update, setActive, remove }
})
