<script setup lang="ts">
import { computed, ref, useId } from 'vue'

const props = withDefaults(
  defineProps<{
    label: string
    type?: 'text' | 'email' | 'password' | 'select'
    placeholder?: string
    autocomplete?: string
    inputmode?: 'text' | 'numeric' | 'email'
    maxlength?: number
    /** Opções da lista quando `type` é 'select'. */
    options?: readonly string[]
    error?: string
  }>(),
  {
    type: 'text',
    placeholder: undefined,
    autocomplete: undefined,
    inputmode: undefined,
    maxlength: undefined,
    options: () => [],
    error: '',
  },
)

const model = defineModel<string>({ required: true })

const id = useId()
const messageId = `${id}-message`
const showPassword = ref(false)
const inputType = computed(() =>
  props.type === 'password' && showPassword.value ? 'text' : props.type,
)
</script>

<template>
  <div class="field" :class="{ 'field--error': error }">
    <label :for="id" class="field__label">{{ label }}</label>
    <div class="field__control">
      <select
        v-if="type === 'select'"
        :id="id"
        v-model="model"
        class="field__input field__select"
        :class="{ 'field__select--empty': !model }"
        :autocomplete="autocomplete"
        :aria-invalid="error ? 'true' : undefined"
        :aria-describedby="error ? messageId : undefined"
      >
        <option value="" disabled>{{ placeholder ?? 'Selecione' }}</option>
        <option v-for="option in options" :key="option" :value="option">{{ option }}</option>
      </select>
      <input
        v-else
        :id="id"
        v-model="model"
        class="field__input"
        :type="inputType"
        :placeholder="placeholder"
        :autocomplete="autocomplete"
        :inputmode="inputmode"
        :maxlength="maxlength"
        :aria-invalid="error ? 'true' : undefined"
        :aria-describedby="error || $slots.hint ? messageId : undefined"
      />
      <button
        v-if="type === 'password'"
        type="button"
        class="field__toggle"
        :aria-label="showPassword ? 'Ocultar senha' : 'Mostrar senha'"
        :aria-pressed="showPassword"
        @click="showPassword = !showPassword"
      >
        <svg v-if="!showPassword" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
        <svg v-else viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3 3l18 18" />
          <path d="M10.6 5.1A10.6 10.6 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4.1" />
          <path d="M6.6 6.6C3.8 8.4 2 12 2 12s3.6 7 10 7a9.7 9.7 0 0 0 5.4-1.6" />
          <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
        </svg>
      </button>
    </div>
    <p v-if="error" :id="messageId" class="field__error" role="alert">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="9.5" />
        <path d="M12 7.5v5.5M12 16.2v.3" />
      </svg>
      {{ error }}
    </p>
    <div v-else-if="$slots.hint" :id="messageId" class="field__hint">
      <slot name="hint" />
    </div>
  </div>
</template>

<style scoped>
.field__label {
  display: block;
  margin-bottom: 8px;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text);
}

.field__control {
  position: relative;
}

.field__input {
  width: 100%;
  height: 48px;
  padding: 0 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: #fff;
  color: var(--text);
  font-size: 0.9375rem;
  transition:
    border-color 0.15s,
    box-shadow 0.15s;
}

.field__input::placeholder {
  color: var(--text-soft);
}

.field__input:focus {
  outline: none;
  border-color: var(--navy-700);
  box-shadow: 0 0 0 3px rgba(20, 47, 128, 0.15);
}

.field__select {
  padding-right: 40px;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%230b2269' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
  background-position: right 14px center;
  background-repeat: no-repeat;
  background-size: 16px;
  cursor: pointer;
}

.field__select--empty {
  color: var(--text-soft);
}

.field__control:has(.field__toggle) .field__input {
  padding-right: 48px;
}

.field--error .field__input {
  border-color: var(--error);
}

.field--error .field__input:focus {
  box-shadow: 0 0 0 3px rgba(214, 57, 58, 0.15);
}

.field__toggle {
  position: absolute;
  top: 50%;
  right: 8px;
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  transform: translateY(-50%);
}

.field__toggle:hover {
  background: #f0f2f7;
}

.field__toggle:focus-visible {
  outline: 2px solid var(--navy-700);
  outline-offset: 1px;
}

.field__toggle svg,
.field__error svg {
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.field__toggle svg {
  width: 20px;
  height: 20px;
}

.field__error {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  font-size: 0.8125rem;
  color: var(--error);
}

.field__error svg {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.field__hint {
  margin-top: 8px;
  font-size: 0.8125rem;
  color: var(--text-muted);
}
</style>
