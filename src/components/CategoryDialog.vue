<script setup lang="ts">
import { computed, nextTick, ref, useId, watch } from 'vue'
import {
  CATEGORY_ERRORS,
  CATEGORY_NAME_MAX,
  CATEGORY_PRESETS,
  isValidHex,
  normalizeHex,
  useCategoriesStore,
  type Category,
} from '@/stores/categories'
import { useTicketsStore } from '@/stores/tickets'

// Janela "Nova categoria" / "Editar categoria".

const props = defineProps<{
  open: boolean
  /** Categoria em edição; sem ela, a janela cria uma nova. */
  category?: Category | null
}>()

const emit = defineEmits<{ close: []; saved: [message: string] }>()

const store = useCategoriesStore()
const tickets = useTicketsStore()

const dialogEl = ref<HTMLDialogElement | null>(null)
const nameInput = ref<HTMLInputElement | null>(null)
const nameId = useId()
const hexId = useId()

const name = ref('')
const color = ref<string>(CATEGORY_PRESETS[0])
const hexInput = ref<string>(CATEGORY_PRESETS[0])
const error = ref('')

const customInput = ref<HTMLInputElement | null>(null)

const isEdit = computed(() => !!props.category)
/** Cor escolhida fora das 8 sugestões (pelo botão "Outra cor" ou pelo hexadecimal). */
const isCustom = computed(() => !(CATEGORY_PRESETS as readonly string[]).includes(color.value))
const hexValid = computed(() => isValidHex(normalizeHex(hexInput.value)))
const previewName = computed(() => name.value.trim() || 'Nome da categoria')

watch(
  () => props.open,
  async (open) => {
    if (!dialogEl.value) return
    if (open) {
      name.value = props.category?.name ?? ''
      color.value = props.category?.color ?? CATEGORY_PRESETS[1]
      hexInput.value = color.value
      error.value = ''
      if (!dialogEl.value.open) dialogEl.value.showModal()
      await nextTick()
      nameInput.value?.focus()
    } else if (dialogEl.value.open) {
      dialogEl.value.close()
    }
  },
  { flush: 'post' },
)

function pick(preset: string) {
  color.value = preset
  hexInput.value = preset
}

/** Abre o seletor de cores completo do navegador. */
function openPicker() {
  const input = customInput.value
  if (!input) return
  try {
    input.showPicker()
  } catch {
    input.click()
  }
}

function onCustomColor(event: Event) {
  pick(normalizeHex((event.target as HTMLInputElement).value))
  error.value = ''
}

// Contraste da cor com o fundo branco das listas (fórmula da WCAG).
function contrastWithWhite(hex: string): number {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  const luminance = 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5)
  return 1.05 / (luminance + 0.05)
}

/** Cores muito claras quase somem no fundo branco: avisamos, mas não bloqueamos. */
const tooLight = computed(() => isValidHex(color.value) && contrastWithWhite(color.value) < 2)

// O campo hexadecimal muda a cor assim que vira um código válido.
watch(hexInput, (value) => {
  if (isValidHex(normalizeHex(value))) color.value = normalizeHex(value)
})

function save() {
  if (!hexValid.value) {
    error.value = CATEGORY_ERRORS['invalid-color']
    return
  }
  if (props.category) {
    const { result, previousName } = store.update(props.category.id, name.value, color.value)
    if (result !== 'ok') {
      error.value = CATEGORY_ERRORS[result]
      return
    }
    if (previousName) tickets.renameCategory(previousName, name.value.trim())
    emit('saved', `Categoria "${name.value.trim()}" atualizada.`)
  } else {
    const result = store.create(name.value, color.value)
    if (result !== 'ok') {
      error.value = CATEGORY_ERRORS[result]
      return
    }
    emit('saved', `Categoria "${name.value.trim()}" criada. Ela já aparece ao abrir chamados.`)
  }
}
</script>

