import { onBeforeUnmount, ref, watch } from 'vue'

// Largura da barra lateral: a pessoa pode arrastar a borda, usar as setas do teclado,
// dar duplo clique para voltar ao padrão ou recolher o menu (só ícones).
// A preferência fica salva neste navegador.

export const SIDEBAR_DEFAULT = 256
export const SIDEBAR_MIN = 220
export const SIDEBAR_MAX = 380
export const SIDEBAR_COLLAPSED = 76
const KEY_STEP = 16
const STORAGE_KEY = 'centraldesk:sidebar'

const clamp = (value: number) => Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, Math.round(value)))

function load(): { width: number; collapsed: boolean } {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    return {
      width: typeof saved.width === 'number' ? clamp(saved.width) : SIDEBAR_DEFAULT,
      collapsed: saved.collapsed === true,
    }
  } catch {
    return { width: SIDEBAR_DEFAULT, collapsed: false }
  }
}

export function useSidebarSize() {
  const saved = load()
  const width = ref(saved.width)
  const collapsed = ref(saved.collapsed)
  const resizing = ref(false)

  watch([width, collapsed], () => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ width: width.value, collapsed: collapsed.value }),
      )
    } catch {
      // Sem armazenamento (ex.: janela anônima): a preferência só não fica salva.
    }
  })

  let startX = 0
  let startWidth = 0

  function onPointerMove(event: PointerEvent) {
    width.value = clamp(startWidth + (event.clientX - startX))
  }

  function stopResize() {
    resizing.value = false
    document.body.classList.remove('is-resizing-sidebar')
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', stopResize)
    window.removeEventListener('pointercancel', stopResize)
  }

  /** Começa a arrastar a borda da barra. */
  function startResize(event: PointerEvent) {
    if (collapsed.value || event.button !== 0) return
    event.preventDefault()
    startX = event.clientX
    startWidth = width.value
    resizing.value = true
    document.body.classList.add('is-resizing-sidebar')
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', stopResize)
    window.addEventListener('pointercancel', stopResize)
  }

  /** Setas mudam a largura; Home/End vão ao mínimo/máximo; Enter volta ao padrão. */
  function onKeydown(event: KeyboardEvent) {
    const actions: Record<string, () => number> = {
      ArrowLeft: () => width.value - KEY_STEP,
      ArrowRight: () => width.value + KEY_STEP,
      Home: () => SIDEBAR_MIN,
      End: () => SIDEBAR_MAX,
      Enter: () => SIDEBAR_DEFAULT,
    }
    const next = actions[event.key]
    if (!next) return
    event.preventDefault()
    width.value = clamp(next())
  }

  function resetWidth() {
    width.value = SIDEBAR_DEFAULT
  }

  function toggleCollapsed() {
    collapsed.value = !collapsed.value
  }

  onBeforeUnmount(stopResize)

  return { width, collapsed, resizing, startResize, onKeydown, resetWidth, toggleCollapsed }
}
