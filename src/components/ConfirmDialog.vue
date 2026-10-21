<script setup lang="ts">
import { ref, watch } from 'vue'

// Janela de confirmação/escolha reutilizável (usa o <dialog> nativo do navegador,
// que já cuida do foco e da tecla Esc).

const props = withDefaults(
  defineProps<{
    open: boolean
    title: string
    confirmLabel?: string
    danger?: boolean
    confirmDisabled?: boolean
  }>(),
  { confirmLabel: 'Confirmar', danger: false, confirmDisabled: false },
)

const emit = defineEmits<{ confirm: []; close: [] }>()

const dialogEl = ref<HTMLDialogElement | null>(null)

watch(
  () => props.open,
  (open) => {
    if (!dialogEl.value) return
    if (open && !dialogEl.value.open) dialogEl.value.showModal()
    if (!open && dialogEl.value.open) dialogEl.value.close()
  },
  { flush: 'post' },
)
</script>

<template>
  <dialog ref="dialogEl" class="dialog" @close="emit('close')" @cancel="emit('close')">
    <form method="dialog" class="dialog__body" @submit.prevent="emit('confirm')">
      <h2 class="dialog__title">{{ title }}</h2>
      <div class="dialog__content"><slot /></div>
      <div class="dialog__actions">
        <button type="button" class="btn btn--secondary" @click="emit('close')">Cancelar</button>
        <button
          type="submit"
          class="btn"
          :class="danger ? 'btn--danger' : 'btn--primary'"
          :disabled="confirmDisabled"
        >
          {{ confirmLabel }}
        </button>
      </div>
    </form>
  </dialog>
</template>

<style scoped>
.dialog {
  width: min(440px, calc(100vw - 32px));
  padding: 0;
  border: 0;
  border-radius: 16px;
  color: var(--text);
  box-shadow: 0 24px 60px rgba(7, 26, 87, 0.25);
}

.dialog::backdrop {
  background: rgba(7, 26, 87, 0.45);
}

.dialog__body {
  padding: 28px;
}

.dialog__title {
  font-size: 1.25rem;
  font-weight: 800;
  color: var(--navy-800);
}

.dialog__content {
  margin-top: 12px;
  color: var(--text-muted);
  font-size: 0.9375rem;
  line-height: 1.55;
}

.dialog__actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 24px;
}

.btn--danger {
  border: 0;
  background: var(--error);
  color: #fff;
}

.btn--danger:hover {
  background: #b92c2d;
}

.dialog__actions .btn:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}
</style>