<template>
  <dialog ref="dialogEl" class="cat-dialog" aria-labelledby="cat-title" @close="emit('close')">
    <form class="cat-dialog__form" novalidate @submit.prevent="save">
      <header class="cat-dialog__head">
        <h2 id="cat-title">{{ isEdit ? 'Editar categoria' : 'Nova categoria' }}</h2>
        <button type="button" class="cat-dialog__close" title="Fechar" @click="emit('close')">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
          <span class="sr-only">Fechar</span>
        </button>
      </header>

      <div class="cat-dialog__body">
        <div class="field">
          <div class="field__top">
            <label :for="nameId">Nome</label>
            <span class="field__count" aria-hidden="true">
              {{ name.length }} / {{ CATEGORY_NAME_MAX }}
            </span>
          </div>
          <input
            :id="nameId"
            ref="nameInput"
            v-model="name"
            class="input"
            :maxlength="CATEGORY_NAME_MAX"
            placeholder="Ex.: Telefonia"
            @input="error = ''"
          />
        </div>

        <fieldset class="field">
          <legend>Cor</legend>
          <div class="swatches">
            <button
              v-for="preset in CATEGORY_PRESETS"
              :key="preset"
              type="button"
              class="swatch"
              :class="{ 'swatch--selected': color === preset }"
              :style="{ background: preset }"
              :aria-pressed="color === preset"
              :title="preset"
              @click="pick(preset)"
            >
              <span class="sr-only">Cor {{ preset }}</span>
            </button>

            <button
              type="button"
              class="swatch swatch--custom"
              :class="{ 'swatch--selected': isCustom }"
              :style="isCustom ? { background: color } : undefined"
              :aria-pressed="isCustom"
              title="Outra cor"
              @click="openPicker"
            >
              <svg v-if="!isCustom" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 6v12M6 12h12" />
              </svg>
              <span class="sr-only">Outra cor</span>
            </button>
            <input
              ref="customInput"
              type="color"
              class="color-input"
              tabindex="-1"
              aria-hidden="true"
              :value="isValidHex(color) ? color.toLowerCase() : '#000000'"
              @input="onCustomColor"
            />
          </div>
          <p class="swatches__hint">
            Escolha uma das cores ou clique em <strong>+</strong> para qualquer outra cor.
          </p>
          <div class="hex">
            <label :for="hexId">Hexadecimal</label>
            <input
              :id="hexId"
              v-model="hexInput"
              class="input input--mono"
              :class="{ 'input--invalid': !hexValid }"
              maxlength="7"
              spellcheck="false"
              autocomplete="off"
              @input="error = ''"
            />
          </div>
        </fieldset>

        <p v-if="tooLight" class="warning" role="status">
          Essa cor é muito clara e pode ficar difícil de ver no fundo branco das listas.
        </p>

        <div class="preview">
          <p class="preview__label">Pré-visualização</p>
          <p class="preview__row">
            <span class="chip">
              <span class="chip__square" :style="{ background: color }" />
              {{ previewName }}
            </span>
            como aparece nas listas de chamados
          </p>
        </div>

        <p v-if="error" class="cat-dialog__error" role="alert">{{ error }}</p>
      </div>

      <footer class="cat-dialog__foot">
        <button type="button" class="btn btn--secondary" @click="emit('close')">Cancelar</button>
        <button type="submit" class="btn btn--primary">Salvar categoria</button>
      </footer>
    </form>
  </dialog>
</template>

<style scoped>
.cat-dialog {
  width: min(512px, calc(100vw - 32px));
  padding: 0;
  overflow: hidden;
  border: 0;
  border-radius: 20px;
  color: var(--text);
  box-shadow: 0 24px 60px rgba(7, 26, 87, 0.25);
}

.cat-dialog::backdrop {
  background: rgba(7, 26, 87, 0.45);
}

.cat-dialog__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid var(--card-border);
}

.cat-dialog__head h2 {
  font-size: 1.25rem;
  font-weight: 800;
  color: var(--navy-800);
}

