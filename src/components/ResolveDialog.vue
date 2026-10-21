<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import FormField from './FormField.vue'
import { RESOLUTION_LIMITS, type TicketResolution } from '@/stores/tickets'

// Janela "Encerrar chamado": descrição (resumo) e comentário (detalhes) são obrigatórios.

const props = defineProps<{ open: boolean; ticketNumber: string }>()
const emit = defineEmits<{ close: []; confirm: [resolution: TicketResolution] }>()

const dialogEl = ref<HTMLDialogElement | null>(null)
const summary = ref('')
const details = ref('')
const attempted = ref(false)

const errors = computed(() => {
  if (!attempted.value) return { summary: '', details: '' }
  return {
    summary:
      summary.value.trim().length >= RESOLUTION_LIMITS.summaryMin
        ? ''
        : `Escreva um resumo do que foi feito (mínimo de ${RESOLUTION_LIMITS.summaryMin} caracteres).`,
    details:
      details.value.trim().length >= RESOLUTION_LIMITS.detailsMin
        ? ''
        : `Detalhe o que foi feito até a conclusão (mínimo de ${RESOLUTION_LIMITS.detailsMin} caracteres).`,
  }
})

watch(
  () => props.open,
  async (open) => {
    if (!dialogEl.value) return
    if (open) {
      summary.value = ''
      details.value = ''
      attempted.value = false
      if (!dialogEl.value.open) dialogEl.value.showModal()
      await nextTick()
      dialogEl.value.querySelector<HTMLElement>('input, textarea')?.focus()
    } else if (dialogEl.value.open) {
      dialogEl.value.close()
    }
  },
  { flush: 'post' },
)

function submit() {
  attempted.value = true
  if (errors.value.summary || errors.value.details) return
  emit('confirm', { summary: summary.value, details: details.value })
}
</script>

<template>
  <dialog ref="dialogEl" class="resolve" aria-labelledby="resolve-title" @close="emit('close')">
    <form class="resolve__form" novalidate @submit.prevent="submit">
      <header class="resolve__head">
        <div>
          <h2 id="resolve-title">Encerrar chamado {{ ticketNumber }}</h2>
          <p>
            Registre o que foi feito. Os dois campos são obrigatórios e ficam visíveis no chamado.
          </p>
        </div>
        <button type="button" class="resolve__close" title="Fechar" @click="emit('close')">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
          <span class="sr-only">Fechar</span>
        </button>
      </header>

      <div class="resolve__body">
        <FormField
          v-model="summary"
          label="Descrição"
          placeholder="Resumo do que foi feito. Ex.: Atualização do Windows desfeita."
          :maxlength="RESOLUTION_LIMITS.summaryMax"
          show-count
          :error="errors.summary"
        >
          <template #hint>Resumo do que foi feito, em uma frase.</template>
        </FormField>

        <FormField
          v-model="details"
          label="Comentário"
          type="textarea"
          :rows="6"
          placeholder="Detalhe o que foi feito até a conclusão: diagnóstico, passos realizados, testes e orientações ao solicitante."
          :maxlength="RESOLUTION_LIMITS.detailsMax"
          show-count
          :error="errors.details"
        >
          <template #hint>Detalhe o que foi feito até o momento da conclusão.</template>
        </FormField>
      </div>

      <footer class="resolve__foot">
        <button type="button" class="btn btn--secondary" @click="emit('close')">Cancelar</button>
        <button type="submit" class="btn btn--primary">Encerrar chamado</button>
      </footer>
    </form>
  </dialog>
</template>

<style scoped>
.resolve {
  width: min(600px, calc(100vw - 32px));
  padding: 0;
  overflow: hidden;
  border: 0;
  border-radius: 20px;
  color: var(--text);
  box-shadow: 0 24px 60px rgba(7, 26, 87, 0.25);
}

.resolve::backdrop {
  background: rgba(7, 26, 87, 0.45);
}

.resolve__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 22px 24px 18px;
  border-bottom: 1px solid var(--card-border);
}

.resolve__head h2 {
  color: var(--navy-800);
  font-size: 1.25rem;
  font-weight: 800;
}

.resolve__head p {
  margin-top: 4px;
  color: var(--text-muted);
  font-size: 0.875rem;
  line-height: 1.45;
}

.resolve__close {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  width: 38px;
  height: 38px;
  padding: 0;
  border: 0;
  border-radius: 10px;
  background: #eef1f6;
  color: var(--navy-800);
  cursor: pointer;
}

.resolve__close svg {
  width: 18px;
  height: 18px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2.2;
  stroke-linecap: round;
}

.resolve__body {
  display: grid;
  gap: 20px;
  padding: 22px 24px;
}

.resolve__foot {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 16px 24px;
  border-top: 1px solid var(--card-border);
  background: #f8f9fc;
}
</style>