.cat-dialog__close {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  padding: 0;
  border: 0;
  border-radius: 10px;
  background: #eef1f6;
  color: var(--navy-800);
  cursor: pointer;
}

.cat-dialog__close:hover {
  background: #e3e7ef;
}

.cat-dialog__close svg {
  width: 18px;
  height: 18px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2.2;
  stroke-linecap: round;
}

.cat-dialog__body {
  display: grid;
  gap: 22px;
  padding: 24px;
}

.field {
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}

.field__top {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 8px;
}

.field label,
.field legend {
  padding: 0;
  color: var(--text);
  font-size: 0.875rem;
  font-weight: 700;
}

.field legend {
  margin-bottom: 10px;
}

.field__count {
  color: var(--text-soft);
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
}

.input {
  width: 100%;
  height: 46px;
  padding: 0 14px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: #fff;
  color: var(--text);
  font-size: 0.9375rem;
}

.input:focus {
  outline: none;
  border-color: var(--navy-700);
  box-shadow: 0 0 0 3px rgba(20, 47, 128, 0.15);
}

.input--mono {
  font-family: ui-monospace, 'Cascadia Mono', Consolas, monospace;
  letter-spacing: 0.02em;
  text-transform: uppercase;
}

.input--invalid {
  border-color: var(--error);
}

.swatches {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.swatch {
  width: 42px;
  height: 42px;
  padding: 0;
  border: 0;
  border-radius: 10px;
  cursor: pointer;
  transition: transform 0.1s;
}

.swatch:hover {
  transform: scale(1.05);
}

.swatch:focus-visible {
  outline: 2px solid var(--navy-700);
  outline-offset: 2px;
}

.swatch--custom {
  position: relative;
  display: grid;
  place-items: center;
  background: conic-gradient(
    #e34948,
    #eda100,
    #16a34a,
    #0891b2,
    #2563eb,
    #7c3aed,
    #db2777,
    #e34948
  );
}

.swatch--custom svg {
  width: 22px;
  height: 22px;
  padding: 3px;
  border-radius: 50%;
  background: #fff;
  fill: none;
  stroke: var(--navy-800);
  stroke-width: 2.6;
  stroke-linecap: round;
}

/* O seletor nativo fica escondido; quem abre é o botão "Outra cor". */
.color-input {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  border: 0;
  opacity: 0;
  pointer-events: none;
}

.swatches {
  position: relative;
}

.swatches__hint {
  margin-top: 8px;
  color: var(--text-muted);
  font-size: 0.75rem;
}

.warning {
  padding: 10px 12px;
  border: 1px solid #f3dfa8;
  border-radius: 10px;
  background: #fdf6e3;
  color: #8a5a00;
  font-size: 0.8125rem;
}

.swatch--selected {
  box-shadow:
    0 0 0 3px #fff,
    0 0 0 5px var(--navy-800);
}

.hex {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 14px;
}

.hex label {
  color: var(--text-muted);
  font-weight: 500;
}

.hex .input {
  width: 156px;
}

.preview {
  padding: 16px;
  border-radius: 12px;
  background: #f4f6fa;
}

.preview__label {
  margin-bottom: 10px;
  color: var(--text-muted);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.preview__row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  color: var(--text-muted);
  font-size: 0.8125rem;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  max-width: 100%;
  padding: 5px 10px;
  border: 1px solid var(--card-border);
  border-radius: 8px;
  background: #fff;
  color: var(--navy-800);
  font-size: 0.875rem;
  font-weight: 600;
  overflow-wrap: anywhere;
}

.chip__square {
  width: 10px;
  height: 10px;
  flex-shrink: 0;
  border-radius: 2px;
}

.cat-dialog__error {
  color: var(--error);
  font-size: 0.875rem;
}

.cat-dialog__foot {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 16px 24px;
  border-top: 1px solid var(--card-border);
  background: #f8f9fc;
}
</style>
